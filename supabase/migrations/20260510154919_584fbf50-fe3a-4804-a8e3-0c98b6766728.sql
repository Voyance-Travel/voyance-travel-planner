ALTER TABLE public.travel_dna_profiles
  ADD COLUMN IF NOT EXISTS dna_recalc_needed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.travel_dna_profiles.dna_recalc_needed_at IS
  'When non-null, client should re-run recalculateArchetype() on next load and clear this. Set by gate-change rollouts.';

UPDATE public.travel_dna_profiles
SET dna_recalc_needed_at = NOW()
WHERE dna_recalc_needed_at IS NULL;