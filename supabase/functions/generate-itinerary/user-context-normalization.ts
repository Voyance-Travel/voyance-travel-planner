// =============================================================================
// USER CONTEXT NORMALIZATION MODULE
// Extracted from index.ts to reduce bundle size
// =============================================================================

import { type BudgetIntent } from './budget-constraints.ts';

// =============================================================================
// INTERFACES
// =============================================================================

export interface NormalizedTraits {
  planning: number;    // -10 to +10
  social: number;      // -10 to +10
  comfort: number;     // -10 to +10
  pace: number;        // -10 to +10
  authenticity: number; // -10 to +10
  adventure: number;   // -10 to +10
  budget: number;      // -10 to +10 (POSITIVE = frugal)
  transformation: number; // -10 to +10
}

export interface NormalizedUserContext {
  // Effective trait scores (blended from all sources)
  traits: NormalizedTraits;
  
  // Archetype blend (from DNA or inferred from traits)
  archetypes: Array<{ name: string; pct: number; [key: string]: any }>;
  
  // Overall confidence in the user profile
  confidence: number;
  
  // Detailed confidence factors
  confidenceFactors: {
    hasQuiz: boolean;
    hasOverrides: boolean;
    hasPreferences: boolean;
    overrideCount: number;
    quizCompleteness: number;
  };
  
  // Deduplicated preferences
  preferences: {
    interests: string[];
    travelPace: string | null;
    diningStyle: string | null;
    activityLevel: string | null;
    dietaryRestrictions: string[];
    accessibilityNeeds: string[];
    mobilityNeeds: string | null;
    mobilityLevel: string | null;
    climatePreferences: string[];
    ecoFriendly: boolean;
    travelerType: string | null;
    travelVibes: string[];
    planningPreference: string | null;
    travelCompanions: string[];
    travelStyle: string | null;
    primaryGoal: string | null;
    emotionalDrivers: string[];
    foodLikes: string[];
    foodDislikes: string[];
    activeHoursPerDay: number | null;
    allergies: string[];
  };
  
  // Trip context (if applicable)
  tripContext: {
    tripType: string | null;
    budgetTier: string | null;
    pace: string | null;
    travelers: number;
    interests: string[];
  };
  
