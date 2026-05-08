-- Final last-gate scrub for trips.itinerary_data prompt artifacts.
-- Even if a code path bypasses the persist-day contract, the DB itself
-- will strip "(slot)" / "(AESTHETIC slot)" / "(... slot)" tokens from
-- activity titles/names/descriptions before the row is committed.

CREATE OR REPLACE FUNCTION public._scrub_itinerary_prompt_artifacts(p_itin jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result jsonb;
  artifact_re text := '\s*\(\s*([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder|name|venue)\s*\)';
BEGIN
  IF p_itin IS NULL OR jsonb_typeof(p_itin) <> 'object' THEN
    RETURN p_itin;
  END IF;

  IF p_itin->'days' IS NULL OR jsonb_typeof(p_itin->'days') <> 'array' THEN
    RETURN p_itin;
  END IF;

  result := jsonb_set(
    p_itin,
    '{days}',
    (
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN day ? 'activities' AND jsonb_typeof(day->'activities') = 'array' THEN
            jsonb_set(day, '{activities}', (
              SELECT coalesce(jsonb_agg(
                CASE
                  WHEN jsonb_typeof(act) = 'object' THEN
                    act
                    || (CASE WHEN act ? 'title' AND jsonb_typeof(act->'title') = 'string'
                             THEN jsonb_build_object('title', trim(regexp_replace(regexp_replace(act->>'title', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                             ELSE '{}'::jsonb END)
                    || (CASE WHEN act ? 'name' AND jsonb_typeof(act->'name') = 'string'
                             THEN jsonb_build_object('name', trim(regexp_replace(regexp_replace(act->>'name', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                             ELSE '{}'::jsonb END)
                    || (CASE WHEN act ? 'description' AND jsonb_typeof(act->'description') = 'string'
                             THEN jsonb_build_object('description', trim(regexp_replace(regexp_replace(act->>'description', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                             ELSE '{}'::jsonb END)
                  ELSE act
                END
              ), '[]'::jsonb)
              FROM jsonb_array_elements(day->'activities') act
            ))
          ELSE day
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(result->'days') day
    )
  );

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public._trips_scrub_itinerary_artifacts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.itinerary_data IS NOT NULL THEN
    NEW.itinerary_data := public._scrub_itinerary_prompt_artifacts(NEW.itinerary_data);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trips_scrub_artifacts ON public.trips;
CREATE TRIGGER trips_scrub_artifacts
BEFORE INSERT OR UPDATE OF itinerary_data ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public._trips_scrub_itinerary_artifacts();

-- One-time backfill: clean already-persisted artifacts
UPDATE public.trips
SET itinerary_data = public._scrub_itinerary_prompt_artifacts(itinerary_data)
WHERE itinerary_data IS NOT NULL
  AND itinerary_data::text ~* '\(\s*([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder|name|venue)\s*\)';