
-- Trip Generation Flight Recorder schema

CREATE TABLE public.trip_generation_traces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL,
  user_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  trigger_source TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_duration_ms INTEGER,
  final_status TEXT,
  user_request_snapshot JSONB,
  resolved_profile JSONB,
  match_verdict JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tgt_trip ON public.trip_generation_traces(trip_id, started_at DESC);
CREATE INDEX idx_tgt_user ON public.trip_generation_traces(user_id, started_at DESC);

CREATE TABLE public.trip_generation_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trace_id UUID NOT NULL REFERENCES public.trip_generation_traces(id) ON DELETE CASCADE,
  day_number INTEGER,
  stage_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  inputs JSONB,
  outputs JSONB,
  notes TEXT[],
  error TEXT
);
CREATE INDEX idx_tgs_trace ON public.trip_generation_stages(trace_id, day_number, order_index);

CREATE TABLE public.trip_generation_llm_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trace_id UUID NOT NULL REFERENCES public.trip_generation_traces(id) ON DELETE CASCADE,
  day_number INTEGER,
  call_purpose TEXT,
  model TEXT,
  temperature NUMERIC,
  prompt_text TEXT,
  response_text TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  finish_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tgl_trace ON public.trip_generation_llm_calls(trace_id, day_number);

CREATE TABLE public.trip_generation_mutations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trace_id UUID NOT NULL REFERENCES public.trip_generation_traces(id) ON DELETE CASCADE,
  day_number INTEGER,
  activity_external_id TEXT,
  activity_title TEXT,
  field TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  stage TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tgm_trace ON public.trip_generation_mutations(trace_id, day_number);
CREATE INDEX idx_tgm_field ON public.trip_generation_mutations(trace_id, field);

ALTER TABLE public.trip_generation_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_generation_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_generation_llm_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_generation_mutations ENABLE ROW LEVEL SECURITY;

-- Trip owner can read their own traces
CREATE POLICY "Trip owner reads traces"
ON public.trip_generation_traces FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
);

CREATE POLICY "Trip owner reads stages"
ON public.trip_generation_stages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trip_generation_traces tr
    JOIN public.trips t ON t.id = tr.trip_id
    WHERE tr.id = trace_id AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Trip owner reads llm calls"
ON public.trip_generation_llm_calls FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trip_generation_traces tr
    JOIN public.trips t ON t.id = tr.trip_id
    WHERE tr.id = trace_id AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Trip owner reads mutations"
ON public.trip_generation_mutations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trip_generation_traces tr
    JOIN public.trips t ON t.id = tr.trip_id
    WHERE tr.id = trace_id AND t.user_id = auth.uid()
  )
);

-- Service role policies (explicit, gated on auth.role() per R10)
CREATE POLICY "Service role writes traces"
ON public.trip_generation_traces FOR ALL
TO authenticated
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role writes stages"
ON public.trip_generation_stages FOR ALL
TO authenticated
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role writes llm calls"
ON public.trip_generation_llm_calls FOR ALL
TO authenticated
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role writes mutations"
ON public.trip_generation_mutations FOR ALL
TO authenticated
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
