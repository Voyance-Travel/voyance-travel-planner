-- Fix security definer view by recreating with security_invoker
DROP VIEW IF EXISTS public.trip_budget_summary;

CREATE VIEW public.trip_budget_summary
WITH (security_invoker = on)
AS
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