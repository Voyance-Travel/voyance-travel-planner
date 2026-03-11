// Schema-Driven Generation — Archetype to Pattern Group Mapping
// Part of the isolated schema generation system (Fix 22A-E)
// This file has ZERO dependencies on existing generation code.
//
// IMPORTANT: Keys are snake_case IDs matching what's stored in
// travel_dna_profiles.primary_archetype_name (NOT display names).

import type { PatternGroup } from '@/types/schema-generation';

export const ARCHETYPE_TO_GROUP: Record<string, PatternGroup> = {
  // GROUP: PACKED — "Every hour counts"
  bucket_list_conqueror: 'packed',
  adrenaline_architect: 'packed',
  urban_nomad: 'packed',

  // GROUP: SOCIAL — "Light day, big night"
  social_butterfly: 'social',
  gap_year_graduate: 'social',
  digital_explorer: 'social',

  // GROUP: BALANCED — "A good mix of everything"
  balanced_story_collector: 'balanced',
  midlife_explorer: 'balanced',
  eco_ethicist: 'balanced',
  history_hunter: 'balanced',
  art_aficionado: 'balanced',
  collection_curator: 'balanced',
  sabbatical_scholar: 'balanced',
  community_builder: 'balanced',
  status_seeker: 'balanced',
  cultural_anthropologist: 'balanced',

  // GROUP: INDULGENT — "Meals and atmosphere ARE the activity"
  culinary_cartographer: 'indulgent',
  luxury_luminary: 'indulgent',
  romantic_curator: 'indulgent',

  // GROUP: GENTLE — "Less is more"
  slow_traveler: 'gentle',
  flexible_wanderer: 'gentle',
  zen_seeker: 'gentle',
  retreat_regular: 'gentle',
  beach_therapist: 'gentle',
  sanctuary_seeker: 'gentle',
  healing_journeyer: 'gentle',
  retirement_ranger: 'gentle',
  family_architect: 'gentle',
  wilderness_pioneer: 'gentle',
  escape_artist: 'gentle',
  story_seeker: 'gentle',
  explorer: 'gentle',
};

/**
 * Look up the pattern group for a given archetype ID.
 * Falls back to 'balanced' if the archetype is not found.
 */
export function getPatternGroupForArchetype(archetypeId: string): PatternGroup {
  if (!archetypeId) return 'balanced';

  // Direct lookup (expected path)
  if (ARCHETYPE_TO_GROUP[archetypeId]) {
    return ARCHETYPE_TO_GROUP[archetypeId];
  }

  // Normalize: lowercase, trim, replace spaces/hyphens with underscores
  const normalized = archetypeId.toLowerCase().trim()
    .replace(/^the\s+/i, '')
    .replace(/[\s-]+/g, '_');

  if (ARCHETYPE_TO_GROUP[normalized]) {
    return ARCHETYPE_TO_GROUP[normalized];
  }

  // Case-insensitive scan as last resort
  const lower = archetypeId.toLowerCase();
  for (const [key, group] of Object.entries(ARCHETYPE_TO_GROUP)) {
    if (key.toLowerCase() === lower) {
      return group;
    }
  }

  console.warn(
    `[schema-generation] Unknown archetype "${archetypeId}" — falling back to "balanced"`
  );
  return 'balanced';
}

/**
 * Get all archetype IDs that belong to a given pattern group.
 */
export function getArchetypesInGroup(group: PatternGroup): string[] {
  return Object.entries(ARCHETYPE_TO_GROUP)
    .filter(([, g]) => g === group)
    .map(([name]) => name);
}
