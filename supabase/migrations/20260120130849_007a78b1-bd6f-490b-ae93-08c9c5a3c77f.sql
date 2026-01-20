-- ============================================
-- TRIP FINANCE SUBLEDGER SCHEMA
-- ============================================
-- Travel-specific bookkeeping with auto-posting from Stripe

-- Entry types for the finance ledger
CREATE TYPE public.finance_entry_type AS ENUM (
  'client_charge',      -- Invoice line item / charge to client
  'client_payment',     -- Payment from client (Stripe, check, etc.)
  'client_refund',      -- Refund to client
  'client_credit',      -- Credit memo / dispute adjustment
  'supplier_payable',   -- Amount owed to supplier
  'supplier_payment',   -- Payment to supplier
  'commission_expected',-- Commission we expect to receive
  'commission_received',-- Commission actually received
  'agent_earning',      -- Amount agent has earned
  'agent_payout',       -- Payout to agent (Stripe Connect transfer)
  'platform_fee',       -- Platform transaction fee
  'stripe_fee',         -- Stripe processing fee
  'adjustment'          -- Manual adjustment entry
);

-- Source of the ledger entry
CREATE TYPE public.finance_entry_source AS ENUM (
  'stripe_webhook',     -- Auto-posted from Stripe event
  'manual',             -- Manual entry by agent/admin
  'import',             -- CSV/bank import
  'system',             -- System-generated (e.g., invoice creation)
  'api'                 -- API integration (Viator, etc.)
);

-- ============================================
-- FINANCE LEDGER ENTRIES (the subledger)
-- ============================================
CREATE TABLE public.finance_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  trip_id UUID REFERENCES public.agency_trips(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.agency_booking_segments(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.agency_invoices(id) ON DELETE SET NULL,
  
  -- Entry classification
  entry_type public.finance_entry_type NOT NULL,
  entry_source public.finance_entry_source NOT NULL DEFAULT 'manual',
  
  -- Amount (positive = inflow/receivable, negative = outflow/payable)
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Descriptions
  description TEXT NOT NULL,
  memo TEXT,
  
  -- External references
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  stripe_dispute_id TEXT,
  external_reference TEXT,
  
  -- Timestamps
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata for audit trail
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.finance_ledger_entries ENABLE ROW LEVEL SECURITY;

-- Agents can view/manage their own entries
CREATE POLICY "Agents can view own ledger entries"
  ON public.finance_ledger_entries FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own ledger entries"
  ON public.finance_ledger_entries FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own ledger entries"
  ON public.finance_ledger_entries FOR UPDATE
  USING (agent_id = auth.uid());

-- Indexes for common queries
CREATE INDEX idx_finance_entries_agent ON public.finance_ledger_entries(agent_id);
CREATE INDEX idx_finance_entries_trip ON public.finance_ledger_entries(trip_id);
CREATE INDEX idx_finance_entries_type ON public.finance_ledger_entries(entry_type);
CREATE INDEX idx_finance_entries_date ON public.finance_ledger_entries(effective_date);
CREATE INDEX idx_finance_entries_stripe_pi ON public.finance_ledger_entries(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================
-- PAYOUT RUNS (batched agent payouts)
-- ============================================
CREATE TABLE public.finance_payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Totals
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  line_count INTEGER NOT NULL DEFAULT 0,
  
  -- Stripe references
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  
  -- Timestamps
  scheduled_for DATE,
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.finance_payout_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own payout runs"
  ON public.finance_payout_runs FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own payout runs"
  ON public.finance_payout_runs FOR INSERT
  WITH CHECK (agent_id = auth.uid());

-- ============================================
-- PAYOUT LINES (individual items in a payout run)
-- ============================================
CREATE TABLE public.finance_payout_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID REFERENCES public.finance_payout_runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  trip_id UUID REFERENCES public.agency_trips(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.agency_booking_segments(id) ON DELETE SET NULL,
  ledger_entry_id UUID REFERENCES public.finance_ledger_entries(id) ON DELETE SET NULL,
  
  -- Line item details
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Source tracking
  source_type TEXT, -- 'commission', 'markup', 'service_fee'
  source_reference TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_payout_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own payout lines"
  ON public.finance_payout_lines FOR SELECT
  USING (agent_id = auth.uid());

-- ============================================
-- COMMISSION IMPORTS (for non-Stripe commissions)
-- ============================================
CREATE TABLE public.finance_commission_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  
  -- Import details
  source TEXT NOT NULL, -- 'viator', 'host_agency', 'hotel_direct', 'csv_upload'
  source_reference TEXT, -- External batch/report ID
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Totals
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  line_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  
  -- File info (for CSV uploads)
  file_name TEXT,
  file_url TEXT,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  raw_data JSONB,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.finance_commission_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own commission imports"
  ON public.finance_commission_imports FOR ALL
  USING (agent_id = auth.uid());

-- ============================================
-- PROFIT SUMMARY VIEW (computed, not stored)
-- ============================================
CREATE OR REPLACE VIEW public.finance_trip_profit_summary AS
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
  
  -- Computed Profits (agent/agency level)
  -- Trip Profit = Client Payments - Supplier Costs - Refunds + Commission Received - Stripe Fees
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

-- Grant access to the view
GRANT SELECT ON public.finance_trip_profit_summary TO authenticated;

-- Triggers for updated_at
CREATE TRIGGER update_finance_ledger_entries_updated_at
  BEFORE UPDATE ON public.finance_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_payout_runs_updated_at
  BEFORE UPDATE ON public.finance_payout_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_commission_imports_updated_at
  BEFORE UPDATE ON public.finance_commission_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();