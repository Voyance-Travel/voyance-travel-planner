import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface GenerationContext {
  tripId: string;
  userId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
  dailyBudget?: number;
  currency?: string;
}

interface StrictActivity {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  location: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
  };
  cost: { amount: number; currency: string; formatted?: string; source?: 'viator' | 'database' | 'estimated' | 'google' };
  description: string;
  tags: string[];
  bookingRequired: boolean;
  transportation: {
    method: string;
    duration: string;
    estimatedCost: { amount: number; currency: string };
    instructions: string;
  };
  tips?: string;
  photos?: Array<{ url: string; photographer?: string; alt?: string }>;
  rating?: { value: number; totalReviews: number };
  verified?: { isValid: boolean; confidence: number; placeId?: string };
  durationMinutes?: number;
  categoryIcon?: string;
  // New fields for venue details
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  priceLevel?: number; // 1-4 scale
  googleMapsUrl?: string;
  reviewHighlights?: string[];
}

interface StrictDay {
  dayNumber: number;
  date: string;
  title: string;
  theme?: string;
  activities: StrictActivity[];
  metadata?: {
    theme?: string;
    totalEstimatedCost?: number;
    mealsIncluded?: number;
    pacingLevel?: 'relaxed' | 'moderate' | 'packed';
  };
}

interface TravelAdvisory {
  visaRequired?: boolean;
  visaType?: string;
  visaDetails?: string;
  passportValidity?: string;
  entryRequirements?: string[];
  safetyLevel?: 'low-risk' | 'moderate' | 'elevated' | 'high-risk';
  safetyAdvisory?: string;
  healthRequirements?: string[];
  currencyTips?: string;
  importantNotes?: string[];
  lastUpdated?: string;
}

interface LocalEventInfo {
  name: string;
  type: string;
  dates: string;
  location: string;
  description: string;
  isFree: boolean;
}

interface TripOverview {
  bestTimeToVisit?: string;
  currency?: string;
  language?: string;
  transportationTips?: string;
  culturalTips?: string;
  budgetBreakdown?: {
    accommodations: number;
    activities: number;
    food: number;
    transportation: number;
    total: number;
  };
  highlights?: string[];
  localTips?: string[];
  travelAdvisory?: TravelAdvisory;
  localEvents?: LocalEventInfo[];
}

interface EnrichedItinerary {
  days: StrictDay[];
  overview?: TripOverview;
  enrichmentMetadata: {
    enrichedAt: string;
    geocodedActivities: number;
    verifiedActivities: number;
    photosAdded: number;
    totalActivities: number;
  };
}

// =============================================================================
// BUDGET INTENT RECONCILIATION
// Derives a single canonical budget line from tier + traits
// =============================================================================

// CANONICAL TRAIT POLARITY (matches calculate-travel-dna):
// - budget:  POSITIVE = frugal/value-focused,  NEGATIVE = splurge/luxury
// - comfort: POSITIVE = luxury-seeking,        NEGATIVE = budget-conscious
// This is the single source of truth - do NOT invert elsewhere!
const BUDGET_TRAIT_POLARITY = 'POSITIVE_IS_FRUGAL' as const;
const COMFORT_TRAIT_POLARITY = 'POSITIVE_IS_LUXURY' as const;

type SpendStyle = 'value_focused' | 'balanced' | 'splurge_forward';
type BudgetTierLevel = 'budget' | 'economy' | 'standard' | 'comfort' | 'premium' | 'luxury';

interface BudgetIntent {
  tier: BudgetTierLevel;
  spendStyle: SpendStyle;
  splurgeCadence: { dinners: number; experiences: number };
  avoid: string[];
  prioritize: string[];
  priceSensitivity: number; // 0-100, higher = more price sensitive
  notes: string; // Single line for the AI prompt
  conflict: boolean; // Whether tier and traits diverged
  conflictDetails?: string;
}

/**
 * Derive a unified budget intent from trip tier and trait scores
 * Resolves the contradiction between e.g. "Premium" tier + "Frugal +9" trait
 */
function deriveBudgetIntent(
  budgetTier: string | undefined,
  budgetTrait: number | undefined, // -10 (splurge) to +10 (frugal)
  comfortTrait: number | undefined // -10 (budget-conscious) to +10 (luxury-seeking)
): BudgetIntent {
  // Normalize inputs
  const tier = (budgetTier?.toLowerCase() || 'standard') as BudgetTierLevel;
  const budget = budgetTrait ?? 0; // frugal positive, splurge negative
  const comfort = comfortTrait ?? 0; // luxury positive, budget-conscious negative
  
  // Tier hierarchy (higher = more $$$)
  const tierLevels: Record<string, number> = {
    budget: 1, economy: 2, standard: 3, comfort: 4, premium: 5, luxury: 6
  };
  const tierLevel = tierLevels[tier] || 3;
  
  // Detect conflict: high tier but high frugality, or low tier but high comfort expectations
  const isHighTier = tierLevel >= 5; // premium/luxury
  const isLowTier = tierLevel <= 2; // budget/economy
  const isFrugal = budget >= 5; // Strong frugal trait
  const isSplurge = budget <= -5; // Strong splurge trait
  const isLuxurySeeker = comfort >= 5; // Strong luxury comfort preference
  const isBudgetConscious = comfort <= -5; // Strong budget-conscious comfort
  
  let conflict = false;
  let conflictDetails: string | undefined;
  
  // High tier + frugal = "value-focused premium" (wants quality, hates waste)
  // Low tier + luxury comfort = mismatch (may be budget-constrained luxury seeker)
  // High tier + splurge = straightforward luxury
  // Low tier + frugal = straightforward budget
  
  if (isHighTier && isFrugal) {
    conflict = true;
    conflictDetails = `Premium tier with strong frugal trait (+${budget}) - value-focused premium traveler`;
  } else if (isLowTier && isLuxurySeeker) {
    conflict = true;
    conflictDetails = `Budget tier with luxury-seeking comfort (+${comfort}) - budget-constrained with quality aspirations`;
  } else if (isHighTier && isBudgetConscious) {
    conflict = true;
    conflictDetails = `Premium tier with budget-conscious comfort (${comfort}) - unusual combination`;
  }
  
  // Derive spend style
  let spendStyle: SpendStyle;
  if (isFrugal || budget > 2) {
    spendStyle = 'value_focused';
  } else if (isSplurge || budget < -2) {
    spendStyle = 'splurge_forward';
  } else {
    spendStyle = 'balanced';
  }
  
  // Adjust based on comfort if budget trait is neutral
  if (Math.abs(budget) <= 2) {
    if (isLuxurySeeker) spendStyle = 'splurge_forward';
    if (isBudgetConscious) spendStyle = 'value_focused';
  }
  
  // Calculate price sensitivity (0-100, higher = more price sensitive)
  // Starts from tier baseline, modified by traits
  const tierSensitivity: Record<string, number> = {
    luxury: 10, premium: 25, comfort: 40, standard: 55, economy: 70, budget: 85
  };
  let priceSensitivity = tierSensitivity[tier] || 55;
  
  // Frugal trait increases sensitivity, splurge decreases
  priceSensitivity += budget * 3; // +30 max for strong frugal
  // Luxury comfort decreases sensitivity, budget-conscious increases
  priceSensitivity -= comfort * 2; // -20 for strong luxury preference
  
  priceSensitivity = Math.max(0, Math.min(100, priceSensitivity));
  
  // Derive splurge cadence based on style and tier
  const splurgeCadence = {
    dinners: spendStyle === 'splurge_forward' ? 4 : spendStyle === 'value_focused' ? 1 : 2,
    experiences: spendStyle === 'splurge_forward' ? 3 : spendStyle === 'value_focused' ? 1 : 2
  };
  
  // Adjust for tier
  if (tierLevel >= 5) {
    splurgeCadence.dinners = Math.min(5, splurgeCadence.dinners + 1);
    splurgeCadence.experiences = Math.min(4, splurgeCadence.experiences + 1);
  } else if (tierLevel <= 2) {
    splurgeCadence.dinners = Math.max(0, splurgeCadence.dinners - 1);
    splurgeCadence.experiences = Math.max(0, splurgeCadence.experiences - 1);
  }
  
  // Derive avoid/prioritize lists
  const avoid: string[] = [];
  const prioritize: string[] = [];
  
  if (spendStyle === 'value_focused') {
    avoid.push('tourist traps', 'overpriced set menus', 'low-ROI experiences', 'expensive transport when cheaper options exist');
    prioritize.push('high-value experiences', 'local favorites with quality', 'smart splurges on signature moments');
  } else if (spendStyle === 'splurge_forward') {
    avoid.push('budget options that compromise experience', 'overcrowded budget alternatives');
    prioritize.push('premium experiences', 'fine dining', 'skip-the-line tickets', 'private tours', 'exclusive access');
  } else {
    avoid.push('obvious tourist traps');
    prioritize.push('balanced mix of splurges and value options', 'local recommendations at various price points');
  }
  
  // Add tier-specific refinements
  if (tierLevel >= 5) {
    prioritize.push('top-tier accommodations as baseline comfort');
    if (spendStyle === 'value_focused') {
      prioritize.push('1-2 signature splurges per trip where ROI is high');
    }
  }
  
  // Build the single-line notes for AI prompt
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const styleLabel = spendStyle.replace('_', '-');
  let notes = `${tierLabel}, ${styleLabel}`;
  
  if (conflict && spendStyle === 'value_focused' && tierLevel >= 5) {
    notes += ': willing to pay for top-tier comfort + 1-2 signature splurges; avoids tourist traps and low-ROI spend';
  } else if (spendStyle === 'value_focused') {
    notes += ': seeks best value at every price point; prioritizes quality over quantity; strategic splurges only';
  } else if (spendStyle === 'splurge_forward') {
    notes += ': embraces premium experiences freely; prioritizes exclusivity and comfort over cost savings';
  } else {
    notes += ': balanced approach to spending; open to both value finds and occasional splurges';
  }
  
  // Log conflict if detected
  if (conflict) {
    console.log(`[BudgetIntent] CONFLICT DETECTED: ${conflictDetails}`);
    console.log(`[BudgetIntent] Resolved to: ${notes}`);
  }
  
  return {
    tier: tier as BudgetTierLevel,
    spendStyle,
    splurgeCadence,
    avoid,
    prioritize,
    priceSensitivity,
    notes,
    conflict,
    conflictDetails
  };
}

// =============================================================================
// UNIFIED USER CONTEXT NORMALIZATION
// Merges Quiz (DNA), Preferences, and Adjustments (Overrides) into single context
// =============================================================================

interface NormalizedTraits {
  planning: number;    // -10 to +10
  social: number;      // -10 to +10
  comfort: number;     // -10 to +10
  pace: number;        // -10 to +10
  authenticity: number; // -10 to +10
  adventure: number;   // -10 to +10
  budget: number;      // -10 to +10 (POSITIVE = frugal)
  transformation: number; // -10 to +10
}

interface NormalizedUserContext {
  // Effective trait scores (blended from all sources)
  traits: NormalizedTraits;
  
  // Archetype information
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  archetypes: Array<{ name: string; pct: number; [key: string]: any }>;
  
  // Confidence score (adjusted based on data quality)
  confidence: number; // 0-100
  confidenceFactors: {
    hasQuiz: boolean;
    hasOverrides: boolean;
    hasPreferences: boolean;
    overrideCount: number;
    quizCompleteness: number; // 0-1
  };
  
  // Deduplicated preferences (quiz takes priority, preferences fill gaps)
  preferences: {
    // Persona
    travelerType: string | null;
    emotionalDrivers: string[];
    travelVibes: string[];
    travelCompanions: string[];
    
    // Style
    interests: string[];
    diningStyle: string | null;
    planningPreference: string | null;
    activityLevel: string | null;
    
    // Constraints
    dietaryRestrictions: string[];
    mobilityNeeds: string | null;
    accessibilityNeeds: string | null;
    
    // Food
    foodLikes: string[];
    foodDislikes: string[];
    
    // Flight/Accommodation (from preferences only)
    flightPreferences: string | null;
    accommodationStyle: string | null;
    climatePreferences: string[];
    
    // Eco
    ecoFriendly: boolean;
  };
  
  // Trip-specific context (overrides user defaults for THIS trip)
  tripContext: {
    tripType: string | null;       // romantic, adventure, family, solo, business
    budgetTier: string | null;     // budget, economy, standard, comfort, premium, luxury
    pace: string | null;           // slow, relaxed, moderate, active, packed
    travelers: number;
    interests: string[];           // Trip-specific interests
  };
  
  // Source tracking for transparency
  sources: {
    quizVersion: number | null;
    preferencesUpdatedAt: string | null;
    overridesApplied: string[];
    tripOverrides: string[];       // Which traits were modified by trip context
  };
}

// Blending weights
const BLEND_WEIGHTS = {
  QUIZ: 0.7,      // 70% weight to computed quiz results
  OVERRIDE: 0.3,  // 30% weight to manual overrides
} as const;

// Confidence penalties
const CONFIDENCE_PENALTIES = {
  NO_QUIZ: -30,           // No quiz data
  PARTIAL_QUIZ: -15,      // Quiz incomplete
  PER_OVERRIDE: -3,       // Each override slightly reduces confidence
  MAX_OVERRIDE_PENALTY: -15, // Cap override penalty
  NO_PREFERENCES: -10,    // No preference data
} as const;

/**
 * Blend a single trait value with an override using weighted average
 */
function blendTraitWithOverride(
  quizValue: number | undefined,
  overrideValue: number | undefined
): number {
  if (quizValue === undefined && overrideValue === undefined) return 0;
  if (quizValue === undefined) return overrideValue ?? 0;
  if (overrideValue === undefined) return quizValue;
  
  // Weighted blend: 70% quiz + 30% override
  const blended = (quizValue * BLEND_WEIGHTS.QUIZ) + (overrideValue * BLEND_WEIGHTS.OVERRIDE);
  // Round to 1 decimal place and clamp to -10 to +10
  return Math.max(-10, Math.min(10, Math.round(blended * 10) / 10));
}

/**
 * Calculate quiz completeness based on trait coverage
 */
function calculateQuizCompleteness(traitScores: Record<string, number> | undefined): number {
  if (!traitScores) return 0;
  
  const requiredTraits = ['planning', 'social', 'comfort', 'pace', 'authenticity', 'adventure', 'budget', 'transformation'];
  const presentTraits = requiredTraits.filter(t => 
    traitScores[t] !== undefined && traitScores[t] !== 0
  );
  
  return presentTraits.length / requiredTraits.length;
}

/**
 * Deduplicate fields between quiz responses and preferences
 * Quiz-derived values take priority; preferences fill gaps
 */
function deduplicatePreferences(
  quizData: Record<string, unknown> | null,
  prefsData: Record<string, unknown> | null
): NormalizedUserContext['preferences'] {
  const quiz = quizData || {};
  const prefs = prefsData || {};
  
  // Helper: get first non-null value
  const coalesce = <T>(...values: (T | null | undefined)[]): T | null => {
    for (const v of values) {
      if (v !== null && v !== undefined) return v;
    }
    return null;
  };
  
  // Helper: merge arrays, quiz first
  const mergeArrays = (quizArr: unknown, prefsArr: unknown): string[] => {
    const q = Array.isArray(quizArr) ? quizArr : [];
    const p = Array.isArray(prefsArr) ? prefsArr : [];
    return [...new Set([...q, ...p])].filter(Boolean) as string[];
  };
  
  return {
    // Persona - quiz fields take priority
    travelerType: coalesce(quiz.traveler_type, prefs.traveler_type) as string | null,
    emotionalDrivers: mergeArrays(quiz.emotional_drivers, prefs.emotional_drivers),
    travelVibes: mergeArrays(quiz.travel_vibes, prefs.travel_vibes),
    travelCompanions: mergeArrays(quiz.travel_companions, prefs.travel_companions),
    
    // Style
    interests: mergeArrays(quiz.interests, prefs.interests),
    diningStyle: coalesce(quiz.dining_style, prefs.dining_style) as string | null,
    planningPreference: coalesce(quiz.planning_preference, prefs.planning_preference) as string | null,
    activityLevel: coalesce(quiz.activity_level, prefs.activity_level) as string | null,
    
    // Constraints - preferences typically more complete here
    dietaryRestrictions: mergeArrays(prefs.dietary_restrictions, quiz.dietary_restrictions),
    mobilityNeeds: coalesce(prefs.mobility_needs, quiz.mobility_needs) as string | null,
    accessibilityNeeds: coalesce(prefs.accessibility_needs, quiz.accessibility_needs) as string | null,
    
    // Food
    foodLikes: mergeArrays(prefs.food_likes, quiz.food_likes),
    foodDislikes: mergeArrays(prefs.food_dislikes, quiz.food_dislikes),
    
    // Flight/Accommodation - preferences only
    flightPreferences: prefs.flight_preferences as string | null,
    accommodationStyle: coalesce(prefs.accommodation_style, prefs.hotel_style) as string | null,
    climatePreferences: mergeArrays(prefs.climate_preferences, prefs.weather_preferences),
    
    // Eco
    ecoFriendly: Boolean(prefs.eco_friendly || quiz.eco_friendly),
  };
}

/**
 * Normalize user context from 4 sources into unified structure
 * 
 * @param dna - Travel DNA profile (quiz results + archetype matching)
 * @param overrides - Manual trait adjustments from user
 * @param prefs - User preferences table data
 * @param tripContext - Trip-specific context (budget, type, pace) that overrides user defaults
 * @returns Unified normalized context with blended traits and deduplicated preferences
 */
