-- Add Submit-To classification to booking segments for travel subledger
-- This drives: A/R (client balance), A/P (vendor balance), Commission tracking

-- Create the settlement type enum
CREATE TYPE booking_settlement_type AS ENUM (
  'arc_bsp',           -- ARC/BSP settlement: Agent files with airline reporting
  'supplier_direct',   -- Supplier Direct: Agency collects from client, pays supplier
  'commission_track'   -- Commission Tracking: Client pays supplier directly, commission due later
);

-- Add settlement tracking columns to booking segments
ALTER TABLE agency_booking_segments
ADD COLUMN settlement_type booking_settlement_type DEFAULT 'supplier_direct',
ADD COLUMN supplier_paid_cents BIGINT DEFAULT 0,          -- What we've paid to supplier (A/P tracking)
ADD COLUMN supplier_paid_at TIMESTAMPTZ,                   -- When supplier was paid
ADD COLUMN commission_expected_cents BIGINT DEFAULT 0,     -- Commission we expect
ADD COLUMN commission_received_cents BIGINT DEFAULT 0,     -- Commission actually received
ADD COLUMN commission_received_at TIMESTAMPTZ,             -- When commission arrived
ADD COLUMN arc_submission_date DATE,                       -- For ARC/BSP: when submitted
ADD COLUMN arc_settlement_date DATE,                       -- For ARC/BSP: expected settlement
ADD COLUMN arc_report_number TEXT;                         -- For ARC/BSP: report/batch number

-- Create a view for easy ledger summaries per trip
CREATE OR REPLACE VIEW trip_finance_ledger AS
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

COMMENT ON COLUMN agency_booking_segments.settlement_type IS 'How this booking is financially processed: arc_bsp (airline reporting), supplier_direct (we pay supplier), commission_track (client pays supplier, we get commission)';
COMMENT ON VIEW trip_finance_ledger IS 'Aggregated financial ledger by trip showing A/R, A/P, and commission balances';