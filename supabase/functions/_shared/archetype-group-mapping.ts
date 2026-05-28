// Archetype → Pattern Group Mapping — Backend Mirror.
// Source of truth: src/config/archetype-group-mapping.ts (Fix 22A-E).

import type { PatternGroup } from './schema-generation.ts';

export const ARCHETYPE_TO_GROUP: Record<string, PatternGroup> = {
  // PACKED
  bucket_list_conqueror: 'packed',
  adrenaline_architect: 'packed',
  urban_nomad: 'packed',

  // SOCIAL
  social_butterfly: 'social',
  gap_year_graduate: 'social',
  digital_explorer: 'social',

  // BALANCED
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

  // INDULGENT
  culinary_cartographer: 'indulgent',
  luxury_luminary: 'indulgent',
  romantic_curator: 'indulgent',

  // GENTLE
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

export function getPatternGroupForArchetype(archetypeId: string | null | undefined): PatternGroup {
  if (!archetypeId) return 'balanced';
  if (ARCHETYPE_TO_GROUP[archetypeId]) return ARCHETYPE_TO_GROUP[archetypeId];

  const normalized = archetypeId.toLowerCase().trim()
    .replace(/^the\s+/i, '')
    .replace(/[\s-]+/g, '_');
  if (ARCHETYPE_TO_GROUP[normalized]) return ARCHETYPE_TO_GROUP[normalized];

  const lower = archetypeId.toLowerCase();
  for (const [key, group] of Object.entries(ARCHETYPE_TO_GROUP)) {
    if (key.toLowerCase() === lower) return group;
  }
  return 'balanced';
}