function normalizeUserContext(
  dna: TravelDNAProfile | null,
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
  // Extract trait scores from DNA
  const quizTraits = dna?.trait_scores || {};
  const overrideTraits = overrides || {};
  
  // Blend each trait (quiz + manual overrides)
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
  
  // Track which traits were modified by trip context
  const tripOverrides: string[] = [];
  
  // ==========================================================================
  // TRIP-LEVEL OVERRIDES - These take highest priority for THIS specific trip
  // ==========================================================================
  
  // Trip type affects social and adventure traits
  if (tripContext?.tripType) {
    const tripTypeAdjustments: Record<string, Partial<NormalizedTraits>> = {
      'romantic': { social: -3, comfort: 3, pace: -2 },      // Intimate, comfortable, relaxed
      'honeymoon': { social: -4, comfort: 4, pace: -3 },     // Very intimate, luxurious, slow
      'adventure': { adventure: 4, pace: 3, comfort: -2 },    // High adventure, fast, less comfort
      'family': { social: 2, planning: 3, pace: -1 },         // Group, structured, moderate pace
      'solo': { social: -4, authenticity: 2, adventure: 1 },  // Independent, local, some adventure
      'business': { planning: 4, comfort: 3, pace: 2 },       // Very structured, comfortable, efficient
      'wellness': { pace: -4, comfort: 3, transformation: 3 }, // Slow, comfortable, growth-focused
      'cultural': { authenticity: 4, transformation: 2 },      // Local experiences, learning
      'beach': { pace: -3, comfort: 2 },                       // Relaxed, comfortable
      'city_break': { pace: 3, social: 1 },                    // Fast-paced, social
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
  
  // Trip pace overrides user pace trait
  if (tripContext?.pace) {
    const paceMap: Record<string, number> = {
      'slow': -6, 'relaxed': -3, 'moderate': 0, 'active': 4, 'packed': 7
    };
    if (paceMap[tripContext.pace] !== undefined) {
      const tripPace = paceMap[tripContext.pace];
      // Blend 50/50 with user preference (trip pace is strong signal)
      const oldPace = blendedTraits.pace;
      blendedTraits.pace = Math.round((blendedTraits.pace * 0.5 + tripPace * 0.5) * 10) / 10;
      if (blendedTraits.pace !== oldPace) {
        tripOverrides.push(`pace (${tripContext.pace})`);
      }
      console.log(`[TripContext] Pace adjusted: ${oldPace} -> ${blendedTraits.pace} (trip wants ${tripContext.pace})`);
    }
  }
  
  // Trip budget tier affects comfort trait (budget trait is handled separately in deriveBudgetIntent)
  if (tripContext?.budgetTier) {
    const budgetComfortMap: Record<string, number> = {
      'budget': -5, 'economy': -2, 'standard': 0, 'comfort': 3, 'premium': 5, 'luxury': 8
    };
    if (budgetComfortMap[tripContext.budgetTier] !== undefined) {
      const tripComfort = budgetComfortMap[tripContext.budgetTier];
      // Blend 60/40 (trip budget is strong signal for comfort expectations)
      const oldComfort = blendedTraits.comfort;
      blendedTraits.comfort = Math.round((blendedTraits.comfort * 0.4 + tripComfort * 0.6) * 10) / 10;
      if (blendedTraits.comfort !== oldComfort) {
        tripOverrides.push(`comfort (${tripContext.budgetTier})`);
      }
      console.log(`[TripContext] Comfort adjusted: ${oldComfort} -> ${blendedTraits.comfort} (trip budget: ${tripContext.budgetTier})`);
    }
  }
  
  // Travelers count affects social trait
  if (tripContext?.travelers && tripContext.travelers > 1) {
    const socialBoost = Math.min(3, (tripContext.travelers - 1) * 1.5);
    const oldSocial = blendedTraits.social;
    blendedTraits.social = Math.max(-10, Math.min(10, blendedTraits.social + socialBoost));
    if (blendedTraits.social !== oldSocial) {
      tripOverrides.push(`social (+${tripContext.travelers} travelers)`);
    }
  }
  
  // Calculate confidence factors
  const hasQuiz = Boolean(dna?.trait_scores && Object.keys(dna.trait_scores).length > 0);
  const hasOverrides = Boolean(overrides && Object.keys(overrides).length > 0);
  const hasPreferences = Boolean(prefs && Object.values(prefs).some(v => v !== null));
  const overrideCount = overrides ? Object.keys(overrides).length : 0;
  const quizCompleteness = calculateQuizCompleteness(dna?.trait_scores);
  
  // Calculate adjusted confidence
  let baseConfidence = dna?.travel_dna_v2?.confidence ?? dna?.confidence ?? 50;
  
  // Apply penalties
  if (!hasQuiz) {
    baseConfidence += CONFIDENCE_PENALTIES.NO_QUIZ;
  } else if (quizCompleteness < 0.8) {
    baseConfidence += CONFIDENCE_PENALTIES.PARTIAL_QUIZ;
  }
  
  if (!hasPreferences) {
    baseConfidence += CONFIDENCE_PENALTIES.NO_PREFERENCES;
  }
  
  // Override penalty (capped)
  const overridePenalty = Math.max(
    CONFIDENCE_PENALTIES.MAX_OVERRIDE_PENALTY,
    overrideCount * CONFIDENCE_PENALTIES.PER_OVERRIDE
  );
  baseConfidence += overridePenalty;
  
  // Clamp to 0-100
  const adjustedConfidence = Math.max(0, Math.min(100, Math.round(baseConfidence)));
  
  // Get archetypes (from DNA or infer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let archetypes: Array<{ name: string; pct: number; [key: string]: any }> = 
    dna?.travel_dna_v2?.archetype_matches || dna?.archetype_matches || [];
  if (archetypes.length === 0 && hasQuiz) {
    // Convert blended traits to Record<string, number> for inferArchetypesFromTraits
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
  
  // Deduplicate preferences
  const deduplicatedPrefs = deduplicatePreferences(
    dna?.travel_dna_v2 as Record<string, unknown> | null,
    prefs
  );
  
  // Track sources
  const sources = {
    quizVersion: dna?.dna_version ?? null,
    preferencesUpdatedAt: null, // Would need to fetch from prefs table
    overridesApplied: overrides ? Object.keys(overrides) : [],
    tripOverrides,
  };
  
  // Build trip context for output
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

/**
 * Build prompt context from normalized user context
 * Uses the unified blended traits instead of raw sources
 */
function buildNormalizedPromptContext(
  normalizedContext: NormalizedUserContext,
  budgetIntent: BudgetIntent | null
): string {
  const sections: string[] = [];
  
  // SECTION 1: Budget Intent (already reconciled)
  if (budgetIntent) {
    let budgetSection = `\n${'='.repeat(60)}\n💰 BUDGET INTENT\n${'='.repeat(60)}`;
    budgetSection += `\n🎯 ${budgetIntent.notes}`;
    budgetSection += `\n✅ PRIORITIZE: ${budgetIntent.prioritize.slice(0, 3).join('; ')}`;
    budgetSection += `\n❌ AVOID: ${budgetIntent.avoid.slice(0, 3).join('; ')}`;
    budgetSection += `\n📊 Splurge cadence: ${budgetIntent.splurgeCadence.dinners} nice dinners, ${budgetIntent.splurgeCadence.experiences} premium experiences per trip`;
    sections.push(budgetSection);
  }
  
  // SECTION 2: Archetype Blend (from normalized context)
  if (normalizedContext.archetypes.length > 0) {
    const blendParts = normalizedContext.archetypes.slice(0, 3).map((a) => 
      `${a.name.replace(/_/g, ' ')} (${Math.round(a.pct)}%)`
    );
    
    const confidenceLabel = normalizedContext.confidence >= 80 ? 'High' : 
                            normalizedContext.confidence >= 60 ? 'Moderate' : 'Uncertain';
    
    let personaSection = `\n${'='.repeat(60)}\n🧬 TRAVEL PERSONA\n${'='.repeat(60)}`;
    personaSection += `\nArchetype Blend: ${blendParts.join(' + ')}`;
    personaSection += `\nConfidence: ${normalizedContext.confidence}/100 (${confidenceLabel})`;
    
    // Confidence guidance
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
  
  // SECTION 3: Trait Profile (blended, excluding budget/comfort)
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
  
  // Note if user overrides or trip overrides were applied
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
  
  // SECTION 4: Trip Context (if available)
  const tripCtx = normalizedContext.tripContext;
  if (tripCtx.tripType || tripCtx.budgetTier || tripCtx.pace) {
    let tripSection = `\n${'='.repeat(60)}\n🗓️ THIS TRIP\n${'='.repeat(60)}`;
    
    if (tripCtx.tripType) {
      const tripTypeLabels: Record<string, string> = {
        'romantic': '💕 Romantic getaway — focus on intimate experiences, couples activities, and special moments',
        'honeymoon': '💍 Honeymoon — luxury, romance, privacy, and once-in-a-lifetime experiences',
        'adventure': '🏔️ Adventure trip — outdoor activities, adrenaline, exploration',
        'family': '👨‍👩‍👧‍👦 Family vacation — kid-friendly, manageable pacing, group activities',
        'solo': '🧘 Solo travel — self-discovery, flexibility, meeting locals',
        'business': '💼 Business trip — efficient, professional, work-friendly venues',
        'wellness': '🧘‍♀️ Wellness retreat — spa, yoga, healthy dining, relaxation',
        'cultural': '🏛️ Cultural exploration — museums, history, local traditions',
        'beach': '🏖️ Beach vacation — sun, sea, relaxation, water activities',
        'city_break': '🏙️ City break — urban exploration, nightlife, landmarks',
      };
      tripSection += `\n${tripTypeLabels[tripCtx.tripType] || `Trip type: ${tripCtx.tripType}`}`;
    }
    
    if (tripCtx.travelers > 1) {
      tripSection += `\n👥 ${tripCtx.travelers} travelers — ensure activities accommodate the group`;
    }
    
    if (tripCtx.interests && tripCtx.interests.length > 0) {
      tripSection += `\n🎯 Trip interests: ${tripCtx.interests.slice(0, 5).join(', ')}`;
    }
    
    sections.push(tripSection);
  }
  
  // SECTION 5: Deduplicated Preferences
  const prefs = normalizedContext.preferences;
  const prefItems: string[] = [];
  
  // Persona
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
  
  // Style
  if (prefs.interests.length > 0) {
    prefItems.push(`🎯 Interests: ${prefs.interests.slice(0, 6).join(', ')}`);
  }
  if (prefs.diningStyle) {
    prefItems.push(`🍽️ Dining style: ${prefs.diningStyle}`);
  }
  if (prefs.planningPreference) {
    prefItems.push(`📋 Planning style: ${prefs.planningPreference}`);
  }
  
  // Food
  if (prefs.foodLikes.length > 0) {
    prefItems.push(`✅ Food loves: ${prefs.foodLikes.slice(0, 5).join(', ')}`);
  }
  if (prefs.foodDislikes.length > 0) {
    prefItems.push(`❌ Food avoid: ${prefs.foodDislikes.slice(0, 5).join(', ')}`);
  }
  
  // Constraints
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

// =============================================================================
// RATE LIMITING - In-memory store (resets on cold start, but limits abuse)
// =============================================================================
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMITS = {
  'generate-full': { maxRequests: 3, windowMs: 300000 }, // 3 full generations per 5 min
  'generate-day': { maxRequests: 10, windowMs: 60000 },   // 10 day regenerations per min
  default: { maxRequests: 20, windowMs: 60000 }           // 20 requests per min for other actions
};

function checkRateLimit(userId: string, action: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `${userId}:${action}`;
  const limits = RATE_LIMITS[action as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limits.windowMs });
    return { allowed: true, remaining: limits.maxRequests - 1 };
  }
  
  if (entry.count >= limits.maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: limits.maxRequests - entry.count };
}

// =============================================================================
// STRICT SCHEMA FOR AI GENERATION (Tool Definition)
// =============================================================================

const STRICT_ITINERARY_TOOL = {
  type: "function",
  function: {
    name: "create_complete_itinerary",
    description: "Creates a complete, structured travel itinerary with all required details including COORDINATES, COSTS, and COMPREHENSIVE TAGS",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "array",
          description: "Array of daily itinerary plans",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "integer", minimum: 1 },
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              title: { type: "string", description: "Day title (e.g., 'Historic Exploration')" },
              activities: {
                type: "array",
                minItems: 3,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    startTime: { type: "string", description: "HH:MM format (24-hour)" },
                    endTime: { type: "string", description: "HH:MM format (24-hour)" },
                    category: {
                      type: "string",
                      enum: ["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"]
                    },
                    location: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Venue name" },
                        address: { type: "string", description: "Full street address with city and postal code" },
                        coordinates: {
                          type: "object",
                          properties: {
                            lat: { type: "number", description: "Latitude (e.g., 48.8584)" },
                            lng: { type: "number", description: "Longitude (e.g., 2.2945)" }
                          },
                          required: ["lat", "lng"],
                          description: "REQUIRED: Approximate GPS coordinates for the venue"
                        }
                      },
                      required: ["name", "address", "coordinates"]
                    },
                    cost: {
                      type: "object",
                      properties: {
                        amount: { type: "number", minimum: 0, description: "REQUIRED: Realistic cost per person in local currency. Use 0 for free attractions." },
                        currency: { type: "string", description: "ISO currency code (USD, EUR, GBP, etc.)" }
                      },
                      required: ["amount", "currency"]
                    },
                    description: { type: "string", description: "Activity description (2-3 sentences)" },
                    tags: { 
                      type: "array", 
                      items: { type: "string" }, 
                      minItems: 5,
                      description: "REQUIRED: 5-8 comprehensive tags for search. Include: category tags (museum, park), experience tags (romantic, family-friendly), time tags (morning, sunset), price tags (free, budget-friendly, premium), mood tags (adventure, relaxation)"
                    },
                    bookingRequired: { type: "boolean" },
                    transportation: {
                      type: "object",
                      properties: {
                        method: { 
                          type: "string", 
                          enum: ["walk", "metro", "bus", "taxi", "uber", "tram", "train", "car"],
                          description: "SMART MODE SELECTION: walk (<1km), metro/tram/bus (1-8km in cities with transit), uber/taxi (>3km or no transit), train (inter-city)"
                        },
                        duration: { type: "string" },
                        distanceKm: { type: "number", description: "Estimated distance in kilometers between locations" },
                        estimatedCost: {
                          type: "object",
                          properties: {
                            amount: { type: "number" },
                            currency: { type: "string" }
                          },
                          required: ["amount", "currency"]
                        },
                        instructions: { type: "string", description: "Include specific transit lines, stations, or route details when applicable" }
                      },
                      required: ["method", "duration", "estimatedCost", "instructions"]
                    },
                    tips: { type: "string", description: "Insider tip or recommendation" },
                    rating: {
                      type: "object",
                      properties: {
                        value: { type: "number", minimum: 1, maximum: 5 },
                        totalReviews: { type: "integer", minimum: 0 }
                      },
                      required: ["value", "totalReviews"]
                    },
                    website: { type: "string", description: "Official website URL if available" },
                    priceLevel: { type: "integer", minimum: 1, maximum: 4, description: "Price level 1-4 ($ to $$$$)" },
                    reviewHighlights: { 
                      type: "array", 
                      items: { type: "string" }, 
                      maxItems: 3,
                      description: "2-3 short review snippets highlighting what visitors love"
                    }
                  },
                  required: ["id", "title", "startTime", "endTime", "category", "location", "cost", "description", "tags", "bookingRequired", "transportation"]
                }
              }
            },
            required: ["dayNumber", "date", "title", "activities"]
          }
        }
      },
      required: ["days"]
    }
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// =============================================================================
// GROUP PREFERENCE BLENDING - For multi-traveler trips with linked friends
// =============================================================================

interface TravelDNAV2 {
  user_id?: string;
  dna_version?: number;
  trait_scores?: Record<string, number>;
  archetype_matches?: Array<{
    archetype_id: string;
    name: string;
    category?: string;
    score: number;
    pct: number;
    reasons?: Array<{ trait: string; effect: string; amount: number; note?: string }>;
  }>;
  confidence?: number;
  trait_contributions?: Array<{
    question_id: string;
    answer_id: string;
    label?: string;
    deltas: Record<string, number>;
    normalized_multiplier: number;
  }>;
}

interface TravelDNAProfile {
  user_id: string;
  trait_scores?: Record<string, number>;
  travel_dna_v2?: TravelDNAV2;
  archetype_matches?: TravelDNAV2['archetype_matches'];
  confidence?: number;
  dna_version?: number;
}

interface PreferenceProfile {
  user_id: string;
  interests?: string[];
  travel_pace?: string;
  budget_tier?: string;
  dining_style?: string;
  activity_level?: string;
  dietary_restrictions?: string[];
  accessibility_needs?: string[];
  mobility_needs?: string;
  mobility_level?: string;
  climate_preferences?: string[];
  eco_friendly?: boolean;
}

/**
 * Blend preferences for group trips using weighted averaging
 * The trip organizer can optionally have higher weight
 */
function blendGroupPreferences(
  profiles: PreferenceProfile[],
  organizerId?: string
): PreferenceProfile | null {
  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0];

  console.log(`[GroupBlend] Blending preferences for ${profiles.length} travelers`);

  // Assign weights - organizer gets 1.5x weight
  const weights = profiles.map(p => p.user_id === organizerId ? 1.5 : 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map(w => w / totalWeight);

  // Blend interests - take union with frequency-based ordering
  const interestCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    (p.interests || []).forEach(interest => {
      interestCounts[interest] = (interestCounts[interest] || 0) + normalizedWeights[idx];
    });
  });
  const blendedInterests = Object.entries(interestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([interest]) => interest);

  // Blend pace - weighted voting
  const paceCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.travel_pace) {
      paceCounts[p.travel_pace] = (paceCounts[p.travel_pace] || 0) + normalizedWeights[idx];
    }
  });
  const blendedPace = Object.entries(paceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'moderate';

  // Blend activity level - weighted voting
  const activityCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.activity_level) {
      activityCounts[p.activity_level] = (activityCounts[p.activity_level] || 0) + normalizedWeights[idx];
    }
  });
  const blendedActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Blend dining style - weighted voting
  const diningCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.dining_style) {
      diningCounts[p.dining_style] = (diningCounts[p.dining_style] || 0) + normalizedWeights[idx];
    }
  });
  const blendedDining = Object.entries(diningCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // CRITICAL: Merge all dietary restrictions (union - don't leave anyone out!)
  const allDietary = new Set<string>();
  profiles.forEach(p => {
    (p.dietary_restrictions || []).forEach(d => allDietary.add(d));
  });

  // CRITICAL: Merge all accessibility needs (union)
  const allAccessibility = new Set<string>();
  profiles.forEach(p => {
    (p.accessibility_needs || []).forEach(a => allAccessibility.add(a));
  });

  // Mobility - take most restrictive
  const mobilityLevels = ['limited', 'moderate', 'active', 'very_active'];
  let mostRestrictiveMobility = 'active';
  profiles.forEach(p => {
    if (p.mobility_level) {
      const currentIdx = mobilityLevels.indexOf(mostRestrictiveMobility);
      const newIdx = mobilityLevels.indexOf(p.mobility_level);
      if (newIdx < currentIdx) mostRestrictiveMobility = p.mobility_level;
    }
  });

  // Eco-friendly - if any member cares, respect it
  const anyEcoFriendly = profiles.some(p => p.eco_friendly);

  // Climate preferences - intersection preferred, union if empty
  const climateSets = profiles.map(p => new Set(p.climate_preferences || []));
  let blendedClimate: string[] = [];
  if (climateSets.every(s => s.size > 0)) {
    // Find intersection
    const first = climateSets[0];
    const intersection = [...first].filter(c => climateSets.every(s => s.has(c)));
    if (intersection.length > 0) {
      blendedClimate = intersection;
    } else {
      // Fallback to union
      const union = new Set<string>();
      climateSets.forEach(s => s.forEach(c => union.add(c)));
      blendedClimate = [...union];
    }
  }

  console.log(`[GroupBlend] Result: ${blendedInterests.length} interests, pace=${blendedPace}, ${allDietary.size} dietary restrictions`);

  return {
    user_id: 'blended',
    interests: blendedInterests,
    travel_pace: blendedPace,
    activity_level: blendedActivity,
    dining_style: blendedDining,
    dietary_restrictions: [...allDietary],
    accessibility_needs: [...allAccessibility],
    mobility_level: mostRestrictiveMobility,
    climate_preferences: blendedClimate,
    eco_friendly: anyEcoFriendly,
  };
}

