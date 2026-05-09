ALTER TABLE public.trip_payments
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pending_credit_charges
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pending_credit_charges_pi
  ON public.pending_credit_charges ((metadata->>'stripe_payment_intent_id'))
  WHERE metadata ? 'stripe_payment_intent_id';