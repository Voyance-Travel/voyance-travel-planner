
-- Add image_url column to attractions table for cross-user photo sharing
ALTER TABLE public.attractions ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_url column to activities table for cross-user photo sharing
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index for fast lookups by destination + name (used in photo cross-share queries)
CREATE INDEX IF NOT EXISTS idx_attractions_dest_name ON public.attractions (destination_id, name);
CREATE INDEX IF NOT EXISTS idx_activities_dest_name ON public.activities (destination_id, name);
