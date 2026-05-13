UPDATE public.trips
SET metadata = metadata - 'persist_validation'
WHERE itinerary_status = 'ready'
  AND metadata ? 'persist_validation'
  AND COALESCE((metadata->'persist_validation'->>'ok')::boolean, true) = false;