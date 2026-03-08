
-- Creator follows table
CREATE TABLE public.creator_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, creator_id)
);

-- Enable RLS
ALTER TABLE public.creator_follows ENABLE ROW LEVEL SECURITY;

-- Users can see their own follows
CREATE POLICY "Users can view own follows"
  ON public.creator_follows
  FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid());

-- Users can follow creators
CREATE POLICY "Users can follow creators"
  ON public.creator_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

-- Users can unfollow
CREATE POLICY "Users can unfollow"
  ON public.creator_follows
  FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());
