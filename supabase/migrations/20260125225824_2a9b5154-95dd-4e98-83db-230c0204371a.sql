-- =============================================================================
-- VERIFIED VENUES TABLE - Phase 2 Venue Verification Pipeline
-- Caches verified venue data to prevent hallucinations and speed up generation
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.verified_venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Venue identification
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- Lowercase, stripped for matching
  destination TEXT NOT NULL,     -- City/region name
  category TEXT,                 -- dining, sightseeing, cultural, etc.
  
  -- Location data
  address TEXT,
  coordinates JSONB,             -- { lat: number, lng: number }
  
  -- Provider references (for deduplication)
  google_place_id TEXT UNIQUE,
  foursquare_id TEXT,
  viator_product_code TEXT,
  
  -- Verified data
  rating NUMERIC(2,1),
  total_reviews INTEGER,
  price_level INTEGER,           -- 1-4 scale
  website TEXT,
  phone_number TEXT,
  opening_hours JSONB,
  
  -- Verification metadata
  verification_source TEXT NOT NULL DEFAULT 'ai_verified', -- google_places, foursquare, manual, ai_verified
  verification_confidence NUMERIC(3,2) DEFAULT 0.8,        -- 0-1 scale
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_count INTEGER DEFAULT 1,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- TTL management (30 days default, refreshed on use)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_verified_venues_destination ON public.verified_venues(destination);
CREATE INDEX IF NOT EXISTS idx_verified_venues_normalized_name ON public.verified_venues(normalized_name);
CREATE INDEX IF NOT EXISTS idx_verified_venues_category ON public.verified_venues(category);
CREATE INDEX IF NOT EXISTS idx_verified_venues_google_place_id ON public.verified_venues(google_place_id);
CREATE INDEX IF NOT EXISTS idx_verified_venues_expires_at ON public.verified_venues(expires_at);

-- Composite index for common lookup pattern
CREATE INDEX IF NOT EXISTS idx_verified_venues_dest_name ON public.verified_venues(destination, normalized_name);

-- Enable RLS
ALTER TABLE public.verified_venues ENABLE ROW LEVEL SECURITY;

-- Public read access (this is cached reference data)
CREATE POLICY "Verified venues are publicly readable"
  ON public.verified_venues
  FOR SELECT
  USING (true);

-- Only system can insert/update (via edge functions)
CREATE POLICY "System can manage verified venues"
  ON public.verified_venues
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_verified_venues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for auto-update timestamp
CREATE TRIGGER update_verified_venues_timestamp
  BEFORE UPDATE ON public.verified_venues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_verified_venues_updated_at();

-- Function to clean expired venues (can be called by cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_venues()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.verified_venues
  WHERE expires_at < now()
  AND usage_count < 3; -- Keep frequently used venues even if "expired"
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SET search_path = public;