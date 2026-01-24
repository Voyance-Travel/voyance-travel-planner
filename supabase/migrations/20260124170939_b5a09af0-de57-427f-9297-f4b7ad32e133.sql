-- Create trip_learnings table for post-trip retrospectives
CREATE TABLE public.trip_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  destination TEXT,
  
  -- Overall trip rating
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  would_return BOOLEAN,
  
  -- What worked well (structured)
  highlights JSONB DEFAULT '[]', -- [{ "category": "dining", "activity": "Trattoria...", "why": "authentic" }]
  pacing_feedback TEXT CHECK (pacing_feedback IN ('too_rushed', 'perfect', 'too_slow', 'varied_needs')),
  accommodation_feedback TEXT CHECK (accommodation_feedback IN ('loved_it', 'good_location', 'would_change', 'too_far')),
  
  -- What didn't work (structured)
  pain_points JSONB DEFAULT '[]', -- [{ "issue": "too crowded", "context": "visited on weekend", "solution": "go weekday" }]
  skipped_activities JSONB DEFAULT '[]', -- [{ "activity": "...", "reason": "tired", "replacement": "..." }]
  
  -- Discovered preferences
  discovered_likes TEXT[], -- Things they discovered they love
  discovered_dislikes TEXT[], -- Things they discovered they don't enjoy
  
  -- AI-generated summary (for chaining to next prompt)
  lessons_summary TEXT, -- AI-summarized learnings for next trip
  
  -- Timing context
  travel_party_notes TEXT, -- "Kids got tired after 4pm", "Partner loved food tours"
  best_time_of_day TEXT CHECK (best_time_of_day IN ('morning_person', 'afternoon_explorer', 'evening_adventurer', 'flexible')),
  
  -- Free-form
  would_change TEXT, -- What they'd do differently
  tips_for_others TEXT, -- Advice for future travelers
  
  -- Metadata
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, trip_id)
);

-- Enable RLS
ALTER TABLE public.trip_learnings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own learnings
CREATE POLICY "Users can view their own trip learnings"
  ON public.trip_learnings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trip learnings"
  ON public.trip_learnings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trip learnings"
  ON public.trip_learnings FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for querying by user
CREATE INDEX idx_trip_learnings_user_id ON public.trip_learnings(user_id);
CREATE INDEX idx_trip_learnings_destination ON public.trip_learnings(destination);

-- Add timestamp update trigger
CREATE TRIGGER update_trip_learnings_updated_at
  BEFORE UPDATE ON public.trip_learnings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();