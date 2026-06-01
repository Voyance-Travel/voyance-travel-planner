UPDATE public.trips
SET
  itinerary_status = 'ready',
  metadata = metadata
    || jsonb_build_object(
      'generation_failure_reason', null,
      'empty_itinerary_detected_at', null,
      'incomplete_backfill_v2_at', now()
    )
WHERE itinerary_status = 'failed'
  AND metadata->>'generation_failure_reason' = 'incomplete_itinerary'
  AND metadata->>'itinerary_frozen_at' IS NOT NULL;