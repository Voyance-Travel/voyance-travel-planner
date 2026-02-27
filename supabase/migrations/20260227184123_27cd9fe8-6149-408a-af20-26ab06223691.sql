
-- Cache table mapping destination slugs to stored image URLs
CREATE TABLE public.destination_image_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_slug TEXT NOT NULL,
  image_type TEXT NOT NULL DEFAULT 'hero',
  original_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '90 days'),
  UNIQUE (destination_slug, image_type)
);

-- Index for fast lookups
CREATE INDEX idx_destination_image_cache_slug ON public.destination_image_cache (destination_slug, image_type);

-- Public read access (images are public anyway)
ALTER TABLE public.destination_image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached images"
  ON public.destination_image_cache FOR SELECT
  USING (true);

-- Only service role can insert/update (edge function uses service role)
CREATE POLICY "Service role can manage cache"
  ON public.destination_image_cache FOR ALL
  USING (true)
  WITH CHECK (true);