  // Source tracking for debug/audit
  sources: {
    quizVersion: number | null;
    preferencesUpdatedAt: string | null;
    overridesApplied: string[];
    tripOverrides: string[];
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BLEND_WEIGHTS = {
  QUIZ: 0.7,
  OVERRIDE: 0.3,
} as const;

const CONFIDENCE_PENALTIES = {
  NO_QUIZ: -30,
  PARTIAL_QUIZ: -15,
  PER_OVERRIDE: -3,
  MAX_OVERRIDE_PENALTY: -15,
  NO_PREFERENCES: -10,
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function blendTraitWithOverride(
  quizValue: number | undefined,
  overrideValue: number | undefined
): number {
  if (quizValue === undefined && overrideValue === undefined) return 0;
  if (quizValue === undefined) return overrideValue ?? 0;
  if (overrideValue === undefined) return quizValue;
  
  const blended = (quizValue * BLEND_WEIGHTS.QUIZ) + (overrideValue * BLEND_WEIGHTS.OVERRIDE);
  return Math.max(-10, Math.min(10, Math.round(blended * 10) / 10));
}

export function calculateQuizCompleteness(traitScores: Record<string, number> | undefined): number {
  if (!traitScores) return 0;
  
  const requiredTraits = ['planning', 'social', 'comfort', 'pace', 'authenticity', 'adventure', 'budget', 'transformation'];
  const presentTraits = requiredTraits.filter(t => 
    traitScores[t] !== undefined && traitScores[t] !== 0
  );
  
  return presentTraits.length / requiredTraits.length;
}

export function deduplicatePreferences(
  quizData: Record<string, unknown> | null,
  prefsData: Record<string, unknown> | null
): NormalizedUserContext['preferences'] {
  const quiz = quizData || {};
  const prefs = prefsData || {};
  
  const mergeArrays = (key: string): string[] => {
    const quizVal = quiz[key];
    const prefsVal = prefs[key];
    const quizArr = Array.isArray(quizVal) ? quizVal : (typeof quizVal === 'string' && quizVal ? [quizVal] : []);
    const prefsArr = Array.isArray(prefsVal) ? prefsVal : (typeof prefsVal === 'string' && prefsVal ? [prefsVal] : []);
    return [...new Set([...quizArr, ...prefsArr])].filter(Boolean) as string[];
  };
  
  const pickFirst = (key: string): string | null => {
    const quizVal = quiz[key];
    const prefsVal = prefs[key];
    return (typeof quizVal === 'string' && quizVal) ? quizVal :
           (typeof prefsVal === 'string' && prefsVal) ? prefsVal : null;
  };
  
  return {
    interests: mergeArrays('interests'),
    travelPace: pickFirst('travel_pace'),
    diningStyle: pickFirst('dining_style'),
    activityLevel: pickFirst('activity_level'),
    dietaryRestrictions: mergeArrays('dietary_restrictions'),
    accessibilityNeeds: mergeArrays('accessibility_needs'),
    mobilityNeeds: pickFirst('mobility_needs'),
    mobilityLevel: pickFirst('mobility_level'),
    climatePreferences: mergeArrays('climate_preferences'),
    ecoFriendly: Boolean(prefs.eco_friendly || quiz.eco_friendly),
    travelerType: pickFirst('traveler_type'),
    travelVibes: mergeArrays('travel_vibes'),
    planningPreference: pickFirst('planning_preference'),
    travelCompanions: mergeArrays('travel_companions'),
    travelStyle: pickFirst('travel_style'),
    primaryGoal: pickFirst('primary_goal'),
    emotionalDrivers: mergeArrays('emotional_drivers'),
    foodLikes: mergeArrays('food_likes'),
    foodDislikes: mergeArrays('food_dislikes'),
    activeHoursPerDay: (typeof prefs.active_hours_per_day === 'number' ? prefs.active_hours_per_day : null) as number | null,
    allergies: mergeArrays('allergies'),
  };
}

export function inferArchetypesFromTraits(traitScores: Record<string, number>): Array<{ name: string; pct: number }> {
  const archetypeTraitWeights: Record<string, Record<string, number>> = {
    'Cultural Curator': { authenticity: 2, transformation: 1.5, planning: 1, adventure: 0.5 },
    'Wellness Wanderer': { comfort: 1.5, pace: -2, transformation: 1.5, social: -1 },
    'Wilderness Pioneer': { adventure: 2, authenticity: 1.5, comfort: -1, pace: 0.5 },
    'Urban Explorer': { social: 1.5, adventure: 1, pace: 1, authenticity: 0.5 },
    'Culinary Voyager': { authenticity: 1.5, comfort: 1, social: 0.5, adventure: 0.5 },
    'Luxury Seeker': { comfort: 2, budget: -2, planning: 1 },
    'Budget Adventurer': { budget: 2, adventure: 1.5, comfort: -1.5 },
    'Social Butterfly': { social: 2, adventure: 0.5, authenticity: 0.5 },
    'Slow Traveler': { pace: -2, comfort: 1, authenticity: 1, planning: -0.5 },
    'Thrill Seeker': { adventure: 2, pace: 1.5, comfort: -1, transformation: 1 },
  };

  const archetypeScores: Array<{ name: string; score: number }> = [];
  
  for (const [archetype, weights] of Object.entries(archetypeTraitWeights)) {
    let score = 50;
    for (const [trait, weight] of Object.entries(weights)) {
      const traitValue = traitScores[trait] || 0;
      score += traitValue * weight;
    }
    archetypeScores.push({ name: archetype, score: Math.max(0, Math.min(100, score)) });
  }

  archetypeScores.sort((a, b) => b.score - a.score);

  const totalScore = archetypeScores.reduce((sum, a) => sum + a.score, 0) || 1;
  const topArchetypes = archetypeScores.slice(0, 5).map(a => ({
    name: a.name,
    pct: (a.score / totalScore) * 100,
  }));

  return topArchetypes;
}

// =============================================================================
// MAIN NORMALIZATION FUNCTION
// =============================================================================

export function normalizeUserContext(
  dna: any | null,
  overrides: Record<string, number> | null,
  prefs: Record<string, unknown> | null,
  tripContext?: {
    tripType?: string;
    budgetTier?: string;
    pace?: string;
    travelers?: number;
    interests?: string[];
  }
): NormalizedUserContext {
  const quizTraits = dna?.trait_scores || {};
  const overrideTraits = overrides || {};
  
  const blendedTraits: NormalizedTraits = {
    planning: blendTraitWithOverride(quizTraits.planning, overrideTraits.planning),
    social: blendTraitWithOverride(quizTraits.social, overrideTraits.social),
    comfort: blendTraitWithOverride(quizTraits.comfort, overrideTraits.comfort),
    pace: blendTraitWithOverride(quizTraits.pace, overrideTraits.pace),
    authenticity: blendTraitWithOverride(quizTraits.authenticity, overrideTraits.authenticity),
    adventure: blendTraitWithOverride(quizTraits.adventure, overrideTraits.adventure),
    budget: blendTraitWithOverride(quizTraits.budget, overrideTraits.budget),
    transformation: blendTraitWithOverride(quizTraits.transformation, overrideTraits.transformation),
  };
  
  const tripOverrides: string[] = [];
  
  if (tripContext?.tripType) {
    const tripTypeAdjustments: Record<string, Partial<NormalizedTraits>> = {
      'romantic': { social: -3, comfort: 3, pace: -2 },
      'honeymoon': { social: -4, comfort: 4, pace: -3 },
      'adventure': { adventure: 4, pace: 3, comfort: -2 },
      'family': { social: 2, planning: 3, pace: -1 },
      'solo': { social: -4, authenticity: 2, adventure: 1 },
      'business': { planning: 4, comfort: 3, pace: 2 },
      'wellness': { pace: -4, comfort: 3, transformation: 3 },
      'cultural': { authenticity: 4, transformation: 2 },
      'beach': { pace: -3, comfort: 2 },
      'city_break': { pace: 3, social: 1 },
      'birthday': { comfort: 3, social: 2 },
      'anniversary': { comfort: 4, social: -2, pace: -2 },
      'celebration': { comfort: 3, social: 2 },
      'milestone': { comfort: 3, transformation: 2 },
      'bachelorette': { social: 4, adventure: 2, pace: 2 },
      'bachelor': { social: 4, adventure: 3, pace: 2 },
      'graduation': { comfort: 2, social: 2, transformation: 2 },
      'retirement': { pace: -2, comfort: 3, transformation: 2 },
    };
    
    const adjustments = tripTypeAdjustments[tripContext.tripType];
    if (adjustments) {
      for (const [trait, delta] of Object.entries(adjustments)) {
        const key = trait as keyof NormalizedTraits;
        const oldValue = blendedTraits[key];
        blendedTraits[key] = Math.max(-10, Math.min(10, blendedTraits[key] + delta));
        if (blendedTraits[key] !== oldValue) {
          tripOverrides.push(`${trait} (${tripContext.tripType})`);
        }
      }
      console.log(`[TripContext] Applied ${tripContext.tripType} adjustments:`, adjustments);
    }
  }
  
  if (tripContext?.pace) {
    const paceMap: Record<string, number> = {
      'slow': -6, 'relaxed': -3, 'balanced': 0, 'moderate': 0, 'active': 4, 'packed': 7
    };
    if (paceMap[tripContext.pace] !== undefined) {
      const tripPace = paceMap[tripContext.pace];
      const oldPace = blendedTraits.pace;
      blendedTraits.pace = Math.round((blendedTraits.pace * 0.2 + tripPace * 0.8) * 10) / 10;
      if (blendedTraits.pace !== oldPace) {
        tripOverrides.push(`pace (${tripContext.pace})`);
      }
      console.log(`[TripContext] Pace adjusted: ${oldPace} -> ${blendedTraits.pace} (trip wants ${tripContext.pace})`);
    }
  }
  
  if (tripContext?.budgetTier) {
    const budgetComfortMap: Record<string, number> = {
      'budget': -5, 'economy': -2, 'standard': 0, 'comfort': 3, 'premium': 5, 'luxury': 8
    };
    if (budgetComfortMap[tripContext.budgetTier] !== undefined) {
      const tripComfort = budgetComfortMap[tripContext.budgetTier];
      const oldComfort = blendedTraits.comfort;
      blendedTraits.comfort = Math.round((blendedTraits.comfort * 0.4 + tripComfort * 0.6) * 10) / 10;
      if (blendedTraits.comfort !== oldComfort) {
        tripOverrides.push(`comfort (${tripContext.budgetTier})`);
      }
      console.log(`[TripContext] Comfort adjusted: ${oldComfort} -> ${blendedTraits.comfort} (trip budget: ${tripContext.budgetTier})`);
    }
  }
  
  if (tripContext?.travelers && tripContext.travelers > 1) {
    const socialBoost = Math.min(3, (tripContext.travelers - 1) * 1.5);
    const oldSocial = blendedTraits.social;
    blendedTraits.social = Math.max(-10, Math.min(10, blendedTraits.social + socialBoost));
    if (blendedTraits.social !== oldSocial) {
      tripOverrides.push(`social (+${tripContext.travelers} travelers)`);
    }
  }
  
  const hasQuiz = Boolean(dna?.trait_scores && Object.keys(dna.trait_scores).length > 0);
  const hasOverrides = Boolean(overrides && Object.keys(overrides).length > 0);
  const hasPreferences = Boolean(prefs && Object.values(prefs).some(v => v !== null));
  const overrideCount = overrides ? Object.keys(overrides).length : 0;
  const quizCompleteness = calculateQuizCompleteness(dna?.trait_scores);
  
  let baseConfidence = dna?.travel_dna_v2?.confidence ?? dna?.confidence ?? 50;
  
  if (!hasQuiz) {
    baseConfidence += CONFIDENCE_PENALTIES.NO_QUIZ;
  } else if (quizCompleteness < 0.8) {
    baseConfidence += CONFIDENCE_PENALTIES.PARTIAL_QUIZ;
  }
  
  if (!hasPreferences) {
    baseConfidence += CONFIDENCE_PENALTIES.NO_PREFERENCES;
  }
  
  const overridePenalty = Math.max(
    CONFIDENCE_PENALTIES.MAX_OVERRIDE_PENALTY,
    overrideCount * CONFIDENCE_PENALTIES.PER_OVERRIDE
  );
  baseConfidence += overridePenalty;
  
  const adjustedConfidence = Math.max(0, Math.min(100, Math.round(baseConfidence)));
  
  let archetypes: Array<{ name: string; pct: number; [key: string]: any }> = [];

  const explicitPrimary =
    (dna as any)?.primary_archetype_name ||
    (dna as any)?.travel_dna?.primary_archetype_name;
  const explicitSecondary =
    (dna as any)?.secondary_archetype_name ||
    (dna as any)?.travel_dna?.secondary_archetype_name;

  if (explicitPrimary && typeof explicitPrimary === 'string') {
    archetypes = [
      { name: explicitPrimary, pct: explicitSecondary ? 70 : 100, source: 'explicit' },
      ...(explicitSecondary && typeof explicitSecondary === 'string'
        ? [{ name: explicitSecondary, pct: 30, source: 'explicit' }]
        : []),
    ];
    console.log(`[NormalizeUserContext] Explicit archetype override: primary=${explicitPrimary}, secondary=${explicitSecondary || 'none'}`);
  } else {
    archetypes = dna?.travel_dna_v2?.archetype_matches || dna?.archetype_matches || [];
  }

  if (archetypes.length === 0 && hasQuiz) {
    const traitsAsRecord: Record<string, number> = {
      planning: blendedTraits.planning,
      social: blendedTraits.social,
      comfort: blendedTraits.comfort,
      pace: blendedTraits.pace,
      authenticity: blendedTraits.authenticity,
      adventure: blendedTraits.adventure,
      budget: blendedTraits.budget,
      transformation: blendedTraits.transformation,
    };
    archetypes = inferArchetypesFromTraits(traitsAsRecord);
  }
  
  const deduplicatedPrefs = deduplicatePreferences(
    dna?.travel_dna_v2 as Record<string, unknown> | null,
    prefs
  );
  
  const sources = {
    quizVersion: dna?.dna_version ?? null,
    preferencesUpdatedAt: null,
    overridesApplied: overrides ? Object.keys(overrides) : [],
    tripOverrides,
  };
  
  const tripContextOutput = {
    tripType: tripContext?.tripType || null,
    budgetTier: tripContext?.budgetTier || null,
    pace: tripContext?.pace || null,
    travelers: tripContext?.travelers || 1,
    interests: tripContext?.interests || [],
  };
  
  console.log('[NormalizeUserContext] Blended traits (with trip adjustments):', blendedTraits);
  console.log(`[NormalizeUserContext] Confidence: ${adjustedConfidence}, tripOverrides: ${tripOverrides.join(', ') || 'none'}`);
  
  return {
    traits: blendedTraits,
    archetypes,
    confidence: adjustedConfidence,
    confidenceFactors: {
      hasQuiz,
      hasOverrides,
      hasPreferences,
      overrideCount,
      quizCompleteness,
    },
    preferences: deduplicatedPrefs,
    tripContext: tripContextOutput,
    sources,
  };
}

// =============================================================================
// BUILD PROMPT CONTEXT
// =============================================================================

export function buildNormalizedPromptContext(
  normalizedContext: NormalizedUserContext,
  budgetIntent: BudgetIntent | null
): string {
  const sections: string[] = [];
  
  if (budgetIntent) {
    let budgetSection = `\n${'='.repeat(60)}\n💰 BUDGET INTENT\n${'='.repeat(60)}`;
    budgetSection += `\n🎯 ${budgetIntent.notes}`;
    budgetSection += `\n✅ PRIORITIZE: ${budgetIntent.prioritize.slice(0, 3).join('; ')}`;
    budgetSection += `\n❌ AVOID: ${budgetIntent.avoid.slice(0, 3).join('; ')}`;
    budgetSection += `\n📊 Upgrade cadence: ${budgetIntent.splurgeCadence.dinners} nicer dinners, ${budgetIntent.splurgeCadence.experiences} upgraded experiences per trip`;
    sections.push(budgetSection);
  }
  
  if (normalizedContext.archetypes.length > 0) {
    const blendParts = normalizedContext.archetypes.slice(0, 3).map((a) => 
      `${a.name.replace(/_/g, ' ')} (${Math.round(a.pct)}%)`
    );
    
    const confidenceLabel = normalizedContext.confidence >= 80 ? 'High' : 
                            normalizedContext.confidence >= 60 ? 'Moderate' : 'Uncertain';
    
    let personaSection = `\n${'='.repeat(60)}\n🧬 TRAVEL PERSONA\n${'='.repeat(60)}`;
    personaSection += `\nArchetype Blend: ${blendParts.join(' + ')}`;
    personaSection += `\nConfidence: ${normalizedContext.confidence}/100 (${confidenceLabel})`;
    
    if (normalizedContext.confidence < 60) {
      personaSection += `\n\n⚠️ LOW CONFIDENCE:`;
      personaSection += `\n   - Profile has mixed signals or limited data`;
      personaSection += `\n   - Include variety and avoid strong assumptions`;
      if (normalizedContext.confidenceFactors.overrideCount > 2) {
        personaSection += `\n   - User has adjusted ${normalizedContext.confidenceFactors.overrideCount} traits manually`;
      }
    }
    
    sections.push(personaSection);
  }
  
  const traitLabels: Record<string, [string, string]> = {
    planning: ['Spontaneous', 'Detailed Planner'],
    social: ['Solo/Intimate', 'Social/Group'],
    pace: ['Relaxed', 'Fast-Paced'],
    authenticity: ['Tourist-Friendly', 'Local/Authentic'],
    adventure: ['Safe/Comfortable', 'Adventurous'],
    transformation: ['Leisure', 'Growth-Focused'],
  };
  
  let traitSection = `\n${'='.repeat(60)}\n📊 TRAIT PROFILE (Blended from Quiz + Adjustments)\n${'='.repeat(60)}`;
  
  for (const [trait, labels] of Object.entries(traitLabels)) {
    const score = normalizedContext.traits[trait as keyof NormalizedTraits];
    const direction = score > 0 ? labels[1] : score < 0 ? labels[0] : 'Balanced';
    const intensity = Math.abs(score) >= 7 ? 'Strong' : Math.abs(score) >= 4 ? 'Moderate' : 'Slight';
    traitSection += `\n   ${trait}: ${score > 0 ? '+' : ''}${score}/10 → ${intensity} ${direction}`;
  }
  
  if (normalizedContext.confidenceFactors.hasOverrides || normalizedContext.sources.tripOverrides.length > 0) {
    const userOverrides = normalizedContext.sources.overridesApplied.slice(0, 3).join(', ');
    const tripAdjustments = normalizedContext.sources.tripOverrides.slice(0, 3).join(', ');
    
    if (userOverrides) {
      traitSection += `\n\n   ⚙️ User adjusted: ${userOverrides}${normalizedContext.sources.overridesApplied.length > 3 ? '...' : ''}`;
    }
    if (tripAdjustments) {
      traitSection += `\n   🎯 Trip-specific: ${tripAdjustments}${normalizedContext.sources.tripOverrides.length > 3 ? '...' : ''}`;
    }
  }
  
  sections.push(traitSection);
  
  const tripCtx = normalizedContext.tripContext;
  if (tripCtx.tripType || tripCtx.budgetTier || tripCtx.pace) {
    let tripSection = `\n${'='.repeat(60)}\n🗓️ THIS TRIP\n${'='.repeat(60)}`;
    
    if (tripCtx.tripType) {
      const tripTypeLabels: Record<string, string> = {
        'romantic': '💕 Romantic getaway: focus on intimate experiences, couples activities, and special moments',
        'honeymoon': '💍 Honeymoon: luxury, romance, privacy, and once-in-a-lifetime experiences',
        'adventure': '🏔️ Adventure trip: outdoor activities, adrenaline, exploration',
        'family': '👨‍👩‍👧‍👦 Family vacation: kid-friendly, manageable pacing, group activities',
        'solo': '🧘 Solo travel: self-discovery, flexibility, meeting locals',
        'business': '💼 Business trip: efficient, professional, work-friendly venues',
        'wellness': '🧘‍♀️ Wellness retreat: spa, yoga, healthy dining, relaxation',
        'cultural': '🏛️ Cultural exploration: museums, history, local traditions',
        'beach': '🏖️ Beach vacation: sun, sea, relaxation, water activities',
        'city_break': '🏙️ City break: urban exploration, nightlife, landmarks',
        'birthday': '🎂 Birthday celebration: special experiences, celebratory dinners, memorable moments',
        'anniversary': '💝 Anniversary trip: romantic celebration, special dinners, intimate experiences',
        'celebration': '🎉 Celebration trip: festive activities, special occasions, memorable experiences',
        'milestone': '🏆 Milestone trip: meaningful experiences, bucket-list activities',
        'bachelorette': '👯‍♀️ Bachelorette party: group fun, nightlife, bonding activities',
        'bachelor': '🎊 Bachelor party: adventure, nightlife, group activities',
        'graduation': '🎓 Graduation trip: celebratory, reward experiences, new chapter adventures',
        'retirement': '🌅 Retirement celebration: relaxed pace, bucket-list experiences',
      };
      tripSection += `\n${tripTypeLabels[tripCtx.tripType] || `Trip type: ${tripCtx.tripType}`}`;
    }
    
    if (tripCtx.travelers > 1) {
      tripSection += `\n👥 ${tripCtx.travelers} travelers: ensure activities accommodate the group`;
    }
    
    if (tripCtx.interests && tripCtx.interests.length > 0) {
      tripSection += `\n🎯 Trip interests: ${tripCtx.interests.slice(0, 5).join(', ')}`;
    }
    
    sections.push(tripSection);
  }
  
  const prefs = normalizedContext.preferences;
  const prefItems: string[] = [];
  
  if (prefs.travelerType) {
    prefItems.push(`🧭 Traveler type: ${prefs.travelerType.replace(/_/g, ' ')}`);
  }
  if (prefs.emotionalDrivers.length > 0) {
    prefItems.push(`💫 Emotional drivers: ${prefs.emotionalDrivers.slice(0, 4).join(', ')}`);
  }
  if (prefs.travelVibes.length > 0) {
    prefItems.push(`🌍 Travel vibes: ${prefs.travelVibes.slice(0, 4).join(', ')}`);
  }
  if (prefs.travelCompanions.length > 0) {
    prefItems.push(`👥 Travel companions: ${prefs.travelCompanions.join(', ')}`);
  }
  if (prefs.interests.length > 0) {
    prefItems.push(`🎯 Interests: ${prefs.interests.slice(0, 6).join(', ')}`);
  }
  if (prefs.diningStyle) {
    prefItems.push(`🍽️ Dining style: ${prefs.diningStyle}`);
  }
  if (prefs.planningPreference) {
    prefItems.push(`📋 Planning style: ${prefs.planningPreference}`);
  }
  if (prefs.foodLikes.length > 0) {
    prefItems.push(`✅ Food loves: ${prefs.foodLikes.slice(0, 5).join(', ')}`);
  }
  if (prefs.foodDislikes.length > 0) {
    prefItems.push(`❌ Food avoid: ${prefs.foodDislikes.slice(0, 5).join(', ')}`);
  }
  if (prefs.dietaryRestrictions.length > 0) {
    prefItems.push(`⚠️ Dietary: ${prefs.dietaryRestrictions.join(', ')}`);
  }
  if (prefs.mobilityNeeds) {
    prefItems.push(`♿ Mobility: ${prefs.mobilityNeeds}`);
  }
  if (prefs.ecoFriendly) {
    prefItems.push(`🌱 Eco-conscious traveler`);
  }
  
  if (prefItems.length > 0) {
    let prefSection = `\n${'='.repeat(60)}\n🎭 UNIFIED PREFERENCES\n${'='.repeat(60)}`;
    prefSection += '\n' + prefItems.join('\n');
    sections.push(prefSection);
  }
  
  return sections.join('\n');
}
