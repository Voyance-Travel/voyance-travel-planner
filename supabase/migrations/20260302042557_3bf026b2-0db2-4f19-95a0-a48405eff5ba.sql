
-- Add partial unique index to prevent concurrent duplicate fulfillment
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_stripe_session
ON public.credit_ledger (stripe_session_id, transaction_type)
WHERE stripe_session_id IS NOT NULL;
