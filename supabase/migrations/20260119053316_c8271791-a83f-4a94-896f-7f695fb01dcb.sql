-- Create table to track user enrichment data and feedback
CREATE TABLE public.user_enrichment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  enrichment_type TEXT NOT NULL, -- 'destination_decline', 'preference_feedback', 'trip_feedback'
  entity_type TEXT, -- 'destination', 'activity', 'experience_type'
  entity_id TEXT, -- destination city/country, activity id, etc.
  entity_name TEXT, -- human readable name
  feedback_reason TEXT, -- why they declined/didn't like it
  feedback_tags TEXT[], -- categorized reasons like ['too_expensive', 'wrong_climate']
  decline_count INTEGER DEFAULT 1, -- how many times declined
  suppress_until TIMESTAMP WITH TIME ZONE, -- don't suggest again until this date
  is_permanent_suppress BOOLEAN DEFAULT false, -- never suggest again
  metadata JSONB DEFAULT '{}', -- additional context
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_enrichment ENABLE ROW LEVEL SECURITY;

-- Users can only see their own enrichment data
CREATE POLICY "Users can view own enrichment data"
ON public.user_enrichment FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own enrichment data
CREATE POLICY "Users can insert own enrichment data"
ON public.user_enrichment FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own enrichment data
CREATE POLICY "Users can update own enrichment data"
ON public.user_enrichment FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_user_enrichment_user_type ON public.user_enrichment(user_id, enrichment_type);
CREATE INDEX idx_user_enrichment_entity ON public.user_enrichment(user_id, entity_type, entity_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_enrichment_updated_at
BEFORE UPDATE ON public.user_enrichment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();