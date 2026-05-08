CREATE OR REPLACE FUNCTION public._scrub_itinerary_prompt_artifacts(p_itin jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  artifact_re text := '\s*\(\s*([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)\s*\)';
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

-- Re-run recovery for trips that the previous broken trigger emptied.
DO $$
DECLARE
  t RECORD;
  rebuilt jsonb;
BEGIN
  FOR t IN
    SELECT tr.id
    FROM public.trips tr
    WHERE tr.updated_at > now() - interval '72 hours'
      AND jsonb_array_length(COALESCE(tr.itinerary_data->'days', '[]'::jsonb)) = 0
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
      SET itinerary_data = jsonb_set(COALESCE(itinerary_data, '{}'::jsonb), '{days}', rebuilt),
          itinerary_status = 'ready'
      WHERE id = t.id;
    END IF;
  END LOOP;
END;
$$;