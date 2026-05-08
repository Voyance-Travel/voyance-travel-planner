-- Tightens the persist-day scrub trigger (description must not be scanned for
-- placeholder prose; bare (name)/(venue) must not be treated as artifacts) and
-- backfills trips that the prior over-aggressive trigger marked as failed.

CREATE OR REPLACE FUNCTION public.scrub_itinerary_activities(acts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  out_acts jsonb := '[]'::jsonb;
  el jsonb;
  id_blob text;
  full_blob text;
  title text;
  cat text;
  start_time text;
  hh int;
  mm int;
  is_locked boolean;
  src text;
  is_predawn boolean;
  is_ghost_cat boolean;
BEGIN
  IF acts IS NULL OR jsonb_typeof(acts) <> 'array' THEN
    RETURN acts;
  END IF;

  FOR el IN SELECT * FROM jsonb_array_elements(acts)
  LOOP
    is_locked := COALESCE((el->>'locked')::boolean, false)
              OR COALESCE((el->>'is_locked')::boolean, false)
              OR COALESCE((el->>'isLocked')::boolean, false)
              OR (el->>'lock_state') = 'locked';
    src := lower(COALESCE(el->>'source', ''));
    IF is_locked OR src IN ('user','manual','extracted','pinned') THEN
      out_acts := out_acts || jsonb_build_array(el);
      CONTINUE;
    END IF;

    title := COALESCE(el->>'title', el->>'name', '');
    cat   := lower(COALESCE(el->>'category', el->>'type', ''));

    -- IDENTIFIER fields only — description must NEVER be scanned for
    -- placeholder prose ("find a cafe nearby" / "pick a restaurant"
    -- are normal descriptions and were dropping every activity).
    id_blob := concat_ws(' | ',
                el->>'title', el->>'name', el->>'venue_name',
                el#>>'{venue,name}', el#>>'{restaurant,name}', el#>>'{location,name}');

    -- Prompt artifacts may legitimately appear in description, so check
    -- description for those (narrow set: "(slot)", "(<TAG> slot)",
    -- "(placeholder)" — NOT bare "(name)" / "(venue)").
    full_blob := concat_ws(' | ', id_blob, el->>'description');

    IF full_blob ~* '\(\s*([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)\s*\)' THEN
      CONTINUE;
    END IF;

    -- Placeholder PROSE — identifier blob only.
    IF id_blob ~* '(find\s+(a\s+)?(venue|local\s+spot|restaurant|cafe|café|bar|spot))'
       OR id_blob ~* '(pick\s+(a\s+)?(venue|local\s+spot|restaurant|cafe|café|bar|spot))'
       OR id_blob ~* '\bplaceholder\b'
       OR id_blob ~* '\bneeds\s*venue\b'
       OR id_blob ~* 'needsvenuepick'
       OR id_blob ~* 'spa\s+time\s*[—\-:]\s*find'
       OR id_blob ~* '\btbd\b|t\.b\.d\.'
    THEN
      CONTINUE;
    END IF;

    -- Pre-dawn ghost rows.
    start_time := COALESCE(el->>'startTime', el->>'start_time', el->>'time', '');
    IF start_time ~ '^\d{1,2}:\d{2}' THEN
      hh := substring(start_time from '^(\d{1,2}):')::int;
      mm := substring(start_time from '^\d{1,2}:(\d{2})')::int;
      IF lower(start_time) ~ 'pm' AND hh < 12 THEN hh := hh + 12; END IF;
      IF lower(start_time) ~ 'am' AND hh = 12 THEN hh := 0; END IF;
      is_predawn := (hh * 60 + mm) < 300;
    ELSE
      is_predawn := false;
    END IF;

    is_ghost_cat := cat IN (
      'accommodation','hotel','lodging','stay',
      'wellness','spa','relaxation',
      'logistics','transport','transportation','transfer','transit'
    );

    IF is_predawn AND (
      is_ghost_cat
      OR title ~* '(return\s+to|back\s+(to|at)|head\s+back\s+to|head\s+to|wind\s+down\s+at)\s+(your\s+|the\s+|our\s+)?[^,.\n]{0,60}hotel'
      OR title ~* 'hotel\s+(check[-\s]?in|settle\s+in|wind[-\s]?down|nightcap)'
      OR title ~* 'find\s+a\s+venue\s*$'
    ) THEN
      CONTINUE;
    END IF;

    out_acts := out_acts || jsonb_build_array(el);
  END LOOP;

  RETURN out_acts;
END;
$$;

-- One-shot recovery: any trip in the last 48h flagged 'failed' but with
-- non-empty itinerary_days gets its itinerary_data.days rebuilt from the
-- per-day rows and itinerary_status reset to 'ready'.
DO $$
DECLARE
  t RECORD;
  rebuilt jsonb;
BEGIN
  FOR t IN
    SELECT tr.id
    FROM public.trips tr
    WHERE tr.itinerary_status = 'failed'
      AND tr.updated_at > now() - interval '48 hours'
      AND EXISTS (
        SELECT 1 FROM public.itinerary_days d
        WHERE d.trip_id = tr.id AND jsonb_array_length(COALESCE(d.activities, '[]'::jsonb)) > 0
      )
  LOOP
    SELECT jsonb_agg(
             jsonb_build_object(
               'dayNumber', d.day_number,
               'title', d.title,
               'theme', d.theme,
               'description', d.description,
               'date', d.date,
               'activities', COALESCE(d.activities, '[]'::jsonb)
             )
             ORDER BY d.day_number
           )
      INTO rebuilt
      FROM public.itinerary_days d
      WHERE d.trip_id = t.id;

    IF rebuilt IS NOT NULL THEN
      UPDATE public.trips
      SET itinerary_data = jsonb_set(
            COALESCE(itinerary_data, '{}'::jsonb),
            '{days}', rebuilt
          ),
          itinerary_status = 'ready'
      WHERE id = t.id;
    END IF;
  END LOOP;
END;
$$;