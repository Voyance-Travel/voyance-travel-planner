-- ============================================================================
-- TRIP BUDGET SYSTEM
-- Adds numeric budget tracking, category allocations, and day-level balancing
-- ============================================================================

-- Add budget columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS budget_total_cents INTEGER,
ADD COLUMN IF NOT EXISTS budget_currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS budget_input_mode VARCHAR(20) DEFAULT 'total' CHECK (budget_input_mode IN ('total', 'per_person')),
ADD COLUMN IF NOT EXISTS budget_include_hotel BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS budget_include_flight BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS budget_warnings_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS budget_warning_threshold VARCHAR(20) DEFAULT 'yellow' CHECK (budget_warning_threshold IN ('yellow', 'red_only', 'off')),
ADD COLUMN IF NOT EXISTS budget_allocations JSONB DEFAULT '{}';

-- Comment for clarity
COMMENT ON COLUMN public.trips.budget_total_cents IS 'Total trip budget in cents (for the whole party)';
COMMENT ON COLUMN public.trips.budget_input_mode IS 'Whether user entered total or per_person amount';
COMMENT ON COLUMN public.trips.budget_include_hotel IS 'Include hotel costs in budget tracking';
COMMENT ON COLUMN public.trips.budget_include_flight IS 'Include flight costs in budget tracking (tracking only)';
COMMENT ON COLUMN public.trips.budget_allocations IS 'Category allocations: {food_percent, activities_percent, transit_percent, misc_percent, buffer_percent}';

-- Create trip_budget_ledger table for tracking committed vs planned
CREATE TABLE IF NOT EXISTS public.trip_budget_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'hotel', 'flight', 'food', 'activities', 'transit', 'misc'
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('committed', 'planned', 'adjustment')),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT,
  day_number INTEGER, -- NULL for trip-level items like hotel
  activity_id TEXT, -- Reference to activity in itinerary_data
  external_booking_id TEXT, -- For booked items
  confidence VARCHAR(10) DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_budget_ledger_trip_id ON public.trip_budget_ledger(trip_id);
CREATE INDEX IF NOT EXISTS idx_budget_ledger_category ON public.trip_budget_ledger(trip_id, category);
CREATE INDEX IF NOT EXISTS idx_budget_ledger_day ON public.trip_budget_ledger(trip_id, day_number);

-- Enable RLS
ALTER TABLE public.trip_budget_ledger ENABLE ROW LEVEL SECURITY;

-- RLS policies: Users can manage their own trip budgets
CREATE POLICY "Users can view their trip budget ledger"
  ON public.trip_budget_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_budget_ledger.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their trip budget entries"
  ON public.trip_budget_ledger FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_budget_ledger.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their trip budget entries"
  ON public.trip_budget_ledger FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_budget_ledger.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their trip budget entries"
  ON public.trip_budget_ledger FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_budget_ledger.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

-- Create view for budget summary
CREATE OR REPLACE VIEW public.trip_budget_summary AS
SELECT 
  t.id as trip_id,
  t.budget_total_cents,
  t.budget_currency,
  t.travelers,
  CASE WHEN t.travelers > 0 THEN t.budget_total_cents / t.travelers ELSE t.budget_total_cents END as budget_per_person_cents,
  t.budget_include_hotel,
  t.budget_include_flight,
  t.budget_allocations,
  
  -- Committed amounts (booked/purchased)
  COALESCE(SUM(CASE WHEN l.entry_type = 'committed' AND l.category = 'hotel' THEN l.amount_cents END), 0) as committed_hotel_cents,
  COALESCE(SUM(CASE WHEN l.entry_type = 'committed' AND l.category = 'flight' THEN l.amount_cents END), 0) as committed_flight_cents,
  COALESCE(SUM(CASE WHEN l.entry_type = 'committed' AND l.category NOT IN ('hotel', 'flight') THEN l.amount_cents END), 0) as committed_other_cents,
  
  -- Planned amounts (itinerary estimates)
  COALESCE(SUM(CASE WHEN l.entry_type = 'planned' THEN l.amount_cents END), 0) as planned_total_cents,
  COALESCE(SUM(CASE WHEN l.entry_type = 'planned' AND l.category = 'food' THEN l.amount_cents END), 0) as planned_food_cents,
  COALESCE(SUM(CASE WHEN l.entry_type = 'planned' AND l.category = 'activities' THEN l.amount_cents END), 0) as planned_activities_cents,
  COALESCE(SUM(CASE WHEN l.entry_type = 'planned' AND l.category = 'transit' THEN l.amount_cents END), 0) as planned_transit_cents,
  
  -- Total committed
  COALESCE(SUM(CASE WHEN l.entry_type = 'committed' THEN l.amount_cents END), 0) as total_committed_cents,
  
  -- Remaining = Budget - Committed (if include flags)
  t.budget_total_cents - (
    CASE WHEN t.budget_include_hotel THEN COALESCE(SUM(CASE WHEN l.entry_type = 'committed' AND l.category = 'hotel' THEN l.amount_cents END), 0) ELSE 0 END +
    CASE WHEN t.budget_include_flight THEN COALESCE(SUM(CASE WHEN l.entry_type = 'committed' AND l.category = 'flight' THEN l.amount_cents END), 0) ELSE 0 END +
    COALESCE(SUM(CASE WHEN l.entry_type = 'committed' AND l.category NOT IN ('hotel', 'flight') THEN l.amount_cents END), 0)
  ) as remaining_cents

FROM public.trips t
LEFT JOIN public.trip_budget_ledger l ON l.trip_id = t.id
WHERE t.budget_total_cents IS NOT NULL
GROUP BY t.id, t.budget_total_cents, t.budget_currency, t.travelers, 
         t.budget_include_hotel, t.budget_include_flight, t.budget_allocations;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_budget_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_budget_ledger_timestamp
  BEFORE UPDATE ON public.trip_budget_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.update_budget_ledger_updated_at();