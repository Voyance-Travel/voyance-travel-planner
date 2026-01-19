/**
 * Dynamic User Preference Weighting Engine
 * 
 * This is the most sophisticated algorithm in the system - it creates dynamic,
 * per-trip preference weights by blending:
 * 
 * 1. Long-term user profile (Travel DNA)
 * 2. Trip context (occasion, budget, party composition)
 * 3. Live user behavior (likes, dislikes, selections)
 * 
 * The output is 8 normalized weights (sum = 1.0) that can be used
 * to score and rank any travel options (hotels, flights, activities).
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PreferenceWeights {
  price: number;      // Price sensitivity
  speed: number;      // Time efficiency
  comfort: number;    // Comfort/luxury priority
  simplicity: number; // Ease/convenience
  eco: number;        // Environmental impact
  adventure: number;  // Unique experiences
  social: number;     // Social experiences
  culture: number;    // Cultural immersion
}

export interface TravelDNAProfile {
  trait_scores?: Record<string, number>;
  emotional_drivers?: string[];
  tone_tags?: string[];
  primary_archetype_name?: string;
}

export interface TripContext {
  occasion?: 'business' | 'honeymoon' | 'anniversary' | 'adventure' | 'relaxation' | 'family' | 'solo' | 'friends' | 'general';
  budget_tier?: 'budget' | 'mid-range' | 'luxury' | 'ultra-luxury';
  party_composition?: 'solo' | 'couple' | 'family' | 'friends' | 'business';
  duration_days?: number;
  destination_type?: 'city' | 'beach' | 'mountain' | 'adventure' | 'cultural';
}

export interface UserInteraction {
  type: 'like' | 'save' | 'select' | 'dislike' | 'remove' | 'ignore';
  optionId: string;
  optionType: 'hotel' | 'flight' | 'activity';
  optionMetadata: OptionMetadata;
  timestamp: number;
}

export interface OptionMetadata {
  priceScore?: number;      // 0-1, higher = more expensive
  speedScore?: number;      // 0-1, higher = faster/more efficient
  comfortScore?: number;    // 0-1, higher = more comfortable
  simplicityScore?: number; // 0-1, higher = simpler/easier
  ecoScore?: number;        // 0-1, higher = more eco-friendly
  adventureScore?: number;  // 0-1, higher = more adventurous
  socialScore?: number;     // 0-1, higher = more social
  cultureScore?: number;    // 0-1, higher = more cultural
  tags?: string[];
}

export interface SessionBias {
  adjustments: Partial<PreferenceWeights>;
  interactionCount: number;
  confidence: number;
  lastUpdated: number;
}

export interface ScoredOption<T = unknown> {
  option: T;
  weightedScore: number;
  matchReasons: string[];
  dimensionScores: Record<string, number>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_WEIGHTS: PreferenceWeights = {
  price: 0.125,
  speed: 0.125,
  comfort: 0.125,
  simplicity: 0.125,
  eco: 0.125,
  adventure: 0.125,
  social: 0.125,
  culture: 0.125,
};

const INTERACTION_MULTIPLIERS: Record<UserInteraction['type'], number> = {
  like: 0.3,      // Positive signal
  save: 0.5,      // Strong positive signal
  select: 0.7,    // Very strong positive signal
  dislike: -0.4,  // Negative signal
  remove: -0.6,   // Strong negative signal
  ignore: -0.1,   // Weak negative signal
};

const LEARNING_RATE = 0.1;
const MIN_INTERACTIONS_FOR_BIAS = 3;
const CONFIDENCE_MAX_INTERACTIONS = 20;

// ============================================================================
// PARTY COMPOSITION ADJUSTMENTS
// ============================================================================

const PARTY_ADJUSTMENTS: Record<string, Partial<PreferenceWeights>> = {
  solo: {
    adventure: 1.3,
    simplicity: 1.1,
    social: 0.7,
  },
  couple: {
    comfort: 1.2,
    social: 0.9,
    adventure: 1.1,
  },
  family: {
    simplicity: 1.3,
    comfort: 1.2,
    adventure: 0.8,
    eco: 1.1,
  },
  friends: {
    social: 1.4,
    adventure: 1.2,
    comfort: 0.9,
  },
  business: {
    speed: 1.4,
    comfort: 1.3,
    price: 0.7,
    simplicity: 1.2,
  },
};

// ============================================================================
// BUDGET ZONE ADJUSTMENTS
// ============================================================================

const BUDGET_ADJUSTMENTS: Record<string, Partial<PreferenceWeights>> = {
  budget: {
    price: 1.5,
    comfort: 0.7,
    simplicity: 1.2,
  },
  'mid-range': {
    price: 1.0,
    comfort: 1.0,
    simplicity: 1.0,
  },
  luxury: {
    price: 0.6,
    comfort: 1.4,
    simplicity: 1.1,
  },
  'ultra-luxury': {
    price: 0.3,
    comfort: 1.6,
    simplicity: 1.3,
  },
};

// ============================================================================
// OCCASION ADJUSTMENTS
// ============================================================================

const OCCASION_ADJUSTMENTS: Record<string, Partial<PreferenceWeights>> = {
  honeymoon: {
    comfort: 1.3,
    social: 0.7,
    culture: 1.2,
    adventure: 1.1,
  },
  anniversary: {
    comfort: 1.3,
    social: 0.7,
    culture: 1.2,
  },
  adventure: {
    adventure: 1.5,
    comfort: 0.8,
    speed: 0.9,
  },
  relaxation: {
    comfort: 1.4,
    simplicity: 1.3,
    adventure: 0.6,
    speed: 0.8,
  },
  business: {
    speed: 1.4,
    comfort: 1.3,
    price: 0.7,
    simplicity: 1.2,
  },
  family: {
    simplicity: 1.3,
    comfort: 1.2,
    adventure: 0.8,
    eco: 1.1,
  },
  solo: {
    adventure: 1.3,
    culture: 1.2,
    social: 0.8,
  },
  friends: {
    social: 1.4,
    adventure: 1.2,
    comfort: 0.9,
  },
  general: {},
};

// ============================================================================
// MAIN ENGINE CLASS
// ============================================================================

export class UserPreferenceWeightingEngine {
  private travelDNA: TravelDNAProfile | null = null;
  private tripContext: TripContext = {};
  private sessionBias: SessionBias = {
    adjustments: {},
    interactionCount: 0,
    confidence: 0,
    lastUpdated: Date.now(),
  };
  private dealBreakers: string[] = [];
  private specialInterests: string[] = [];

  /**
   * Initialize the engine with user profile and trip context
   */
  initialize(
    travelDNA: TravelDNAProfile | null,
    tripContext: TripContext,
    dealBreakers: string[] = [],
    specialInterests: string[] = []
  ): void {
    this.travelDNA = travelDNA;
    this.tripContext = tripContext;
    this.dealBreakers = dealBreakers;
    this.specialInterests = specialInterests;
    this.sessionBias = {
      adjustments: {},
      interactionCount: 0,
      confidence: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Step 1: Blend profile and trip context for base weights
   */
  calculateBaseWeights(): PreferenceWeights {
    const weights = { ...DEFAULT_WEIGHTS };

    // Apply Travel DNA adjustments
    if (this.travelDNA?.trait_scores) {
      this.applyTraitScoreAdjustments(weights, this.travelDNA.trait_scores);
    }

    // Apply party composition adjustments
    if (this.tripContext.party_composition) {
      this.applyMultipliers(weights, PARTY_ADJUSTMENTS[this.tripContext.party_composition] || {});
    }

    // Apply budget adjustments
    if (this.tripContext.budget_tier) {
      this.applyMultipliers(weights, BUDGET_ADJUSTMENTS[this.tripContext.budget_tier] || {});
    }

    // Apply occasion adjustments
    if (this.tripContext.occasion) {
      this.applyMultipliers(weights, OCCASION_ADJUSTMENTS[this.tripContext.occasion] || {});
    }

    // Normalize weights to sum to 1.0
    return this.normalizeWeights(weights);
  }

  /**
   * Apply Travel DNA trait scores to weights
   * Maps the 8 trait dimensions to preference dimensions
   */
  private applyTraitScoreAdjustments(
    weights: PreferenceWeights,
    traitScores: Record<string, number>
  ): void {
    // Map trait scores (-10 to +10) to weight multipliers (0.5 to 1.5)
    const toMultiplier = (score: number): number => 1 + (score / 20);

    // Planning → simplicity, speed
    if (traitScores.planning !== undefined) {
      const mult = toMultiplier(traitScores.planning);
      weights.simplicity *= mult;
      weights.speed *= mult;
    }

    // Social → social dimension
    if (traitScores.social !== undefined) {
      weights.social *= toMultiplier(traitScores.social);
    }

    // Comfort → comfort dimension
    if (traitScores.comfort !== undefined) {
      weights.comfort *= toMultiplier(traitScores.comfort);
    }

    // Pace → speed (inverted - slow pace = lower speed priority)
    if (traitScores.pace !== undefined) {
      weights.speed *= toMultiplier(traitScores.pace);
    }

    // Authenticity → culture
    if (traitScores.authenticity !== undefined) {
      weights.culture *= toMultiplier(traitScores.authenticity);
    }

    // Adventure → adventure dimension
    if (traitScores.adventure !== undefined) {
      weights.adventure *= toMultiplier(traitScores.adventure);
    }

    // Budget → price (inverted - high budget score = lower price sensitivity)
    if (traitScores.budget !== undefined) {
      weights.price *= toMultiplier(-traitScores.budget);
    }

    // Transformation → culture, adventure
    if (traitScores.transformation !== undefined) {
      const mult = toMultiplier(traitScores.transformation * 0.5);
      weights.culture *= mult;
      weights.adventure *= mult;
    }
  }

  /**
   * Apply multipliers to weights
   */
  private applyMultipliers(
    weights: PreferenceWeights,
    multipliers: Partial<PreferenceWeights>
  ): void {
    for (const [key, mult] of Object.entries(multipliers)) {
      if (key in weights && mult !== undefined) {
        weights[key as keyof PreferenceWeights] *= mult;
      }
    }
  }

  /**
   * Normalize weights to sum to 1.0
   */
  private normalizeWeights(weights: PreferenceWeights): PreferenceWeights {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return { ...DEFAULT_WEIGHTS };

    const normalized = { ...weights };
    for (const key of Object.keys(normalized) as Array<keyof PreferenceWeights>) {
      normalized[key] = normalized[key] / sum;
    }
    return normalized;
  }

  /**
   * Step 2: Process user interaction and update session bias
   */
  processInteraction(interaction: UserInteraction): void {
    const multiplier = INTERACTION_MULTIPLIERS[interaction.type];
    const metadata = interaction.optionMetadata;

    // Calculate adjustment for each dimension based on the interaction
    const dimensionMappings: Array<{ key: keyof PreferenceWeights; metaKey: keyof OptionMetadata }> = [
      { key: 'price', metaKey: 'priceScore' },
      { key: 'speed', metaKey: 'speedScore' },
      { key: 'comfort', metaKey: 'comfortScore' },
      { key: 'simplicity', metaKey: 'simplicityScore' },
      { key: 'eco', metaKey: 'ecoScore' },
      { key: 'adventure', metaKey: 'adventureScore' },
      { key: 'social', metaKey: 'socialScore' },
      { key: 'culture', metaKey: 'cultureScore' },
    ];

    for (const { key, metaKey } of dimensionMappings) {
      const rawScore = metadata[metaKey];
      if (typeof rawScore === 'number') {
        const adjustment = rawScore * multiplier * LEARNING_RATE;
        const currentAdjustment = this.sessionBias.adjustments[key] || 0;
        this.sessionBias.adjustments[key] = currentAdjustment + adjustment;
      }
    }

    this.sessionBias.interactionCount++;
    this.sessionBias.confidence = Math.min(
      1,
      this.sessionBias.interactionCount / CONFIDENCE_MAX_INTERACTIONS
    );
    this.sessionBias.lastUpdated = Date.now();
  }

  /**
   * Step 3: Get final weights with session bias applied
   */
  getFinalWeights(): PreferenceWeights {
    const baseWeights = this.calculateBaseWeights();

    // Only apply bias after minimum interactions
    if (this.sessionBias.interactionCount < MIN_INTERACTIONS_FOR_BIAS) {
      return baseWeights;
    }

    // Apply session bias with confidence weighting
    const finalWeights = { ...baseWeights };
    for (const [key, adjustment] of Object.entries(this.sessionBias.adjustments)) {
      if (key in finalWeights) {
        const weightedAdjustment = (adjustment || 0) * this.sessionBias.confidence;
        finalWeights[key as keyof PreferenceWeights] += weightedAdjustment;
        // Ensure weights stay positive
        finalWeights[key as keyof PreferenceWeights] = Math.max(0.01, finalWeights[key as keyof PreferenceWeights]);
      }
    }

    // Re-normalize after adjustments
    return this.normalizeWeights(finalWeights);
  }

  /**
   * Step 4: Score options with final weights
   */
  scoreOptions<T extends { metadata?: OptionMetadata; tags?: string[] }>(
    options: T[]
  ): ScoredOption<T>[] {
    const weights = this.getFinalWeights();

    return options.map(option => {
      const metadata = option.metadata || {};
      const tags = option.tags || [];

      // Calculate weighted score across all dimensions
      let weightedScore = 0;
      const dimensionScores: Record<string, number> = {};
      const matchReasons: string[] = [];

      const dimensionMappings: Array<{ key: keyof PreferenceWeights; metaKey: keyof OptionMetadata; label: string }> = [
        { key: 'price', metaKey: 'priceScore', label: 'Price' },
        { key: 'speed', metaKey: 'speedScore', label: 'Speed' },
        { key: 'comfort', metaKey: 'comfortScore', label: 'Comfort' },
        { key: 'simplicity', metaKey: 'simplicityScore', label: 'Convenience' },
        { key: 'eco', metaKey: 'ecoScore', label: 'Eco-friendly' },
        { key: 'adventure', metaKey: 'adventureScore', label: 'Adventure' },
        { key: 'social', metaKey: 'socialScore', label: 'Social' },
        { key: 'culture', metaKey: 'cultureScore', label: 'Cultural' },
      ];

      for (const { key, metaKey, label } of dimensionMappings) {
        const rawScore = metadata[metaKey];
        const score = typeof rawScore === 'number' ? rawScore : 0.5; // Default to neutral
        const weight = weights[key];
        const dimensionContribution = weight * score;
        
        dimensionScores[key] = dimensionContribution;
        weightedScore += dimensionContribution;

        // Add match reason for high scores
        if (score >= 0.8 && weight >= 0.15) {
          matchReasons.push(`Excellent ${label.toLowerCase()}`);
        }
      }

      // Apply deal breaker penalty (70% reduction)
      const hasDealBreaker = this.dealBreakers.some(db => 
        tags.map(t => t.toLowerCase()).includes(db.toLowerCase())
      );
      if (hasDealBreaker) {
        weightedScore *= 0.3;
        matchReasons.push('Contains deal-breaker');
      }

      // Apply special interest bonus (15% per match)
      const matchingInterests = this.specialInterests.filter(interest =>
        tags.map(t => t.toLowerCase()).includes(interest.toLowerCase())
      );
      if (matchingInterests.length > 0) {
        weightedScore *= 1 + matchingInterests.length * 0.15;
        matchReasons.push(`Matches interests: ${matchingInterests.join(', ')}`);
      }

      // Clamp final score
      weightedScore = Math.max(0, Math.min(1, weightedScore));

      return {
        option,
        weightedScore,
        matchReasons: matchReasons.slice(0, 3), // Max 3 reasons
        dimensionScores,
      };
    });
  }

  /**
   * Step 5: Rank and return best recommendations
   */
  rankOptions<T extends { metadata?: OptionMetadata; tags?: string[] }>(
    options: T[],
    limit?: number
  ): ScoredOption<T>[] {
    const scored = this.scoreOptions(options);
    scored.sort((a, b) => b.weightedScore - a.weightedScore);
    return limit ? scored.slice(0, limit) : scored;
  }

  /**
   * Get current session state for debugging/persistence
   */
  getSessionState(): {
    baseWeights: PreferenceWeights;
    finalWeights: PreferenceWeights;
    sessionBias: SessionBias;
    tripContext: TripContext;
  } {
    return {
      baseWeights: this.calculateBaseWeights(),
      finalWeights: this.getFinalWeights(),
      sessionBias: { ...this.sessionBias },
      tripContext: { ...this.tripContext },
    };
  }

  /**
   * Restore session state
   */
  restoreSessionBias(bias: SessionBias): void {
    this.sessionBias = { ...bias };
  }
}

// ============================================================================
// SINGLETON INSTANCE & HELPER FUNCTIONS
// ============================================================================

let engineInstance: UserPreferenceWeightingEngine | null = null;

/**
 * Get or create engine instance
 */
export function getPreferenceEngine(): UserPreferenceWeightingEngine {
  if (!engineInstance) {
    engineInstance = new UserPreferenceWeightingEngine();
  }
  return engineInstance;
}

/**
 * Quick scoring function without full engine setup
 */
export function quickScore(
  options: Array<{ metadata?: OptionMetadata; tags?: string[] }>,
  weights: Partial<PreferenceWeights> = {}
): ScoredOption[] {
  const finalWeights: PreferenceWeights = { ...DEFAULT_WEIGHTS, ...weights };
  const sum = Object.values(finalWeights).reduce((a, b) => a + b, 0);
  
  // Normalize
  for (const key of Object.keys(finalWeights) as Array<keyof PreferenceWeights>) {
    finalWeights[key] = finalWeights[key] / sum;
  }

  const engine = new UserPreferenceWeightingEngine();
  engine.initialize(null, {});
  
  return options.map(option => {
    const metadata = option.metadata || {};
    let weightedScore = 0;

    weightedScore += (metadata.priceScore ?? 0.5) * finalWeights.price;
    weightedScore += (metadata.speedScore ?? 0.5) * finalWeights.speed;
    weightedScore += (metadata.comfortScore ?? 0.5) * finalWeights.comfort;
    weightedScore += (metadata.simplicityScore ?? 0.5) * finalWeights.simplicity;
    weightedScore += (metadata.ecoScore ?? 0.5) * finalWeights.eco;
    weightedScore += (metadata.adventureScore ?? 0.5) * finalWeights.adventure;
    weightedScore += (metadata.socialScore ?? 0.5) * finalWeights.social;
    weightedScore += (metadata.cultureScore ?? 0.5) * finalWeights.culture;

    return {
      option,
      weightedScore: Math.max(0, Math.min(1, weightedScore)),
      matchReasons: [],
      dimensionScores: {},
    };
  });
}

/**
 * Blend preferences for group trips
 * Takes multiple user profiles and returns weighted average preferences
 */
export function blendGroupPreferences(
  profiles: TravelDNAProfile[],
  weights?: number[] // Optional per-user weights (e.g., trip organizer has more weight)
): Record<string, number> {
  if (profiles.length === 0) return {};

  const normalizedWeights = weights 
    ? weights.map(w => w / weights.reduce((a, b) => a + b, 1))
    : profiles.map(() => 1 / profiles.length);

  const blendedTraits: Record<string, number> = {};
  const traitCounts: Record<string, number> = {};

  profiles.forEach((profile, index) => {
    const weight = normalizedWeights[index];
    const traits = profile.trait_scores || {};

    for (const [trait, scoreValue] of Object.entries(traits)) {
      const score = typeof scoreValue === 'number' ? scoreValue : 0;
      if (!(trait in blendedTraits)) {
        blendedTraits[trait] = 0;
        traitCounts[trait] = 0;
      }
      blendedTraits[trait] += score * weight;
      traitCounts[trait] += weight;
    }
  });

  // Average the blended traits
  for (const trait of Object.keys(blendedTraits)) {
    const count = traitCounts[trait];
    if (typeof count === 'number' && count > 0) {
      blendedTraits[trait] = Math.round(blendedTraits[trait] / count);
    }
  }

  return blendedTraits;
}
