
-- Add hero_image_url column to destinations table
ALTER TABLE public.destinations ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_destinations_hero_image ON public.destinations (city) WHERE hero_image_url IS NOT NULL;
