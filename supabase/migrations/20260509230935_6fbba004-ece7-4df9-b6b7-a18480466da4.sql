ALTER TABLE public.activity_costs
  ADD COLUMN IF NOT EXISTS paid_amount_local numeric(10,2),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer;