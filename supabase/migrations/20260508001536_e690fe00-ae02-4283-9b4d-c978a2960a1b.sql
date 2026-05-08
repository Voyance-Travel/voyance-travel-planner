-- Final safety-net scrub trigger on itinerary_days.activities (jsonb).
-- Mirrors src/lib/itinerary/persistDayContract.ts + supabase/functions/_shared/persist-day-contract.ts:
--   - drops elements whose title/name/venue_name/description/location.name match the placeholder family
--   - drops pre-dawn (00:00–04:59) hotel/accommodation/wellness/return-to-hotel rows
--   - skips locked rows / source IN (user, manual, extracted, pinned)

CREATE OR REPLACE FUNCTION public.scrub_itinerary_activities(acts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  out_acts jsonb := '[]'::jsonb;
  el jsonb;
  blob text;
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
    -- Locked / user-sourced rows pass through untouched (universal locking).
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
    blob  := concat_ws(' | ',
              el->>'title', el->>'name', el->>'venue_name', el->>'description',
              el#>>'{venue,name}', el#>>'{restaurant,name}', el#>>'{location,name}');

    -- Placeholder / prompt-artifact family (case-insensitive).
    IF blob ~* '(find\s+(a\s+)?(venue|local\s+spot|restaurant|cafe|café|bar|spot))'
       OR blob ~* '(pick\s+(a\s+)?(venue|local\s+spot|restaurant|cafe|café|bar|spot))'
       OR blob ~* '\(\s*([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|aesthetic\s+slot|placeholder|name|venue)\s*\)'
       OR blob ~* '\bplaceholder\b'
       OR blob ~* '\bneeds\s*venue\b'
       OR blob ~* 'needsvenuepick'
       OR blob ~* 'spa\s+time\s*[—\-:]\s*find'
       OR blob ~* '\btbd\b|t\.t\.t\.'
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

CREATE OR REPLACE FUNCTION public.itinerary_days_scrub_activities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.activities IS NOT NULL AND jsonb_typeof(NEW.activities) = 'array' THEN
    NEW.activities := public.scrub_itinerary_activities(NEW.activities);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS itinerary_days_scrub_activities_trg ON public.itinerary_days;
CREATE TRIGGER itinerary_days_scrub_activities_trg
  BEFORE INSERT OR UPDATE OF activities ON public.itinerary_days
  FOR EACH ROW
  EXECUTE FUNCTION public.itinerary_days_scrub_activities();

-- Also scrub trips.itinerary_data.days[*].activities on every write so any
-- future helper that bypasses persistTripItinerary still cannot leak.
CREATE OR REPLACE FUNCTION public.trips_scrub_itinerary_days()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  days jsonb;
  new_days jsonb := '[]'::jsonb;
  d jsonb;
  cleaned jsonb;
BEGIN
  IF NEW.itinerary_data IS NULL OR jsonb_typeof(NEW.itinerary_data) <> 'object' THEN
    RETURN NEW;
  END IF;
  days := NEW.itinerary_data->'days';
  IF days IS NULL OR jsonb_typeof(days) <> 'array' THEN
    RETURN NEW;
  END IF;
  FOR d IN SELECT * FROM jsonb_array_elements(days)
  LOOP
    IF d ? 'activities' AND jsonb_typeof(d->'activities') = 'array' THEN
      cleaned := public.scrub_itinerary_activities(d->'activities');
      new_days := new_days || jsonb_build_array(jsonb_set(d, '{activities}', cleaned));
    ELSE
      new_days := new_days || jsonb_build_array(d);
    END IF;
  END LOOP;
  NEW.itinerary_data := jsonb_set(NEW.itinerary_data, '{days}', new_days);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trips_scrub_itinerary_days_trg ON public.trips;
CREATE TRIGGER trips_scrub_itinerary_days_trg
  BEFORE INSERT OR UPDATE OF itinerary_data ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trips_scrub_itinerary_days();