-- C-COST-5: generic response cache for Google geocode / routes / distance-matrix.
-- These callers (airport-transfers, route-details, transit-estimate, transfer-pricing,
-- venue-enrichment) had NO caching, so identical lookups hit Google every time.
-- A response between two fixed coordinates (distance/duration) is stable, so caching
-- by a hash of the request inputs is safe and does not change transit-buffer logic.
CREATE TABLE IF NOT EXISTS public.google_api_response_cache (
  cache_key   text PRIMARY KEY,
  sku         text NOT NULL,
  response_data jsonb NOT NULL,
  hit_count   integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_garc_expires ON public.google_api_response_cache (expires_at);

-- Service-role only (edge functions use the service-role key, which bypasses RLS).
-- No policies are defined, so anon/authenticated have no access.
ALTER TABLE public.google_api_response_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.google_api_response_cache IS
  'C-COST-5: generic Google API response cache (geocode/routes/distance-matrix), keyed by a hash of request inputs. Service-role only.';
