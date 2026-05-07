-- Repair descriptions damaged by the legacy over-greedy TEXT_SCHEMA_LEAK regex
-- which stripped bare words like "city" from prose. Targets activity descriptions
-- only; leaves locked / user / extracted / pinned / manual items untouched.
CREATE OR REPLACE FUNCTION public._repair_schema_leak_prose_jsonb(node jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  result jsonb;
  k text;
  v jsonb;
  arr jsonb := '[]'::jsonb;
  el jsonb;
  desc_text text;
  fixed text;
  is_locked boolean;
BEGIN
  IF node IS NULL THEN RETURN node; END IF;

  IF jsonb_typeof(node) = 'array' THEN
    FOR el IN SELECT * FROM jsonb_array_elements(node) LOOP
      arr := arr || jsonb_build_array(public._repair_schema_leak_prose_jsonb(el));
    END LOOP;
    RETURN arr;
  ELSIF jsonb_typeof(node) = 'object' THEN
    result := '{}'::jsonb;
    -- detect lock flags on the activity object
    is_locked :=
      coalesce((node->>'locked')::boolean, false)
      OR coalesce((node->>'isLocked')::boolean, false)
      OR coalesce((node->>'pinned')::boolean, false)
      OR coalesce((node->>'isPinned')::boolean, false)
      OR coalesce((node->>'userAdded')::boolean, false)
      OR coalesce((node->>'isUserAdded')::boolean, false)
      OR coalesce((node->>'manual')::boolean, false)
      OR coalesce((node->>'extracted')::boolean, false);

    FOR k, v IN SELECT * FROM jsonb_each(node) LOOP
      IF k = 'description' AND jsonb_typeof(v) = 'string' AND NOT is_locked THEN
        desc_text := v #>> '{}';
        fixed := desc_text;
        fixed := regexp_replace(fixed, '\m(see|view|explore|experience|enjoy|admire|photograph) the from the\M', '\1 the city from the', 'gi');
        fixed := regexp_replace(fixed, '\m(in|of|across|over|through|around|from) the from the\M', '\1 the city from the', 'gi');
        fixed := regexp_replace(fixed, '\mthe from the (water|street|streets|river|canal|canals|sea|sky|air|ground|inside|outside|rooftop|rooftops|hilltop|hilltops|harbor|harbour|lagoon|coast)\M', 'the city from the \1', 'gi');
        result := result || jsonb_build_object(k, to_jsonb(fixed));
      ELSE
        result := result || jsonb_build_object(k, public._repair_schema_leak_prose_jsonb(v));
      END IF;
    END LOOP;
    RETURN result;
  ELSE
    RETURN node;
  END IF;
END;
$$;

UPDATE public.trips
SET itinerary_data = public._repair_schema_leak_prose_jsonb(itinerary_data)
WHERE itinerary_data::text ~* '\mthe from the (water|street|river|canal|sea|sky|air|ground|inside|outside|rooftop|hilltop|harbor|harbour|lagoon|coast)\M';

DROP FUNCTION public._repair_schema_leak_prose_jsonb(jsonb);