/**
 * Single source of truth for resolving a user's archetype from a DNA profile row.
 * Multiple historical schema shapes exist (canonical column, v2 blob, v2 matches,
 * legacy top-level matches). Centralizing the resolution prevents drift between
 * consumers (profile-loader, explain-recommendation, action-generate-trip, …).
 */

export interface DnaArchetypeMatch {
  archetype_id?: string;
  name?: string;
}

export interface DnaProfileLike {
  primary_archetype_name?: string | null;
  secondary_archetype_name?: string | null;
  trait_scores?: Record<string, number> | null;
  archetype_matches?: DnaArchetypeMatch[] | null;
  travel_dna_v2?: {
    primary_archetype_name?: string | null;
    archetype_matches?: DnaArchetypeMatch[] | null;
  } | null;
}

export type ArchetypeSource =
  | 'canonical'
  | 'v2_blob'
  | 'v2_matches'
  | 'legacy_matches'
  | 'default';

export function resolvePrimaryArchetype(
  profile: DnaProfileLike | null | undefined
): { archetype: string; source: ArchetypeSource } {
  if (!profile) return { archetype: 'Explorer', source: 'default' };

  if (profile.primary_archetype_name) {
    return { archetype: profile.primary_archetype_name, source: 'canonical' };
  }

  const v2 = profile.travel_dna_v2 as DnaProfileLike['travel_dna_v2'];
  if (v2?.primary_archetype_name) {
    return { archetype: v2.primary_archetype_name, source: 'v2_blob' };
  }

  if (Array.isArray(v2?.archetype_matches) && v2.archetype_matches[0]?.name) {
    return { archetype: v2.archetype_matches[0].name, source: 'v2_matches' };
  }

  if (
    Array.isArray(profile.archetype_matches) &&
    profile.archetype_matches[0]?.name
  ) {
    return { archetype: profile.archetype_matches[0].name, source: 'legacy_matches' };
  }

  return { archetype: 'Explorer', source: 'default' };
}
