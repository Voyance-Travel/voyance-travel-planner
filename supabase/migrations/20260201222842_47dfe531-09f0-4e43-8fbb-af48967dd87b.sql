-- =====================================================
-- COMPREHENSIVE FEEDBACK SYSTEM SCHEMA
-- Enables contextual feedback collection during and after trips
-- =====================================================

-- Feedback prompt types enum
CREATE TYPE public.feedback_prompt_type AS ENUM (
  'quick_reaction',
  'day_summary', 
  'restaurant_specific',
  'departure_summary',
  'one_week_followup'
);

-- Question types enum
CREATE TYPE public.feedback_question_type AS ENUM (
  'emoji_scale',
  'single_select',
  'multi_select',
  'text',
  'activity_pick',
  'rating_scale'
);

-- =====================================================
-- FEEDBACK PROMPTS TABLE
-- Configurable prompts that can be shown to users
-- =====================================================
CREATE TABLE public.feedback_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_type public.feedback_prompt_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  -- trigger_config structure:
  -- {
  --   "type": "time_after_activity" | "time_of_day" | "trip_day" | "days_after_return",
  --   "value": number (minutes or day number),
  --   "conditions": {
  --     "activity_types": ["restaurant", "attraction"],
  --     "user_opened_activity": boolean,
  --     "max_prompts_today": number
  --   }
  -- }
  questions JSONB NOT NULL DEFAULT '[]',
  -- questions structure:
  -- [
  --   {
  --     "id": "rating",
  --     "text": "How was {activity_name}?",
  --     "type": "emoji_scale",
  --     "options": ["😍 Loved it", "👍 Good", "😐 Meh", "👎 Skip it"],
  --     "required": true
  --   }
  -- ]
  priority INTEGER NOT NULL DEFAULT 5,
  archetype_relevance TEXT[] DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- TRIP FEEDBACK RESPONSES TABLE
-- Stores all user feedback responses
-- =====================================================
CREATE TABLE public.trip_feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.feedback_prompts(id) ON DELETE SET NULL,
  prompt_type public.feedback_prompt_type NOT NULL,
  activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  day_number INTEGER,
  responses JSONB NOT NULL DEFAULT '{}',
  -- responses structure matches question IDs:
  -- {
  --   "rating": "😍 Loved it",
  --   "pacing": "Just right",
  --   "highlight": "activity-uuid",
  --   "note": "Great experience!"
  -- }
  location JSONB,
  -- { "lat": number, "lng": number }
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- DAY SUMMARIES TABLE
-- End-of-day reflections and ratings
-- =====================================================
CREATE TABLE public.trip_day_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_date DATE NOT NULL,
  pacing_rating TEXT CHECK (pacing_rating IN ('too_rushed', 'just_right', 'too_slow')),
  highlight_activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  highlight_text TEXT,
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  notes TEXT,
  weather_experience TEXT,
  unexpected_discoveries TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trip_id, day_number)
);

-- =====================================================
-- DEPARTURE SUMMARIES TABLE
-- End-of-trip comprehensive reflections
-- =====================================================
CREATE TABLE public.trip_departure_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  archetype_fit TEXT CHECK (archetype_fit IN ('nailed_it', 'mostly', 'somewhat', 'missed_the_mark')),
  highlight_activities UUID[],
  would_change TEXT[],
  best_meal_activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  best_experience_activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  overall_trip_rating INTEGER CHECK (overall_trip_rating BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  recommend_score INTEGER CHECK (recommend_score BETWEEN 0 AND 10),
  final_thoughts TEXT,
  suggestions_for_destination TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trip_id)
);

-- =====================================================
-- ACTIVITY QUALITY SCORES TABLE
-- Aggregated quality data per activity/venue
-- =====================================================
CREATE TABLE public.activity_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  venue_id TEXT, -- For matching across trips (e.g., Google Place ID)
  venue_name TEXT NOT NULL,
  destination TEXT NOT NULL,
  category TEXT,
  total_ratings INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2),
  rating_distribution JSONB NOT NULL DEFAULT '{"loved": 0, "good": 0, "meh": 0, "skip": 0}',
  worth_price_score NUMERIC(3,2),
  archetype_breakdown JSONB NOT NULL DEFAULT '{}',
  -- { "slow_traveler": { "count": 10, "avg": 4.2 }, "culinary_cartographer": { "count": 5, "avg": 4.8 } }
  common_tips TEXT[],
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- ARCHETYPE PACING STATS TABLE
-- Tracks pacing feedback per archetype for calibration
-- =====================================================
CREATE TABLE public.archetype_pacing_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype TEXT NOT NULL,
  trip_type TEXT,
  total_responses INTEGER NOT NULL DEFAULT 0,
  pacing_distribution JSONB NOT NULL DEFAULT '{"too_rushed": 0, "just_right": 0, "too_slow": 0}',
  recommended_adjustment NUMERIC(3,2) DEFAULT 0,
  -- -1 to 1 scale (slower to faster)
  sample_size_threshold INTEGER DEFAULT 20,
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(archetype, trip_type)
);

