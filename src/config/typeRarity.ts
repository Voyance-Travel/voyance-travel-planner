/**
 * Travel DNA Type Rarity Distribution
 * 
 * Based on expected travel behavior patterns.
 * Replace with real data once you have 500+ users.
 * 
 * Total distribution: ~100%
 */

export type RarityTier = 'very-common' | 'common' | 'uncommon' | 'rare' | 'very-rare';

export interface TypeRarity {
  percentage: number;
  tier: RarityTier;
  description: string;
}

export const TYPE_RARITY: Record<string, TypeRarity> = {
  // ═══════════════════════════════════════════════════════════════
  // EXPLORER CATEGORY
  // ═══════════════════════════════════════════════════════════════
  cultural_anthropologist: {
    percentage: 9.8,
    tier: 'common',
    description: 'Nearly 10% of travelers seek deep cultural connection',
  },
  urban_nomad: {
    percentage: 7.2,
    tier: 'uncommon',
    description: '7% of travelers share your city-first mindset',
  },
  wilderness_pioneer: {
    percentage: 3.2,
    tier: 'rare',
    description: 'Only 3% of travelers venture this far off the grid',
  },
  digital_explorer: {
    percentage: 4.2,
    tier: 'rare',
    description: 'Just 4% blend tech and travel like you',
  },
  explorer: {
    percentage: 15.0,
    tier: 'very-common',
    description: 'A natural explorer drawn to new experiences',
  },
  balanced_story_collector: {
    percentage: 15.0,
    tier: 'very-common',
    description: 'A versatile traveler who enjoys a mix of everything',
  },
  flexible_wanderer: {
    percentage: 15.0,
    tier: 'very-common',
    description: 'An adaptable traveler who goes with the flow',
  },

  // ═══════════════════════════════════════════════════════════════
  // CONNECTOR CATEGORY
  // ═══════════════════════════════════════════════════════════════
  social_butterfly: {
    percentage: 3.5,
    tier: 'rare',
    description: 'Only 3.5% of travelers are as social as you',
  },
  family_architect: {
    percentage: 12.5,
    tier: 'very-common',
    description: '12.5% of travelers prioritize family experiences',
  },
  romantic_curator: {
    percentage: 6.2,
    tier: 'uncommon',
    description: '6% of travelers focus on romantic getaways',
  },
  story_seeker: {
    percentage: 5.8,
    tier: 'uncommon',
    description: '6% of travelers collect stories like you',
  },
  community_builder: {
    percentage: 2.5,
    tier: 'rare',
    description: 'Only 2.5% of travelers build community through travel',
  },

  // ═══════════════════════════════════════════════════════════════
  // ACHIEVER CATEGORY
  // ═══════════════════════════════════════════════════════════════
  bucket_list_conqueror: {
    percentage: 8.5,
    tier: 'common',
    description: '8.5% of travelers share your list-checking drive',
  },
  adrenaline_architect: {
    percentage: 2.8,
    tier: 'rare',
    description: 'Under 3% of travelers match your thrill-seeking intensity',
  },
  collection_curator: {
    percentage: 4.1,
    tier: 'rare',
    description: 'Just 4% curate travel collections like you',
  },
  status_seeker: {
    percentage: 3.5,
    tier: 'rare',
    description: 'Only 3.5% of travelers seek prestige destinations like you',
  },

  // ═══════════════════════════════════════════════════════════════
  // RESTORER CATEGORY
  // ═══════════════════════════════════════════════════════════════
  zen_seeker: {
    percentage: 4.5,
    tier: 'rare',
    description: 'Only 4.5% of travelers prioritize mindfulness like you',
  },
  retreat_regular: {
    percentage: 3.8,
    tier: 'rare',
    description: 'Under 4% of travelers retreat as intentionally as you',
  },
  beach_therapist: {
    percentage: 8.8,
    tier: 'common',
    description: 'Nearly 9% of travelers share your love of the shore',
  },
  slow_traveler: {
    percentage: 11.5,
    tier: 'common',
    description: '11.5% of travelers prefer your unhurried pace',
  },
  escape_artist: {
    percentage: 5.2,
    tier: 'uncommon',
    description: 'Only 5% of travelers seek escape as completely as you',
  },
  sanctuary_seeker: {
    percentage: 2.1,
    tier: 'rare',
    description: 'Just 2% of travelers seek sanctuary this deeply',
  },

  // ═══════════════════════════════════════════════════════════════
  // CURATOR CATEGORY
  // ═══════════════════════════════════════════════════════════════
  culinary_cartographer: {
    percentage: 7.5,
    tier: 'uncommon',
    description: '7.5% of travelers share your food-first philosophy',
  },
  luxury_luminary: {
    percentage: 3.8,
    tier: 'rare',
    description: 'Under 4% of travelers seek luxury at your level',
  },
  art_aficionado: {
    percentage: 4.2,
    tier: 'rare',
    description: 'Only 4% of travelers curate art experiences like you',
  },
  eco_ethicist: {
    percentage: 2.2,
    tier: 'rare',
    description: 'Just 2% of travelers prioritize eco-ethics like you',
  },

  // ═══════════════════════════════════════════════════════════════
  // TRANSFORMER CATEGORY
  // ═══════════════════════════════════════════════════════════════
  gap_year_graduate: {
    percentage: 1.8,
    tier: 'very-rare',
    description: 'Less than 2% of travelers share your transformative gap-year spirit',
  },
  midlife_explorer: {
    percentage: 5.8,
    tier: 'uncommon',
    description: '6% of travelers embrace reinvention through travel',
  },
  sabbatical_scholar: {
    percentage: 1.5,
    tier: 'very-rare',
    description: 'Less than 2% of travelers pursue sabbatical-style deep dives',
  },
  healing_journeyer: {
    percentage: 1.2,
    tier: 'very-rare',
    description: 'Just 1% of travelers use journeys for deep healing like you',
  },
  retirement_ranger: {
    percentage: 4.5,
    tier: 'rare',
    description: 'Only 4.5% of travelers explore retirement this adventurously',
  },
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize archetype ID to match rarity keys
 * Handles display names, snake_case, kebab-case, "The X" prefixes
 */
function normalizeTypeId(typeId: string): string {
  return typeId
    .toLowerCase()
    .replace(/^the[\s_-]+/, '')
    .replace(/[\s-]+/g, '_');
}

/**
 * Get rarity info for a type
 */
export function getTypeRarity(typeId: string): TypeRarity | null {
  const normalized = normalizeTypeId(typeId);
  return TYPE_RARITY[normalized] || null;
}

/**
 * Get display string for type rarity
 */
export function getRarityDisplay(typeId: string): string {
  const rarity = getTypeRarity(typeId);
  if (!rarity) return '';
  return rarity.description;
}

/**
 * Get rarity tier label with emoji
 */
export function getRarityLabel(typeId: string): string {
  const rarity = getTypeRarity(typeId);
  if (!rarity) return 'Unique';
  
  switch (rarity.tier) {
    case 'very-rare': return '✨ Very Rare';
    case 'rare': return '💎 Rare';
    case 'uncommon': return '🔹 Uncommon';
    case 'common': return 'Common';
    case 'very-common': return 'Very Common';
  }
}

/**
 * Get full rarity badge for UI display
 */
export function getRarityBadge(typeId: string): {
  label: string;
  tier: RarityTier;
  percentage: number;
  description: string;
} | null {
  const rarity = getTypeRarity(typeId);
  if (!rarity) return null;

  return {
    label: getRarityLabel(typeId),
    tier: rarity.tier,
    percentage: rarity.percentage,
    description: rarity.description,
  };
}
