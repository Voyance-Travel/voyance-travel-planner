UPDATE public.trips
SET itinerary_status = 'ready',
    metadata = metadata - 'failed_day_numbers'
WHERE itinerary_status = 'partial'
  AND metadata ? 'itinerary_frozen_at'
  AND itinerary_data ? 'days'
  AND jsonb_typeof(itinerary_data->'days') = 'array'
  AND jsonb_array_length(itinerary_data->'days') > 0
  AND (
    SELECT bool_and(
      jsonb_typeof(coalesce(d->'activities','[]'::jsonb)) = 'array'
      AND jsonb_array_length(coalesce(d->'activities','[]'::jsonb)) >= 3
    )
    FROM jsonb_array_elements(itinerary_data->'days') d
  );