
-- STEP 1: Add journey columns to trips table
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS journey_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS journey_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS journey_order INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS journey_total_legs INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transition_mode TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transition_departure_time TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transition_arrival_time TIMESTAMPTZ DEFAULT NULL;

-- STEP 2: Index for fast journey lookups
CREATE INDEX IF NOT EXISTS idx_trips_journey_id ON public.trips(journey_id) WHERE journey_id IS NOT NULL;

-- STEP 3: Function to fetch all trips in a journey
CREATE OR REPLACE FUNCTION public.get_journey_trips(p_journey_id UUID)
RETURNS SETOF public.trips
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM public.trips WHERE journey_id = p_journey_id ORDER BY journey_order ASC;
$$;
