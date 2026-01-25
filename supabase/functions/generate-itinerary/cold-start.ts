/**
 * COLD START PROTECTION
 * 
 * When quiz/preferences are thin, the model defaults to generic.
 * This module handles new users gracefully with:
 * - Top 5 non-negotiables capture
 * - Default persona with explicit uncertainty
 * - Early taste calibration signals
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DataCompleteness {
  hasQuiz: boolean;
  quizCompleteness: number; // 0-1
  hasPreferences: boolean;
  preferencesCompleteness: number; // 0-1
  hasOverrides: boolean;
  hasTripHistory: boolean;
  tripCount: number;
  confidenceLevel: 'high' | 'medium' | 'low' | 'cold_start';
  dataGaps: string[];
}

export interface ColdStartFallback {
  defaultPersona: DefaultPersona;
  uncertaintyFlags: string[];
  calibrationPrompts: CalibrationPrompt[];
  assumptionsExplained: string;
}

export interface DefaultPersona {
  name: string;
  traits: Record<string, number>;
  interests: string[];
  pace: 'relaxed' | 'moderate' | 'active';
  budgetStyle: 'value-focused' | 'balanced' | 'quality-focused';
}

export interface CalibrationPrompt {
  question: string;
  options: Array<{ label: string; signal: CalibratedSignal }>;
  category: 'pace' | 'interests' | 'dining' | 'budget' | 'social';
}

export interface CalibratedSignal {
  trait?: string;
  delta?: number;
  tag?: string;
  avoid?: string;
}

export interface TopNonNegotiables {
  mustHave: string[];    // e.g., ["great food", "cultural sites", "no crowds"]
  mustAvoid: string[];   // e.g., ["spicy food", "extreme sports"]
  flexibility: string[]; // e.g., ["timing", "specific venues"]
}

// =============================================================================
// DATA COMPLETENESS ASSESSMENT
// =============================================================================

/**
 * Assess how complete the user's data is for personalization
 */
export function assessDataCompleteness(
  quizData: Record<string, unknown> | null,
  preferences: Record<string, unknown> | null,
  overrides: Record<string, number> | null,
  tripHistory: Array<{ id: string }> | null
): DataCompleteness {
  const dataGaps: string[] = [];
  
  // Quiz completeness
  const hasQuiz = !!quizData;
  let quizCompleteness = 0;
  
  if (quizData) {
    const quizFields = [
      'traveler_type', 'emotional_drivers', 'travel_vibes', 'interests',
      'activity_level', 'dining_style', 'planning_preference'
    ];
    const filledQuizFields = quizFields.filter(f => 
      quizData[f] && (
        (Array.isArray(quizData[f]) && (quizData[f] as unknown[]).length > 0) ||
        (!Array.isArray(quizData[f]) && quizData[f])
      )
    );
    quizCompleteness = filledQuizFields.length / quizFields.length;
    
    if (quizCompleteness < 0.5) {
      dataGaps.push('incomplete_quiz');
    }
  } else {
    dataGaps.push('no_quiz');
  }
  
  // Preferences completeness
  const hasPreferences = !!preferences && Object.keys(preferences).length > 0;
  let preferencesCompleteness = 0;
  
  if (preferences) {
    const prefFields = [
      'interests', 'dietary_restrictions', 'food_likes', 'food_dislikes',
      'travel_companions', 'accommodation_style', 'budget_tier'
    ];
    const filledPrefFields = prefFields.filter(f => 
      preferences[f] && (
        (Array.isArray(preferences[f]) && (preferences[f] as unknown[]).length > 0) ||
        (!Array.isArray(preferences[f]) && preferences[f])
      )
    );
    preferencesCompleteness = filledPrefFields.length / prefFields.length;
    
    if (preferencesCompleteness < 0.3) {
      dataGaps.push('sparse_preferences');
    }
  } else {
    dataGaps.push('no_preferences');
  }
  
  const hasOverrides = !!overrides && Object.keys(overrides).length > 0;
  const hasTripHistory = !!tripHistory && tripHistory.length > 0;
  const tripCount = tripHistory?.length || 0;
  
  if (!hasTripHistory) {
    dataGaps.push('no_trip_history');
  }
  
  // Determine confidence level
  let confidenceLevel: DataCompleteness['confidenceLevel'];
  
  const overallScore = (
    (quizCompleteness * 0.4) +
    (preferencesCompleteness * 0.3) +
    (hasOverrides ? 0.15 : 0) +
    (Math.min(tripCount, 3) / 3 * 0.15)
  );
  
  if (overallScore >= 0.7) {
    confidenceLevel = 'high';
  } else if (overallScore >= 0.4) {
    confidenceLevel = 'medium';
  } else if (overallScore >= 0.15) {
    confidenceLevel = 'low';
  } else {
    confidenceLevel = 'cold_start';
  }
  
  return {
    hasQuiz,
    quizCompleteness,
    hasPreferences,
    preferencesCompleteness,
    hasOverrides,
    hasTripHistory,
    tripCount,
    confidenceLevel,
    dataGaps
  };
}

