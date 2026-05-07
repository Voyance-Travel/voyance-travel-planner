-- One-time scrub: remove "ghost" activities from persisted itinerary_data.
-- Two predicates only (mirrors src/lib/itinerary/hideGhostActivities.ts):
--   A. title ~* 'find a venue\s*$'   (legacy "Spa Time — find a venue" placeholder)
--   B. title ~* 'return.*hotel|back.*hotel' AND start hour < 5  (pre-dawn return ghost)
-- Skips activities marked is_locked / source IN ('user','manual','extracted','pinned').

CREATE OR REPLACE FUNCTION public._scrub_ghost_activities_jsonb(p_itinerary jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  days jsonb;
  new_days jsonb := '[]'::jsonb;
  d jsonb;
  acts jsonb;
  new_acts jsonb;
  a jsonb;
  ttl text;
  src text;
  st text;
  st_h int;
  is_predawn_hotel boolean;
  is_wellness_ph boolean;
  is_locked boolean;
BEGIN
  IF p_itinerary IS NULL OR jsonb_typeof(p_itinerary) <> 'object' THEN
    RETURN p_itinerary;
  END IF;
  days := p_itinerary -> 'days';
  IF days IS NULL OR jsonb_typeof(days) <> 'array' THEN
    RETURN p_itinerary;
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(days) LOOP
    acts := d -> 'activities';
    IF acts IS NULL OR jsonb_typeof(acts) <> 'array' THEN
      new_days := new_days || jsonb_build_array(d);
      CONTINUE;
    END IF;
    new_acts := '[]'::jsonb;
    FOR a IN SELECT * FROM jsonb_array_elements(acts) LOOP
      ttl := COALESCE(a->>'title', a->>'name', '');
      src := lower(COALESCE(a->>'source', ''));
      is_locked := COALESCE((a->>'is_locked')::boolean, (a->>'isLocked')::boolean, false);

      IF is_locked OR src IN ('user', 'manual', 'extracted', 'pinned') THEN
        new_acts := new_acts || jsonb_build_array(a);
        CONTINUE;
      END IF;

      is_wellness_ph := ttl ~* 'find a venue\s*$';

      st := COALESCE(a->>'startTime', a->>'start_time', a->>'time');
      is_predawn_hotel := false;
      IF ttl ~* '(return\s+to\s+(your\s+)?[^,]*hotel|back\s+to\s+(the\s+)?hotel)' AND st IS NOT NULL THEN
        BEGIN
          st_h := substring(st from '^([0-9]{1,2})')::int;
          IF st_h IS NOT NULL AND st_h < 5 THEN
            is_predawn_hotel := true;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          is_predawn_hotel := false;
        END;
      END IF;

      IF is_wellness_ph OR is_predawn_hotel THEN
        -- drop
        CONTINUE;
      END IF;

      new_acts := new_acts || jsonb_build_array(a);
    END LOOP;
    new_days := new_days || jsonb_build_array(jsonb_set(d, '{activities}', new_acts));
  END LOOP;

  RETURN jsonb_set(p_itinerary, '{days}', new_days);
END;
$$;

UPDATE public.trips
SET itinerary_data = public._scrub_ghost_activities_jsonb(itinerary_data)
WHERE itinerary_data IS NOT NULL
  AND (
    itinerary_data::text ~* 'find a venue'
    OR itinerary_data::text ~* 'return.*your hotel'
    OR itinerary_data::text ~* 'return.*hotel'
  );

DROP FUNCTION public._scrub_ghost_activities_jsonb(jsonb);