CREATE TABLE IF NOT EXISTS public.chat_idempotency_cache (
  idempotency_key text PRIMARY KEY,
  conversation_id uuid,
  user_id uuid,
  trip_id uuid,
  input_hash text NOT NULL,
  response_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_idempotency_expires_at ON public.chat_idempotency_cache (expires_at);

ALTER TABLE public.chat_idempotency_cache ENABLE ROW LEVEL SECURITY;
-- No client policies: service role only.