
-- Add pattern_group column to profiles table (additive, nullable)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pattern_group TEXT DEFAULT NULL;
COMMENT ON COLUMN profiles.pattern_group IS 'DNA pattern group: packed, social, balanced, indulgent, gentle. Set on quiz completion.';

-- Backfill existing profiles using snake_case archetype IDs
-- Extract primary_archetype_name from travel_dna JSONB

UPDATE profiles SET pattern_group = 'packed'
WHERE pattern_group IS NULL
AND travel_dna IS NOT NULL
AND (travel_dna->>'primary_archetype_name') IN ('bucket_list_conqueror', 'adrenaline_architect', 'urban_nomad');

UPDATE profiles SET pattern_group = 'social'
WHERE pattern_group IS NULL
AND travel_dna IS NOT NULL
AND (travel_dna->>'primary_archetype_name') IN ('social_butterfly', 'gap_year_graduate', 'digital_explorer');

UPDATE profiles SET pattern_group = 'balanced'
WHERE pattern_group IS NULL
AND travel_dna IS NOT NULL
AND (travel_dna->>'primary_archetype_name') IN (
  'balanced_story_collector', 'midlife_explorer', 'eco_ethicist',
  'history_hunter', 'art_aficionado', 'collection_curator',
  'sabbatical_scholar', 'community_builder', 'status_seeker',
  'cultural_anthropologist'
);

UPDATE profiles SET pattern_group = 'indulgent'
WHERE pattern_group IS NULL
AND travel_dna IS NOT NULL
AND (travel_dna->>'primary_archetype_name') IN ('culinary_cartographer', 'luxury_luminary', 'romantic_curator');

UPDATE profiles SET pattern_group = 'gentle'
WHERE pattern_group IS NULL
AND travel_dna IS NOT NULL
AND (travel_dna->>'primary_archetype_name') IN (
  'slow_traveler', 'flexible_wanderer', 'zen_seeker',
  'retreat_regular', 'beach_therapist', 'sanctuary_seeker',
  'healing_journeyer', 'retirement_ranger', 'family_architect',
  'wilderness_pioneer', 'escape_artist', 'story_seeker', 'explorer'
);

-- Catch-all: any remaining profiles with travel_dna but no pattern_group
UPDATE profiles SET pattern_group = 'balanced'
WHERE pattern_group IS NULL
AND travel_dna IS NOT NULL;
