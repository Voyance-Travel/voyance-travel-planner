CREATE TABLE IF NOT EXISTS public.travel_intel_locks (
  lock_key   text PRIMARY KEY,
  locked_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.travel_intel_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_stale_intel_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.travel_intel_locks WHERE expires_at < now();
$$;

SELECT cron.schedule(
  'cleanup-intel-locks',
  '*/5 * * * *',
  $$SELECT public.cleanup_stale_intel_locks()$$
);