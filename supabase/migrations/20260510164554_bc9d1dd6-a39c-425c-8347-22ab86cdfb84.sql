ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

UPDATE public.credit_ledger
   SET idempotency_key = metadata->>'idempotencyKey'
 WHERE idempotency_key IS NULL
   AND metadata ? 'idempotencyKey';

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_user_idempotency
  ON public.credit_ledger(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;