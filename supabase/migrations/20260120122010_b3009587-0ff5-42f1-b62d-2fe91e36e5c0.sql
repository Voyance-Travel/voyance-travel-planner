-- Fix security definer view by adding security_invoker
DROP VIEW IF EXISTS trip_finance_ledger;

CREATE VIEW trip_finance_ledger 
WITH (security_invoker = on) AS
SELECT 
  trip_id,
  agent_id,
  -- A/R: What clients owe
  COALESCE(SUM(sell_price_cents), 0) as total_client_charges_cents,
  -- A/P: What we owe suppliers (for supplier_direct type only)
  COALESCE(SUM(CASE WHEN settlement_type = 'supplier_direct' THEN net_cost_cents ELSE 0 END), 0) as total_supplier_owed_cents,
  COALESCE(SUM(CASE WHEN settlement_type = 'supplier_direct' THEN supplier_paid_cents ELSE 0 END), 0) as total_supplier_paid_cents,
  -- Commissions
  COALESCE(SUM(commission_expected_cents), 0) as total_commission_expected_cents,
  COALESCE(SUM(commission_received_cents), 0) as total_commission_received_cents,
  -- Counts by settlement type
  COUNT(CASE WHEN settlement_type = 'arc_bsp' THEN 1 END) as arc_bsp_count,
  COUNT(CASE WHEN settlement_type = 'supplier_direct' THEN 1 END) as supplier_direct_count,
  COUNT(CASE WHEN settlement_type = 'commission_track' THEN 1 END) as commission_track_count
FROM agency_booking_segments
GROUP BY trip_id, agent_id;

COMMENT ON VIEW trip_finance_ledger IS 'Aggregated financial ledger by trip showing A/R, A/P, and commission balances - uses security_invoker for RLS';