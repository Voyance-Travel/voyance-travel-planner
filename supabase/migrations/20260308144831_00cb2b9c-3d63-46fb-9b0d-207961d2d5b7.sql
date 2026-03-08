
-- Content links table for community guides (YouTube, Instagram, Patreon, etc.)
CREATE TABLE public.guide_content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.community_guides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  day_number INTEGER,
  activity_id TEXT,
  activity_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_content_links ENABLE ROW LEVEL SECURITY;

-- Owner can CRUD
CREATE POLICY "Users can manage own content links"
  ON public.guide_content_links FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Public can read content links for published guides
CREATE POLICY "Anyone can read content links for published guides"
  ON public.guide_content_links FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_guides cg
      WHERE cg.id = guide_content_links.guide_id
      AND cg.status = 'published'
    )
  );
