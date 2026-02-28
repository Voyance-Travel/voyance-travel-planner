/**
 * DNA Blending Utility
 * 
 * Client-side blending of Travel DNA trait scores for group trips.
 * Used by BlendedProfilesCard and trip creation flow.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TravelerDnaInput {
  userId: string;
  name: string;
  archetypeId: string;
  traitScores: Record<string, number>; // e.g., { pace: 5, adventure: 8, comfort: 3 }
  isOwner: boolean;
  includePreferences: boolean;
}

export interface BlendedDnaResult {
  blendedTraits: Record<string, number>;
  dominantArchetype: string;
  travelerProfiles: Array<{
    userId: string;
    name: string;
    archetypeId: string;
    isOwner: boolean;
    weight: number;
  }>;
  blendMethod: 'weighted_average';
  ownerWeight: number;
  isBlended: boolean;
}

// ============================================================================
// BLENDING ALGORITHM
// ============================================================================

/**
 * Blend multiple travelers' DNA trait scores into a unified profile.
 * 
 * Rules:
 * - Owner gets 50% weight
 * - Remaining 50% split equally among companions with includePreferences=true
 * - Companions with includePreferences=false are excluded
 * - If no companions have includePreferences=true, returns 100% owner DNA
 */
export function blendTravelDna(travelers: TravelerDnaInput[]): BlendedDnaResult {
  const owner = travelers.find(t => t.isOwner);
  if (!owner) {
    // Fallback: first traveler is treated as owner
    const fallbackOwner = travelers[0];
    return {
      blendedTraits: fallbackOwner?.traitScores || {},
      dominantArchetype: fallbackOwner?.archetypeId || 'balanced_story_collector',
      travelerProfiles: travelers.map(t => ({
        userId: t.userId,
        name: t.name,
        archetypeId: t.archetypeId,
        isOwner: t.isOwner,
        weight: 1 / travelers.length,
      })),
      blendMethod: 'weighted_average',
      ownerWeight: 1,
      isBlended: false,
    };
  }

  const includedCompanions = travelers.filter(t => !t.isOwner && t.includePreferences);

  // No companions with blend enabled — use 100% owner
  if (includedCompanions.length === 0) {
    return {
      blendedTraits: { ...owner.traitScores },
      dominantArchetype: owner.archetypeId,
      travelerProfiles: [{
        userId: owner.userId,
        name: owner.name,
        archetypeId: owner.archetypeId,
        isOwner: true,
        weight: 1,
      }],
      blendMethod: 'weighted_average',
      ownerWeight: 1,
      isBlended: false,
    };
  }

  // Owner gets 50%, remaining 50% split among companions
  const ownerWeight = 0.5;
  const companionWeight = 0.5 / includedCompanions.length;

  // Collect all trait keys
  const allTraitKeys = new Set<string>();
  Object.keys(owner.traitScores).forEach(k => allTraitKeys.add(k));
  includedCompanions.forEach(c => Object.keys(c.traitScores).forEach(k => allTraitKeys.add(k)));

  // Blend traits
  const blendedTraits: Record<string, number> = {};
  for (const key of allTraitKeys) {
    const ownerScore = owner.traitScores[key] ?? 0;
    const companionSum = includedCompanions.reduce(
      (sum, c) => sum + (c.traitScores[key] ?? 0) * companionWeight,
      0
    );
    blendedTraits[key] = Math.round(ownerScore * ownerWeight + companionSum);
  }

  // Determine dominant archetype (owner's by default, since they have highest weight)
  const dominantArchetype = owner.archetypeId;

  // Build profiles with weights
  const travelerProfiles = [
    {
      userId: owner.userId,
      name: owner.name,
      archetypeId: owner.archetypeId,
      isOwner: true,
      weight: ownerWeight,
    },
    ...includedCompanions.map(c => ({
      userId: c.userId,
      name: c.name,
      archetypeId: c.archetypeId,
      isOwner: false,
      weight: companionWeight,
    })),
  ];

  return {
    blendedTraits,
    dominantArchetype,
    travelerProfiles,
    blendMethod: 'weighted_average',
    ownerWeight,
    isBlended: true,
  };
}

// ============================================================================
// TRAIT COMPARISON HELPERS (for BlendedProfilesCard)
// ============================================================================

export interface TraitComparison {
  name: string;
  ownerScore: number;
  blendedScore: number;
  status: 'aligned' | 'compromised' | 'boosted';
  description: string;
}

const TRAIT_LABELS: Record<string, string> = {
  pace: 'Pace',
  budget: 'Budget',
  social: 'Social',
  planning: 'Planning',
  comfort: 'Comfort',
  authenticity: 'Authenticity',
  adventure: 'Adventure',
  cultural: 'Cultural',
};

const TRAIT_DESCRIPTIONS: Record<string, { low: string; high: string }> = {
  pace: { low: 'Relaxed rhythm', high: 'Energetic exploration' },
  budget: { low: 'Luxury splurges', high: 'Value-focused' },
  social: { low: 'Intimate moments', high: 'Social adventures' },
  comfort: { low: 'Roughing it', high: 'Pure comfort' },
  adventure: { low: 'Safe & steady', high: 'Thrill-seeking' },
  authenticity: { low: 'Popular spots', high: 'Local deep-dives' },
  cultural: { low: 'Light culture', high: 'Culture immersion' },
  planning: { low: 'Spontaneous flow', high: 'Structured days' },
};

/**
 * Compare owner's traits vs blended traits to show alignment/compromises
 */
export function compareTraits(
  ownerTraits: Record<string, number>,
  blendedTraits: Record<string, number>
): TraitComparison[] {
  const comparisons: TraitComparison[] = [];

  for (const [key, label] of Object.entries(TRAIT_LABELS)) {
    const ownerScore = ownerTraits[key] ?? 0;
    const blendedScore = blendedTraits[key] ?? 0;
    const diff = Math.abs(ownerScore - blendedScore);

    let status: TraitComparison['status'];
    if (diff <= 2) {
      status = 'aligned';
    } else if (blendedScore > ownerScore) {
      status = 'boosted';
    } else {
      status = 'compromised';
    }

    const descs = TRAIT_DESCRIPTIONS[key];
    const description = descs
      ? (blendedScore >= 0 ? descs.high : descs.low)
      : `Score: ${blendedScore}`;

    comparisons.push({ name: label, ownerScore, blendedScore, status, description });
  }

  return comparisons;
}
