
ALTER TABLE public.pending_credit_charges
ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_credit_charges_idempotency_key
ON public.pending_credit_charges (idempotency_key)
WHERE idempotency_key IS NOT NULL;