-- =====================================================
-- FEEDBACK PROMPT LOG TABLE
-- Tracks when prompts were shown/dismissed
-- =====================================================
CREATE TABLE public.feedback_prompt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.feedback_prompts(id) ON DELETE SET NULL,
  prompt_type public.feedback_prompt_type NOT NULL,
  activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  day_number INTEGER,
  shown_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK (action IN ('shown', 'dismissed', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_feedback_responses_user_trip ON public.trip_feedback_responses(user_id, trip_id);
CREATE INDEX idx_feedback_responses_activity ON public.trip_feedback_responses(activity_id);
CREATE INDEX idx_feedback_responses_submitted ON public.trip_feedback_responses(submitted_at);
CREATE INDEX idx_day_summaries_user_trip ON public.trip_day_summaries(user_id, trip_id);
CREATE INDEX idx_departure_summaries_user_trip ON public.trip_departure_summaries(user_id, trip_id);
CREATE INDEX idx_activity_quality_venue ON public.activity_quality_scores(venue_id);
CREATE INDEX idx_activity_quality_destination ON public.activity_quality_scores(destination);
CREATE INDEX idx_archetype_pacing ON public.archetype_pacing_stats(archetype, trip_type);
CREATE INDEX idx_prompt_log_user_trip ON public.feedback_prompt_log(user_id, trip_id, shown_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Feedback prompts (read-only for all authenticated users)
ALTER TABLE public.feedback_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active prompts"
ON public.feedback_prompts FOR SELECT
TO authenticated
USING (is_active = true);

-- Trip feedback responses (users can CRUD their own)
ALTER TABLE public.trip_feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
ON public.trip_feedback_responses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback"
ON public.trip_feedback_responses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.trip_feedback_responses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Day summaries
ALTER TABLE public.trip_day_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own day summaries"
ON public.trip_day_summaries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own day summaries"
ON public.trip_day_summaries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own day summaries"
ON public.trip_day_summaries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Departure summaries
ALTER TABLE public.trip_departure_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own departure summaries"
ON public.trip_departure_summaries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own departure summaries"
ON public.trip_departure_summaries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own departure summaries"
ON public.trip_departure_summaries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Activity quality scores (read-only for authenticated users)
ALTER TABLE public.activity_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read activity quality scores"
ON public.activity_quality_scores FOR SELECT
TO authenticated
USING (true);

-- Archetype pacing stats (read-only for authenticated users)
ALTER TABLE public.archetype_pacing_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read archetype pacing stats"
ON public.archetype_pacing_stats FOR SELECT
TO authenticated
USING (true);

-- Feedback prompt log
ALTER TABLE public.feedback_prompt_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompt log"
ON public.feedback_prompt_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prompt log"
ON public.feedback_prompt_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE TRIGGER update_feedback_prompts_updated_at
  BEFORE UPDATE ON public.feedback_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_day_summaries_updated_at
  BEFORE UPDATE ON public.trip_day_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departure_summaries_updated_at
  BEFORE UPDATE ON public.trip_departure_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SEED DEFAULT PROMPTS
-- =====================================================
INSERT INTO public.feedback_prompts (prompt_type, name, description, trigger_config, questions, priority, archetype_relevance) VALUES
-- Quick Activity Reaction
('quick_reaction', 'Activity Reaction', 'Quick feedback after completing an activity', 
  '{"type": "time_after_activity", "value": 120, "conditions": {"user_opened_activity": true, "max_prompts_today": 2}}',
  '[{"id": "rating", "text": "How was {activity_name}?", "type": "emoji_scale", "options": ["😍 Loved it", "👍 Good", "😐 Meh", "👎 Skip it"], "required": true}, {"id": "note", "text": "Anything future travelers should know?", "type": "text", "required": false}]',
  5, NULL),

-- Day Summary
('day_summary', 'End of Day Summary', 'Evening reflection on the day',
  '{"type": "time_of_day", "value": 21, "conditions": {"max_prompts_today": 1}}',
  '[{"id": "pacing", "text": "Was the pacing right today?", "type": "single_select", "options": ["Too rushed", "Just right", "Too slow"], "required": true}, {"id": "highlight", "text": "Best moment?", "type": "activity_pick", "required": false}, {"id": "energy", "text": "Energy level?", "type": "rating_scale", "options": ["1", "2", "3", "4", "5"], "required": false}]',
  3, NULL),

-- Restaurant Specific
('restaurant_specific', 'Restaurant Feedback', 'Detailed feedback after dining',
  '{"type": "time_after_activity", "value": 90, "conditions": {"activity_types": ["restaurant", "dining", "food"], "max_prompts_today": 2}}',
  '[{"id": "rating", "text": "How was {activity_name}?", "type": "emoji_scale", "options": ["Amazing", "Great", "Good", "Disappointing"], "required": true}, {"id": "worth_price", "text": "Worth the price?", "type": "single_select", "options": ["Absolutely", "Yes", "Borderline", "No"], "required": true}, {"id": "tip", "text": "Any tips for future visitors?", "type": "text", "required": false}]',
  7, ARRAY['culinary_cartographer', 'luxury_luminary', 'romantic_curator']),

-- Departure Summary
('departure_summary', 'Departure Day Reflection', 'Complete trip summary on last day',
  '{"type": "trip_day", "value": -1}',
  '[{"id": "archetype_fit", "text": "Did your itinerary feel like YOU?", "type": "single_select", "options": ["Nailed it", "Mostly", "Somewhat", "Missed the mark"], "required": true}, {"id": "highlight", "text": "Highlight of the trip?", "type": "activity_pick", "required": true}, {"id": "would_change", "text": "What would you change?", "type": "multi_select", "options": ["Less packed days", "More food focus", "Different neighborhoods", "More time alone", "More group activities", "Higher end accommodations", "Nothing—it was perfect"], "required": true}, {"id": "final_thoughts", "text": "Any final thoughts?", "type": "text", "required": false}]',
  10, NULL),

-- One Week Followup
('one_week_followup', 'One Week Later', 'What stuck with you?',
  '{"type": "days_after_return", "value": 7}',
  '[{"id": "what_stuck", "text": "What''s still with you a week later?", "type": "text", "required": true}, {"id": "would_recommend", "text": "Would you recommend Voyance to a friend?", "type": "single_select", "options": ["Definitely", "Probably", "Maybe", "No"], "required": true}]',
  4, NULL);