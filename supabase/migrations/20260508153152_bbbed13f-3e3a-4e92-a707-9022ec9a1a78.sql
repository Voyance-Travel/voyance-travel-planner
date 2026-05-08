-- Pure text-strip helper: scrubs prompt-artifact tokens from title/name/
-- description on each activity in a JSONB array. Never drops rows.
CREATE OR REPLACE FUNCTION public._strip_prompt_artifacts_in_activities(acts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  artifact_re text := '\s*\(\s*(([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
BEGIN
  IF acts IS NULL OR jsonb_typeof(acts) <> 'array' THEN
    RETURN acts;
  END IF;

  RETURN (
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
    FROM jsonb_array_elements(acts) act
  );
END;
$function$;

-- Wire the strip into the existing per-day trigger BEFORE the row-drop pass so
-- forced-interest activities keep their place but lose the dirty token.
CREATE OR REPLACE FUNCTION public.itinerary_days_scrub_activities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.activities IS NOT NULL AND jsonb_typeof(NEW.activities) = 'array' THEN
    NEW.activities := public._strip_prompt_artifacts_in_activities(NEW.activities);
    NEW.activities := public.scrub_itinerary_activities(NEW.activities);
  END IF;
  RETURN NEW;
END;
$function$;

-- One-shot backfill: scrub already-saved rows from the last 14 days.
DO $$
DECLARE
  artifact_re text := '\s*\(\s*(([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
BEGIN
  UPDATE public.itinerary_days d
  SET activities = public._strip_prompt_artifacts_in_activities(d.activities)
  WHERE d.updated_at > now() - interval '14 days'
    AND d.activities IS NOT NULL
    AND jsonb_typeof(d.activities) = 'array'
    AND d.activities::text ~ artifact_re;

  UPDATE public.trips tr
  SET itinerary_data = public._scrub_itinerary_prompt_artifacts(tr.itinerary_data)
  WHERE tr.updated_at > now() - interval '14 days'
    AND tr.itinerary_data IS NOT NULL
    AND tr.itinerary_data::text ~ artifact_re;
END;
$$;