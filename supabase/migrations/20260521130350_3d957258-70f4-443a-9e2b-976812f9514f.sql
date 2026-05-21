-- Restore primary/secondary/confidence from latest non-null-secondary history snapshot
-- for the 4 users whose secondary was clobbered by the now-removed auto-recalc.
WITH latest_good AS (
  SELECT DISTINCT ON (h.user_id)
    h.user_id,
    (h.profile_snapshot->>'primary_archetype_name') AS primary_archetype_name,
    (h.profile_snapshot->>'secondary_archetype_name') AS secondary_archetype_name,
    NULLIF(h.profile_snapshot->>'dna_confidence_score','')::numeric AS dna_confidence_score
  FROM travel_dna_history h
  WHERE h.profile_snapshot->>'secondary_archetype_name' IS NOT NULL
    AND h.profile_snapshot->>'secondary_archetype_name' <> ''
  ORDER BY h.user_id, h.created_at DESC
)
UPDATE travel_dna_profiles p
SET
  primary_archetype_name = lg.primary_archetype_name,
  secondary_archetype_name = lg.secondary_archetype_name,
  dna_confidence_score = COALESCE(lg.dna_confidence_score::int, p.dna_confidence_score),
  updated_at = now()
FROM latest_good lg
WHERE p.user_id = lg.user_id
  AND p.secondary_archetype_name IS NULL
  AND p.primary_archetype_name IS NOT NULL;