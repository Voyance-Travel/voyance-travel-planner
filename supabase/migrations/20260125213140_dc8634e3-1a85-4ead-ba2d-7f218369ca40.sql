-- Create image_votes table to track admin feedback on images
CREATE TABLE public.image_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  entity_type text NOT NULL DEFAULT 'destination',
  entity_key text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('good', 'bad')),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, image_url)
);

-- Enable RLS
ALTER TABLE public.image_votes ENABLE ROW LEVEL SECURITY;

-- Only admins can vote (for now, any authenticated user - can restrict later)
CREATE POLICY "Authenticated users can vote on images"
ON public.image_votes FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_image_votes_url ON public.image_votes (image_url);
CREATE INDEX idx_image_votes_entity ON public.image_votes (entity_type, entity_key);

-- Add vote_score column to curated_images for aggregated scoring
ALTER TABLE public.curated_images 
ADD COLUMN IF NOT EXISTS vote_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS vote_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_blacklisted boolean DEFAULT false;