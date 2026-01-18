-- Create activity_feedback table for storing user reactions to activities
CREATE TABLE public.activity_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.trip_activities(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('loved', 'liked', 'neutral', 'disliked')),
  feedback_text TEXT,
  feedback_tags TEXT[] DEFAULT '{}',
  activity_type TEXT,
  activity_category TEXT,
  destination TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

-- Create user_preference_insights table for learned preferences
CREATE TABLE public.user_preference_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  loved_activity_types JSONB DEFAULT '{}',
  disliked_activity_types JSONB DEFAULT '{}',
  loved_categories JSONB DEFAULT '{}',
  disliked_categories JSONB DEFAULT '{}',
  preferred_times JSONB DEFAULT '{}',
  preferred_pace TEXT,
  feedback_count INTEGER DEFAULT 0,
  last_analysis_at TIMESTAMP WITH TIME ZONE,
  insights_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preference_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_feedback
CREATE POLICY "Users can view their own feedback" 
ON public.activity_feedback 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback" 
ON public.activity_feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" 
ON public.activity_feedback 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback" 
ON public.activity_feedback 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for user_preference_insights
CREATE POLICY "Users can view their own insights" 
ON public.user_preference_insights 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own insights" 
ON public.user_preference_insights 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights" 
ON public.user_preference_insights 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_activity_feedback_updated_at
BEFORE UPDATE ON public.activity_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preference_insights_updated_at
BEFORE UPDATE ON public.user_preference_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_activity_feedback_user_id ON public.activity_feedback(user_id);
CREATE INDEX idx_activity_feedback_trip_id ON public.activity_feedback(trip_id);
CREATE INDEX idx_activity_feedback_rating ON public.activity_feedback(rating);
CREATE INDEX idx_user_preference_insights_user_id ON public.user_preference_insights(user_id);