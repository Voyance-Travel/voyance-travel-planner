
-- Performance logging table for itinerary generation
CREATE TABLE IF NOT EXISTS public.generation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  total_duration_ms INTEGER,
  status TEXT CHECK (status IN ('started', 'in_progress', 'completed', 'failed')),
  phase_timings JSONB DEFAULT '{}',
  day_timings JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  num_days INTEGER,
  num_guests INTEGER,
  destination TEXT,
  model_used TEXT,
  prompt_token_count INTEGER,
  completion_token_count INTEGER,
  current_phase TEXT,
  progress_pct INTEGER DEFAULT 0
);

CREATE INDEX idx_generation_logs_trip_id ON public.generation_logs(trip_id);
CREATE INDEX idx_generation_logs_created_at ON public.generation_logs(created_at DESC);

ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their trips"
  ON public.generation_logs FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM public.trips WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all logs"
  ON public.generation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can manage logs"
  ON public.generation_logs FOR ALL
  TO authenticated
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);
