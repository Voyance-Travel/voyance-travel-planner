
-- ============================================================
-- Phase 1: cost_reference, activity_costs, exchange_rates
-- ============================================================

-- 1. cost_reference — baseline pricing by destination + category
CREATE TABLE public.cost_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_city TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  item_name TEXT,
  cost_low_usd NUMERIC(10,2) NOT NULL,
  cost_mid_usd NUMERIC(10,2) NOT NULL,
  cost_high_usd NUMERIC(10,2) NOT NULL,
  local_currency TEXT,
  cost_low_local NUMERIC(10,2),
  cost_mid_local NUMERIC(10,2),
  cost_high_local NUMERIC(10,2),
  exchange_rate NUMERIC(10,4),
  source TEXT NOT NULL DEFAULT 'ai_seeded',
  confidence TEXT NOT NULL DEFAULT 'medium',
  last_updated TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(destination_city, category, subcategory, item_name)
);

CREATE INDEX idx_cost_ref_city_cat ON public.cost_reference(destination_city, category);
CREATE INDEX idx_cost_ref_country_cat ON public.cost_reference(destination_country, category);

-- 2. activity_costs — one row per activity per trip (single source of truth)
CREATE TABLE public.activity_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL,
  day_number INT NOT NULL,
  cost_reference_id UUID REFERENCES public.cost_reference(id),
  cost_per_person_usd NUMERIC(10,2) NOT NULL,
  cost_per_person_local NUMERIC(10,2),
  local_currency TEXT,
  num_travelers INT NOT NULL DEFAULT 1,
  total_cost_usd NUMERIC(10,2) GENERATED ALWAYS AS (cost_per_person_usd * num_travelers) STORED,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'reference',
  confidence TEXT DEFAULT 'medium',
  is_paid BOOLEAN DEFAULT FALSE,
  paid_amount_usd NUMERIC(10,2),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_costs_trip ON public.activity_costs(trip_id);
CREATE INDEX idx_activity_costs_trip_day ON public.activity_costs(trip_id, day_number);
CREATE UNIQUE INDEX idx_activity_costs_trip_activity ON public.activity_costs(trip_id, activity_id);

-- 3. exchange_rates
CREATE TABLE public.exchange_rates (
  currency_code TEXT PRIMARY KEY,
  rate_to_usd NUMERIC(12,6) NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Validation trigger on activity_costs
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_activity_cost()
RETURNS TRIGGER AS $$
DECLARE
  ref RECORD;
  max_allowed NUMERIC;
  original_cost NUMERIC;
BEGIN
  -- Rule 1: Cost must be non-negative
  IF NEW.cost_per_person_usd < 0 THEN
    NEW.cost_per_person_usd := 0;
  END IF;

  -- Rule 2: If linked to a reference, cap at 3x the high-end
  IF NEW.cost_reference_id IS NOT NULL THEN
    SELECT * INTO ref FROM public.cost_reference WHERE id = NEW.cost_reference_id;
    IF FOUND THEN
      max_allowed := ref.cost_high_usd * 3;
      IF NEW.cost_per_person_usd > max_allowed THEN
        original_cost := NEW.cost_per_person_usd;
        NEW.cost_per_person_usd := ref.cost_high_usd;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Auto-corrected from $' || original_cost || ', exceeded 3x ref high $' || ref.cost_high_usd || ']';
        NEW.source := 'auto_corrected';
      END IF;
    END IF;
  END IF;

  -- Rule 3: Category-specific absolute caps
  CASE NEW.category
    WHEN 'dining' THEN
      IF NEW.cost_per_person_usd > 500 THEN
        NEW.cost_per_person_usd := 500;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Capped at $500/pp dining limit]';
        NEW.source := 'auto_corrected';
      END IF;
    WHEN 'transport' THEN
      IF NEW.cost_per_person_usd > 300 THEN
        NEW.cost_per_person_usd := 300;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Capped at $300/pp transport limit]';
        NEW.source := 'auto_corrected';
      END IF;
    WHEN 'activity' THEN
      IF NEW.cost_per_person_usd > 1000 THEN
        NEW.cost_per_person_usd := 1000;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Capped at $1000/pp activity limit]';
        NEW.source := 'auto_corrected';
      END IF;
    WHEN 'nightlife' THEN
      IF NEW.cost_per_person_usd > 200 THEN
        NEW.cost_per_person_usd := 200;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Capped at $200/pp nightlife limit]';
        NEW.source := 'auto_corrected';
      END IF;
    ELSE
      IF NEW.cost_per_person_usd > 2000 THEN
        NEW.cost_per_person_usd := 2000;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Capped at $2000/pp global limit]';
        NEW.source := 'auto_corrected';
      END IF;
  END CASE;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_activity_cost
