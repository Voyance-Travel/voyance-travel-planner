-- Trip-specific intents captured via chatbot or explicit user customization
-- Persisted to influence future refreshes / regenerations
CREATE TABLE IF NOT EXISTS public.trip_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  intent_type TEXT NOT NULL,  -- e.g. "vibe", "companion", "constraint"
  intent_value TEXT NOT NULL,  -- e.g. "romantic", "mom is coming"
  confidence TEXT DEFAULT 'explicit',  -- explicit / inferred
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, intent_type, intent_value)
);

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_trip_intents_trip ON public.trip_intents(trip_id) WHERE active = true;

-- RLS
ALTER TABLE public.trip_intents ENABLE ROW LEVEL SECURITY;

-- Users can read intents for their own trips
CREATE POLICY "Users can view intents for their trips"
ON public.trip_intents FOR SELECT
USING (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid())
);

-- Users and backend can insert intents for their trips
CREATE POLICY "Users can insert intents for their trips"
ON public.trip_intents FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid())
  OR user_id = auth.uid()
);

-- Users can update intents for their trips
CREATE POLICY "Users can update intents for their trips"
ON public.trip_intents FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid())
);

-- Users can delete intents for their trips
CREATE POLICY "Users can delete intents for their trips"
ON public.trip_intents FOR DELETE
USING (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_id AND trips.user_id = auth.uid())
);

-- updated_at trigger
CREATE TRIGGER update_trip_intents_updated_at
BEFORE UPDATE ON public.trip_intents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();