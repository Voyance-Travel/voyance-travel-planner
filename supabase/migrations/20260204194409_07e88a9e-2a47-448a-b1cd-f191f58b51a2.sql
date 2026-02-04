-- Trip cost tracking for real margin data
CREATE TABLE public.trip_cost_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  user_id UUID,
  action_type TEXT NOT NULL, -- 'full_itinerary', 'day_regeneration', 'activity_swap', 'travel_dna', 'quick_preview', 'analyze_itinerary'
  model TEXT NOT NULL, -- 'openai/gpt-5', 'openai/gpt-5-mini', 'google/gemini-2.5-flash', etc.
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  google_places_calls INTEGER NOT NULL DEFAULT 0,
  google_geocoding_calls INTEGER NOT NULL DEFAULT 0,
  google_photos_calls INTEGER NOT NULL DEFAULT 0,
  google_routes_calls INTEGER NOT NULL DEFAULT 0,
  amadeus_calls INTEGER NOT NULL DEFAULT 0,
  perplexity_calls INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6), -- Calculated cost based on token pricing
  duration_ms INTEGER, -- How long the operation took
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for aggregation queries
CREATE INDEX idx_trip_cost_tracking_created_at ON public.trip_cost_tracking(created_at DESC);
CREATE INDEX idx_trip_cost_tracking_action_type ON public.trip_cost_tracking(action_type);
CREATE INDEX idx_trip_cost_tracking_trip_id ON public.trip_cost_tracking(trip_id);

-- Enable RLS
ALTER TABLE public.trip_cost_tracking ENABLE ROW LEVEL SECURITY;

-- Only admins can read cost tracking data
CREATE POLICY "Admins can view cost tracking"
ON public.trip_cost_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Edge functions insert via service role (no RLS check needed for insert from backend)
CREATE POLICY "Service role can insert cost tracking"
ON public.trip_cost_tracking
FOR INSERT
WITH CHECK (true);

-- View for aggregated stats
CREATE OR REPLACE VIEW public.trip_cost_summary AS
SELECT 
  action_type,
  model,
  COUNT(*) as total_calls,
  AVG(input_tokens) as avg_input_tokens,
  AVG(output_tokens) as avg_output_tokens,
  AVG(google_places_calls) as avg_google_places,
  AVG(google_geocoding_calls) as avg_google_geocoding,
  AVG(google_photos_calls) as avg_google_photos,
  AVG(google_routes_calls) as avg_google_routes,
  AVG(amadeus_calls) as avg_amadeus,
  AVG(perplexity_calls) as avg_perplexity,
  AVG(estimated_cost_usd) as avg_cost_usd,
  SUM(estimated_cost_usd) as total_cost_usd,
  AVG(duration_ms) as avg_duration_ms,
  MIN(created_at) as first_call,
  MAX(created_at) as last_call
FROM public.trip_cost_tracking
GROUP BY action_type, model;