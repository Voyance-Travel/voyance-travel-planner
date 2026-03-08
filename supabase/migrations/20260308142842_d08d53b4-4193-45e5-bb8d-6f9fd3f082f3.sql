
-- Social links table for user profiles
CREATE TABLE public.user_social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- RLS
ALTER TABLE public.user_social_links ENABLE ROW LEVEL SECURITY;

-- Users can read their own links
CREATE POLICY "Users can read own social links"
  ON public.user_social_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own links
CREATE POLICY "Users can insert own social links"
  ON public.user_social_links FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own links
CREATE POLICY "Users can update own social links"
  ON public.user_social_links FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own links
CREATE POLICY "Users can delete own social links"
  ON public.user_social_links FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Public can read social links (for published guides)
CREATE POLICY "Anyone can read social links"
  ON public.user_social_links FOR SELECT
  TO anon
  USING (true);
