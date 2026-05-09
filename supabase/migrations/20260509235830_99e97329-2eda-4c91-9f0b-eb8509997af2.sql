ALTER TABLE public.activity_costs
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

UPDATE public.activity_costs ac
   SET currency = COALESCE(t.budget_currency, 'USD')
  FROM public.trips t
 WHERE ac.trip_id = t.id
   AND (ac.currency IS NULL OR ac.currency = 'USD');