// =============================================================================
// DEFAULT PERSONAS
// =============================================================================

const DEFAULT_PERSONAS: Record<string, DefaultPersona> = {
  balanced_explorer: {
    name: 'Balanced Explorer',
    traits: {
      planning: 2,
      social: 0,
      comfort: 2,
      pace: 0,
      authenticity: 3,
      adventure: 2,
      budget: 0,
      transformation: 1
    },
    interests: ['sightseeing', 'local cuisine', 'culture', 'photography'],
    pace: 'moderate',
    budgetStyle: 'balanced'
  },
  
  relaxed_comfort_seeker: {
    name: 'Relaxed Comfort Seeker',
    traits: {
      planning: 3,
      social: 1,
      comfort: 4,
      pace: -3,
      authenticity: 2,
      adventure: 0,
      budget: -2,
      transformation: 1
    },
    interests: ['relaxation', 'good food', 'scenic views', 'comfortable hotels'],
    pace: 'relaxed',
    budgetStyle: 'quality-focused'
  },
  
  active_discoverer: {
    name: 'Active Discoverer',
    traits: {
      planning: 1,
      social: 2,
      comfort: 0,
      pace: 4,
      authenticity: 4,
      adventure: 3,
      budget: 2,
      transformation: 2
    },
    interests: ['walking tours', 'local neighborhoods', 'street food', 'hidden gems'],
    pace: 'active',
    budgetStyle: 'value-focused'
  }
};

/**
 * Select a default persona based on limited signals
 */
export function selectDefaultPersona(
  limitedSignals: {
    tripType?: string;
    budgetTier?: string;
    travelers?: number;
    companions?: string[];
  }
): DefaultPersona {
  // Use trip type to infer persona
  if (limitedSignals.tripType) {
    const tripType = limitedSignals.tripType.toLowerCase();
    
    if (['honeymoon', 'romantic', 'anniversary'].includes(tripType)) {
      return DEFAULT_PERSONAS.relaxed_comfort_seeker;
    }
    if (['adventure', 'backpacking', 'active'].includes(tripType)) {
      return DEFAULT_PERSONAS.active_discoverer;
    }
  }
  
  // Use budget tier to infer
  if (limitedSignals.budgetTier) {
    const budget = limitedSignals.budgetTier.toLowerCase();
    if (['luxury', 'premium'].includes(budget)) {
      return DEFAULT_PERSONAS.relaxed_comfort_seeker;
    }
    if (['budget', 'economy'].includes(budget)) {
      return DEFAULT_PERSONAS.active_discoverer;
    }
  }
  
  // Default to balanced
  return DEFAULT_PERSONAS.balanced_explorer;
}

// =============================================================================
// CALIBRATION PROMPTS
// =============================================================================

const CALIBRATION_PROMPTS: CalibrationPrompt[] = [
  {
    question: "How do you feel about a packed day with lots of activities?",
    category: 'pace',
    options: [
      { label: "Love it! The more the better", signal: { trait: 'pace', delta: 4 } },
      { label: "Sounds good with some breaks", signal: { trait: 'pace', delta: 1 } },
      { label: "I prefer a slower rhythm", signal: { trait: 'pace', delta: -3 } }
    ]
  },
  {
    question: "When it comes to food, what matters most?",
    category: 'dining',
    options: [
      { label: "Authentic local flavors", signal: { trait: 'authenticity', delta: 3, tag: 'local-cuisine' } },
      { label: "Variety and quality", signal: { trait: 'comfort', delta: 2 } },
      { label: "Familiar options I know I'll like", signal: { trait: 'adventure', delta: -3 } }
    ]
  },
  {
    question: "Would you rather visit a famous landmark or a hidden local spot?",
    category: 'interests',
    options: [
      { label: "Famous landmark - I want the classics", signal: { tag: 'landmark', trait: 'authenticity', delta: -2 } },
      { label: "Hidden spot - show me the real city", signal: { trait: 'authenticity', delta: 4, tag: 'hidden-gem' } },
      { label: "A mix of both", signal: { trait: 'authenticity', delta: 1 } }
    ]
  },
  {
    question: "Tours and group activities?",
    category: 'social',
    options: [
      { label: "Yes! Great way to meet people and learn", signal: { trait: 'social', delta: 4, tag: 'group-tour' } },
      { label: "Small groups are fine", signal: { trait: 'social', delta: 1 } },
      { label: "I prefer exploring independently", signal: { trait: 'social', delta: -4, tag: 'solo' } }
    ]
  },
  {
    question: "What's your approach to travel spending?",
    category: 'budget',
    options: [
      { label: "Splurge on experiences that matter", signal: { trait: 'budget', delta: -4 } },
      { label: "Best value for money", signal: { trait: 'budget', delta: 4 } },
      { label: "Balanced - some splurges, some savings", signal: { trait: 'budget', delta: 0 } }
    ]
  }
];

