UPDATE public.trips
SET itinerary_status = 'not_started',
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'generation_started_at', NULL,
        'generation_heartbeat', NULL,
        'generation_error', NULL,
        'chain_error', NULL,
        'chain_error_at', NULL,
        'generation_completed_days', 0,
        'fully_persisted', false,
        'unstuck_at', to_jsonb(now()),
        'unstuck_reason', 'self_duplicate_guard_fix_2026_05_25b'
      )
WHERE id = 'e4217b97-34b6-4de4-a842-2200db6f5f73';