/**
 * Fetch collaborator preferences for a trip
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCollaboratorPreferences(supabase: any, tripId: string): Promise<PreferenceProfile[]> {
  try {
    // Get collaborators linked to this trip
    const { data: collaborators, error: collabError } = await supabase
      .from('trip_collaborators')
      .select('user_id')
      .eq('trip_id', tripId);

    if (collabError || !collaborators?.length) {
      return [];
    }

    const userIds = collaborators.map((c: { user_id: string }) => c.user_id);
    
    // Fetch their preferences using the SAFE view (excludes PII like phone_number)
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences_safe')
      .select('*')
      .in('user_id', userIds);

    if (prefError) {
      console.error('[GroupBlend] Error fetching collaborator preferences:', prefError);
      return [];
    }

    return (preferences || []) as PreferenceProfile[];
  } catch (e) {
    console.error('[GroupBlend] Error:', e);
    return [];
  }
}

/**
 * Get flight and hotel context for AI prompt
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FlightHotelContextResult {
  context: string;
  arrivalTime?: string;
  arrivalTime24?: string;
  earliestFirstActivityTime?: string;
  returnDepartureTime?: string;
  returnDepartureTime24?: string;
  latestLastActivityTime?: string;
  hotelName?: string;
  hotelAddress?: string;
}

// Airport transfer fare data from database
interface AirportTransferFare {
  taxiCostMin: number | null;
  taxiCostMax: number | null;
  trainCost: number | null;
  busCost: number | null;
  currency: string;
  currencySymbol: string;
  taxiIsFixedPrice: boolean;
}

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  if (!period && hours >= 24) return null;
  return hours * 60 + mins;
}

function minutesToHHMM(totalMinutes: number): string {
  const mins = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutesToHHMM(timeHHMM: string, deltaMins: number): string {
  const base = parseTimeToMinutes(timeHHMM);
  if (base === null) return timeHHMM;
  return minutesToHHMM(base + deltaMins);
}

function normalizeTo24h(timeStr: string): string | null {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return null;
  return minutesToHHMM(mins);
}

/**
 * Dynamic transfer pricing result from transfer-pricing edge function
 */
interface DynamicTransferResult {
  recommendedOption?: {
    mode: string;
    priceTotal: number;
    currency: string;
    priceFormatted: string;
    isBookable: boolean;
    bookingUrl?: string;
    productCode?: string;
    source: string;
    durationMinutes: number;
  };
  options: Array<{
    id: string;
    mode: string;
    priceTotal: number;
    currency: string;
    priceFormatted: string;
    isBookable: boolean;
    bookingUrl?: string;
    productCode?: string;
    source: string;
  }>;
  source: 'live' | 'database' | 'estimated';
}

/**
 * Fetch dynamic transfer pricing from transfer-pricing edge function
 * This combines Viator, Google Maps, and database fares for accurate pricing
 */
