CREATE TABLE IF NOT EXISTS public.stripe_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  result text,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_log_received
  ON public.stripe_webhook_log (received_at DESC);

ALTER TABLE public.stripe_webhook_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.stripe_webhook_log TO service_role;