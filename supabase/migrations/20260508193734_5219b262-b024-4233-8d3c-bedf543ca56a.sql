CREATE OR REPLACE FUNCTION public.scrub_itinerary_prompt_artifacts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  artifact_re text :=
    '\s*\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
  scrubbed_count int := 0;
  new_days jsonb;
BEGIN
  IF NEW.itinerary_data IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.itinerary_data->'days' IS NULL OR jsonb_typeof(NEW.itinerary_data->'days') <> 'array' THEN
    RETURN NEW;
  END IF;

  WITH days_array AS (
    SELECT ordinality - 1 AS day_idx, value AS day_obj
    FROM jsonb_array_elements(NEW.itinerary_data->'days') WITH ORDINALITY
  ),
  scrubbed_days AS (
    SELECT
      day_idx,
      CASE
        WHEN day_obj->'activities' IS NULL OR jsonb_typeof(day_obj->'activities') <> 'array'
          THEN day_obj
        ELSE jsonb_set(
          day_obj,
          '{activities}',
          (
            SELECT jsonb_agg(
              CASE WHEN jsonb_typeof(act) <> 'object' THEN act ELSE
                act
                  || jsonb_build_object(
                       'title',
                       CASE WHEN act ? 'title' AND jsonb_typeof(act->'title') = 'string'
                            THEN to_jsonb(regexp_replace(act->>'title', artifact_re, '', 'gi'))
                            ELSE act->'title' END,
                       'name',
                       CASE WHEN act ? 'name' AND jsonb_typeof(act->'name') = 'string'
                            THEN to_jsonb(regexp_replace(act->>'name', artifact_re, '', 'gi'))
                            ELSE act->'name' END,
                       'description',
                       CASE WHEN act ? 'description' AND jsonb_typeof(act->'description') = 'string'
                            THEN to_jsonb(regexp_replace(act->>'description', artifact_re, '', 'gi'))
                            ELSE act->'description' END
                     )
              END
            )
            FROM jsonb_array_elements(day_obj->'activities') AS act
          )
        )
      END AS new_day_obj,
      (
        SELECT count(*)::int
        FROM jsonb_array_elements(COALESCE(day_obj->'activities', '[]'::jsonb)) AS act
        WHERE jsonb_typeof(act) = 'object' AND (
          (act->>'title') ~* artifact_re OR
          (act->>'name') ~* artifact_re OR
          (act->>'description') ~* artifact_re
        )
      ) AS hits
    FROM days_array
  )
  SELECT
    jsonb_agg(new_day_obj ORDER BY day_idx),
    COALESCE(SUM(hits), 0)::int
  INTO new_days, scrubbed_count
  FROM scrubbed_days;

  IF scrubbed_count > 0 THEN
    RAISE NOTICE '[scrub_itinerary_prompt_artifacts] trip=% scrubbed % field(s)', NEW.id, scrubbed_count;
    NEW.itinerary_data := jsonb_set(NEW.itinerary_data, '{days}', new_days);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trips_scrub_prompt_artifacts ON public.trips;

CREATE TRIGGER trips_scrub_prompt_artifacts
  BEFORE INSERT OR UPDATE OF itinerary_data ON public.trips
  FOR EACH ROW
  WHEN (NEW.itinerary_data IS NOT NULL)
  EXECUTE FUNCTION public.scrub_itinerary_prompt_artifacts();

COMMENT ON FUNCTION public.scrub_itinerary_prompt_artifacts() IS
  'Last-gate scrub of prompt-artifact tokens (FLEX_WINDOW, INTEREST_SLOT, (slot), (AESTHETIC slot), etc.) from trips.itinerary_data.days[].activities[]. Belt-and-braces complement to the client-side persistTripItinerary boundary; never blocks a write, only mutates dirty strings in place.';