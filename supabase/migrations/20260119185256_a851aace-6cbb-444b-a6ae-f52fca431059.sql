-- Create search cache table for Amadeus API results
-- TTL: 4 hours for cost control
CREATE TABLE IF NOT EXISTS public.search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_type TEXT NOT NULL CHECK (search_type IN ('flight', 'hotel')),
  search_key TEXT NOT NULL UNIQUE, -- SHA-256 hash of normalized params
  origin TEXT,
  destination TEXT NOT NULL,
  depart_date DATE,
  return_date DATE,
  adults INTEGER DEFAULT 1,
  cabin_class TEXT,
  result_count INTEGER DEFAULT 0,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'amadeus',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours')
);

-- Index for fast lookups by search key
CREATE INDEX IF NOT EXISTS idx_search_cache_key ON public.search_cache(search_key);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON public.search_cache(expires_at);

-- Enable RLS (allow service role only - edge functions use service key)
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Only backend can access this table (no user-facing access)
-- No public policies needed - edge functions use service role key

-- Create function to clean expired cache entries (called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_search_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.search_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permission to authenticated users (for manual cleanup)
GRANT EXECUTE ON FUNCTION public.cleanup_expired_search_cache() TO authenticated;

COMMENT ON TABLE public.search_cache IS 'Cache for Amadeus flight/hotel API results to reduce API costs. TTL: 4 hours.';
COMMENT ON COLUMN public.search_cache.search_key IS 'SHA-256 hash of normalized search parameters for deduplication';
COMMENT ON COLUMN public.search_cache.results IS 'JSONB array of flight or hotel results from Amadeus';