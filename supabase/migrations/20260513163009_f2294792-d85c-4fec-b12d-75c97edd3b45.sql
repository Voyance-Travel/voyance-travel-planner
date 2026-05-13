DELETE FROM public.itinerary_activities
WHERE category IN ('accommodation', 'stay')
  AND (
    title  ~* '\sfor\s+Check\s*$'
    OR name ~* '\sfor\s+Check\s*$'
  );

UPDATE public.trips
SET itinerary_data = (
  SELECT jsonb_set(
    itinerary_data,
    '{days}',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_set(
          day_obj,
          '{activities}',
          COALESCE((
            SELECT jsonb_agg(act)
            FROM jsonb_array_elements(day_obj->'activities') AS act
            WHERE NOT (
              lower(COALESCE(act->>'category', '')) IN ('accommodation', 'stay')
              AND (
                COALESCE(act->>'title', '') ~* '\sfor\s+Check\s*$'
                OR COALESCE(act->>'name', '')  ~* '\sfor\s+Check\s*$'
              )
            )
          ), '[]'::jsonb)
        )
      )
      FROM jsonb_array_elements(itinerary_data->'days') AS day_obj
    ), '[]'::jsonb)
  )
)
WHERE itinerary_data ? 'days'
  AND itinerary_data::text ~* '\sfor\s+Check"';