CREATE TABLE IF NOT EXISTS public.destination_insights_cache (
  destination text PRIMARY KEY,
  insights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days'
);
ALTER TABLE public.destination_insights_cache ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.destination_insights_cache TO service_role;