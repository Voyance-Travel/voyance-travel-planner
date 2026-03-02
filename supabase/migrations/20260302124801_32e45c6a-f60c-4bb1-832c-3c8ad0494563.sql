
DROP VIEW IF EXISTS public.credit_ledger_safe;

CREATE VIEW public.credit_ledger_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  user_id,
  transaction_type,
  credits_delta,
  is_free_credit,
  action_type,
  trip_id,
  activity_id,
  notes,
  metadata,
  created_at
FROM public.credit_ledger;

GRANT SELECT ON public.credit_ledger_safe TO authenticated;
