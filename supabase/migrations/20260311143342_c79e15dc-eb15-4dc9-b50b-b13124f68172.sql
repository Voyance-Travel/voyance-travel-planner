
CREATE TABLE IF NOT EXISTS public.saved_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES public.community_guides(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, guide_id)
);

ALTER TABLE public.saved_guides ENABLE ROW LEVEL SECURITY;

-- Users can view their own saves
CREATE POLICY "Users can view own saved guides"
  ON public.saved_guides FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own saves
CREATE POLICY "Users can save guides"
  ON public.saved_guides FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own saves
CREATE POLICY "Users can unsave guides"
  ON public.saved_guides FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
