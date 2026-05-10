ALTER TABLE public.trip_cost_tracking
  ADD COLUMN IF NOT EXISTS token_source TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS is_cache_hit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attempt_id   UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS retry_of     UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_place_details_calls INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_trip_cost_tracking_cache_hit
  ON public.trip_cost_tracking (is_cache_hit) WHERE is_cache_hit = true;

CREATE INDEX IF NOT EXISTS idx_trip_cost_tracking_retry_of
  ON public.trip_cost_tracking (retry_of) WHERE retry_of IS NOT NULL;