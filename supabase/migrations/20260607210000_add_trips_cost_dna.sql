-- C-CRED-4: cost-parity snapshot column.
-- Stores EXACTLY the {dietary, budget, specialOccasion} object the client fed into
-- calculateTripCredits to produce the DISPLAYED trip-generation estimate at creation.
-- The server trip_generation charge recomputes the authoritative cost from this
-- snapshot (+ trip_cities count + metadata.mustDoActivities + budget_include_hotel +
-- dates) and charges that, guaranteeing the charge equals what the user was shown.
--
-- DISTINCT from trips.dna_snapshot (the full Travel DNA profile written at GENERATION
-- time by generate-itinerary/generation-core.ts) — do not conflate the two.
--
-- Backfill: existing rows are NULL. The server loader treats NULL as multiplier 1.0
-- (safe — matches today's behaviour where no DNA multiplier is applied).
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS cost_dna jsonb;

COMMENT ON COLUMN public.trips.cost_dna IS
  'Cost-parity snapshot of the {dietary, budget, specialOccasion} DNA object the client used to compute the displayed trip-generation estimate at creation time. Read by spend-credits (trip_generation) to recompute the authoritative charge. NULL => complexity multiplier 1.0.';