async function getDynamicTransferPricing(
  supabaseUrl: string,
  origin: string,
  destination: string,
  city: string,
  travelers: number = 2,
  date?: string
): Promise<DynamicTransferResult | null> {
  try {
    console.log(`[TransferPricing] Fetching dynamic pricing for ${origin} → ${destination}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/transfer-pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        city,
        travelers,
        date,
        transferType: origin.toLowerCase().includes('airport') ? 'airport_arrival' : 'point_to_point',
      }),
    });

    if (!response.ok) {
      console.warn('[TransferPricing] Edge function error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log(`[TransferPricing] Got ${data.options?.length || 0} options, source: ${data.source}`);
    
    return data;
  } catch (e) {
    console.error('[TransferPricing] Error:', e);
    return null;
  }
}

/**
 * Fetch airport transfer fare from database to sync with Airport Game Plan
 * Falls back to database query if dynamic pricing fails
 */
async function getAirportTransferFare(supabase: any, city: string, airportCode?: string): Promise<AirportTransferFare | null> {
  try {
    let query = supabase
      .from('airport_transfer_fares')
      .select('taxi_cost_min, taxi_cost_max, train_cost, bus_cost, currency, currency_symbol, taxi_is_fixed_price')
      .ilike('city', city);
    
    if (airportCode) {
      query = query.eq('airport_code', airportCode.toUpperCase());
    }
    
    const { data, error } = await query.limit(1);
    
    if (error || !data?.length) {
      console.log(`[AirportFare] No fare found for ${city}${airportCode ? ` (${airportCode})` : ''}`);
      return null;
    }
    
    const fare = data[0];
    console.log(`[AirportFare] Found fare for ${city}: taxi €${fare.taxi_cost_min}-${fare.taxi_cost_max}, train €${fare.train_cost}`);
    
    return {
      taxiCostMin: fare.taxi_cost_min,
      taxiCostMax: fare.taxi_cost_max,
      trainCost: fare.train_cost,
      busCost: fare.bus_cost,
      currency: fare.currency || 'EUR',
      currencySymbol: fare.currency_symbol || '€',
      taxiIsFixedPrice: fare.taxi_is_fixed_price || false,
    };
  } catch (e) {
    console.error('[AirportFare] Error fetching fare:', e);
    return null;
  }
}

async function getFlightHotelContext(supabase: any, tripId: string): Promise<FlightHotelContextResult> {
  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('flight_selection, hotel_selection')
      .eq('id', tripId)
      .maybeSingle();

    if (error || !trip) return { context: '' };

    const sections: string[] = [];
    let arrivalTimeStr: string | undefined;
    let arrivalTime24: string | undefined;
    let earliestFirstActivity: string | undefined;
    let returnDepartureTimeStr: string | undefined;
    let returnDepartureTime24: string | undefined;
    let latestLastActivity: string | undefined;
    let hotelName: string | undefined;
    let hotelAddress: string | undefined;

    // Parse flight information - handle both flat and nested structures
    // Flat: { arrivalTime, returnDepartureTime }
    // Nested: { departure: { arrivalTime }, return: { departureTime } }
    const flightRaw = trip.flight_selection as Record<string, unknown> | null;
    
    if (flightRaw) {
      const flightInfo: string[] = [];
      
      // Extract arrival time for Day 1 (when we land at destination)
      // Nested structure: departure.arrivalTime (outbound flight arrives at destination)
      // Flat structure: arrivalTime
      const nestedDeparture = flightRaw.departure as Record<string, unknown> | undefined;
      const nestedReturn = flightRaw.return as Record<string, unknown> | undefined;
      
      const outboundArrival = (nestedDeparture?.arrivalTime as string) || (flightRaw.arrivalTime as string);
      const returnDeparture = (nestedReturn?.departureTime as string) || (flightRaw.returnDepartureTime as string);
      
      // Airport info
      const departureAirport = flightRaw.departureAirport as string | undefined;
      const arrivalAirport = flightRaw.arrivalAirport as string | undefined;
      
      if (departureAirport && arrivalAirport) {
        flightInfo.push(`✈️ Outbound: ${departureAirport} → ${arrivalAirport}`);
      }
      
      // Outbound departure time
      const outboundDeparture = (nestedDeparture?.departureTime as string) || (flightRaw.departureTime as string);
      if (outboundDeparture) {
        flightInfo.push(`  Departure: ${outboundDeparture}`);
      }
      
      // Day 1 arrival - CRITICAL for first activity timing
      if (outboundArrival) {
        // Normalize to 24h HH:MM (required by the AI tool schema for startTime/endTime)
        arrivalTimeStr = outboundArrival; // keep original for display
        arrivalTime24 = normalizeTo24h(outboundArrival) || (outboundArrival.includes('T') ? normalizeTo24h(new Date(outboundArrival).toTimeString()) || undefined : undefined);
        flightInfo.push(`  Arrival: ${arrivalTimeStr}${arrivalTime24 ? ` (24h: ${arrivalTime24})` : ''}`);

        // Calculate earliest sightseeing time: arrival + 4 hours buffer
        if (arrivalTime24) {
          const ARRIVAL_BUFFER_MINS = 4 * 60;
          earliestFirstActivity = minutesToHHMM((parseTimeToMinutes(arrivalTime24) || 0) + ARRIVAL_BUFFER_MINS);
        }

        console.log(`[FlightContext] Raw arrival: "${outboundArrival}", arrival24: ${arrivalTime24}, earliest sightseeing: ${earliestFirstActivity}`);
      }
      
      // Last day - return flight departure
      if (returnDeparture) {
        returnDepartureTimeStr = returnDeparture;
        returnDepartureTime24 = normalizeTo24h(returnDeparture) || undefined;
        flightInfo.push(`✈️ Return departure: ${returnDepartureTimeStr}`);

        // Calculate latest last activity: return departure - 3 hours buffer
        if (returnDepartureTime24) {
          const DEPARTURE_BUFFER_MINS = 3 * 60;
          latestLastActivity = minutesToHHMM((parseTimeToMinutes(returnDepartureTime24) || 0) - DEPARTURE_BUFFER_MINS);
        }

        console.log(`[FlightContext] Return raw ${returnDepartureTimeStr}, return24: ${returnDepartureTime24}, latest activity: ${latestLastActivity}`);
      }
      
      if (flightInfo.length > 0) {
        let flightConstraints = `\n${'='.repeat(40)}\n✈️ FLIGHT SCHEDULE - CRITICAL CONSTRAINTS\n${'='.repeat(40)}\n${flightInfo.join('\n')}`;
        
        // Add explicit timing constraints
        if (earliestFirstActivity) {
          flightConstraints += `\n\n🚨 DAY 1 TIMING CONSTRAINT:`;
          flightConstraints += `\n   - Flight lands at ${arrivalTime24 || arrivalTimeStr}`;
          flightConstraints += `\n   - Allow 4 hours for: customs/immigration, baggage, transport to hotel, check-in`;
          flightConstraints += `\n   - EARLIEST first sightseeing activity: ${earliestFirstActivity} (NOT earlier!)`;
          flightConstraints += `\n   - If arrival is late (after 6 PM), Day 1 should only include: arrival → transfer → check-in → (optional) quick dinner near hotel → rest`;
        }
        
        if (latestLastActivity) {
          flightConstraints += `\n\n🚨 LAST DAY TIMING CONSTRAINT:`;
          flightConstraints += `\n   - Return flight departs at ${returnDepartureTimeStr}`;
          flightConstraints += `\n   - Allow 3 hours for: checkout, transport to airport, check-in, security`;
          flightConstraints += `\n   - LATEST activity before airport transfer: ${latestLastActivity}`;
        }
        
        sections.push(flightConstraints);
      }
    }

    // Parse hotel information  
    const hotel = trip.hotel_selection as {
      name?: string;
      address?: string;
      neighborhood?: string;
      checkIn?: string;
      checkOut?: string;
    } | null;
    
    if (hotel) {
      const hotelInfo: string[] = [];
      if (hotel.name) {
        hotelInfo.push(`🏨 Hotel: ${hotel.name}`);
        hotelName = hotel.name;
      }
      if (hotel.address) {
        hotelInfo.push(`   Address: ${hotel.address}`);
        hotelAddress = hotel.address;
      }
      if (hotel.neighborhood) {
        hotelInfo.push(`   Neighborhood: ${hotel.neighborhood}`);
      }
      if (hotelInfo.length > 0) {
        sections.push(`\n${'='.repeat(40)}\n🏨 ACCOMMODATION (Use as daily starting/ending point)\n${'='.repeat(40)}\n${hotelInfo.join('\n')}\n⚠️ Start each day from the hotel area and end nearby for easy return.`);
      }
    }

    return {
      context: sections.join('\n'),
      arrivalTime: arrivalTimeStr,
      arrivalTime24,
      earliestFirstActivityTime: earliestFirstActivity,
      returnDepartureTime: returnDepartureTimeStr,
      returnDepartureTime24,
      latestLastActivityTime: latestLastActivity,
      hotelName,
      hotelAddress,
    };
  } catch (e) {
    console.error('[FlightHotel] Error:', e);
    return { context: '' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLearnedPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preference_insights')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(`
        interests, 
        travel_pace, 
        budget_tier, 
        dining_style, 
        activity_level,
        dietary_restrictions,
        accessibility_needs,
        mobility_needs,
        mobility_level,
        hotel_style,
        accommodation_style,
        flight_preferences,
        flight_time_preference,
        seat_preference,
        direct_flights_only,
        climate_preferences,
        weather_preferences,
        preferred_regions,
        eco_friendly,
        traveler_type,
        travel_vibes,
        planning_preference,
        travel_companions,
        vibe,
        travel_style,
        primary_goal,
        emotional_drivers,
        food_likes,
        food_dislikes
      `)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// =============================================================================
// TRAVEL DNA V2 INTEGRATION - Archetype blend + confidence for persona
// =============================================================================

// Helper to normalize budget trait from older profiles with inverted polarity
// This is also defined in calculate-travel-dna, replicated here to avoid cross-function imports
function normalizeBudgetTraitForPolarity(budgetTrait: number, polarityVersion: 1 | 2): number {
  // v1 = old inverted deltas (positive=splurge), v2 = fixed (positive=frugal)
  return polarityVersion === 1 ? -budgetTrait : budgetTrait;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTravelDNAV2(supabase: any, userId: string): Promise<TravelDNAProfile | null> {
  try {
    // First check for Travel DNA v2 data
    const { data: dnaProfile, error: dnaError } = await supabase
      .from('travel_dna_profiles')
      .select('user_id, trait_scores, travel_dna_v2, archetype_matches, dna_version')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (dnaProfile?.travel_dna_v2) {
      console.log('[TravelDNA] Found v2 profile with archetype blend');
      
      // Always normalize budget trait based on polarity version (safer approach)
      const v2Data = dnaProfile.travel_dna_v2;
      const polarityVersion = (v2Data.budget_polarity_version ?? 1) as 1 | 2;  // Default to v1 if not present
      let normalizedTraitScores = v2Data.trait_scores;
      const rawBudget = normalizedTraitScores?.budget;
      
      // Always apply normalization - function handles both versions correctly
      if (rawBudget !== undefined) {
        const normalizedBudget = normalizeBudgetTraitForPolarity(rawBudget, polarityVersion);
        if (normalizedBudget !== rawBudget) {
          console.log(`[TravelDNA] Normalizing budget from polarity v${polarityVersion}: ${rawBudget} -> ${normalizedBudget}`);
        }
        normalizedTraitScores = {
          ...normalizedTraitScores,
          budget: normalizedBudget,
        };
      }
      
      return {
        user_id: dnaProfile.user_id,
        trait_scores: normalizedTraitScores,
        travel_dna_v2: { ...v2Data, trait_scores: normalizedTraitScores },
        archetype_matches: v2Data.archetype_matches,
        confidence: v2Data.confidence,
        dna_version: 2,
      };
    }

    // Fallback to v1 or archetype_matches column - ALWAYS needs polarity normalization
    if (dnaProfile?.archetype_matches) {
      console.log('[TravelDNA] Found v1 profile with archetype_matches - normalizing budget polarity');
      let traitScores = dnaProfile.trait_scores;
      
      // v1 profiles always have inverted polarity
      if (traitScores?.budget !== undefined) {
        traitScores = {
          ...traitScores,
          budget: normalizeBudgetTraitForPolarity(traitScores.budget, 1),
        };
      }
      
      return {
        user_id: dnaProfile.user_id,
        trait_scores: traitScores,
        archetype_matches: dnaProfile.archetype_matches,
        dna_version: 1,
      };
    }

    // Also check profiles.travel_dna for legacy data - ALWAYS needs polarity normalization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('travel_dna, travel_dna_overrides')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.travel_dna) {
      const dna = profile.travel_dna as Record<string, unknown>;
      console.log('[TravelDNA] Found legacy profile data - normalizing budget polarity');
      let traitScores = dna.trait_scores as Record<string, number>;
      
      // Legacy profiles always have inverted polarity
      if (traitScores?.budget !== undefined) {
        traitScores = {
          ...traitScores,
          budget: normalizeBudgetTraitForPolarity(traitScores.budget, 1),
        };
      }
      
      return {
        user_id: userId,
        trait_scores: traitScores,
        dna_version: 1,
      };
    }

    return null;
  } catch (e) {
    console.error('[TravelDNA] Error fetching:', e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTraitOverrides(supabase: any, userId: string): Promise<Record<string, number> | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('travel_dna_overrides')
      .eq('id', userId)
      .maybeSingle();
    
    if (data?.travel_dna_overrides && typeof data.travel_dna_overrides === 'object') {
      console.log('[TravelDNA] Found trait overrides');
      return data.travel_dna_overrides as Record<string, number>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Infer archetypes from trait scores for v1 users who don't have archetype_matches
 * Uses a simple weighted mapping of traits to archetype affinities
 */
function inferArchetypesFromTraits(traitScores: Record<string, number>): Array<{ name: string; pct: number }> {
  // Archetype definitions with trait weights
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

  // Calculate score for each archetype
  const archetypeScores: Array<{ name: string; score: number }> = [];
  
  for (const [archetype, weights] of Object.entries(archetypeTraitWeights)) {
    let score = 50; // Base score
    for (const [trait, weight] of Object.entries(weights)) {
      const traitValue = traitScores[trait] || 0;
      score += traitValue * weight;
    }
    archetypeScores.push({ name: archetype, score: Math.max(0, Math.min(100, score)) });
  }

  // Sort by score descending
  archetypeScores.sort((a, b) => b.score - a.score);

  // Convert to percentages (softmax-like normalization)
  const totalScore = archetypeScores.reduce((sum, a) => sum + a.score, 0) || 1;
  const topArchetypes = archetypeScores.slice(0, 5).map(a => ({
    name: a.name,
    pct: (a.score / totalScore) * 100,
  }));

  return topArchetypes;
}

/**
 * Build Travel DNA persona context for AI prompt
 * Includes archetype blend, confidence level, trait information, and RECONCILED BUDGET INTENT
 * 
 * @param supabase - Supabase client for structured event logging
 * @param userId - User ID for event logging (optional)
 */
async function buildTravelDNAContext(
  dna: TravelDNAProfile | null, 
  overrides: Record<string, number> | null,
  budgetTier?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any,
  userId?: string
): Promise<{ context: string; budgetIntent: BudgetIntent | null }> {
  if (!dna) return { context: '', budgetIntent: null };

  const sections: string[] = [];
  
  // Get effective trait scores (overrides take precedence)
  const traitScores = overrides 
    ? { ...dna.trait_scores, ...overrides }
    : dna.trait_scores;
  
  // ==========================================================================
  // BUDGET INTENT RECONCILIATION - Single source of truth for spending behavior
  // ==========================================================================
  const budgetTrait = traitScores?.budget as number | undefined;
  const comfortTrait = traitScores?.comfort as number | undefined;
  const budgetIntent = deriveBudgetIntent(budgetTier, budgetTrait, comfortTrait);
  
  // Log structured event if conflict detected (for analytics + debugging)
  if (budgetIntent.conflict && supabase && userId) {
    try {
      await supabase.from('voyance_events').insert({
        user_id: userId,
        event_type: 'budget_intent_conflict',
        properties: {
          budget_tier: budgetTier,
          budget_trait: budgetTrait,
          comfort_trait: comfortTrait,
          resolved_tier: budgetIntent.tier,
          resolved_spend_style: budgetIntent.spendStyle,
          price_sensitivity: budgetIntent.priceSensitivity,
          conflict_details: budgetIntent.conflictDetails,
          notes: budgetIntent.notes,
        },
      });
      console.log('[BudgetIntent] Logged conflict event to voyance_events');
    } catch (logErr) {
      console.warn('[BudgetIntent] Failed to log event:', logErr);
    }
  }
  
  // SIMPLIFIED budget section for LLM (per user feedback: keep it short)
  // Only the essentials: notes line + 2 bullet lists + optional splurge cadence
  let budgetSection = `\n💰 BUDGET INTENT:\n🎯 ${budgetIntent.notes}`;
  budgetSection += `\n✅ PRIORITIZE: ${budgetIntent.prioritize.slice(0, 3).join('; ')}`;
  budgetSection += `\n❌ AVOID: ${budgetIntent.avoid.slice(0, 3).join('; ')}`;
  budgetSection += `\n📊 Splurge cadence: ${budgetIntent.splurgeCadence.dinners} dinners, ${budgetIntent.splurgeCadence.experiences} experiences`;
  
  sections.push(budgetSection);
  
  // Archetype blend section - use existing or infer from trait scores
  let archetypes: Array<{ name: string; pct: number }> | undefined = 
    dna.travel_dna_v2?.archetype_matches || dna.archetype_matches;
  const confidence = dna.travel_dna_v2?.confidence ?? dna.confidence ?? 75;
  
  // If no archetypes but we have trait scores, infer archetypes from traits (v1 fallback)
  if ((!archetypes || archetypes.length === 0) && traitScores) {
    archetypes = inferArchetypesFromTraits(traitScores);
    if (archetypes && archetypes.length > 0) {
      console.log('[TravelDNA] Inferred archetypes from trait scores:', archetypes.map(a => a.name));
    }
  }
  
  if (archetypes && archetypes.length > 0) {
    const blendParts = archetypes.slice(0, 3).map((a) => 
      `${a.name.replace(/_/g, ' ')} (${Math.round(a.pct)}%)`
    );
    
    const confidenceLabel = confidence >= 80 ? 'High' : confidence >= 60 ? 'Moderate' : 'Uncertain';
    
    let personaSection = `\n${'='.repeat(60)}\n🧬 TRAVEL DNA ARCHETYPE BLEND\n${'='.repeat(60)}`;
    personaSection += `\nArchetype Blend: ${blendParts.join(' + ')}`;
    personaSection += `\nConfidence: ${Math.round(confidence)}/100 (${confidenceLabel})`;
    
    // Add archetype descriptions for AI context
    const archetypeDescriptions: Record<string, string> = {
      'Cultural Curator': 'Prioritize museums, historical sites, art galleries, architectural tours, and authentic local experiences',
      'Wellness Wanderer': 'Include spa visits, yoga sessions, meditation spots, thermal baths, and peaceful nature retreats',
      'Wilderness Pioneer': 'Focus on hiking, nature reserves, outdoor adventures, wildlife, and scenic viewpoints',
      'Urban Explorer': 'Emphasize city walks, street art, local neighborhoods, rooftop bars, and vibrant nightlife',
      'Culinary Voyager': 'Center activities around food markets, cooking classes, wine tastings, and renowned restaurants',
      'Luxury Seeker': 'Recommend premium experiences, fine dining, exclusive tours, and high-end establishments',
      'Budget Adventurer': 'Focus on free attractions, street food, walking tours, and value experiences',
      'Social Butterfly': 'Include group tours, communal dining, festivals, and opportunities to meet locals',
      'Slow Traveler': 'Fewer activities per day, longer experiences, cafe culture, and immersive local living',
      'Thrill Seeker': 'Adventure sports, extreme activities, adrenaline experiences, and unique challenges',
    };
    
    const topArchetype = archetypes[0]?.name?.replace(/_/g, ' ');
    if (topArchetype && archetypeDescriptions[topArchetype]) {
      personaSection += `\n\n🎯 PRIMARY ARCHETYPE GUIDANCE:`;
      personaSection += `\n   ${archetypeDescriptions[topArchetype]}`;
    }
    
    // Add guidance based on confidence
    if (confidence < 60) {
      personaSection += `\n\n⚠️ LOW CONFIDENCE NOTICE:`;
      personaSection += `\n   - This traveler's profile has mixed signals or is still being refined`;
      personaSection += `\n   - Avoid overly assertive persona-based recommendations`;
      personaSection += `\n   - Include more variety and let activities speak for themselves`;
      personaSection += `\n   - Consider offering 2 stylistic alternatives for key decisions`;
    } else if (confidence >= 80) {
      personaSection += `\n\n✅ HIGH CONFIDENCE:`;
      personaSection += `\n   - Lean into the primary archetype's preferences confidently`;
      personaSection += `\n   - Personalization can be more specific and targeted`;
    }
    
    sections.push(personaSection);
  }
  
  // Trait summary section - EXCLUDING budget/comfort (already reconciled above)
  if (traitScores && Object.keys(traitScores).length > 0) {
    const traitLabels: Record<string, [string, string]> = {
      planning: ['Spontaneous', 'Detailed Planner'],
      social: ['Solo/Intimate', 'Social/Group'],
      pace: ['Relaxed', 'Fast-Paced'],
      authenticity: ['Tourist-Friendly', 'Local/Authentic'],
      adventure: ['Safe/Comfortable', 'Adventurous'],
      transformation: ['Leisure', 'Growth-Focused'],
      // NOTE: budget and comfort are EXCLUDED - they are reconciled in Budget Intent above
    };
    
    let traitSection = `\n${'='.repeat(60)}\n📊 TRAIT PROFILE (Non-Budget)\n${'='.repeat(60)}`;
    
    for (const [trait, score] of Object.entries(traitScores)) {
      // Skip budget and comfort - they're in Budget Intent
      if (trait === 'budget' || trait === 'comfort') continue;
      
      const labels = traitLabels[trait];
      if (labels && typeof score === 'number') {
        const normalized = Math.round(score);
        const direction = normalized > 0 ? labels[1] : normalized < 0 ? labels[0] : 'Balanced';
        const intensity = Math.abs(normalized) >= 7 ? 'Strong' : Math.abs(normalized) >= 4 ? 'Moderate' : 'Slight';
        traitSection += `\n   ${trait}: ${normalized > 0 ? '+' : ''}${normalized}/10 → ${intensity} ${direction}`;
      }
    }
    
    // Add override notice if applicable
    if (overrides && Object.keys(overrides).length > 0) {
      traitSection += `\n\n   ⚙️ User has manually adjusted some traits - respect these preferences.`;
    }
    
    sections.push(traitSection);
  }
  
  return { context: sections.join('\n'), budgetIntent };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPreferenceContext(insights: any, prefs: any): string {
  const sections: { title: string; items: string[] }[] = [];

  // ==========================================================================
  // LEARNED INSIGHTS (from activity feedback)
  // ==========================================================================
  if (insights) {
    const insightItems: string[] = [];
    
    const lovedTypes = Object.entries(insights.loved_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (lovedTypes.length > 0) {
      insightItems.push(`✅ LOVES: ${lovedTypes.join(', ')}`);
    }

    const dislikedTypes = Object.entries(insights.disliked_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (dislikedTypes.length > 0) {
      insightItems.push(`❌ AVOID activities: ${dislikedTypes.join(', ')}`);
    }

    if (insights.preferred_pace) {
      const formattedPace = insights.preferred_pace.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      insightItems.push(`Learned pace preference: ${formattedPace}`);
    }
    
    if (insightItems.length > 0) {
      sections.push({ title: '🧠 LEARNED FROM PAST TRIPS', items: insightItems });
    }
  }

  // ==========================================================================
  // USER PREFERENCES
  // ==========================================================================
  if (prefs) {
    const coreItems: string[] = [];
    const restrictionItems: string[] = [];
    const mobilityItems: string[] = [];
    const climateItems: string[] = [];
    const accommodationItems: string[] = [];
    const personaItems: string[] = [];

    // Traveler persona (from quiz - key for personalization!)
    if (prefs.traveler_type) {
      const personaMap: Record<string, string> = {
        'explorer': 'Curiosity-driven explorer who seeks authentic, off-the-beaten-path adventures and hidden gems',
        'escape_artist': 'Peace-seeker who travels to disconnect, recharge, and find inner peace',
        'curated_luxe': 'Refinement-focused traveler who appreciates curated experiences and premium service',
        'story_seeker': 'Moment-collector who focuses on memorable experiences and cultural connections',
        'wilderness_pioneer': 'Nature-focused adventurer who seeks wilderness, outdoor experiences, and connection with nature',
        'cultural_curator': 'Culture enthusiast who prioritizes museums, history, art, and authentic local experiences',
        'wellness_wanderer': 'Wellness-focused traveler seeking relaxation, spas, yoga, and rejuvenation',
        'urban_explorer': 'City lover who thrives on urban energy, nightlife, architecture, and local neighborhoods',
        'social_butterfly': 'Social traveler who loves group activities, meeting locals, and shared experiences',
      };
      personaItems.push(`🧭 TRAVELER TYPE: ${personaMap[prefs.traveler_type] || prefs.traveler_type.replace(/_/g, ' ')}`);
    }
    
    // Emotional drivers - WHY they travel (critical for activity selection!)
    if (prefs.emotional_drivers?.length) {
      const driverDescriptions: Record<string, string> = {
        'freedom': 'seeks liberation and escape from routine',
        'peace': 'wants tranquility and calm environments',
        'renewal': 'looking for rejuvenation and fresh perspectives',
        'restoration': 'needs recovery and recharging energy',
        'pleasure': 'desires enjoyment, indulgence, and sensory experiences',
        'adventure': 'craves excitement and new challenges',
        'connection': 'wants meaningful relationships and cultural bonds',
        'discovery': 'driven by curiosity and learning',
        'achievement': 'seeks accomplishment and bucket-list experiences',
        'transformation': 'looking for personal growth and change',
      };
      const driverContext = prefs.emotional_drivers
        .slice(0, 5)
        .map((d: string) => driverDescriptions[d] || d)
        .join('; ');
      personaItems.push(`💫 EMOTIONAL DRIVERS: ${driverContext}`);
      personaItems.push(`   → Design activities that fulfill these emotional needs`);
    }
    
    if (prefs.travel_vibes?.length) {
      personaItems.push(`🌍 Attracted to: ${prefs.travel_vibes.join(', ')} environments`);
    }
    
    if (prefs.vibe || prefs.travel_style) {
      personaItems.push(`Overall vibe: ${prefs.vibe || prefs.travel_style}`);
    }
    
    if (prefs.travel_companions?.length) {
      const companionContext = prefs.travel_companions.map((c: string) => {
        const map: Record<string, string> = {
          'solo': 'solo traveler - include opportunities for reflection and meeting locals',
          'partner': 'traveling with partner - include romantic spots and couple activities',
          'family': 'family travel - ensure kid-friendly options and manageable pacing',
          'friends': 'group of friends - include social activities and shared experiences',
        };
        return map[c] || c;
      });
      personaItems.push(`Travel style: ${companionContext.join('; ')}`);
    }
    
    if (prefs.planning_preference) {
      const planningMap: Record<string, string> = {
        'detailed': 'Plans everything in advance - provide specific times, reservations, and backup options',
        'flexible': 'Prefers a loose framework - provide key bookings but leave room for spontaneity',
        'spontaneous': 'Minimal planning preferred - focus on must-see highlights, leave gaps for discovery',
      };
      personaItems.push(`Planning style: ${planningMap[prefs.planning_preference] || prefs.planning_preference}`);
    }
    
    if (personaItems.length > 0) {
      sections.push({ title: '🎭 TRAVELER PERSONA', items: personaItems });
    }

    // Core preferences
    if (prefs.interests?.length) {
      coreItems.push(`Interests: ${prefs.interests.slice(0, 6).join(', ')}`);
    }
    if (prefs.travel_pace) {
      coreItems.push(`Travel pace: ${prefs.travel_pace}`);
    }
    if (prefs.activity_level) {
      coreItems.push(`Activity level: ${prefs.activity_level}`);
    }
    if (prefs.dining_style) {
      coreItems.push(`Dining style: ${prefs.dining_style}`);
    }
    if (prefs.eco_friendly) {
      coreItems.push(`🌱 Eco-conscious traveler - prefer sustainable options`);
    }
    
    if (coreItems.length > 0) {
      sections.push({ title: '🎯 TRAVEL STYLE', items: coreItems });
    }

    // FOOD PREFERENCES (Likes/Dislikes) - Critical for restaurant selection!
    const foodItems: string[] = [];
    if (prefs.food_likes?.length) {
      foodItems.push(`✅ FOOD LOVES: ${prefs.food_likes.join(', ')}`);
      foodItems.push(`   → Prioritize restaurants/cafes that specialize in these cuisines`);
    }
    if (prefs.food_dislikes?.length) {
      foodItems.push(`❌ FOOD DISLIKES: ${prefs.food_dislikes.join(', ')}`);
      foodItems.push(`   → AVOID recommending these types of food/restaurants`);
    }
    if (foodItems.length > 0) {
      sections.push({ title: '🍴 FOOD PREFERENCES', items: foodItems });
    }

    // CRITICAL: Dietary restrictions
    if (prefs.dietary_restrictions?.length) {
      restrictionItems.push(`⚠️ DIETARY RESTRICTIONS: ${prefs.dietary_restrictions.join(', ')}`);
      restrictionItems.push(`ALL meal recommendations MUST accommodate these restrictions`);
    }
    
    if (restrictionItems.length > 0) {
      sections.push({ title: '🍽️ DIETARY REQUIREMENTS (MANDATORY)', items: restrictionItems });
    }

    // CRITICAL: Accessibility & Mobility
    if (prefs.accessibility_needs?.length || prefs.mobility_needs || prefs.mobility_level) {
      if (prefs.accessibility_needs?.length) {
        mobilityItems.push(`♿ ACCESSIBILITY NEEDS: ${prefs.accessibility_needs.join(', ')}`);
      }
      if (prefs.mobility_needs) {
        mobilityItems.push(`Mobility requirements: ${prefs.mobility_needs}`);
      }
      if (prefs.mobility_level) {
        mobilityItems.push(`Mobility level: ${prefs.mobility_level}`);
      }
      mobilityItems.push(`ALL venues MUST be accessible. Avoid long walks, steep stairs, or inaccessible locations.`);
      
      sections.push({ title: '♿ ACCESSIBILITY (MANDATORY)', items: mobilityItems });
    }

    // Climate & Weather preferences - THE DIFFERENTIATOR
    if (prefs.climate_preferences?.length || prefs.weather_preferences?.length) {
      if (prefs.climate_preferences?.length) {
        climateItems.push(`Preferred climates: ${prefs.climate_preferences.join(', ')}`);
      }
      if (prefs.weather_preferences?.length) {
        climateItems.push(`Weather preferences: ${prefs.weather_preferences.join(', ')}`);
      }
      climateItems.push(`Schedule outdoor activities during optimal weather conditions`);
      climateItems.push(`Have indoor backup options for weather-sensitive activities`);
      
      sections.push({ title: '🌤️ CLIMATE & WEATHER PREFERENCES', items: climateItems });
    }

    // Accommodation preferences
    if (prefs.hotel_style || prefs.accommodation_style) {
      if (prefs.hotel_style) {
        accommodationItems.push(`Hotel style: ${prefs.hotel_style}`);
      }
      if (prefs.accommodation_style) {
        accommodationItems.push(`Accommodation preference: ${prefs.accommodation_style}`);
      }
      
      sections.push({ title: '🏨 ACCOMMODATION STYLE', items: accommodationItems });
    }

    // Flight preferences (useful for airport arrival/departure context)
    if (prefs.flight_preferences || prefs.flight_time_preference || prefs.seat_preference) {
      const flightItems: string[] = [];
      if (prefs.flight_time_preference) {
        flightItems.push(`Preferred flight times: ${prefs.flight_time_preference}`);
      }
      if (prefs.direct_flights_only) {
        flightItems.push(`Prefers direct flights only`);
      }
      
      if (flightItems.length > 0) {
        sections.push({ title: '✈️ FLIGHT PREFERENCES', items: flightItems });
      }
    }

    // Preferred regions
    if (prefs.preferred_regions?.length) {
      sections.push({ 
        title: '🗺️ REGIONAL PREFERENCES', 
        items: [`Favorite regions: ${prefs.preferred_regions.join(', ')}`] 
      });
    }
  }

  // Build the final context string
  if (sections.length === 0) {
    return '';
  }

  const contextParts = sections.map(section => 
    `${section.title}:\n${section.items.map(item => `  - ${item}`).join('\n')}`
  );

  return `\n\n${'='.repeat(60)}\n🎯 PERSONALIZED TRAVELER PROFILE\n${'='.repeat(60)}\n${contextParts.join('\n\n')}`;
}

// =============================================================================
// AI PREFERENCE ENRICHMENT ("FLUFFING")
// Transforms raw preferences into rich, detailed context
// =============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichPreferencesWithAI(prefs: any, destination: string, LOVABLE_API_KEY: string): Promise<string> {
  if (!prefs || Object.keys(prefs).filter(k => prefs[k] !== null).length === 0) {
    return "";
  }

  const prompt = `You are a travel personalization expert. Transform these raw user preferences into RICH, DETAILED guidance for an AI itinerary generator.

RAW PREFERENCES:
${JSON.stringify(prefs, null, 2)}

DESTINATION: ${destination}

Your task: Expand each preference into actionable, specific guidance. For example:
- "vegetarian" → "This traveler is vegetarian - recommend restaurants with dedicated vegetarian menus, avoid steakhouses, highlight plant-based cuisine, suggest local vegetarian specialties of ${destination}"
- "temperate climate" → "Prefers mild weather 60-75°F - schedule outdoor activities in morning/late afternoon, include shaded walking tours, have indoor alternatives for midday heat"
- "accessibility_needs: wheelchair" → "Requires wheelchair access - verify elevator access at all venues, avoid cobblestone areas, recommend accessible transportation, ensure restaurant seating accommodates wheelchairs"

Create a detailed traveler profile with:
1. **TRAVELER PERSONA** (2-3 sentences capturing their travel style and what drives them)
2. **MANDATORY CONSTRAINTS** (dietary, accessibility, allergies - these are non-negotiable)
3. **CLIMATE GUIDANCE** (how weather preferences should shape the schedule)
4. **ACTIVITY PRIORITIES** (what to emphasize based on interests)
5. **SPECIAL INSTRUCTIONS** (3-5 specific "always" or "never" rules)

Make it conversational and actionable, not a bullet list. The AI reading this should feel like they deeply understand this traveler.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a travel personalization expert. Create rich, detailed traveler profiles that help AI itinerary generators deeply understand each traveler." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.warn("[Preference Enrichment] AI call failed, using raw context");
      return "";
    }

    const result = await response.json();
    const enrichedProfile = result.choices?.[0]?.message?.content || "";
    
    if (enrichedProfile) {
      console.log("[Preference Enrichment] Successfully enriched preferences");
      return `\n\n${'='.repeat(60)}\n🌟 AI-ENRICHED TRAVELER PROFILE\n${'='.repeat(60)}\n${enrichedProfile}`;
    }
    
    return "";
  } catch (error) {
    console.warn("[Preference Enrichment] Error:", error);
    return "";
  }
}

function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(startDate: string, dayOffset: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split('T')[0];
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    sightseeing: 'map-pin',
    dining: 'utensils',
    cultural: 'landmark',
    shopping: 'shopping-bag',
    relaxation: 'spa',
    transport: 'car',
    accommodation: 'bed',
    activity: 'activity'
  };
  return icons[category] || 'star';
}

// =============================================================================
// STAGE 1: CONTEXT PREPARATION
// =============================================================================

interface DirectTripData {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  tripType?: string;
  budgetTier?: string;
  userId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function prepareContext(supabase: any, tripId: string, userId?: string, directTripData?: DirectTripData): Promise<GenerationContext | null> {
  console.log(`[Stage 1] Preparing context for trip ${tripId}`);

  // First try to fetch from database
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();

  // If we have direct trip data, use it as fallback (for localStorage/demo mode trips)
  if (!trip && directTripData) {
    console.log('[Stage 1] Trip not in database, using direct trip data');
    
    const totalDays = calculateDays(directTripData.startDate, directTripData.endDate);
    
    const context: GenerationContext = {
      tripId: directTripData.tripId,
      userId: directTripData.userId || userId || 'anonymous',
      destination: directTripData.destination,
      destinationCountry: directTripData.destinationCountry,
      startDate: directTripData.startDate,
      endDate: directTripData.endDate,
      totalDays,
      travelers: directTripData.travelers || 1,
      tripType: directTripData.tripType,
      budgetTier: directTripData.budgetTier,
      pace: 'moderate',
      interests: [],
      currency: 'USD'
    };
    
    // Set daily budget based on tier
    const budgetMap: Record<string, number> = {
      budget: 75,
      economy: 100,
      standard: 150,
      comfort: 200,
      premium: 300,
      luxury: 500
    };
    context.dailyBudget = budgetMap[context.budgetTier || 'standard'] || 150;
    
    console.log(`[Stage 1] Context prepared from direct data: ${context.totalDays} days in ${context.destination}`);
    return context;
  }

  if (error || !trip) {
    console.error('[Stage 1] Trip not found:', error);
    return null;
  }

  const totalDays = calculateDays(trip.start_date, trip.end_date);

  const context: GenerationContext = {
    tripId: trip.id,
    userId: userId || trip.user_id,
    destination: trip.destination,
    destinationCountry: trip.destination_country,
    startDate: trip.start_date,
    endDate: trip.end_date,
    totalDays,
    travelers: trip.travelers || 1,
    tripType: trip.trip_type,
    budgetTier: trip.budget_tier,
    pace: trip.metadata?.pace || 'moderate',
    interests: trip.metadata?.interests || [],
    currency: 'USD'
  };

  // Set daily budget based on tier
  const budgetMap: Record<string, number> = {
    budget: 75,
    economy: 100,
    standard: 150,
    comfort: 200,
    premium: 300,
    luxury: 500
  };
  context.dailyBudget = budgetMap[context.budgetTier || 'standard'] || 150;

  console.log(`[Stage 1] Context prepared: ${context.totalDays} days in ${context.destination}`);
  return context;
}

// =============================================================================
// STAGE 2: AI GENERATION WITH BATCH PROCESSING, VALIDATION & RETRY
// =============================================================================

// Day validation result
interface DayValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Validate a single generated day for quality and correctness
function validateGeneratedDay(day: StrictDay, dayNumber: number, isFirstDay: boolean, isLastDay: boolean, totalDays: number): DayValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic structure checks
  if (!day.dayNumber || day.dayNumber !== dayNumber) {
    errors.push(`Day number mismatch: expected ${dayNumber}, got ${day.dayNumber}`);
  }

  if (!day.activities || day.activities.length === 0) {
    errors.push('Day has no activities');
  }

  if (day.activities && day.activities.length < 3) {
    warnings.push(`Day has only ${day.activities.length} activities (expected 3-6)`);
  }

  // Validate each activity
  for (let i = 0; i < (day.activities?.length || 0); i++) {
    const act = day.activities[i];
    
    // Required fields check
    if (!act.title) {
      errors.push(`Activity ${i + 1}: Missing title`);
    }
    if (!act.startTime || !act.endTime) {
      errors.push(`Activity ${i + 1} (${act.title || 'unknown'}): Missing start/end time`);
    }
    if (!act.category) {
      warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Missing category`);
    }
    if (!act.location?.name) {
      warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Missing location name`);
    }

    // Time format validation (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (act.startTime && !timeRegex.test(act.startTime)) {
      errors.push(`Activity ${i + 1} (${act.title || 'unknown'}): Invalid startTime format "${act.startTime}"`);
    }
    if (act.endTime && !timeRegex.test(act.endTime)) {
      errors.push(`Activity ${i + 1} (${act.title || 'unknown'}): Invalid endTime format "${act.endTime}"`);
    }

    // Logistics should NOT have booking required
    const logisticsKeywords = ['check-in', 'checkout', 'check-out', 'check in', 'check out', 'arrival', 'departure', 'transfer', 'free time', 'at leisure'];
    const isLogistics = logisticsKeywords.some(kw => (act.title || '').toLowerCase().includes(kw)) ||
                        ['transport', 'accommodation', 'downtime', 'free_time'].includes(act.category?.toLowerCase() || '');
    
    if (isLogistics && act.bookingRequired) {
      warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Logistics activity should not require booking`);
    }

    // Logistics should have $0 cost
    if (isLogistics && act.cost?.amount && act.cost.amount > 0) {
      const isAirportTransfer = (act.title || '').toLowerCase().includes('transfer') && 
                                 (act.title || '').toLowerCase().includes('airport');
      // Airport transfers may have a cost, but check-in/out should be free
      if (!isAirportTransfer) {
        warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Logistics should have $0 cost`);
      }
    }

    // =========================================================================
    // DUPLICATE ACTIVITY DETECTION - No same activity type back-to-back
    // =========================================================================
    if (i > 0) {
      const prevAct = day.activities[i - 1];
      const currTitle = (act.title || '').toLowerCase();
      const prevTitle = (prevAct.title || '').toLowerCase();
      
      // Extract activity concept (e.g., "pastel de nata baking class" -> "pastel de nata baking")
      const extractConcept = (title: string): string => {
        // Remove venue names (usually after "at" or "with")
        const conceptPart = title.split(/\s+at\s+|\s+with\s+|\s+@\s+/i)[0];
        // Remove common suffixes
        return conceptPart
          .replace(/\s*(class|tour|experience|visit|workshop|session|lesson)$/i, '')
          .trim();
      };
      
      const currConcept = extractConcept(currTitle);
      const prevConcept = extractConcept(prevTitle);
      
      // Check for same concept back-to-back (similarity > 80%)
      const conceptSimilarity = (a: string, b: string): boolean => {
        if (!a || !b || a.length < 5 || b.length < 5) return false;
        // Exact match
        if (a === b) return true;
        // One contains the other
        if (a.includes(b) || b.includes(a)) return true;
        // Key words match (e.g., "pastel de nata" in both)
        const aWords = new Set(a.split(/\s+/));
        const bWords = new Set(b.split(/\s+/));
        const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 3);
        const minLen = Math.min(aWords.size, bWords.size);
        return minLen > 0 && intersection.length / minLen > 0.6;
      };
      
      if (conceptSimilarity(currConcept, prevConcept)) {
        errors.push(`Activities ${i} and ${i + 1} are too similar: "${prevAct.title}" followed by "${act.title}" - AVOID duplicate concepts back-to-back`);
      }
      
      // Check for same activity category repeating (excluding meals and transport)
      const skipCategories = ['dining', 'transport', 'accommodation', 'breakfast', 'lunch', 'dinner', 'downtime'];
      if (act.category && prevAct.category && 
          act.category.toLowerCase() === prevAct.category.toLowerCase() &&
          !skipCategories.includes(act.category.toLowerCase())) {
        // Same category back-to-back (e.g., two "activity" entries that are both cooking classes)
        warnings.push(`Activities ${i} and ${i + 1} are both "${act.category}" - consider more variety`);
      }
    }
  }

  // First day checks
  if (isFirstDay) {
    const hasArrival = day.activities?.some(a => 
      (a.title || '').toLowerCase().includes('arrival') || 
      ((a.category === 'transport') && (a.title || '').toLowerCase().includes('airport'))
    );
    const hasTransfer = day.activities?.some(a => 
      (a.title || '').toLowerCase().includes('transfer')
    );
    const hasCheckin = day.activities?.some(a => 
      (a.title || '').toLowerCase().includes('check-in') || (a.title || '').toLowerCase().includes('checkin')
    );

    if (!hasArrival) {
      warnings.push('Day 1 should start with airport arrival');
    }
    if (!hasTransfer) {
      warnings.push('Day 1 should include airport-to-hotel transfer');
    }
    if (!hasCheckin) {
      warnings.push('Day 1 should include hotel check-in');
    }
  }

  // Last day checks
  if (isLastDay && totalDays > 1) {
    const hasCheckout = day.activities?.some(a => 
      (a.title || '').toLowerCase().includes('check-out') || (a.title || '').toLowerCase().includes('checkout')
    );
    const hasDeparture = day.activities?.some(a => 
      (a.title || '').toLowerCase().includes('departure') ||
      ((a.category === 'transport') && (a.title || '').toLowerCase().includes('airport'))
    );

    if (!hasCheckout) {
      warnings.push('Last day should include hotel checkout');
    }
    if (!hasDeparture) {
      warnings.push('Last day should end with airport departure');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Generate a single day with retry logic
async function generateSingleDayWithRetry(
  context: GenerationContext,
  preferenceContext: string,
  dayNumber: number,
  previousDays: StrictDay[],
  flightHotelContext: string,
  LOVABLE_API_KEY: string,
  maxRetries: number = 2
): Promise<StrictDay> {
  const isFirstDay = dayNumber === 1;
  const isLastDay = dayNumber === context.totalDays;
  const date = formatDate(context.startDate, dayNumber - 1);

  // Build previous activities list to avoid repetition
  const previousActivities = previousDays.flatMap(d => 
    d.activities.map(a => a.title).filter(Boolean)
  );

  // Quality enforcement rules that get stricter with retries
  const qualityRules = [
    'QUALITY RULES (STRICTLY ENFORCED):',
    '1. Every activity MUST have a title, startTime, endTime, category, and location',
    '2. Times MUST be in HH:MM format (24-hour, e.g., "09:00", "14:30")',
    '3. Hotel check-in/checkout: bookingRequired=false, cost.amount=0',
    '4. Airport transfers: bookingRequired=false (user arranges transport)',
    '5. Free time/leisure: bookingRequired=false, cost.amount=0',
    '6. Only tours, museums, and ticketed attractions should have bookingRequired=true',
    '7. NO DUPLICATE ACTIVITIES: NEVER schedule the same type of activity back-to-back (e.g., two cooking classes, two wine tastings, two walking tours). Each consecutive activity must be a DIFFERENT experience type.',
    '8. VARIETY RULE: If suggesting a cooking class, wine tasting, or similar experience, only include ONE per day. Diversify across museums, outdoor activities, cultural sites, dining, and relaxation.',
    isFirstDay ? '9. DAY 1 MUST start with: Arrival → Transfer → Check-in (in that order)' : '',
    isLastDay && context.totalDays > 1 ? '9. LAST DAY MUST end with: Checkout → Transfer → Departure' : '',
  ].filter(Boolean).join('\n');

  let lastError: Error | null = null;
  let lastValidation: DayValidationResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Stage 2] Generating day ${dayNumber}/${context.totalDays} (attempt ${attempt + 1}/${maxRetries + 1})`);

      // Build retry-specific prompt additions
      let retryPrompt = '';
      if (attempt > 0 && lastValidation) {
        retryPrompt = `\n\n⚠️ PREVIOUS ATTEMPT FAILED VALIDATION. FIX THESE ISSUES:\n`;
        if (lastValidation.errors.length > 0) {
          retryPrompt += `ERRORS (must fix):\n${lastValidation.errors.map(e => `  - ${e}`).join('\n')}\n`;
        }
        if (lastValidation.warnings.length > 0) {
          retryPrompt += `WARNINGS (should fix):\n${lastValidation.warnings.map(w => `  - ${w}`).join('\n')}\n`;
        }
      }

      const systemPrompt = `You are an expert travel planner. Generate a SINGLE day's itinerary with PERFECT data quality.

${qualityRules}

PERSONALIZATION:
${preferenceContext}

${flightHotelContext}${retryPrompt}`;

      const userPrompt = `Generate Day ${dayNumber} of ${context.totalDays} for ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''}.

DATE: ${date}
TRAVELERS: ${context.travelers}
BUDGET: ${context.budgetTier || 'standard'} (~$${context.dailyBudget}/day per person)
PACE: ${context.pace || 'moderate'}

${previousActivities.length > 0 ? `AVOID REPEATING: ${previousActivities.slice(-10).join(', ')}\n` : ''}

Generate 4-6 activities for this day following ALL quality rules above.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_day_itinerary",
              description: "Creates a validated day itinerary",
              parameters: {
                type: "object",
                properties: {
                  dayNumber: { type: "number" },
                  date: { type: "string" },
                  title: { type: "string" },
                  theme: { type: "string" },
                  activities: {
                    type: "array",
                    minItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        startTime: { type: "string", description: "HH:MM 24-hour format" },
                        endTime: { type: "string", description: "HH:MM 24-hour format" },
                        category: { type: "string", enum: ["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"] },
                        location: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            address: { type: "string" },
                            coordinates: {
                              type: "object",
                              properties: { lat: { type: "number" }, lng: { type: "number" } },
                              required: ["lat", "lng"]
                            }
                          },
                          required: ["name", "address"]
                        },
                        cost: {
                          type: "object",
                          properties: {
                            amount: { type: "number", minimum: 0 },
                            currency: { type: "string" }
                          },
                          required: ["amount", "currency"]
                        },
                        description: { type: "string" },
                        tags: { type: "array", items: { type: "string" }, minItems: 5 },
                        bookingRequired: { type: "boolean" },
                        transportation: {
                          type: "object",
                          properties: {
                            method: { type: "string" },
                            duration: { type: "string" },
                            estimatedCost: {
                              type: "object",
                              properties: { amount: { type: "number" }, currency: { type: "string" } }
                            },
                            instructions: { type: "string" }
                          }
                        },
                        tips: { type: "string" },
                        rating: {
                          type: "object",
                          properties: { value: { type: "number" }, totalReviews: { type: "number" } }
                        },
                        website: { type: "string" }
                      },
                      required: ["id", "title", "startTime", "endTime", "category", "location", "cost", "bookingRequired"]
                    }
                  }
                },
                required: ["dayNumber", "date", "title", "activities"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "create_day_itinerary" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text();
        console.error(`[Stage 2] AI Gateway error for day ${dayNumber}: ${status}`, errorText);
        throw new Error(status === 429 ? 'Rate limit exceeded' : status === 402 ? 'Credits exhausted' : 'AI generation failed');
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall?.function?.arguments) {
        throw new Error("Invalid AI response format");
      }

      const generatedDay = JSON.parse(toolCall.function.arguments) as StrictDay;

      // Normalize the day data
      generatedDay.dayNumber = dayNumber;
      generatedDay.date = date;
      generatedDay.title = generatedDay.title || generatedDay.theme || `Day ${dayNumber}`;

      // Normalize activities
      generatedDay.activities = generatedDay.activities.map((act, idx) => {
        const normalizedAct = {
          ...act,
          id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
          title: act.title || `Activity ${idx + 1}`,
          durationMinutes: calculateDuration(act.startTime, act.endTime),
          categoryIcon: getCategoryIcon(act.category || 'activity'),
        };

        // Auto-fix logistics activities
        const logisticsKeywords = ['check-in', 'checkout', 'check-out', 'arrival', 'departure', 'transfer', 'free time', 'at leisure'];
        const isLogistics = logisticsKeywords.some(kw => normalizedAct.title.toLowerCase().includes(kw)) ||
                            ['transport', 'accommodation', 'downtime', 'free_time'].includes(normalizedAct.category?.toLowerCase() || '');
        
        if (isLogistics) {
          normalizedAct.bookingRequired = false;
          // Only zero out non-transfer logistics
          if (!normalizedAct.title.toLowerCase().includes('transfer')) {
            normalizedAct.cost = { amount: 0, currency: act.cost?.currency || 'USD' };
          }
        }

        return normalizedAct;
      });

      // Validate the generated day
      const validation = validateGeneratedDay(generatedDay, dayNumber, isFirstDay, isLastDay, context.totalDays);
      lastValidation = validation;

      if (validation.errors.length > 0) {
        console.warn(`[Stage 2] Day ${dayNumber} validation errors:`, validation.errors);
      }
      if (validation.warnings.length > 0) {
        console.log(`[Stage 2] Day ${dayNumber} validation warnings:`, validation.warnings);
      }

      // If valid or on last retry, return the day
      if (validation.isValid || attempt === maxRetries) {
        console.log(`[Stage 2] Day ${dayNumber} generated successfully (${generatedDay.activities.length} activities)`);
        return generatedDay;
      }

      // Otherwise, retry with feedback
      console.log(`[Stage 2] Day ${dayNumber} has ${validation.errors.length} errors, retrying...`);
      lastError = new Error(`Validation failed: ${validation.errors.join('; ')}`);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Stage 2] Day ${dayNumber} generation error on attempt ${attempt + 1}:`, lastError.message);
      
      // Rate limit and credits errors should not retry
      if (lastError.message.includes('Rate limit') || lastError.message.includes('Credits')) {
        throw lastError;
      }

      // If not the last attempt, wait before retry
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to generate day ${dayNumber} after ${maxRetries + 1} attempts`);
}

// Main batch generation function
async function generateItineraryAI(
  context: GenerationContext,
  preferenceContext: string,
  LOVABLE_API_KEY: string,
  flightHotelContext: string = ''
): Promise<{ days: StrictDay[] } | null> {
  console.log(`[Stage 2] Starting batch generation for ${context.totalDays} days`);

  const days: StrictDay[] = [];
  const BATCH_SIZE = 2; // Generate 2 days at a time for quality control

  // Process days in batches
  for (let batchStart = 0; batchStart < context.totalDays; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, context.totalDays);
    const batchDays: Promise<StrictDay>[] = [];

    console.log(`[Stage 2] Generating batch: days ${batchStart + 1}-${batchEnd}`);

    // Generate days in this batch in parallel
    for (let dayNum = batchStart + 1; dayNum <= batchEnd; dayNum++) {
      batchDays.push(
        generateSingleDayWithRetry(
          context,
          preferenceContext,
          dayNum,
          days, // Pass already completed days for context
          flightHotelContext,
          LOVABLE_API_KEY
        )
      );
    }

    // Wait for all days in batch to complete
    const batchResults = await Promise.all(batchDays);
    days.push(...batchResults);

    console.log(`[Stage 2] Batch complete: ${days.length}/${context.totalDays} days generated`);

    // Small delay between batches to avoid rate limiting
    if (batchEnd < context.totalDays) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Apply fallback costs for any missing values
  const fallbackCosts: Record<string, number> = {
    sightseeing: 15,
    cultural: 20,
    dining: 35,
    shopping: 0,
    relaxation: 40,
    transport: 10,
    accommodation: 0,
    activity: 25
  };

  for (const day of days) {
    for (const act of day.activities) {
      if (!act.cost || act.cost.amount === undefined) {
        const amount = fallbackCosts[act.category] || 20;
        act.cost = {
          amount,
          currency: 'USD',
          formatted: `$${amount} USD`
        };
      } else if (!act.cost.formatted) {
        act.cost.formatted = `$${act.cost.amount} ${act.cost.currency || 'USD'}`;
      }
    }
  }

  console.log(`[Stage 2] All ${days.length} days generated successfully`);
  return { days };
}

// =============================================================================
// STAGE 3: EARLY SAVE (Critical - ensures user gets itinerary even if later stages fail)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function earlySaveItinerary(supabase: any, tripId: string, days: StrictDay[]): Promise<boolean> {
  console.log(`[Stage 3] Early save for trip ${tripId} with ${days.length} days`);

  try {
    const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);

    const itineraryData = {
      days,
      status: 'generating', // Will be updated to 'ready' after full enrichment
      generatedAt: new Date().toISOString(),
      enrichmentMetadata: {
        enrichedAt: new Date().toISOString(),
        geocodedActivities: 0,
        verifiedActivities: 0,
        photosAdded: 0,
        totalActivities
      }
    };

    const { error } = await supabase
      .from('trips')
      .update({
        itinerary_data: itineraryData,
        itinerary_status: 'generating',
        updated_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (error) {
      console.error('[Stage 3] Early save failed:', error);
      return false;
    }

    console.log(`[Stage 3] Early save successful - ${totalActivities} activities`);
    return true;
  } catch (e) {
    console.error('[Stage 3] Early save error:', e);
    return false;
  }
}

// =============================================================================
// STAGE 4: ENRICHMENT (Real Photos + Venue Verification via Google Places API v1)
// =============================================================================

// Google Places API v1 - Verify venue and get rich details
interface VenueVerification {
  isValid: boolean;
  confidence: number;
  placeId?: string;
  formattedAddress?: string;
  coordinates?: { lat: number; lng: number };
  rating?: { value: number; totalReviews: number };
  priceLevel?: number;
  openingHours?: string[];
  website?: string;
  googleMapsUrl?: string;
}

async function verifyVenueWithGooglePlaces(
  venueName: string,
  destination: string,
  GOOGLE_MAPS_API_KEY: string | undefined
): Promise<VenueVerification | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log('[Stage 4] Google Maps API key not configured, skipping venue verification');
    return null;
  }

  try {
    const textQuery = `${venueName} ${destination}`;
    console.log(`[Stage 4] Verifying venue: ${venueName}`);

    // Use AbortController for 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.websiteUri,places.googleMapsUri",
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: 1,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Stage 4] Google Places API error for "${venueName}":`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    const place = data.places?.[0];

    if (!place) {
      console.log(`[Stage 4] No place found for: ${venueName}`);
      return null;
    }

    // Map price level from new API format
    const mapPriceLevel = (priceLevel: string): number => {
      const mapping: Record<string, number> = {
        PRICE_LEVEL_FREE: 0,
        PRICE_LEVEL_INEXPENSIVE: 1,
        PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3,
        PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };
      return mapping[priceLevel] ?? 2;
    };

    console.log(`[Stage 4] ✅ Verified venue: ${venueName} → ${place.displayName?.text || 'Unknown'}`);

    return {
      isValid: true,
      confidence: 0.95,
      placeId: place.id,
      formattedAddress: place.formattedAddress,
      coordinates: place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined,
      rating: place.rating ? {
        value: place.rating,
        totalReviews: place.userRatingCount || 0,
      } : undefined,
      priceLevel: place.priceLevel ? mapPriceLevel(place.priceLevel) : undefined,
      openingHours: place.currentOpeningHours?.weekdayDescriptions,
      website: place.websiteUri,
      googleMapsUrl: place.googleMapsUri,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[Stage 4] Venue verification timeout for: ${venueName}`);
    } else {
      console.log(`[Stage 4] Venue verification error for "${venueName}":`, error);
    }
    return null;
  }
}

// Fetch real venue photos using the destination-images edge function
// Priority: Cache → Google Places → TripAdvisor → Wikimedia → AI (last resort)
async function fetchActivityImage(
  activityTitle: string,
  category: string,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ url: string; source: string; attribution?: string } | null> {
  try {
    // Skip image fetching for transport/downtime activities
    const skipCategories = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
    if (skipCategories.includes(category?.toLowerCase() || '')) {
      return null;
    }

    console.log(`[Stage 4] Fetching real photo for: ${activityTitle} in ${destination}`);

    // Use AbortController for 5-second timeout on image fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Call the destination-images edge function with venue name
    const response = await fetch(`${supabaseUrl}/functions/v1/destination-images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        venueName: activityTitle,
        destination: destination,
        category: category,
        imageType: 'activity',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[Stage 4] Image fetch failed for "${activityTitle}":`, response.status);
      return null;
    }

    const data = await response.json();
    const image = data.images?.[0];

    if (image?.url && image.source !== 'fallback') {
      console.log(`[Stage 4] ✅ Got ${image.source} photo for: ${activityTitle}`);
      return {
        url: image.url,
        source: image.source,
        attribution: image.attribution,
      };
    }

    return null;
  } catch (e) {
    console.log(`[Stage 4] Image fetch error for "${activityTitle}":`, e);
    return null;
  }
}

// Categories that should NOT get Viator matching (dining, downtime, etc.)
const NON_BOOKABLE_CATEGORIES = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation', 'dining', 'restaurant', 'food'];
const DINING_KEYWORDS = ['dinner', 'lunch', 'breakfast', 'brunch', 'restaurant', 'cafe', 'dining'];

function isBookableActivity(activity: StrictActivity): boolean {
  const category = (activity.category || '').toLowerCase();
  const title = (activity.title || '').toLowerCase();
  
  // Skip non-bookable categories
  if (NON_BOOKABLE_CATEGORIES.includes(category)) return false;
  
  // Skip dining activities
  if (DINING_KEYWORDS.some(kw => title.includes(kw))) return false;
  
  // Bookable categories
  const bookableCategories = ['sightseeing', 'cultural', 'adventure', 'tour', 'experience', 'entertainment', 'water', 'nature'];
  return bookableCategories.some(bc => category.includes(bc)) || 
         ['museum', 'palace', 'castle', 'tower', 'cathedral', 'basilica', 'gallery', 'tour', 'experience'].some(kw => title.includes(kw));
}

async function searchViatorForActivity(
  activityTitle: string,
  destination: string,
  category: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ productCode?: string; bookingUrl?: string; quotePriceCents?: number } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/viator-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activityName: activityTitle,
        destination: destination,
        category: category,
        limit: 1,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.bestMatch && data.bestMatch.matchScore >= 40) {
      console.log(`[Stage 4] ✅ Viator match for "${activityTitle}": ${data.bestMatch.title} (score: ${data.bestMatch.matchScore})`);
      return {
        productCode: data.bestMatch.productCode,
        bookingUrl: data.bestMatch.bookingUrl,
        quotePriceCents: data.bestMatch.priceCents,
      };
    }
    return null;
  } catch (e) {
    console.log(`[Stage 4] Viator search skipped for "${activityTitle}":`, e);
    return null;
  }
}

async function enrichActivity(
  activity: StrictActivity,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined
): Promise<StrictActivity> {
  const enriched = { ...activity };

  // Skip enrichment for transport/downtime activities
  const skipCategories = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
  if (skipCategories.includes(activity.category?.toLowerCase() || '')) {
    enriched.verified = { isValid: true, confidence: 0.75 };
    return enriched;
  }

  // Determine if this activity should get Viator matching
  const shouldSearchViator = isBookableActivity(activity) && !(enriched as any).viatorProductCode;

  // Run venue verification, photo fetch, and Viator search in parallel
  const [venueData, photoResult, viatorMatch] = await Promise.all([
    // Verify venue with Google Places API v1
    verifyVenueWithGooglePlaces(activity.title, destination, GOOGLE_MAPS_API_KEY),
    // Fetch real venue photo using tiered approach
    !enriched.photos?.length 
      ? fetchActivityImage(activity.title, activity.category || 'sightseeing', destination, supabaseUrl, supabaseKey)
      : Promise.resolve(null),
    // Search for bookable Viator product
    shouldSearchViator
      ? searchViatorForActivity(activity.title, destination, activity.category || 'sightseeing', supabaseUrl, supabaseKey)
      : Promise.resolve(null),
  ]);

  // Apply Viator booking data if found
  if (viatorMatch) {
    (enriched as any).viatorProductCode = viatorMatch.productCode;
    (enriched as any).bookingUrl = viatorMatch.bookingUrl;
    if (viatorMatch.quotePriceCents) {
      (enriched as any).quotePriceCents = viatorMatch.quotePriceCents;
    }
    enriched.bookingRequired = true;
  }

  // Apply venue verification data (coordinates, ratings, opening hours, etc.)
  if (venueData) {
    if (venueData.coordinates) {
      enriched.location = {
        ...enriched.location,
        coordinates: venueData.coordinates,
      };
      if (venueData.formattedAddress) {
        enriched.location.address = venueData.formattedAddress;
      }
    }
    if (venueData.rating) {
      enriched.rating = venueData.rating;
    }
    if (venueData.priceLevel !== undefined) {
      enriched.priceLevel = venueData.priceLevel;
    }
    if (venueData.openingHours) {
      enriched.openingHours = venueData.openingHours;
    }
    if (venueData.website) {
      enriched.website = venueData.website;
    }
    if (venueData.googleMapsUrl) {
      enriched.googleMapsUrl = venueData.googleMapsUrl;
    }
    enriched.verified = {
      isValid: venueData.isValid,
      confidence: venueData.confidence,
      placeId: venueData.placeId,
    };
  }

  // Apply photo data
  if (photoResult) {
    enriched.photos = [{
      url: photoResult.url,
      alt: `${activity.title} in ${destination}`,
      photographer: photoResult.attribution || `Source: ${photoResult.source}`,
    }];
  }

  // Set verification confidence based on what we got
  if (!enriched.verified) {
    const hasRealPhoto = enriched.photos?.length && 
      !enriched.photos[0]?.photographer?.includes('AI Generated');
    
    enriched.verified = {
      isValid: true,
      confidence: hasRealPhoto ? 0.8 : (enriched.photos?.length ? 0.7 : 0.6)
    };
  }

  return enriched;
}

// Enrichment result tracking for better reporting
interface EnrichmentStats {
  totalActivities: number;
  photosAdded: number;
  venuesVerified: number;
  enrichmentFailures: number;
  retriedSuccessfully: number;
}

// Enrich a single activity with retry logic
async function enrichActivityWithRetry(
  activity: StrictActivity,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined,
  maxRetries: number = 1
): Promise<{ activity: StrictActivity; success: boolean; retried: boolean }> {
  let retried = false;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const enriched = await enrichActivity(activity, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY);
      return { activity: enriched, success: true, retried };
    } catch (error) {
      console.warn(`[Stage 4] Enrichment error for "${activity.title}" (attempt ${attempt + 1}):`, error);
      
      if (attempt < maxRetries) {
        retried = true;
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  
  // Return original activity with minimal verification on failure
  console.log(`[Stage 4] Enrichment failed for "${activity.title}" after ${maxRetries + 1} attempts, using original`);
  return {
    activity: {
      ...activity,
      verified: { isValid: false, confidence: 0.5 }
    },
    success: false,
    retried
  };
}

async function enrichItinerary(
  days: StrictDay[],
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined
): Promise<{ days: StrictDay[]; stats: EnrichmentStats }> {
  console.log(`[Stage 4] Starting enrichment for ${days.length} days with real photos + venue verification`);

  const enrichedDays: StrictDay[] = [];
  const stats: EnrichmentStats = {
    totalActivities: 0,
    photosAdded: 0,
    venuesVerified: 0,
    enrichmentFailures: 0,
    retriedSuccessfully: 0
  };

  for (const day of days) {
    const enrichedActivities: StrictActivity[] = [];

    // Process activities in batches of 3 with delays for rate limits
    // (3 activities × 2 API calls each = 6 concurrent requests per batch)
    const BATCH_SIZE = 3;
    for (let i = 0; i < day.activities.length; i += BATCH_SIZE) {
      const batch = day.activities.slice(i, i + BATCH_SIZE);
      
      const enrichedBatch = await Promise.all(
        batch.map(act => enrichActivityWithRetry(act, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY))
      );
      
      for (const result of enrichedBatch) {
        enrichedActivities.push(result.activity);
        stats.totalActivities++;
        
        if (result.activity.photos?.length) {
          stats.photosAdded++;
        }
        if (result.activity.verified?.placeId) {
          stats.venuesVerified++;
        }
        if (!result.success) {
          stats.enrichmentFailures++;
        }
        if (result.retried && result.success) {
          stats.retriedSuccessfully++;
        }
      }

      // Delay between batches to respect API rate limits
      if (i + BATCH_SIZE < day.activities.length) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Calculate day metadata
    const totalCost = enrichedActivities.reduce((sum, a) => sum + (a.cost?.amount || 0), 0);
    const mealsCount = enrichedActivities.filter(a => a.category === 'dining').length;
    const activityCount = enrichedActivities.length;

    enrichedDays.push({
      ...day,
      activities: enrichedActivities,
      metadata: {
        theme: day.title,
        totalEstimatedCost: totalCost,
        mealsIncluded: mealsCount,
        pacingLevel: activityCount <= 3 ? 'relaxed' : activityCount <= 5 ? 'moderate' : 'packed'
      }
    });
  }

  console.log(`[Stage 4] Enrichment complete - ${stats.photosAdded} photos, ${stats.venuesVerified} venues verified, ${stats.enrichmentFailures} failures${stats.retriedSuccessfully > 0 ? `, ${stats.retriedSuccessfully} recovered via retry` : ''}`);
  return { days: enrichedDays, stats };
}

// =============================================================================
// STAGE 5: TRIP OVERVIEW GENERATION
// =============================================================================

function generateTripOverview(
  days: StrictDay[], 
  context: GenerationContext,
  options?: {
    travelAdvisory?: TravelAdvisory;
    localEvents?: LocalEventInfo[];
  }
): TripOverview {
  console.log('[Stage 5] Generating trip overview');

  // Calculate budget breakdown
  let activitiesCost = 0;
  let foodCost = 0;
  let transportationCost = 0;

  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.category === 'dining') {
        foodCost += activity.cost?.amount || 0;
      } else {
        activitiesCost += activity.cost?.amount || 0;
      }
      transportationCost += activity.transportation?.estimatedCost?.amount || 0;
    }
  }

  // Estimate accommodations (35% of activities + food)
  const subtotal = activitiesCost + foodCost + transportationCost;
  const accommodations = Math.round(subtotal * 0.35);

  // Extract highlights (most expensive/featured activities)
  const allActivities = days.flatMap(d => d.activities);
  const highlights = allActivities
    .filter(a => a.category === 'sightseeing' || a.category === 'cultural')
    .sort((a, b) => (b.cost?.amount || 0) - (a.cost?.amount || 0))
    .slice(0, 5)
    .map(a => a.title);

  const overview: TripOverview = {
    currency: context.currency || 'USD',
    budgetBreakdown: {
      accommodations: Math.round(accommodations),
      activities: Math.round(activitiesCost),
      food: Math.round(foodCost),
      transportation: Math.round(transportationCost),
      total: Math.round(subtotal + accommodations)
    },
    highlights: highlights.length > 0 ? highlights : ['Explore local attractions', 'Enjoy authentic cuisine'],
    localTips: [
      'Book popular attractions in advance',
      'Try local restaurants away from tourist areas',
      'Use public transportation for authentic experiences',
      'Learn a few phrases in the local language',
      'Keep some local currency for small vendors'
    ],
    // Include AI-enriched travel advisory if available
    ...(options?.travelAdvisory && { travelAdvisory: options.travelAdvisory }),
    // Include local events if available
    ...(options?.localEvents && options.localEvents.length > 0 && { localEvents: options.localEvents }),
  };

  console.log(`[Stage 5] Overview generated - Total budget: $${overview.budgetBreakdown?.total}`);
  if (options?.travelAdvisory) {
    console.log(`[Stage 5] Travel advisory included: safetyLevel=${options.travelAdvisory.safetyLevel}`);
  }
  if (options?.localEvents?.length) {
    console.log(`[Stage 5] Local events included: ${options.localEvents.length} events`);
  }
  return overview;
}

// =============================================================================
// STAGE 6: FINAL SAVE
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finalSaveItinerary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  enrichedData: EnrichedItinerary,
  context: GenerationContext
): Promise<boolean> {
  console.log(`[Stage 6] Final save for trip ${tripId}`);

  try {
    const frontendReadyData = {
      success: true,
      status: 'ready',
      destination: context.destination,
      title: `${context.destination} - ${context.totalDays} Days`,
      tripId: context.tripId,
      totalDays: context.totalDays,
      itinerary: {
        days: enrichedData.days,
        generatedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        preferences: {
          pace: context.pace,
          budgetTier: context.budgetTier,
          interests: context.interests
        },
        metadata: {
          aiModel: 'gemini-3-flash-preview',
          version: '2.0'
        }
      },
      overview: enrichedData.overview,
      enrichmentMetadata: enrichedData.enrichmentMetadata
    };

    const { error } = await supabase
      .from('trips')
      .update({
        itinerary_data: frontendReadyData,
        itinerary_status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (error) {
      console.error('[Stage 6] Final save failed:', error);
      return false;
    }

    console.log('[Stage 6] Final save successful');
    return true;
  } catch (e) {
    console.error('[Stage 6] Final save error:', e);
    return false;
  }
}

// =============================================================================
// AUTHENTICATION HELPER
// =============================================================================
async function validateAuth(req: Request, supabase: any): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create auth client for validation
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
    });

    // Validate authentication
    const authResult = await validateAuth(req, authClient);
    if (!authResult) {
      console.error("[generate-itinerary] Unauthorized request");
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please sign in to generate itineraries." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[generate-itinerary] Authenticated user: ${authResult.userId}`);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`);

    // Rate limit check for expensive operations
    const rateCheck = checkRateLimit(authResult.userId, action);
    if (!rateCheck.allowed) {
      console.log(`[generate-itinerary] Rate limit exceeded for ${authResult.userId} on ${action}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a few minutes before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-full - Complete 7-stage pipeline
    // ==========================================================================
    if (action === 'generate-full') {
      const { tripId, userId, tripData } = params;

      // STAGE 1: Context Preparation (supports direct trip data for localStorage/demo mode)
      const directTripData = tripData ? {
        tripId,
        destination: tripData.destination,
        destinationCountry: tripData.destinationCountry,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        travelers: tripData.travelers,
        tripType: tripData.tripType,
        budgetTier: tripData.budgetTier,
        userId: tripData.userId || userId,
      } : undefined;

      const context = await prepareContext(supabase, tripId, userId, directTripData);
      if (!context) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user preferences for personalization
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      let prefs = userId ? await getUserPreferences(supabase, userId) : null;
      
      // =======================================================================
      // GROUP PREFERENCE BLENDING - For multi-traveler trips with linked friends
      // =======================================================================
      console.log("[Stage 1.2] Checking for trip collaborators...");
      const collaboratorPrefs = await getCollaboratorPreferences(supabase, tripId);
      
      if (collaboratorPrefs.length > 0) {
        console.log(`[Stage 1.2] Found ${collaboratorPrefs.length} collaborators - blending preferences`);
        
        // Include primary user's preferences in the blend
        const allProfiles: PreferenceProfile[] = prefs 
          ? [{ user_id: userId || 'primary', ...prefs }, ...collaboratorPrefs]
          : collaboratorPrefs;
        
        // Blend all preferences with organizer (primary user) having higher weight
        const blendedPrefs = blendGroupPreferences(allProfiles, userId);
        
        if (blendedPrefs) {
          console.log(`[Stage 1.2] Blended group preferences successfully`);
          prefs = blendedPrefs;
        }
      }
      
      // =======================================================================
      // UNIFIED USER CONTEXT NORMALIZATION
      // Merges Quiz (DNA) + Preferences + Adjustments into single context
      // =======================================================================
      console.log("[Stage 1.3] Building unified user context...");
      const travelDNA = userId ? await getTravelDNAV2(supabase, userId) : null;
      const traitOverrides = userId ? await getTraitOverrides(supabase, userId) : null;
      
      // Create normalized context with weighted blending + trip-level overrides
      const normalizedContext = normalizeUserContext(travelDNA, traitOverrides, prefs, {
        tripType: context.tripType,
        budgetTier: context.budgetTier,
        pace: context.pace,
        travelers: context.travelers,
        interests: context.interests,
      });
      
      // Derive budget intent from normalized traits (reconciles tier + traits)
      const budgetIntent = deriveBudgetIntent(
        context.budgetTier,
        normalizedContext.traits.budget,
        normalizedContext.traits.comfort
      );
      
      // Build unified prompt context from normalized data
      const unifiedDNAContext = buildNormalizedPromptContext(normalizedContext, budgetIntent);
      
      // Log normalization summary
      console.log(`[Stage 1.3] Unified context: confidence=${normalizedContext.confidence}, tripType=${context.tripType}, tripOverrides=${normalizedContext.sources.tripOverrides.join(', ') || 'none'}`);
      
      // Log budget conflict if detected
      if (budgetIntent?.conflict) {
        console.log(`[Stage 1.3] 🚨 BUDGET CONFLICT: ${budgetIntent.conflictDetails}`);
        console.log(`[Stage 1.3] Reconciled to: ${budgetIntent.notes}`);
        
        // Log conflict event for analytics
        try {
          await supabase.from('voyance_events').insert({
            user_id: userId,
            event_type: 'budget_intent_conflict',
            properties: {
              budget_tier: context.budgetTier,
              budget_trait: normalizedContext.traits.budget,
              comfort_trait: normalizedContext.traits.comfort,
              resolved_tier: budgetIntent.tier,
              resolved_spend_style: budgetIntent.spendStyle,
              confidence: normalizedContext.confidence,
            },
          });
        } catch (logErr) {
          console.warn('[Stage 1.3] Failed to log conflict event:', logErr);
        }
      }
      
      // =======================================================================
      // FLIGHT & HOTEL CONTEXT - Use booked flight/hotel in itinerary planning
      // =======================================================================
      console.log("[Stage 1.4] Fetching flight and hotel context...");
      const flightHotelResult = await getFlightHotelContext(supabase, tripId);
      if (flightHotelResult.context) {
        console.log("[Stage 1.4] Flight/hotel context added to AI prompt");
        if (flightHotelResult.earliestFirstActivityTime) {
          console.log(`[Stage 1.4] Day 1 earliest activity: ${flightHotelResult.earliestFirstActivityTime}`);
        }
        if (flightHotelResult.latestLastActivityTime) {
          console.log(`[Stage 1.4] Last day latest activity: ${flightHotelResult.latestLastActivityTime}`);
        }
      }
      
      // =======================================================================
      // AIRPORT TRANSFER FARE - Dynamic pricing with Viator + database + Google Maps
      // =======================================================================
      console.log("[Stage 1.5] Fetching dynamic transfer pricing...");
      
      // Get hotel address from flight/hotel context for accurate distance calculation
      const hotelDestination = flightHotelResult.hotelAddress || `${context.destination} city center`;
      const airportOrigin = `${context.destination} Airport`;
      
      // Try dynamic pricing first (Viator + Google Maps + database)
      let dynamicTransfer: DynamicTransferResult | null = null;
      try {
        dynamicTransfer = await getDynamicTransferPricing(
          supabaseUrl,
          airportOrigin,
          hotelDestination,
          context.destination,
          context.travelers || 2,
          context.startDate
        );
      } catch (e) {
        console.warn("[Stage 1.5] Dynamic pricing failed, falling back to database:", e);
      }
      
      // Fallback to database-only if dynamic pricing fails
      const airportFare = await getAirportTransferFare(supabase, context.destination);
      if (dynamicTransfer?.recommendedOption) {
        console.log(`[Stage 1.5] Dynamic pricing: ${dynamicTransfer.recommendedOption.priceFormatted} (${dynamicTransfer.source})`);
      } else if (airportFare) {
        console.log(`[Stage 1.5] Database fare: taxi ${airportFare.currencySymbol}${airportFare.taxiCostMin}-${airportFare.taxiCostMax}`);
      }
      
      // Build raw preference context (structured data)
      const rawPreferenceContext = buildPreferenceContext(insights, prefs);
      
      // STAGE 1.6: AI-Enrich preferences ("fluffing" layer)
      // Transform raw preferences into rich, detailed AI guidance
      console.log("[Stage 1.6] Enriching preferences with AI...");
      let enrichedPreferenceContext = "";
      if (prefs && Object.values(prefs).some(v => v !== null)) {
        try {
          enrichedPreferenceContext = await enrichPreferencesWithAI(prefs, context.destination, LOVABLE_API_KEY);
          console.log("[Stage 1.6] Preference enrichment complete");
        } catch (enrichError) {
          console.warn("[Stage 1.6] Preference enrichment failed, using raw context:", enrichError);
        }
      }
      
      // STAGE 1.7: Fetch past trip learnings for continuous improvement
      console.log("[Stage 1.7] Fetching past trip learnings...");
      let tripLearningsContext = "";
      try {
        const { data: learnings } = await supabase
          .from('trip_learnings')
          .select('*')
          .eq('user_id', userId)
          .not('lessons_summary', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(3);
        
        if (learnings && learnings.length > 0) {
          const sections: string[] = [];
          
          for (const l of learnings) {
            const tripSection: string[] = [];
            
            if (l.destination) {
              tripSection.push(`Past trip to ${l.destination}:`);
            }
            
            // Positive learnings
            const highlights = l.highlights as Array<{ activity?: string; why?: string }> | null;
            if (highlights && highlights.length > 0) {
              const highlightText = highlights
                .slice(0, 2)
                .map(h => `${h.activity || 'Unknown'} (${h.why || ''})`)
                .join(', ');
              tripSection.push(`  ✓ Loved: ${highlightText}`);
            }
            
            // What to avoid
            const painPoints = l.pain_points as Array<{ issue?: string; solution?: string }> | null;
            if (painPoints && painPoints.length > 0) {
              const issues = painPoints
                .slice(0, 2)
                .map(p => `${p.issue || 'Issue'}${p.solution ? ` → ${p.solution}` : ''}`)
                .join('; ');
              tripSection.push(`  ✗ Avoid: ${issues}`);
            }
            
            // Pacing insights
            if (l.pacing_feedback) {
              const pacingMap: Record<string, string> = {
                'too_rushed': 'prefers slower pace with fewer activities',
                'perfect': 'current pacing works well',
                'too_slow': 'enjoys action-packed days',
                'varied_needs': 'needs variety in daily intensity'
              };
              tripSection.push(`  📊 ${pacingMap[l.pacing_feedback] || l.pacing_feedback}`);
            }
            
            // Discovered preferences
            if (l.discovered_likes && l.discovered_likes.length > 0) {
              tripSection.push(`  💡 Discovered loves: ${l.discovered_likes.slice(0, 3).join(', ')}`);
            }
            if (l.discovered_dislikes && l.discovered_dislikes.length > 0) {
              tripSection.push(`  ⚠️ Discovered dislikes: ${l.discovered_dislikes.slice(0, 3).join(', ')}`);
            }
            
            // AI summary (most valuable)
            if (l.lessons_summary) {
              tripSection.push(`  📝 Key insight: ${l.lessons_summary}`);
            }
            
            if (tripSection.length > 1) {
              sections.push(tripSection.join('\n'));
            }
          }
          
          if (sections.length > 0) {
            tripLearningsContext = `\n## 🔄 LEARNINGS FROM PAST TRIPS\nApply these lessons to avoid repeating mistakes:\n${sections.join('\n\n')}\n`;
            console.log(`[Stage 1.7] Loaded ${learnings.length} past trip learnings`);
          }
        } else {
          console.log("[Stage 1.7] No past trip learnings found");
        }
      } catch (learningsError) {
        console.warn("[Stage 1.7] Failed to fetch trip learnings:", learningsError);
      }
      
      // STAGE 1.8: Fetch recently used activities for this destination to ensure variety
      console.log("[Stage 1.8] Fetching recently used activities for variety...");
      let recentlyUsedContext = "";
      try {
        // Get activities from recent trips to the same destination (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const destinationLower = context.destination.toLowerCase();
        
        const { data: recentTrips } = await supabase
          .from('trips')
          .select('id, destination, itinerary_data')
          .neq('id', tripId) // Exclude current trip
          .gte('created_at', thirtyDaysAgo)
          .not('itinerary_data', 'is', null)
          .limit(10);
        
        if (recentTrips && recentTrips.length > 0) {
          // Filter to same destination and extract activity titles
          const recentActivityNames: string[] = [];
          
          for (const trip of recentTrips) {
            const tripDest = (trip.destination || '').toLowerCase();
            // Match if destination contains our destination or vice versa
            if (tripDest.includes(destinationLower) || destinationLower.includes(tripDest)) {
              const itineraryData = trip.itinerary_data as { days?: Array<{ activities?: Array<{ title?: string; name?: string }> }> };
              if (itineraryData?.days) {
                for (const day of itineraryData.days) {
                  if (day.activities) {
                    for (const act of day.activities) {
                      const actName = act.title || act.name;
                      if (actName && !recentActivityNames.includes(actName)) {
                        recentActivityNames.push(actName);
                      }
                    }
                  }
                }
              }
            }
          }
          
          if (recentActivityNames.length > 0) {
            // Limit to 20 most recent to keep prompt size reasonable
            const topRecent = recentActivityNames.slice(0, 20);
            recentlyUsedContext = `\n## ⚠️ RECENTLY USED (avoid for variety):\nThese activities/restaurants were recently used in other ${context.destination} itineraries. AVOID suggesting them to ensure unique experiences:\n- ${topRecent.join('\n- ')}\n`;
            console.log(`[Stage 1.8] Found ${topRecent.length} recently used activities to avoid`);
          }
        } else {
          console.log("[Stage 1.8] No recent trips to this destination found");
        }
      } catch (recentError) {
        console.warn("[Stage 1.8] Failed to fetch recently used activities:", recentError);
      }
      
      // STAGE 1.9: Fetch local events and travel advisory (AI-powered via Perplexity)
      console.log("[Stage 1.9] Fetching local events and travel advisory...");
      let localEventsContext = "";
      let fetchedLocalEvents: LocalEventInfo[] = [];
      let fetchedTravelAdvisory: TravelAdvisory | undefined;
      
      try {
        const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
        
        if (PERPLEXITY_API_KEY && context.startDate && context.endDate) {
          // Fetch local events and travel advisory in parallel
          const [eventsResponse, advisoryResponse] = await Promise.all([
            // Local events lookup
            fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar',
                messages: [
                  {
                    role: 'system',
                    content: `You are a local events researcher. Find festivals, concerts, exhibitions, sports events, cultural events, and special happenings.

Return a JSON array of events:
[
  {
    "name": "Event name",
    "type": "festival|concert|exhibition|sports|cultural|market|other",
    "dates": "Date range or specific date",
    "location": "Venue or area",
    "description": "Brief 1-2 sentence description",
    "isFree": boolean,
    "bestFor": "who this appeals to (e.g., 'art lovers', 'families', 'foodies')"
  }
]

RULES:
- Include ONLY events happening during the specified dates
- Maximum 8 events, prioritize by significance
- Return empty array [] if no events found
- ONLY return valid JSON. No markdown.`
                  },
                  {
                    role: 'user',
                    content: `Find events and happenings in ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''} between ${context.startDate} and ${context.endDate}.`
                  }
                ],
              }),
            }),
            // Travel advisory lookup
            fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar',
                messages: [
                  {
                    role: 'system',
                    content: `You are a travel advisory specialist. Provide current, accurate information about entry requirements, safety, and health.

Return a JSON object:
{
  "visaRequired": boolean,
  "visaType": string or null,
  "passportValidity": string or null,
  "entryRequirements": [string],
  "safetyLevel": "low-risk" | "moderate" | "elevated" | "high-risk",
  "safetyAdvisory": string or null,
  "healthRequirements": [string],
  "currencyTips": string or null,
  "importantNotes": [string],
  "lastUpdated": "YYYY-MM-DD"
}

ONLY return valid JSON. No markdown.`
                  },
                  {
                    role: 'user',
                    content: `Get travel advisory for US citizens traveling to ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''}.`
                  }
                ],
              }),
            }),
          ]);

          // Process local events
          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            const content = eventsData.choices?.[0]?.message?.content?.trim() || '';
            
            try {
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const events = JSON.parse(jsonMatch[0]);
                
                if (events && events.length > 0) {
                  // Store for overview
                  fetchedLocalEvents = events.map((e: any) => ({
                    name: e.name,
                    type: e.type,
                    dates: e.dates,
                    location: e.location,
                    description: e.description,
                    isFree: e.isFree || false,
                  }));
                  
                  // Build context for AI prompt
                  const eventLines = events.map((e: any) => 
                    `- ${e.name} (${e.type}): ${e.dates} at ${e.location}. ${e.description}${e.isFree ? ' [FREE]' : ''} Best for: ${e.bestFor || 'general interest'}`
                  ).join('\n');
                  
                  localEventsContext = `\n## 🎉 LOCAL EVENTS DURING TRIP
The following events are happening during the traveler's visit. INCORPORATE relevant ones into the itinerary based on the traveler's interests:
${eventLines}

INSTRUCTIONS: If any event matches the traveler's interests or travel style, WEAVE it into the appropriate day. For festivals/markets, schedule as a morning or afternoon activity. For concerts/evening events, replace a dinner or evening activity. Always mention the event is happening if you include it.
`;
                  console.log(`[Stage 1.9] Found ${events.length} local events to potentially include`);
                }
              }
            } catch (parseErr) {
              console.warn("[Stage 1.9] Failed to parse events:", parseErr);
            }
          } else {
            console.warn(`[Stage 1.9] Events API error: ${eventsResponse.status}`);
          }
          
          // Process travel advisory
          if (advisoryResponse.ok) {
            const advisoryData = await advisoryResponse.json();
            const content = advisoryData.choices?.[0]?.message?.content?.trim() || '';
            
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const advisory = JSON.parse(jsonMatch[0]);
                fetchedTravelAdvisory = {
                  visaRequired: advisory.visaRequired,
                  visaType: advisory.visaType,
                  passportValidity: advisory.passportValidity,
                  entryRequirements: advisory.entryRequirements || [],
                  safetyLevel: advisory.safetyLevel,
                  safetyAdvisory: advisory.safetyAdvisory,
                  healthRequirements: advisory.healthRequirements || [],
                  currencyTips: advisory.currencyTips,
                  importantNotes: advisory.importantNotes || [],
                  lastUpdated: advisory.lastUpdated || new Date().toISOString().split('T')[0],
                };
                console.log(`[Stage 1.9] Travel advisory: safetyLevel=${fetchedTravelAdvisory.safetyLevel}, visaRequired=${fetchedTravelAdvisory.visaRequired}`);
              }
            } catch (parseErr) {
              console.warn("[Stage 1.9] Failed to parse travel advisory:", parseErr);
            }
          } else {
            console.warn(`[Stage 1.9] Advisory API error: ${advisoryResponse.status}`);
          }
        } else {
          console.log("[Stage 1.9] Skipping - Perplexity not configured or missing dates");
        }
      } catch (eventsError) {
        console.warn("[Stage 1.9] Failed to fetch enrichment data:", eventsError);
      }
      
      // Combine all context for maximum personalization
      // Order: Unified DNA context → raw prefs → enriched prefs → flight/hotel → LEARNINGS → RECENTLY USED → LOCAL EVENTS
      // NOTE: unifiedDNAContext includes budget intent, archetypes, blended traits, and deduplicated preferences
      const preferenceContext = unifiedDNAContext + rawPreferenceContext + enrichedPreferenceContext + flightHotelResult.context + tripLearningsContext + recentlyUsedContext + localEventsContext;

      // STAGE 2: AI Generation (batch with validation and retry)
      let aiResult;
      try {
        aiResult = await generateItineraryAI(context, preferenceContext, LOVABLE_API_KEY, flightHotelResult.context);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        const status = message.includes('Rate limit') ? 429 : message.includes('Credits') ? 402 : 500;
        return new Response(
          JSON.stringify({ error: message }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!aiResult?.days?.length) {
        return new Response(
          JSON.stringify({ error: "No itinerary generated" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // =======================================================================
      // STAGE 2.5: Apply dynamic transfer pricing to airport transfers
      // Priority: Viator bookable > database verified > estimated
      // =======================================================================
      if (aiResult.days.length > 0) {
        console.log("[Stage 2.5] Applying dynamic transfer costs...");
        
        // Helper to apply transfer pricing to an activity
        const applyTransferPricing = (act: StrictActivity, isReturn: boolean = false): StrictActivity => {
          const titleLower = act.title.toLowerCase();
          const isAirportTransfer = 
            titleLower.includes('airport transfer') ||
            titleLower.includes('transfer to hotel') ||
            titleLower.includes('transfer from airport') ||
            titleLower.includes('transfer to airport') ||
            (act.category === 'transport' && titleLower.includes('airport'));
          
          if (!isAirportTransfer) return act;
          
          // Use dynamic pricing if available (includes Viator bookable options)
          if (dynamicTransfer?.recommendedOption) {
            const opt = dynamicTransfer.recommendedOption;
            console.log(`[Stage 2.5] Setting "${act.title}" to ${opt.priceFormatted} (${opt.source}${opt.isBookable ? ', bookable' : ''})`);
            
            const updatedAct: StrictActivity = {
              ...act,
              cost: {
                amount: opt.priceTotal,
                currency: opt.currency,
                formatted: opt.priceFormatted,
                source: opt.source as any,
              },
              // Add booking info if Viator product available
              ...(opt.isBookable && opt.bookingUrl && {
                bookingRequired: true,
                tips: act.tips 
                  ? `${act.tips} • Book your transfer in advance for best rates.`
                  : 'Book your transfer in advance for best rates.',
              }),
            };
            
            // Store booking URL in a way the frontend can access
            if (opt.isBookable && opt.productCode) {
              (updatedAct as any).viatorProductCode = opt.productCode;
              (updatedAct as any).bookingUrl = opt.bookingUrl;
            }
            
            return updatedAct;
          }
          
          // Fallback to database fare
          if (airportFare) {
            const transferCost = airportFare.taxiCostMax ?? airportFare.taxiCostMin ?? 50;
            console.log(`[Stage 2.5] Setting "${act.title}" to ${airportFare.currencySymbol}${transferCost} (database)`);
            return {
              ...act,
              cost: {
                amount: transferCost,
                currency: airportFare.currency,
                formatted: `${airportFare.currencySymbol}${transferCost} ${airportFare.currency}`,
                source: 'database' as any,
              }
            };
          }
          
          return act;
        };
        
        // Apply to Day 1 (arrival transfer)
        const day1 = aiResult.days[0];
        day1.activities = day1.activities.map((act: StrictActivity) => applyTransferPricing(act, false));
        aiResult.days[0] = day1;
        
        // Apply to last day (departure transfer)
        if (aiResult.days.length > 1) {
          const lastDay = aiResult.days[aiResult.days.length - 1];
          lastDay.activities = lastDay.activities.map((act: StrictActivity) => applyTransferPricing(act, true));
          aiResult.days[aiResult.days.length - 1] = lastDay;
        }
        
        // Log summary
        if (dynamicTransfer) {
          const bookableCount = dynamicTransfer.options.filter(o => o.isBookable).length;
          console.log(`[Stage 2.5] Transfer pricing complete: ${dynamicTransfer.options.length} options, ${bookableCount} bookable via Viator`);
        }
      }

      // STAGE 3: Early Save (Critical - ensures user gets itinerary)
      await earlySaveItinerary(supabase, tripId, aiResult.days);

      // STAGE 4: Enrichment (real photos + venue verification via Google Places API v1)
      let enrichedDays: StrictDay[];
      let enrichmentStats: EnrichmentStats | null = null;
      try {
        const enrichmentResult = await enrichItinerary(aiResult.days, context.destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY);
        enrichedDays = enrichmentResult.days;
        enrichmentStats = enrichmentResult.stats;
      } catch (enrichError) {
        console.warn('[generate-itinerary] Enrichment failed, using base itinerary:', enrichError);
        enrichedDays = aiResult.days;
      }

      // STAGE 5: Trip Overview (with enriched data from Stage 1.9)
      const overview = generateTripOverview(enrichedDays, context, {
        travelAdvisory: fetchedTravelAdvisory,
        localEvents: fetchedLocalEvents,
      });

      // Build enrichment metadata from stats or calculate from days
      const totalActivities = enrichmentStats?.totalActivities || enrichedDays.reduce((sum, d) => sum + d.activities.length, 0);
      const photosAdded = enrichmentStats?.photosAdded || enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.photos?.length).length, 0
      );
      const verifiedVenues = enrichmentStats?.venuesVerified || enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.verified?.placeId).length, 0
      );
      const geocodedActivities = enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.location?.coordinates).length, 0
      );

      const enrichedItinerary: EnrichedItinerary = {
        days: enrichedDays,
        overview,
        enrichmentMetadata: {
          enrichedAt: new Date().toISOString(),
          geocodedActivities,
          verifiedActivities: verifiedVenues,
          photosAdded,
          totalActivities,
          ...(enrichmentStats?.enrichmentFailures && enrichmentStats.enrichmentFailures > 0 && {
            failures: enrichmentStats.enrichmentFailures,
            retriedSuccessfully: enrichmentStats.retriedSuccessfully
          })
        }
      };

      // STAGE 6: Final Save
      await finalSaveItinerary(supabase, tripId, enrichedItinerary, context);

      // Return complete response
      return new Response(
        JSON.stringify({
          success: true,
          status: 'ready',
          tripId,
          totalDays: context.totalDays,
          totalActivities,
          itinerary: {
            days: enrichedDays,
            overview
          },
          enrichmentMetadata: enrichedItinerary.enrichmentMetadata
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-day / regenerate-day - Single day generation with flight/hotel awareness
    // ==========================================================================
    if (action === 'generate-day' || action === 'regenerate-day') {
      const { tripId, dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities, userId } = params;

      // Get user preferences
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      const userPrefs = userId ? await getUserPreferences(supabase, userId) : null;
      const preferenceContext = buildPreferenceContext(insights, userPrefs);

      // Load trip-specific intents (e.g. "romantic", "mom is coming")
      let tripIntentsContext = '';
      if (tripId) {
        const { data: intents } = await supabase
          .from('trip_intents')
          .select('intent_type, intent_value')
          .eq('trip_id', tripId)
          .eq('active', true);
        if (intents && intents.length > 0) {
          const formatted = intents.map(i => `${i.intent_type}: ${i.intent_value}`).join(', ');
          tripIntentsContext = `\nTrip-specific requests from user: ${formatted}`;
          console.log(`[generate-day] Loaded ${intents.length} trip intents for trip ${tripId}`);
        }
      }

      // CRITICAL: Fetch flight/hotel context for Day 1 and last day timing
      const flightContext = tripId ? await getFlightHotelContext(supabase, tripId) : { context: '' };
      const isFirstDay = dayNumber === 1;
      const isLastDay = dayNumber === totalDays;
      
      console.log(`[generate-day] Day ${dayNumber}/${totalDays}, isFirst=${isFirstDay}, isLast=${isLastDay}`);
      if (flightContext.arrivalTime) {
        console.log(`[generate-day] Flight arrival: ${flightContext.arrivalTime}, earliest activity: ${flightContext.earliestFirstActivityTime}`);
      }
      if (flightContext.returnDepartureTime) {
        console.log(`[generate-day] Return departure: ${flightContext.returnDepartureTime}, latest activity: ${flightContext.latestLastActivityTime}`);
      }

      // Build day-specific constraints
       let dayConstraints = '';
       if (isFirstDay && (flightContext.arrivalTime24 || flightContext.arrivalTime)) {
         const arrival24 = flightContext.arrivalTime24 || (flightContext.arrivalTime ? normalizeTo24h(flightContext.arrivalTime) : null) || '18:00';
         const arrivalMins = parseTimeToMinutes(arrival24) ?? (18 * 60);
         const transferStart = addMinutesToHHMM(arrival24, 45);
         const transferEnd = addMinutesToHHMM(transferStart, 60);
         const checkInStart = transferEnd;
         const checkInEnd = addMinutesToHHMM(checkInStart, 30);
         const earliestAfterArrival = flightContext.earliestFirstActivityTime || addMinutesToHHMM(arrival24, 240);
         const isLateArrival = arrivalMins >= (18 * 60);

        dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (that's ${flightContext.arrivalTime || arrival24}).
The traveler is NOT in the destination before this time. They are on a plane.

REQUIRED ACTIVITY SEQUENCE (in this exact order):
1. Activity 1: "Arrival at Airport" 
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - location: { name: "Airport", address: "Rome Fiumicino Airport (FCO)" }
   
2. Activity 2: "Airport Transfer to Hotel"
   - startTime: "${transferStart}", endTime: "${transferEnd}" 
   - category: "transport"
   
3. Activity 3: "Hotel Check-in"
   - startTime: "${checkInStart}", endTime: "${checkInEnd}"
   - category: "accommodation"
   - location: { name: "${flightContext.hotelName || 'Hotel'}", address: "${flightContext.hotelAddress || 'Hotel Address'}" }

${isLateArrival ? `
Since arrival is after 6 PM, Day 1 should ONLY have:
- The 3 activities above (Arrival, Transfer, Check-in)
- OPTIONALLY: One late dinner activity near the hotel (starting around ${addMinutesToHHMM(checkInEnd, 60)})
- NO other activities. The traveler needs rest after a long flight.
` : `
After check-in, the earliest any sightseeing/dining can start is ${earliestAfterArrival}.
`}

DO NOT include any activities that happen BEFORE ${arrival24} - no breakfast, no morning sightseeing.
The day starts when the plane lands, not at 9 AM.`;
       } else if (isLastDay && flightContext.returnDepartureTime) {
         const departure24 = flightContext.returnDepartureTime24 || normalizeTo24h(flightContext.returnDepartureTime) || '12:00';
         const latestActivity = flightContext.latestLastActivityTime || addMinutesToHHMM(departure24, -180);
         
         dayConstraints = `
THE RETURN FLIGHT DEPARTS AT ${departure24} (that's ${flightContext.returnDepartureTime}).
The traveler must be at the airport 3 hours before departure.

REQUIRED ENDING SEQUENCE (activities must end with):
1. "Hotel Checkout" (category: accommodation) - around ${addMinutesToHHMM(departure24, -210)}
2. "Transfer to Airport" (category: transport) 
3. "Departure from Airport" (category: transport) - endTime should be ${departure24}

ALL sightseeing/activities must END by ${latestActivity}.
Plan only morning activities and leave afternoon clear for airport.`;
       }

      // Build system prompt with day-specific timing constraints EMBEDDED
      let timingInstructions = '';
      if (isFirstDay && dayConstraints) {
        // For arrival day, put constraints directly in system prompt for maximum weight
        timingInstructions = `
CRITICAL ARRIVAL DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
      } else if (isLastDay && dayConstraints) {
        timingInstructions = `
CRITICAL DEPARTURE DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
      } else {
        timingInstructions = '- Start around 9:00 AM, end by 9:00-10:00 PM';
      }

      const systemPrompt = `You are an expert travel planner. Generate a single day's detailed itinerary.

${timingInstructions}

General Requirements:
- Include FULL street addresses for all locations
- Provide realistic cost estimates in local currency
- Account for travel time between activities
- Include meals (breakfast, lunch, dinner as appropriate for the time of day)
- Every activity MUST have a "title" field (the display name)
- All times MUST be in 24-hour HH:MM format`;

      const userPrompt = `Generate Day ${dayNumber} of ${totalDays} in ${destination}${destinationCountry ? `, ${destinationCountry}` : ''}.

Date: ${date}
Travelers: ${travelers}
Budget: ${budgetTier || 'standard'}
${preferences?.pace ? `Pace: ${preferences.pace}` : ''}
${preferences?.dayFocus ? `Day focus: ${preferences.dayFocus}` : ''}
${preferenceContext}
${tripIntentsContext}
${previousDayActivities?.length ? `\nAvoid repeating these specific venues/activities (be creative and pick DIFFERENT ones): ${previousDayActivities.join(', ')}` : ''}

Generate activities following the timing constraints specified in the system prompt.
IMPORTANT: Pick DIFFERENT restaurants/activities than listed above. Do not repeat.`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            tools: [{
              type: "function",
              function: {
                name: "create_day_itinerary",
                description: "Creates a structured day itinerary",
                parameters: {
                  type: "object",
                  properties: {
                    dayNumber: { type: "number" },
                    date: { type: "string" },
                    theme: { type: "string" },
                    title: { type: "string", description: "Day title like 'Arrival Day' or 'Historic Exploration'" },
                    activities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          title: { type: "string", description: "Activity display name (REQUIRED)" },
                          name: { type: "string", description: "Alias for title" },
                          description: { type: "string" },
                          category: { type: "string", enum: ["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"] },
                          startTime: { type: "string", description: "HH:MM format (24-hour)" },
                          endTime: { type: "string", description: "HH:MM format (24-hour)" },
                          duration: { type: "string" },
                          location: { 
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              address: { type: "string" }
                            }
                          },
                          estimatedCost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } } },
                          cost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } } },
                          bookingRequired: { type: "boolean" },
                          tips: { type: "string" },
                          coordinates: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } },
                          type: { type: "string" }
                        },
                        required: ["title", "category", "startTime", "endTime", "location"]
                      }
                    },
                    narrative: { type: "object", properties: { theme: { type: "string" }, highlights: { type: "array", items: { type: "string" } } } }
                  },
                  required: ["dayNumber", "date", "theme", "activities"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "create_day_itinerary" } },
          }),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error("AI generation failed");
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall?.function?.arguments) {
          throw new Error("Invalid AI response format");
        }

        const generatedDay = JSON.parse(toolCall.function.arguments);

        // Normalize activities: ensure title exists, add IDs and enhancements
        generatedDay.activities = generatedDay.activities.map((act: { 
          id?: string; 
          title?: string; 
          name?: string; 
          startTime?: string; 
          endTime?: string; 
          category?: string;
          estimatedCost?: { amount: number; currency: string };
          cost?: { amount: number; currency: string };
          location?: string | { name?: string; address?: string };
        }, idx: number) => {
          // Normalize title: use title, fallback to name
          const normalizedTitle = act.title || act.name || `Activity ${idx + 1}`;
          
          // Normalize cost: use cost or estimatedCost
          const normalizedCost = act.cost || act.estimatedCost || { amount: 0, currency: 'USD' };
          
          // Normalize location: convert string to object if needed
          let normalizedLocation = act.location;
          if (typeof act.location === 'string') {
            normalizedLocation = { name: act.location, address: act.location };
          }
          
          return {
            ...act,
            id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
            title: normalizedTitle,
            name: normalizedTitle, // Keep both for compatibility
            cost: normalizedCost,
            location: normalizedLocation,
            durationMinutes: act.startTime && act.endTime ? calculateDuration(act.startTime, act.endTime) : 60,
            categoryIcon: getCategoryIcon(act.category || 'activity')
          };
        });

        // Ensure day has a title
        generatedDay.title = generatedDay.title || generatedDay.theme || `Day ${dayNumber}`;

        return new Response(
          JSON.stringify({
            success: true,
            day: generatedDay,
            dayNumber,
            totalDays,
            usedPersonalization: !!preferenceContext,
            flightAware: !!(flightContext.arrivalTime || flightContext.returnDepartureTime)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("[generate-day] Error:", error);
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==========================================================================
    // ACTION: get-trip (with ownership verification)
    // ==========================================================================
    if (action === 'get-trip') {
      const { tripId } = params;
      
      // Use authenticated client to enforce RLS, or verify ownership with service role
      const { data: trip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership - user must be the trip owner or a collaborator
      const isOwner = trip.user_id === authResult.userId;
      
      // Check if user is a collaborator via direct query
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const isCollaborator = !!collab;
      
      if (!isOwner && !isCollaborator) {
        console.error(`[get-trip] Unauthorized access attempt by ${authResult.userId} for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Trip not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          trip: {
            tripId: trip.id,
            destination: trip.destination,
            destinationCountry: trip.destination_country,
            startDate: trip.start_date,
            endDate: trip.end_date,
            travelers: trip.travelers || 1,
            tripType: trip.trip_type,
            budgetTier: trip.budget_tier
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: save-itinerary (with ownership verification)
    // ==========================================================================
    if (action === 'save-itinerary') {
      const { tripId, itinerary } = params;

      // First verify the user has access to this trip
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('user_id')
        .eq('id', tripId)
        .single();

      if (tripError || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership or edit permission
      const isOwner = trip.user_id === authResult.userId;
      
      // Check if user is a collaborator with edit permission
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('id, permission')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const hasEditPermission = collab && (collab.permission === 'edit' || collab.permission === 'admin');
      
      if (!isOwner && !hasEditPermission) {
        console.error(`[save-itinerary] Unauthorized save attempt by ${authResult.userId} for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Access denied. You don't have permission to modify this trip." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from('trips')
        .update({
          itinerary_data: itinerary,
          itinerary_status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId);

      if (error) {
        console.error("[save-itinerary] Failed:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save itinerary" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: get-itinerary (with ownership verification)
    // ==========================================================================
    if (action === 'get-itinerary') {
      const { tripId } = params;

      const { data: trip, error } = await supabase
        .from('trips')
        .select('id, user_id, destination, destination_country, start_date, end_date, travelers, itinerary_data, itinerary_status')
        .eq('id', tripId)
        .single();

      if (error || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership or collaboration
      const isOwner = trip.user_id === authResult.userId;
      
      // Check if user is a collaborator
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const isCollaborator = !!collab;
      
      if (!isOwner && !isCollaborator) {
        console.error(`[get-itinerary] Unauthorized access attempt by ${authResult.userId} for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Trip not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!trip.itinerary_data) {
        return new Response(
          JSON.stringify({
            success: true,
            status: trip.itinerary_status || 'not_started',
            itinerary: null
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: trip.itinerary_status || 'ready',
          tripId: trip.id,
          destination: trip.destination,
          ...trip.itinerary_data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-itinerary] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
