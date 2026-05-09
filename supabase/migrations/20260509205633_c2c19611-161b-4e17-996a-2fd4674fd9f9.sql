ALTER TABLE public.trip_activities
  ADD COLUMN IF NOT EXISTS user_rating TEXT,
  ADD COLUMN IF NOT EXISTS user_feedback_at TIMESTAMPTZ;