BEFORE INSERT OR UPDATE ON public.activity_costs
FOR EACH ROW EXECUTE FUNCTION public.validate_activity_cost();

-- ============================================================
-- RLS Policies
-- ============================================================

-- cost_reference: read-only for all authenticated
ALTER TABLE public.cost_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cost_reference"
  ON public.cost_reference FOR SELECT
  TO authenticated
  USING (true);

-- exchange_rates: read-only for all authenticated
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read exchange_rates"
  ON public.exchange_rates FOR SELECT
  TO authenticated
  USING (true);

-- activity_costs: CRUD for trip owners and collaborators
ALTER TABLE public.activity_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owners can manage activity_costs"
  ON public.activity_costs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = activity_costs.trip_id AND t.user_id = auth.uid()
    )
    OR
    public.is_trip_collaborator(activity_costs.trip_id, auth.uid(), false)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = activity_costs.trip_id AND t.user_id = auth.uid()
    )
    OR
    public.is_trip_collaborator(activity_costs.trip_id, auth.uid(), true)
  );

-- service_role can do anything (for edge functions)
CREATE POLICY "Service role full access to activity_costs"
  ON public.activity_costs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to cost_reference"
  ON public.cost_reference FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to exchange_rates"
  ON public.exchange_rates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- SQL Views for consistent totals
-- ============================================================

CREATE VIEW public.v_trip_total AS
SELECT
  trip_id,
  COUNT(*) as activity_count,
  SUM(cost_per_person_usd) as total_per_person_usd,
  SUM(total_cost_usd) as total_all_travelers_usd,
  COUNT(DISTINCT day_number) as days_with_costs
FROM public.activity_costs
GROUP BY trip_id;

CREATE VIEW public.v_day_totals AS
SELECT
  trip_id,
  day_number,
  SUM(cost_per_person_usd) as day_total_per_person_usd,
  SUM(total_cost_usd) as day_total_all_travelers_usd,
  COUNT(*) as activity_count
FROM public.activity_costs
GROUP BY trip_id, day_number;

CREATE VIEW public.v_budget_by_category AS
SELECT
  trip_id,
  category,
  SUM(cost_per_person_usd) as category_total_per_person_usd,
  SUM(total_cost_usd) as category_total_all_travelers_usd,
  COUNT(*) as item_count
FROM public.activity_costs
GROUP BY trip_id, category;

CREATE VIEW public.v_payments_summary AS
SELECT
  trip_id,
  SUM(total_cost_usd) as total_estimated_usd,
  SUM(CASE WHEN is_paid THEN COALESCE(paid_amount_usd, total_cost_usd) ELSE 0 END) as total_paid_usd,
  SUM(CASE WHEN NOT is_paid THEN total_cost_usd ELSE 0 END) as total_remaining_usd,
  COUNT(CASE WHEN is_paid THEN 1 END) as paid_count,
  COUNT(CASE WHEN NOT is_paid THEN 1 END) as unpaid_count
FROM public.activity_costs
GROUP BY trip_id;

-- ============================================================
-- Seed initial exchange rates
-- ============================================================
INSERT INTO public.exchange_rates (currency_code, rate_to_usd, last_updated) VALUES
  ('USD', 1.000000, now()),
  ('HKD', 0.128000, now()),
  ('CNY', 0.138000, now()),
  ('JPY', 0.006700, now()),
  ('EUR', 1.080000, now()),
  ('GBP', 1.260000, now()),
  ('THB', 0.028000, now()),
  ('KRW', 0.000750, now()),
  ('SGD', 0.740000, now()),
  ('AUD', 0.650000, now()),
  ('MXN', 0.058000, now()),
  ('CAD', 0.740000, now())
ON CONFLICT (currency_code) DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, last_updated = now();
