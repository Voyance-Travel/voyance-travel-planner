/**
 * Smart Defaults - Hook for archetype-aware default values
 * Sets things correctly so users don't have to change them
 * Shows, doesn't tell - user discovers we understood them
 */

import { useMemo } from 'react';
import { useCompanion } from '@/contexts/CompanionContext';

interface TripDefaults {
  /** Default pace (1-5, 1=slow, 5=packed) */
  pace: number;
  /** Default start time (hour, 0-23) */
  startTime: number;
  /** Whether to prioritize walkability */
  preferWalkable: boolean;
  /** Default budget level (1-3) */
  budgetLevel: number;
  /** Whether to include hidden gems */
  includeHiddenGems: boolean;
  /** Default activity mix */
  activityMix: 'balanced' | 'cultural' | 'adventure' | 'relaxation' | 'food';
}

// Archetype to defaults mapping
const archetypeDefaults: Record<string, Partial<TripDefaults>> = {
  // Explorers
  'cultural-anthropologist': {
    pace: 2,
    startTime: 9,
    includeHiddenGems: true,
    activityMix: 'cultural',
  },
  'urban-nomad': {
    pace: 3,
    startTime: 10,
    preferWalkable: true,
    activityMix: 'balanced',
  },
  'wilderness-pioneer': {
    pace: 3,
    startTime: 7,
    activityMix: 'adventure',
  },
  'digital-explorer': {
    pace: 2,
    startTime: 10,
    activityMix: 'balanced',
  },
  'flexible-wanderer': {
    pace: 2,
    startTime: 10,
    activityMix: 'balanced',
  },
  
  // Connectors
  'social-butterfly': {
    pace: 3,
    startTime: 10,
    activityMix: 'balanced',
  },
  'family-architect': {
    pace: 2,
    startTime: 9,
    activityMix: 'balanced',
  },
  'romantic-curator': {
    pace: 2,
    startTime: 10,
    activityMix: 'balanced',
  },
  
  // Achievers
  'bucket-list-conqueror': {
    pace: 4,
    startTime: 8,
    activityMix: 'adventure',
  },
  'adrenaline-architect': {
    pace: 4,
    startTime: 7,
    activityMix: 'adventure',
  },
  
  // Restorers
  'zen-seeker': {
    pace: 1,
    startTime: 9,
    activityMix: 'relaxation',
  },
  'slow-traveler': {
    pace: 1,
    startTime: 10,
    preferWalkable: true,
    activityMix: 'relaxation',
  },
  'beach-therapist': {
    pace: 1,
    startTime: 10,
    activityMix: 'relaxation',
  },
  
  // Curators
  'culinary-cartographer': {
    pace: 2,
    startTime: 10,
    activityMix: 'food',
  },
  'art-aficionado': {
    pace: 2,
    startTime: 10,
    activityMix: 'cultural',
  },
  'luxury-luminary': {
    pace: 2,
    startTime: 10,
    budgetLevel: 3,
    activityMix: 'relaxation',
  },
};

const baseDefaults: TripDefaults = {
  pace: 3,
  startTime: 9,
  preferWalkable: false,
  budgetLevel: 2,
  includeHiddenGems: false,
  activityMix: 'balanced',
};

/**
 * Returns smart defaults based on user's archetype
 * Use these to pre-fill form values so they're already right
 */
export function useSmartDefaults(): TripDefaults {
  const { archetype } = useCompanion();
  
  return useMemo(() => {
    if (!archetype) return baseDefaults;
    
    const archetypeKey = archetype.toLowerCase().replace(/\s+/g, '-');
    const overrides = archetypeDefaults[archetypeKey] || {};
    
    return {
      ...baseDefaults,
      ...overrides,
    };
  }, [archetype]);
}

/**
 * Get a specific default value
 */
export function useSmartDefault<K extends keyof TripDefaults>(key: K): TripDefaults[K] {
  const defaults = useSmartDefaults();
  return defaults[key];
}

/**
 * Check if user has archetype for smart defaults
 */
export function useHasSmartDefaults(): boolean {
  const { archetype } = useCompanion();
  return !!archetype;
}
