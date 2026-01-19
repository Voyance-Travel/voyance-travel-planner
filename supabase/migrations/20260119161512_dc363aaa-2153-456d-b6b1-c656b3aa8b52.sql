-- =====================================================
-- Geocoding Cache Table
-- Reduces repeated Google Geocoding API calls
-- =====================================================

CREATE TABLE public.geocoding_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_key TEXT NOT NULL UNIQUE, -- normalized address + destination hash
  address TEXT NOT NULL,
  destination TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  formatted_address TEXT,
  place_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '90 days')
);

-- Index for fast lookups
CREATE INDEX idx_geocoding_cache_query_key ON public.geocoding_cache(query_key);
CREATE INDEX idx_geocoding_cache_expires ON public.geocoding_cache(expires_at);

-- Enable RLS (public read for efficiency, no user-specific data)
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (geocoding is shared data)
CREATE POLICY "Anyone can read geocoding cache" ON public.geocoding_cache
  FOR SELECT USING (true);

-- Add comment for documentation
COMMENT ON TABLE public.geocoding_cache IS 'Caches Google Geocoding API responses to reduce API costs. Entries expire after 90 days.';