-- ============================================================================
-- TRAVEL DNA V2 MIGRATION
-- Adds support for archetype blends, contribution tracking, and accuracy events
-- ============================================================================

-- 1. Add travel_dna_v2 JSONB column to travel_dna_profiles
-- This stores the full v2 output while maintaining backward compatibility
ALTER TABLE public.travel_dna_profiles
ADD COLUMN IF NOT EXISTS travel_dna_v2 JSONB DEFAULT NULL;

-- Add version column to distinguish v1 vs v2 profiles
ALTER TABLE public.travel_dna_profiles
ADD COLUMN IF NOT EXISTS dna_version SMALLINT DEFAULT 1;

-- Add trait contributions for transparency ("why" explanations)
ALTER TABLE public.travel_dna_profiles
ADD COLUMN IF NOT EXISTS trait_contributions JSONB DEFAULT NULL;

-- Add archetype blend (top 5 with percentages)
ALTER TABLE public.travel_dna_profiles
ADD COLUMN IF NOT EXISTS archetype_matches JSONB DEFAULT NULL;

-- 2. Add user trait overrides column to profiles table
-- Users can manually adjust their trait scores
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS travel_dna_overrides JSONB DEFAULT NULL;

-- 3. Create voyance_events table for accuracy tracking and analytics
CREATE TABLE IF NOT EXISTS public.voyance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on voyance_events
ALTER TABLE public.voyance_events ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own events
CREATE POLICY "Users can insert their own events"
ON public.voyance_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only view their own events
CREATE POLICY "Users can view their own events"
ON public.voyance_events
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for efficient querying by user and event type
CREATE INDEX IF NOT EXISTS idx_voyance_events_user_id ON public.voyance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_voyance_events_event_name ON public.voyance_events(event_name);
CREATE INDEX IF NOT EXISTS idx_voyance_events_created_at ON public.voyance_events(created_at DESC);

-- 4. Add helpful comments
COMMENT ON COLUMN public.travel_dna_profiles.travel_dna_v2 IS 'Full Travel DNA v2 output including raw scores, contributions, and archetype blends';
COMMENT ON COLUMN public.travel_dna_profiles.dna_version IS 'Version of DNA calculation algorithm: 1=legacy, 2=v2 with blends';
COMMENT ON COLUMN public.travel_dna_profiles.trait_contributions IS 'Array of answer contributions to each trait for transparency';
COMMENT ON COLUMN public.travel_dna_profiles.archetype_matches IS 'Top 5 archetype matches with scores and percentages';
COMMENT ON COLUMN public.profiles.travel_dna_overrides IS 'User-specified trait overrides from refinement UI';
COMMENT ON TABLE public.voyance_events IS 'Analytics events for accuracy tracking and user behavior';

-- 5. Grant necessary permissions
GRANT SELECT, INSERT ON public.voyance_events TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;