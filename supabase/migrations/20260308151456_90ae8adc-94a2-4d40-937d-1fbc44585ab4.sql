-- Create guide_follows table (the only missing table from Epic 0)
CREATE TABLE public.guide_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  followed_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, followed_id),
  CHECK (follower_id != followed_id)
);

-- Enable RLS
ALTER TABLE public.guide_follows ENABLE ROW LEVEL SECURITY;

-- Users can manage their own follows
CREATE POLICY "Users manage own follows" ON public.guide_follows FOR ALL USING (auth.uid() = follower_id);

-- Users can see who follows them
CREATE POLICY "Users can see who follows them" ON public.guide_follows FOR SELECT USING (auth.uid() = followed_id);

-- Indexes
CREATE INDEX idx_guide_follows_follower ON public.guide_follows(follower_id);
CREATE INDEX idx_guide_follows_followed ON public.guide_follows(followed_id);