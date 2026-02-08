
-- Per-trip action usage tracking for free cap consumption
CREATE TABLE public.trip_action_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_trip_action_usage UNIQUE (user_id, trip_id, action_type)
);

-- Index for fast lookups
CREATE INDEX idx_trip_action_usage_lookup ON public.trip_action_usage(user_id, trip_id, action_type);

-- RLS
ALTER TABLE public.trip_action_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON public.trip_action_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.trip_action_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.trip_action_usage FOR UPDATE
  USING (auth.uid() = user_id);
