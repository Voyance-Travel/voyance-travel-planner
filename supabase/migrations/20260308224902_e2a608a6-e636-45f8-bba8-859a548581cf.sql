
-- Add user ownership and trip linkage to the existing guides table
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guide_type TEXT DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS archetype TEXT,
  ADD COLUMN IF NOT EXISTS vibe_tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add check constraints separately (IF NOT EXISTS not supported for constraints)
DO $$ BEGIN
  ALTER TABLE public.guides ADD CONSTRAINT guides_guide_type_check CHECK (guide_type IN ('editorial', 'user'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.guides ADD CONSTRAINT guides_status_check CHECK (status IN ('draft', 'published', 'flagged', 'removed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create guide_sections table
CREATE TABLE IF NOT EXISTS public.guide_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  section_type TEXT NOT NULL CHECK (section_type IN ('day_overview', 'activity', 'recommendation', 'tip', 'freeform')),
  title TEXT NOT NULL,
  body TEXT,
  linked_day_number INTEGER,
  linked_activity_id UUID,
  activity_title TEXT,
  activity_category TEXT,
  activity_location TEXT,
  activity_tips TEXT,
  activity_rating NUMERIC,
  activity_cost TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS on guide_sections
ALTER TABLE public.guide_sections ENABLE ROW LEVEL SECURITY;

-- Drop old read-only policy on guides
DROP POLICY IF EXISTS "Guides are publicly readable" ON public.guides;

-- Users can read all published guides + their own drafts
CREATE POLICY "Users can read published guides and own drafts" ON public.guides
  FOR SELECT USING (
    published = true
    OR (guide_type = 'user' AND user_id = auth.uid())
    OR guide_type = 'editorial'
  );

-- Users can create their own guides
CREATE POLICY "Users can create guides" ON public.guides
  FOR INSERT WITH CHECK (guide_type = 'user' AND user_id = auth.uid());

-- Users can update their own guides
CREATE POLICY "Users can update own guides" ON public.guides
  FOR UPDATE USING (guide_type = 'user' AND user_id = auth.uid());

-- Users can delete their own guides
CREATE POLICY "Users can delete own guides" ON public.guides
  FOR DELETE USING (guide_type = 'user' AND user_id = auth.uid());

-- Guide sections: users can manage sections of their own guides, read sections of published guides
CREATE POLICY "Users can manage sections of own guides" ON public.guide_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.guides
      WHERE guides.id = guide_sections.guide_id
      AND (guides.user_id = auth.uid() OR guides.published = true)
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guides_community ON public.guides(guide_type, status, destination_city)
  WHERE guide_type = 'user' AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_guides_user ON public.guides(user_id) WHERE guide_type = 'user';
CREATE INDEX IF NOT EXISTS idx_guide_sections_guide ON public.guide_sections(guide_id, sort_order);
