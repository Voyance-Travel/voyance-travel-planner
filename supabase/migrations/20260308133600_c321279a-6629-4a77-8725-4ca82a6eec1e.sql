
-- Guide favorites: users bookmark specific activities from their trips
CREATE TABLE public.guide_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.trip_activities(id) ON DELETE CASCADE,
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

ALTER TABLE public.guide_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own guide favorites"
  ON public.guide_favorites
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_guide_favorites_trip ON public.guide_favorites(trip_id);
CREATE INDEX idx_guide_favorites_user_trip ON public.guide_favorites(user_id, trip_id);

-- Community guides: compiled shareable guides from trip favorites
CREATE TABLE public.community_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  destination TEXT,
  destination_country TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  slug TEXT UNIQUE,
  content JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_guides ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Users can manage their own guides"
  ON public.community_guides
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Anyone can view published guides
CREATE POLICY "Anyone can view published guides"
  ON public.community_guides
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE INDEX idx_community_guides_user ON public.community_guides(user_id);
CREATE INDEX idx_community_guides_trip ON public.community_guides(trip_id);
CREATE INDEX idx_community_guides_status ON public.community_guides(status);
