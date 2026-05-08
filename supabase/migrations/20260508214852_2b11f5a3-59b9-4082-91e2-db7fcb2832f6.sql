-- 1. Auto-normalizer trigger on verified_venues
CREATE OR REPLACE FUNCTION public.strip_verified_venue_meal_suffix()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := btrim(regexp_replace(
      NEW.name,
      '\s*\((?:breakfast|lunch|dinner|brunch)\)\s*$',
      '',
      'i'
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verified_venues_strip_meal_suffix ON public.verified_venues;
CREATE TRIGGER verified_venues_strip_meal_suffix
BEFORE INSERT OR UPDATE OF name ON public.verified_venues
FOR EACH ROW
EXECUTE FUNCTION public.strip_verified_venue_meal_suffix();

-- 2. Clean existing rows. Drop suffixed dups whose stripped name collides
--    with an existing row at the same destination, then UPDATE the rest
--    (trigger normalizes via the BEFORE UPDATE path).
WITH targets AS (
  SELECT v.id, v.destination,
         btrim(regexp_replace(v.name, '\s*\((?:breakfast|lunch|dinner|brunch)\)\s*$', '', 'i')) AS clean_name
  FROM public.verified_venues v
  WHERE v.name ~* '\((breakfast|lunch|dinner|brunch)\)\s*$'
),
collisions AS (
  SELECT t.id
  FROM targets t
  JOIN public.verified_venues v2
    ON v2.destination = t.destination
   AND lower(v2.name) = lower(t.clean_name)
   AND v2.id <> t.id
)
DELETE FROM public.verified_venues
WHERE id IN (SELECT id FROM collisions);

UPDATE public.verified_venues
SET name = name  -- trigger does the strip
WHERE name ~* '\((breakfast|lunch|dinner|brunch)\)\s*$';

-- 3. Companion trigger on trips that strips the suffix from itinerary_data
CREATE OR REPLACE FUNCTION public.scrub_itinerary_meal_suffix()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  meal_re text := '\s*\((?:breakfast|lunch|dinner|brunch)\)\s*$';
  new_days jsonb;
BEGIN
  IF NEW.itinerary_data IS NULL THEN RETURN NEW; END IF;
  IF NEW.itinerary_data->'days' IS NULL OR jsonb_typeof(NEW.itinerary_data->'days') <> 'array' THEN
    RETURN NEW;
  END IF;

  WITH days_array AS (
    SELECT ordinality - 1 AS day_idx, value AS day_obj
    FROM jsonb_array_elements(NEW.itinerary_data->'days') WITH ORDINALITY
  ),
  scrubbed AS (
    SELECT day_idx,
      CASE
        WHEN day_obj->'activities' IS NULL OR jsonb_typeof(day_obj->'activities') <> 'array'
          THEN day_obj
        ELSE jsonb_set(day_obj, '{activities}', (
          SELECT jsonb_agg(
            CASE WHEN jsonb_typeof(act) <> 'object' THEN act ELSE
              (CASE
                WHEN act ? 'location' AND jsonb_typeof(act->'location') = 'object'
                     AND act->'location' ? 'name'
                     AND jsonb_typeof(act->'location'->'name') = 'string'
                     AND (act->'location'->>'name') ~* meal_re
                THEN jsonb_set(act, '{location,name}',
                       to_jsonb(btrim(regexp_replace(act->'location'->>'name', meal_re, '', 'i'))))
                ELSE act
              END)
              || jsonb_build_object(
                   'title',
                   CASE WHEN act ? 'title' AND jsonb_typeof(act->'title') = 'string'
                        THEN to_jsonb(btrim(regexp_replace(act->>'title', meal_re, '', 'i')))
                        ELSE act->'title' END,
                   'name',
                   CASE WHEN act ? 'name' AND jsonb_typeof(act->'name') = 'string'
                        THEN to_jsonb(btrim(regexp_replace(act->>'name', meal_re, '', 'i')))
                        ELSE act->'name' END
                 )
            END
          )
          FROM jsonb_array_elements(day_obj->'activities') AS act
        ))
      END AS new_day_obj
    FROM days_array
  )
  SELECT jsonb_agg(new_day_obj ORDER BY day_idx) INTO new_days FROM scrubbed;

  NEW.itinerary_data := jsonb_set(NEW.itinerary_data, '{days}', COALESCE(new_days, '[]'::jsonb));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trips_scrub_meal_suffix ON public.trips;
CREATE TRIGGER trips_scrub_meal_suffix
BEFORE INSERT OR UPDATE OF itinerary_data ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.scrub_itinerary_meal_suffix();

-- 4. One-shot backfill on existing trips with the suffix in JSONB.
UPDATE public.trips
SET itinerary_data = itinerary_data
WHERE itinerary_data::text ~* '\((breakfast|lunch|dinner|brunch)\)';
