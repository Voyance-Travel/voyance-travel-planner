-- ============================================================================
-- EXPANDED USER PREFERENCES SCHEMA
-- Aligns Supabase with backend's comprehensive preference structure
-- ============================================================================

-- 1. Expand user_preferences table with additional fields
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS quiz_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS quiz_version text DEFAULT 'v3',
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS primary_goal text,
ADD COLUMN IF NOT EXISTS traveler_type text,
ADD COLUMN IF NOT EXISTS travel_vibes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS emotional_drivers text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS travel_style text,
ADD COLUMN IF NOT EXISTS travel_frequency text,
ADD COLUMN IF NOT EXISTS trip_duration text,
ADD COLUMN IF NOT EXISTS schedule_flexibility text,
ADD COLUMN IF NOT EXISTS trip_structure_preference text,
ADD COLUMN IF NOT EXISTS travel_companions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_group_size text,
ADD COLUMN IF NOT EXISTS communication_style text,
ADD COLUMN IF NOT EXISTS hotel_style text,
ADD COLUMN IF NOT EXISTS hotel_vs_flight text,
ADD COLUMN IF NOT EXISTS flight_preferences jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS loyalty_programs text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS direct_flights_only boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS airport_radius_miles integer,
ADD COLUMN IF NOT EXISTS preferred_regions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS climate_preferences text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS weather_preferences text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mobility_level text,
ADD COLUMN IF NOT EXISTS accessibility_needs text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS dining_style text,
ADD COLUMN IF NOT EXISTS food_likes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS food_dislikes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS budget_range jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS personal_notes text,
ADD COLUMN IF NOT EXISTS eco_friendly boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vibe text,
ADD COLUMN IF NOT EXISTS activity_weights jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sleep_schedule text,
ADD COLUMN IF NOT EXISTS daytime_bias text,
ADD COLUMN IF NOT EXISTS downtime_ratio text,
ADD COLUMN IF NOT EXISTS seat_preference text,
ADD COLUMN IF NOT EXISTS flight_time_preference text,
ADD COLUMN IF NOT EXISTS planning_preference text,
ADD COLUMN IF NOT EXISTS activity_level text;

-- 2. Create quiz_sessions table for tracking quiz progress
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_version text NOT NULL DEFAULT 'v3',
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  last_activity_at timestamp with time zone DEFAULT now(),
  current_step integer DEFAULT 1,
  total_steps integer DEFAULT 11,
  completion_percentage integer DEFAULT 0,
  status text DEFAULT 'in_progress',
  user_agent text,
  device_type text,
  is_complete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. Create quiz_responses table for storing individual answers
CREATE TABLE IF NOT EXISTS public.quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  quiz_version text DEFAULT 'v3',
  field_id text NOT NULL,
  field_type text NOT NULL,
  answer_value text NOT NULL,
  display_label text,
  step_id text,
  question_prompt text,
  response_order integer,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Create travel_dna_profiles table for calculated DNA results
CREATE TABLE IF NOT EXISTS public.travel_dna_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  session_id uuid REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
  primary_archetype_name text,
  secondary_archetype_name text,
  dna_confidence_score integer,
  dna_rarity text,
  trait_scores jsonb DEFAULT '{}',
  tone_tags text[] DEFAULT '{}',
  emotional_drivers text[] DEFAULT '{}',
  summary text,
  calculated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. Create travel_dna_history for tracking changes over time
CREATE TABLE IF NOT EXISTS public.travel_dna_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_snapshot jsonb NOT NULL,
  quiz_session_id uuid REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Enable RLS on all new tables
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_dna_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_dna_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for quiz_sessions
CREATE POLICY "Users can view own quiz sessions" ON public.quiz_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz sessions" ON public.quiz_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz sessions" ON public.quiz_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- 8. RLS Policies for quiz_responses
CREATE POLICY "Users can view own quiz responses" ON public.quiz_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz responses" ON public.quiz_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz responses" ON public.quiz_responses
  FOR UPDATE USING (auth.uid() = user_id);

-- 9. RLS Policies for travel_dna_profiles
CREATE POLICY "Users can view own travel DNA" ON public.travel_dna_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own travel DNA" ON public.travel_dna_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own travel DNA" ON public.travel_dna_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 10. RLS Policies for travel_dna_history
CREATE POLICY "Users can view own DNA history" ON public.travel_dna_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own DNA history" ON public.travel_dna_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id ON public.quiz_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_session_id ON public.quiz_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_travel_dna_profiles_user_id ON public.travel_dna_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_dna_history_user_id ON public.travel_dna_history(user_id);

-- 12. Add triggers for updated_at
CREATE TRIGGER update_quiz_sessions_updated_at
  BEFORE UPDATE ON public.quiz_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_travel_dna_profiles_updated_at
  BEFORE UPDATE ON public.travel_dna_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();