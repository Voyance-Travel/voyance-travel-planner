UPDATE public.trips
SET metadata = (metadata::jsonb
                - 'generation_failure_reason'
                - 'empty_itinerary_detected_at')
WHERE itinerary_status = 'ready'
  AND COALESCE((metadata->>'fully_persisted')::boolean, false) = true
  AND (metadata ? 'generation_failure_reason'
       OR metadata ? 'empty_itinerary_detected_at');