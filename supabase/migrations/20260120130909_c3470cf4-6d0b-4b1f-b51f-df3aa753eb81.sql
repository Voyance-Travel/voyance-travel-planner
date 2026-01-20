-- Fix security definer view by using security invoker instead
DROP VIEW IF EXISTS public.finance_trip_profit_summary;

CREATE VIEW public.finance_trip_profit_summary 
WITH (security_invoker = true) AS
SELECT 
  t.id AS trip_id,
  t.agent_id,
  t.name AS trip_name,
  t.currency,
  
  -- Client Revenue (A/R)
  COALESCE(SUM(CASE WHEN e.entry_type = 'client_charge' THEN e.amount_cents ELSE 0 END), 0) AS total_client_charges_cents,
  COALESCE(SUM(CASE WHEN e.entry_type = 'client_payment' THEN e.amount_cents ELSE 0 END), 0) AS total_client_payments_cents,
  COALESCE(SUM(CASE WHEN e.entry_type IN ('client_refund', 'client_credit') THEN e.amount_cents ELSE 0 END), 0) AS total_refunds_cents,
  
  -- Supplier Costs (A/P)
  COALESCE(SUM(CASE WHEN e.entry_type = 'supplier_payable' THEN ABS(e.amount_cents) ELSE 0 END), 0) AS total_supplier_costs_cents,
  COALESCE(SUM(CASE WHEN e.entry_type = 'supplier_payment' THEN ABS(e.amount_cents) ELSE 0 END), 0) AS total_supplier_paid_cents,
  
  -- Commissions
  COALESCE(SUM(CASE WHEN e.entry_type = 'commission_expected' THEN e.amount_cents ELSE 0 END), 0) AS commission_expected_cents,
  COALESCE(SUM(CASE WHEN e.entry_type = 'commission_received' THEN e.amount_cents ELSE 0 END), 0) AS commission_received_cents,
  
  -- Fees
  COALESCE(SUM(CASE WHEN e.entry_type = 'platform_fee' THEN ABS(e.amount_cents) ELSE 0 END), 0) AS platform_fees_cents,
  COALESCE(SUM(CASE WHEN e.entry_type = 'stripe_fee' THEN ABS(e.amount_cents) ELSE 0 END), 0) AS stripe_fees_cents,
  
  -- Agent Payouts
  COALESCE(SUM(CASE WHEN e.entry_type = 'agent_earning' THEN e.amount_cents ELSE 0 END), 0) AS agent_earnings_cents,
  COALESCE(SUM(CASE WHEN e.entry_type = 'agent_payout' THEN ABS(e.amount_cents) ELSE 0 END), 0) AS agent_paid_out_cents,
  
  -- Computed Trip Gross Profit
  (
    COALESCE(SUM(CASE WHEN e.entry_type = 'client_payment' THEN e.amount_cents ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN e.entry_type = 'supplier_payment' THEN ABS(e.amount_cents) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN e.entry_type IN ('client_refund', 'client_credit') THEN ABS(e.amount_cents) ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN e.entry_type = 'commission_received' THEN e.amount_cents ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN e.entry_type = 'stripe_fee' THEN ABS(e.amount_cents) ELSE 0 END), 0)
  ) AS trip_gross_profit_cents

FROM public.agency_trips t
LEFT JOIN public.finance_ledger_entries e ON e.trip_id = t.id
GROUP BY t.id, t.agent_id, t.name, t.currency;

GRANT SELECT ON public.finance_trip_profit_summary TO authenticated;