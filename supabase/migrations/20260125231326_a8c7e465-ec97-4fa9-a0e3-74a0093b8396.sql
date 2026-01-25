-- Phase 5: Personalization Tag Learning Table
-- Tracks effectiveness of personalization tags based on user actions (swap/skip/save/complete)

CREATE TABLE public.personalization_tag_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag TEXT NOT NULL,
  destination TEXT, -- Optional: track per-destination (NULL = global)
  
  -- Action counts
  shown_count INTEGER DEFAULT 0,      -- How many times activities with this tag were shown
  saved_count INTEGER DEFAULT 0,      -- User explicitly saved/starred the activity
  completed_count INTEGER DEFAULT 0,  -- Activity was kept through trip completion
  swapped_count INTEGER DEFAULT 0,    -- User swapped out for alternative
  skipped_count INTEGER DEFAULT 0,    -- Activity was removed/skipped
  
  -- Derived metrics (updated periodically)
  retention_rate NUMERIC(5,4) DEFAULT 0, -- (saved + completed) / shown
  rejection_rate NUMERIC(5,4) DEFAULT 0, -- (swapped + skipped) / shown
  
  -- Time tracking
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Composite unique constraint
  UNIQUE(tag, destination)
);

-- Index for common queries
CREATE INDEX idx_personalization_tag_stats_tag ON public.personalization_tag_stats(tag);
CREATE INDEX idx_personalization_tag_stats_destination ON public.personalization_tag_stats(destination);
CREATE INDEX idx_personalization_tag_stats_retention ON public.personalization_tag_stats(retention_rate DESC);

-- Enable RLS
ALTER TABLE public.personalization_tag_stats ENABLE ROW LEVEL SECURITY;

-- Public read access (aggregate data, no user PII)
CREATE POLICY "Anyone can read tag stats"
  ON public.personalization_tag_stats
  FOR SELECT
  USING (true);

-- Only service role can write (edge functions)
CREATE POLICY "Service role can manage tag stats"
  ON public.personalization_tag_stats
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add personalization_tags column to activity_feedback for richer tracking
ALTER TABLE public.activity_feedback 
ADD COLUMN IF NOT EXISTS personalization_tags TEXT[] DEFAULT '{}';

-- Add action_type to user_enrichment for swap/skip/save tracking
ALTER TABLE public.user_enrichment
ADD COLUMN IF NOT EXISTS action_type TEXT;

COMMENT ON TABLE public.personalization_tag_stats IS 'Aggregated statistics on personalization tag effectiveness based on user behavior';
COMMENT ON COLUMN public.personalization_tag_stats.retention_rate IS 'Percentage of activities with this tag that were kept (saved + completed)';
COMMENT ON COLUMN public.personalization_tag_stats.rejection_rate IS 'Percentage of activities with this tag that were rejected (swapped + skipped)';