/**
 * Get calibration prompts for a cold-start user
 */
export function getCalibrationPrompts(
  dataGaps: string[],
  limit: number = 3
): CalibrationPrompt[] {
  // Prioritize prompts based on gaps
  const priorityOrder: Record<string, number> = {
    'no_quiz': 1,
    'incomplete_quiz': 2,
    'no_trip_history': 3,
    'sparse_preferences': 4,
    'no_preferences': 5
  };
  
  // If we have specific gaps, prioritize relevant prompts
  const hasQuizGap = dataGaps.some(g => g.includes('quiz'));
  const hasHistoryGap = dataGaps.includes('no_trip_history');
  
  let prioritizedPrompts = [...CALIBRATION_PROMPTS];
  
  // If no quiz, pace and social are most important to calibrate
  if (hasQuizGap) {
    prioritizedPrompts.sort((a, b) => {
      const priorityA = ['pace', 'social', 'budget'].includes(a.category) ? 0 : 1;
      const priorityB = ['pace', 'social', 'budget'].includes(b.category) ? 0 : 1;
      return priorityA - priorityB;
    });
  }
  
  return prioritizedPrompts.slice(0, limit);
}

// =============================================================================
// COLD START FALLBACK GENERATION
// =============================================================================

/**
 * Generate cold start fallback with explicit uncertainty
 */
export function generateColdStartFallback(
  completeness: DataCompleteness,
  limitedSignals: {
    tripType?: string;
    budgetTier?: string;
    travelers?: number;
    companions?: string[];
    destination?: string;
  }
): ColdStartFallback {
  const defaultPersona = selectDefaultPersona(limitedSignals);
  const calibrationPrompts = getCalibrationPrompts(completeness.dataGaps, 3);
  
  const uncertaintyFlags: string[] = [];
  
  if (!completeness.hasQuiz) {
    uncertaintyFlags.push('No personality quiz completed - using default assumptions');
  }
  if (completeness.quizCompleteness < 0.5 && completeness.hasQuiz) {
    uncertaintyFlags.push('Quiz partially completed - some preferences may be inferred');
  }
  if (!completeness.hasTripHistory) {
    uncertaintyFlags.push('First trip - we\'re still learning your preferences');
  }
  if (completeness.preferencesCompleteness < 0.3) {
    uncertaintyFlags.push('Limited preference data - itinerary may need refinement');
  }
  
  // Build assumptions explanation
  const assumptionParts: string[] = [];
  
  assumptionParts.push(`We're assuming you're a "${defaultPersona.name}" traveler`);
  
  if (limitedSignals.tripType) {
    assumptionParts.push(`based on your ${limitedSignals.tripType} trip type`);
  } else if (limitedSignals.budgetTier) {
    assumptionParts.push(`based on your ${limitedSignals.budgetTier} budget selection`);
  } else {
    assumptionParts.push(`using balanced defaults`);
  }
  
  assumptionParts.push('. Edit activities or answer quick calibration questions to personalize.');
  
  return {
    defaultPersona,
    uncertaintyFlags,
    calibrationPrompts,
    assumptionsExplained: assumptionParts.join(' ')
  };
}

// =============================================================================
// PROMPT GENERATION
// =============================================================================

/**
 * Generate cold start context for AI prompt
 */
