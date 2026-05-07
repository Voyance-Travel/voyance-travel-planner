DO $$
DECLARE
  v_trip_id uuid := '38f81fab-c114-4124-bc3a-a7c54ebd79df';
BEGIN
  DELETE FROM public.itinerary_activities
  WHERE trip_id = v_trip_id
    AND lower(title) SIMILAR TO '%(sant''?eustachio|sostanza|antico vinaio)%';

  UPDATE public.itinerary_days
  SET activities = COALESCE(
    (SELECT jsonb_agg(a)
     FROM jsonb_array_elements(activities) a
     WHERE NOT (lower(COALESCE(a->>'title', '')) SIMILAR TO '%(sant''?eustachio|sostanza|antico vinaio)%')),
    '[]'::jsonb
  )
  WHERE trip_id = v_trip_id
    AND activities IS NOT NULL;

  UPDATE public.trips
  SET itinerary_data = jsonb_set(
    itinerary_data,
    '{days}',
    COALESCE((
      SELECT jsonb_agg(
        CASE
          WHEN day ? 'activities' AND jsonb_typeof(day->'activities') = 'array'
          THEN jsonb_set(day, '{activities}', COALESCE(
            (SELECT jsonb_agg(a)
             FROM jsonb_array_elements(day->'activities') a
             WHERE NOT (lower(COALESCE(a->>'title', '')) SIMILAR TO '%(sant''?eustachio|sostanza|antico vinaio)%')),
            '[]'::jsonb
          ))
          ELSE day
        END
      )
      FROM jsonb_array_elements(itinerary_data->'days') day
    ), '[]'::jsonb)
  )
  WHERE id = v_trip_id
    AND itinerary_data IS NOT NULL
    AND itinerary_data ? 'days';
END $$;