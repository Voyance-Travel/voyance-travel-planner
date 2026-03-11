
-- 1. Add new columns to guide_sections for editable activity cards
ALTER TABLE public.guide_sections 
  ADD COLUMN IF NOT EXISTS user_experience TEXT,
  ADD COLUMN IF NOT EXISTS user_rating INTEGER,
  ADD COLUMN IF NOT EXISTS recommended TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- 2. Add moderation_status to community_guides
ALTER TABLE public.community_guides 
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';

-- 3. Create guide_activity_reviews table for future aggregation
CREATE TABLE IF NOT EXISTS public.guide_activity_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES public.community_guides(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_name TEXT NOT NULL,
  activity_category TEXT,
  destination_city TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  recommended BOOLEAN,
  experience_text TEXT,
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_reviews_destination ON public.guide_activity_reviews(destination_city);
CREATE INDEX IF NOT EXISTS idx_activity_reviews_activity ON public.guide_activity_reviews(activity_name);

-- RLS for guide_activity_reviews
ALTER TABLE public.guide_activity_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read guide activity reviews"
  ON public.guide_activity_reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert own reviews"
  ON public.guide_activity_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.guide_activity_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.guide_activity_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create guide-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('guide-photos', 'guide-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read
CREATE POLICY "Public read access for guide photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'guide-photos');

-- Storage RLS: authenticated upload to own path
CREATE POLICY "Authenticated users can upload guide photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'guide-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: owner delete
CREATE POLICY "Users can delete own guide photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'guide-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