export function buildColdStartPrompt(fallback: ColdStartFallback): string {
  return `
## COLD START MODE - LIMITED USER DATA
This user has limited preference data. Use conservative, broadly-appealing choices.

ASSUMED PERSONA: ${fallback.defaultPersona.name}
- Pace: ${fallback.defaultPersona.pace}
- Budget style: ${fallback.defaultPersona.budgetStyle}
- Default interests: ${fallback.defaultPersona.interests.join(', ')}

UNCERTAINTY FLAGS:
${fallback.uncertaintyFlags.map(f => `- ⚠️ ${f}`).join('\n')}

GENERATION RULES FOR COLD START:
1. Prefer classic, well-reviewed venues over niche picks
2. Include a mix of must-see landmarks AND one off-beaten-path option per day
3. Use moderate pace (4-5 activities/day) unless trip type suggests otherwise
4. Include "safe" dining picks (diverse menus, good reviews) over highly specialized
5. Add variety - if one day is museum-heavy, next day should be different
6. For each activity, add \`confidenceNote: "Assumed based on [X]"\` when making assumptions

The user can refine by:
- Replacing activities (signals preference)
- Marking activities as "not me" (signals avoidance)
- Saving favorites (signals preference)

Track these signals for personalization learning.`;
}

// =============================================================================
// TOP NON-NEGOTIABLES CAPTURE
// =============================================================================

/**
 * Generate quick non-negotiables questions for cold start users
 */
export function getNonNegotiablesQuestions(): Array<{
  question: string;
  type: 'must_have' | 'must_avoid' | 'flexible';
  options: string[];
}> {
  return [
    {
      question: "What's a MUST-HAVE for this trip?",
      type: 'must_have',
      options: [
        'Great local food',
        'Major landmarks',
        'Nature/outdoor time',
        'Cultural experiences',
        'Relaxation/spa',
        'Nightlife',
        'Shopping',
        'Adventure activities'
      ]
    },
    {
      question: "What should we AVOID?",
      type: 'must_avoid',
      options: [
        'Crowded tourist spots',
        'Spicy food',
        'Early mornings',
        'Long walks',
        'Group tours',
        'Expensive restaurants',
        'Museums',
        'Outdoor activities'
      ]
    },
    {
      question: "Where are you FLEXIBLE?",
      type: 'flexible',
      options: [
        'Specific restaurants',
        'Exact timing',
        'Order of activities',
        'Neighborhoods',
        'Cuisine types',
        'Morning vs evening activities'
      ]
    }
  ];
}

/**
 * Apply non-negotiables to generation context
 */
export function applyNonNegotiables(
  nonNegotiables: TopNonNegotiables,
  context: {
    interests: string[];
    foodDislikes: string[];
    avoidList: string[];
    traits: Record<string, number>;
  }
): {
  interests: string[];
  foodDislikes: string[];
  avoidList: string[];
  traits: Record<string, number>;
} {
  const result = { ...context };
  
  // Add must-haves to interests
  result.interests = [...new Set([...context.interests, ...nonNegotiables.mustHave])];
  
  // Add must-avoids
  const avoidItems: string[] = [];
  for (const avoid of nonNegotiables.mustAvoid) {
    const avoidLower = avoid.toLowerCase();
    if (avoidLower.includes('food') || avoidLower.includes('spicy')) {
      result.foodDislikes = [...new Set([...context.foodDislikes, avoid])];
    } else {
      avoidItems.push(avoid);
    }
  }
  result.avoidList = [...new Set([...context.avoidList, ...avoidItems])];
  
  // Infer trait adjustments from non-negotiables
  for (const mustHave of nonNegotiables.mustHave) {
    const item = mustHave.toLowerCase();
    if (item.includes('adventure')) {
      result.traits.adventure = Math.max(result.traits.adventure || 0, 4);
    }
    if (item.includes('relax') || item.includes('spa')) {
      result.traits.pace = Math.min(result.traits.pace || 0, -3);
    }
    if (item.includes('local') || item.includes('cultural')) {
      result.traits.authenticity = Math.max(result.traits.authenticity || 0, 4);
    }
  }
  
  for (const avoid of nonNegotiables.mustAvoid) {
    const item = avoid.toLowerCase();
    if (item.includes('crowd')) {
      result.traits.social = Math.min(result.traits.social || 0, -3);
    }
    if (item.includes('early morning')) {
      result.traits.pace = Math.min(result.traits.pace || 0, -2);
    }
    if (item.includes('long walk')) {
      // Add to constraints rather than traits
    }
  }
  
  return result;
}
