
CREATE TABLE public.trip_blogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  cover_image_url TEXT,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  social_links JSONB DEFAULT '[]'::jsonb,
  slug TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  destination TEXT,
  trip_dates TEXT,
  traveler_count INTEGER DEFAULT 1,
  trip_duration_days INTEGER,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_trip_blogs_slug ON trip_blogs(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_trip_blogs_user ON trip_blogs(user_id, created_at DESC);
CREATE INDEX idx_trip_blogs_trip ON trip_blogs(trip_id);

ALTER TABLE trip_blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blogs" ON trip_blogs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read published blogs" ON trip_blogs
  FOR SELECT USING (status = 'published');
