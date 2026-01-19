-- Create curated_images table for caching high-quality venue photos
CREATE TABLE public.curated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'activity', 'destination', 'hotel', 'landmark'
  entity_key TEXT NOT NULL,  -- normalized venue name or destination slug
  destination TEXT,          -- optional: city/country for context
  source TEXT NOT NULL,      -- 'google_places', 'tripadvisor', 'wikimedia', 'manual', 'ai_generated'
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  alt_text TEXT,
  attribution TEXT,          -- required for Wikimedia, optional for others
  quality_score FLOAT,       -- AI-assigned 0-1 score for ranking
  photo_reference TEXT,      -- Google Places photo_reference for refresh
  place_id TEXT,             -- Google Places place_id
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,    -- optional TTL for cache invalidation
  UNIQUE(entity_type, entity_key, destination)
);

-- Create index for fast lookups
CREATE INDEX idx_curated_images_lookup ON public.curated_images(entity_type, entity_key);
CREATE INDEX idx_curated_images_destination ON public.curated_images(destination);
CREATE INDEX idx_curated_images_source ON public.curated_images(source);

-- Enable RLS
ALTER TABLE public.curated_images ENABLE ROW LEVEL SECURITY;

-- Public read access (images are public content)
CREATE POLICY "Anyone can view curated images"
ON public.curated_images
FOR SELECT
USING (true);

-- Only service role can insert/update (edge functions)
CREATE POLICY "Service role can manage curated images"
ON public.curated_images
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER update_curated_images_updated_at
BEFORE UPDATE ON public.curated_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();