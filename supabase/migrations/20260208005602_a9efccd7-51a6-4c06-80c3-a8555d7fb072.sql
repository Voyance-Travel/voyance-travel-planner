
-- Add fields to trip_suggestions for activity replacement proposals
ALTER TABLE public.trip_suggestions
  ADD COLUMN IF NOT EXISTS target_activity_id TEXT,
  ADD COLUMN IF NOT EXISTS target_activity_title TEXT,
  ADD COLUMN IF NOT EXISTS replacement_reason TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.trip_suggestions.target_activity_id IS 'ID of the itinerary activity being proposed for replacement';
COMMENT ON COLUMN public.trip_suggestions.target_activity_title IS 'Title of the activity being replaced (for display)';
COMMENT ON COLUMN public.trip_suggestions.replacement_reason IS 'Reason the proposer wants to replace this activity';
