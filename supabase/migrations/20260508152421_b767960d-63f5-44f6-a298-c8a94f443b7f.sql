CREATE OR REPLACE FUNCTION public._scrub_itinerary_prompt_artifacts(p_itin jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  -- Two alternatives:
  --   (a) labelled prompt slots: "(... slot)" / "(... placeholder)"
  --   (b) bare ALLCAPS-with-underscore tokens: "(FLEX_WINDOW)", "(NARRATIVE_MOOD)"
  -- Underscore in (b) prevents stripping legit acronyms like (USA) / (NYC).
  artifact_re text := '\s*\(\s*(([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
BEGIN
  IF p_itin IS NULL OR jsonb_typeof(p_itin) <> 'object' THEN
    RETURN p_itin;
  END IF;
  IF p_itin->'days' IS NULL OR jsonb_typeof(p_itin->'days') <> 'array' THEN
    RETURN p_itin;
  END IF;

  RETURN jsonb_set(
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
      FROM jsonb_array_elements(p_itin->'days') day
    )
  );
END;
$function$;

-- One-shot scrub of recently-saved trips so the (FLEX_WINDOW) leak goes away
-- without forcing a regenerate. trips.itinerary_data first, then the
-- per-day activities table.
DO $$
DECLARE
  artifact_re text := '\s*\(\s*(([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
BEGIN
  UPDATE public.trips tr
  SET itinerary_data = public._scrub_itinerary_prompt_artifacts(tr.itinerary_data)
  WHERE tr.updated_at > now() - interval '14 days'
    AND tr.itinerary_data IS NOT NULL
    AND tr.itinerary_data::text ~ artifact_re;

  UPDATE public.itinerary_days d
  SET activities = (
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
    FROM jsonb_array_elements(d.activities) act
  )
  WHERE d.updated_at > now() - interval '14 days'
    AND d.activities IS NOT NULL
    AND jsonb_typeof(d.activities) = 'array'
    AND d.activities::text ~ artifact_re;
END;
$$;