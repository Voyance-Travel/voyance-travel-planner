
-- Cache table for Travel Intel (Perplexity) responses
CREATE TABLE public.travel_intel_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  request_params JSONB NOT NULL DEFAULT '{}',
  intel_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id)
);

-- RLS
ALTER TABLE public.travel_intel_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trip intel cache"
  ON public.travel_intel_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = travel_intel_cache.trip_id
      AND (t.user_id = auth.uid() OR public.is_trip_collaborator(t.id, auth.uid()))
    )
  );

CREATE POLICY "Users can insert their own trip intel cache"
  ON public.travel_intel_cache FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = travel_intel_cache.trip_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own trip intel cache"
  ON public.travel_intel_cache FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = travel_intel_cache.trip_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own trip intel cache"
  ON public.travel_intel_cache FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = travel_intel_cache.trip_id
      AND t.user_id = auth.uid()
    )
  );

-- Service role needs access from edge function
CREATE POLICY "Service role full access on travel_intel_cache"
  ON public.travel_intel_cache FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_travel_intel_cache_trip_id ON public.travel_intel_cache(trip_id);
