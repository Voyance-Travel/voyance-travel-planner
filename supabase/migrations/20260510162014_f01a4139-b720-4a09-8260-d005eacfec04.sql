UPDATE public.travel_dna_profiles
SET dna_recalc_needed_at = now()
WHERE dna_recalc_needed_at IS NULL
  AND primary_archetype_name IS NOT NULL
  AND trait_scores IS NOT NULL;