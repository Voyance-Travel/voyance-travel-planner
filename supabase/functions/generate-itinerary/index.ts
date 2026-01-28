import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// NEW PERSONALIZATION MODULES (Phase 8 - Make Itineraries Impossible to be Generic)
// =============================================================================
import {
  deriveForcedSlots,
  deriveScheduleConstraints,
  reconcileGroupPreferences,
  validateDayPersonalization,
  buildForcedSlotsPrompt,
  buildScheduleConstraintsPrompt,
  buildGroupReconciliationPrompt,
  type TraitScores,
  type TravelerProfile,
  type ForcedSlot,
  type ScheduleConstraints,
  type DayValidation,
  type ReconciliationStrategy
} from './personalization-enforcer.ts';

import {
  calculateConfidence as calculateTruthAnchorConfidence,
  needsFallback,
  verifyFromGooglePlaces,
  verifyFromCache,
  generateFallback,
  buildTruthAnchorPrompt,
  validateTruthAnchors,
  type TruthAnchor
} from './truth-anchors.ts';

import {
  generateExplanation,
  validateExplanation,
  buildExplainabilityPrompt,
  type ExplainabilityContext,
  type Explanation
} from './explainability.ts';

import {
  assessDataCompleteness,
  generateColdStartFallback,
  buildColdStartPrompt,
  applyNonNegotiables,
  type DataCompleteness,
  type ColdStartFallback
} from './cold-start.ts';

import {
  extractReplacementSignal,
  calculateEditingMetrics,
  aggregateLearnings,
  buildEnrichmentUpsert,
  buildLearnedPreferencesPrompt,
  createReplacementEvent,
  createSaveEvent,
  createNotMeEvent,
  type FeedbackEvent,
  type FeedbackEventType,
  type AggregatedLearning
} from './feedback-instrumentation.ts';

import {
  getCuratedZones,
  assignToZone,
  determineDayAnchor,
  deriveTravelTimeConstraints,
  validateDayGeography,
  reorderActivitiesOptimally,
  buildGeographicPrompt,
  buildDayZonePrompt,
  logGeographicQAMetrics,
  haversineDistance,
  estimateTravelMinutes,
  type ZoneDefinition,
  type DayAnchor,
  type TravelTimeConstraints,
  type GeographicValidation,
  type ActivityWithLocation
} from './geographic-coherence.ts';

// =============================================================================
// PHASE 9: MODULAR PROMPT LIBRARY - Full DNA-Driven Personalization
// =============================================================================
import {
  buildDayPrompt,
  buildPersonaManuscript,
  extractFlightData,
  extractHotelData,
  buildTravelerDNA,
  type FlightData as PromptFlightData,
  type HotelData as PromptHotelData,
  type TravelerDNA,
  type TripContext as PromptTripContext,
  type DayConstraints
} from './prompt-library.ts';

// =============================================================================
// PHASE 11: COMPREHENSIVE ARCHETYPE CONSTRAINTS - What Archetypes ACTUALLY Mean
// =============================================================================
import {
  buildAllConstraints,
  buildArchetypeConstraintsBlock as buildArchetypeConstraintsBlockNew,
  buildBudgetConstraints as buildBudgetConstraintsNew,
  buildTripWideVarietyRules,
  buildUnscheduledTimeRules,
  buildPacingRules,
  buildNamingRules,
  getArchetypeDefinition,
} from './archetype-constraints.ts';

// =============================================================================
// PHASE 10: DESTINATION ESSENTIALS - Non-Negotiable Landmarks & Hidden Gems
// Now with DB-driven data + freshness-based Perplexity enrichment
// =============================================================================
import {
  buildDestinationEssentialsPrompt,
  buildDestinationEssentialsPromptWithDB,
  getDestinationIntelligence,
  hasCuratedEssentials,
} from './destination-essentials.ts';

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
  childrenCount?: number; // Number of children in the travel party
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
  dailyBudget?: number;
  currency?: string;
  // Phase 9: Full DNA injection for prompt library
  travelerDNA?: TravelerDNA;
  flightData?: PromptFlightData;
  hotelData?: PromptHotelData;
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
  // =========================================================================
  // PERSONALIZATION GUARANTEE FIELDS - Phase 1
  // These fields make personalization provable and machine-checkable
  // =========================================================================
  personalization?: {
    /** Machine-checkable tags tied to user inputs (e.g., ["romantic", "local-authentic", "seafood-lover", "low-pace"]) */
    tags: string[];
    /** 1-2 sentences explaining why this activity fits THIS user's specific preferences/traits */
    whyThisFits: string;
    /** AI confidence in this recommendation (0-1) */
    confidence: number;
    /** Which user inputs influenced this choice */
    matchedInputs: string[];
  };
  /** Source provider for venue verification */
  sourceProvider?: 'google_places' | 'foursquare' | 'viator' | 'internal_db' | 'ai_generated';
  /** External provider ID for deduplication and verification */
  providerId?: string;
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
// PERSONALIZATION VALIDATOR - Phase 3
// Validates itinerary output against user preferences to ensure real customization
// =============================================================================

interface ValidationContext {
  foodDislikes: string[];
  foodLikes: string[];
  dietaryRestrictions: string[];
  avoidList: string[];
  mobilityNeeds: string[];
  pacePreference: 'relaxed' | 'moderate' | 'packed';
  budgetTier: string;
  traitScores: Record<string, number>;
  tripIntents: string[];
}

interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
  personalizationScore: number; // 0-100
  stats: {
    activitiesChecked: number;
    personalizationFieldsPresent: number;
    personalizationFieldsMissing: number;
    matchedInputsTotal: number;
  };
}

interface ValidationViolation {
  type: 'avoid_list' | 'dietary' | 'pace' | 'missing_personalization' | 'empty_matched_inputs' | 'duplicate';
  activityId: string;
  activityTitle: string;
  dayNumber: number;
  details: string;
  severity: 'critical' | 'major' | 'minor';
}

interface ValidationWarning {
  type: string;
  message: string;
  activityId?: string;
}

/**
 * Validates the generated itinerary against user preferences
 * Returns violations that should cause rejection/regeneration
 */
function validateItineraryPersonalization(
  days: StrictDay[],
  ctx: ValidationContext
): ValidationResult {
  console.log('[Validator] Starting personalization validation...');
  
  const violations: ValidationViolation[] = [];
  const warnings: ValidationWarning[] = [];
  const seenActivities = new Set<string>();
  
  let activitiesChecked = 0;
  let personalizationPresent = 0;
  let personalizationMissing = 0;
  let matchedInputsTotal = 0;
  
  for (const day of days) {
    const dayActivities = day.activities || [];
    
    // Check pace constraint
    const nonTransportActivities = dayActivities.filter(a => a.category !== 'transport' && a.category !== 'accommodation');
    const expectedMax = ctx.pacePreference === 'relaxed' ? 4 : ctx.pacePreference === 'moderate' ? 6 : 8;
    const expectedMin = ctx.pacePreference === 'relaxed' ? 2 : ctx.pacePreference === 'moderate' ? 3 : 4;
    
    if (nonTransportActivities.length > expectedMax) {
      violations.push({
        type: 'pace',
        activityId: '',
        activityTitle: `Day ${day.dayNumber}`,
        dayNumber: day.dayNumber,
        details: `Too many activities (${nonTransportActivities.length}) for ${ctx.pacePreference} pace (max ${expectedMax})`,
        severity: 'major'
      });
    }
    
    if (nonTransportActivities.length < expectedMin && day.dayNumber !== 1 && day.dayNumber !== days.length) {
      warnings.push({
        type: 'pace_low',
        message: `Day ${day.dayNumber} has only ${nonTransportActivities.length} activities for ${ctx.pacePreference} pace`
      });
    }
    
    for (const activity of dayActivities) {
      activitiesChecked++;
      
      const titleLower = activity.title.toLowerCase();
      const descLower = (activity.description || '').toLowerCase();
      const tagsLower = (activity.tags || []).map(t => t.toLowerCase());
      const locationLower = (activity.location?.name || '').toLowerCase();
      
      // Check for duplicates (same title in same trip)
      const activityKey = `${titleLower}::${locationLower}`;
      if (seenActivities.has(activityKey)) {
        violations.push({
          type: 'duplicate',
          activityId: activity.id,
          activityTitle: activity.title,
          dayNumber: day.dayNumber,
          details: `Duplicate activity found: "${activity.title}"`,
          severity: 'major'
        });
      }
      seenActivities.add(activityKey);
      
      // Check avoid list (food dislikes, general avoids)
      const allAvoid = [...ctx.foodDislikes, ...ctx.avoidList].map(a => a.toLowerCase());
      for (const avoid of allAvoid) {
        if (avoid.length < 3) continue; // Skip short items like "no"
        if (
          titleLower.includes(avoid) ||
          descLower.includes(avoid) ||
          tagsLower.some(t => t.includes(avoid))
        ) {
          violations.push({
            type: 'avoid_list',
            activityId: activity.id,
            activityTitle: activity.title,
            dayNumber: day.dayNumber,
            details: `Contains avoided item: "${avoid}"`,
            severity: 'critical'
          });
        }
      }
      
      // Check dietary restrictions (critical for dining)
      if (activity.category === 'dining') {
        for (const restriction of ctx.dietaryRestrictions.map(r => r.toLowerCase())) {
          // Check if the activity explicitly accommodates the restriction
          const accommodates = 
            tagsLower.some(t => t.includes(restriction) || t.includes('vegan') || t.includes('vegetarian')) ||
            descLower.includes(restriction) ||
            descLower.includes('dietary') ||
            descLower.includes('allergy');
          
          // Only warn, don't fail - dining may not explicitly state "vegetarian friendly"
          if (!accommodates && restriction.length > 3) {
            warnings.push({
              type: 'dietary_unchecked',
              message: `Dining "${activity.title}" doesn't explicitly mention accommodation for: ${restriction}`,
              activityId: activity.id
            });
          }
        }
      }
      
      // Check personalization fields exist
      if (!activity.personalization) {
        personalizationMissing++;
        violations.push({
          type: 'missing_personalization',
          activityId: activity.id,
          activityTitle: activity.title,
          dayNumber: day.dayNumber,
          details: 'Missing personalization object (required for customization proof)',
          severity: 'major'
        });
      } else {
        personalizationPresent++;
        
        // Check matchedInputs is not empty
        if (!activity.personalization.matchedInputs?.length) {
          violations.push({
            type: 'empty_matched_inputs',
            activityId: activity.id,
            activityTitle: activity.title,
            dayNumber: day.dayNumber,
            details: 'personalization.matchedInputs is empty - must reference at least 1 user input',
            severity: 'minor'
          });
        } else {
          matchedInputsTotal += activity.personalization.matchedInputs.length;
        }
        
        // Validate whyThisFits references something specific
        const whyFits = (activity.personalization.whyThisFits || '').toLowerCase();
        const hasSpecificReference = 
          whyFits.includes('your') ||
          whyFits.includes('trait') ||
          whyFits.includes('preference') ||
          whyFits.includes('score') ||
          whyFits.includes('intent') ||
          ctx.tripIntents.some(intent => whyFits.includes(intent.toLowerCase()));
        
        if (!hasSpecificReference) {
          warnings.push({
            type: 'generic_why',
            message: `"${activity.title}" has generic whyThisFits - doesn't reference specific user inputs`,
            activityId: activity.id
          });
        }
      }
    }
  }
  
  // Calculate personalization score
  const personalizationRatio = activitiesChecked > 0 
    ? personalizationPresent / activitiesChecked 
    : 0;
  const avgMatchedInputs = personalizationPresent > 0 
    ? matchedInputsTotal / personalizationPresent 
    : 0;
  
  const personalizationScore = Math.min(100, Math.round(
    (personalizationRatio * 50) + // 50 points for having fields
    (Math.min(avgMatchedInputs / 2, 1) * 30) + // 30 points for matched inputs (avg 2 = full score)
    ((1 - violations.length / Math.max(activitiesChecked, 1)) * 20) // 20 points for no violations
  ));
  
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const majorViolations = violations.filter(v => v.severity === 'major');
  
  // Invalid if: any critical violations OR >20% major violations
  const isValid = 
    criticalViolations.length === 0 && 
    majorViolations.length <= Math.ceil(activitiesChecked * 0.2);
  
  console.log(`[Validator] Result: ${isValid ? 'VALID' : 'INVALID'} | Score: ${personalizationScore}/100 | Critical: ${criticalViolations.length} | Major: ${majorViolations.length} | Warnings: ${warnings.length}`);
  
  return {
    isValid,
    violations,
    warnings,
    personalizationScore,
    stats: {
      activitiesChecked,
      personalizationFieldsPresent: personalizationPresent,
      personalizationFieldsMissing: personalizationMissing,
      matchedInputsTotal
    }
  };
}

/**
 * Extract validation context from user preferences
 */
function buildValidationContext(
  prefs: Record<string, any>,
  budgetIntent: BudgetIntent | null,
  traitScores: Record<string, number>,
  tripIntents: string[]
): ValidationContext {
  // Determine pace from traits or preferences
  const paceScore = traitScores.pace || 0;
  let pacePreference: 'relaxed' | 'moderate' | 'packed' = 'moderate';
  if (paceScore <= -4) pacePreference = 'relaxed';
  else if (paceScore >= 4) pacePreference = 'packed';
  
  // If explicit pace preference exists, use it
  if (prefs.travel_pace) {
    const pace = prefs.travel_pace.toLowerCase();
    if (pace.includes('relax') || pace.includes('slow')) pacePreference = 'relaxed';
    else if (pace.includes('pack') || pace.includes('fast') || pace.includes('intensive')) pacePreference = 'packed';
  }
  
  return {
    foodDislikes: (prefs.food_dislikes || []).filter(Boolean),
    foodLikes: (prefs.food_likes || []).filter(Boolean),
    dietaryRestrictions: (prefs.dietary_restrictions || []).filter(Boolean),
    avoidList: budgetIntent?.avoid || [],
    mobilityNeeds: [prefs.mobility_needs, prefs.mobility_level, ...(prefs.accessibility_needs || [])].filter(Boolean),
    pacePreference,
    budgetTier: budgetIntent?.tier || prefs.budget_tier || 'standard',
    traitScores,
    tripIntents
  };
}


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
  const rawTier = (budgetTier?.toLowerCase() || 'standard');
  // UI/DB sometimes uses "moderate"; normalize to our canonical tier labels.
  const tier = ((rawTier === 'moderate' ? 'standard' : rawTier) as BudgetTierLevel);
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
    prioritize.push('high-value experiences', 'local favorites with quality', 'intentional upgrades on signature moments');
  } else if (spendStyle === 'splurge_forward') {
    avoid.push('budget options that compromise experience', 'overcrowded budget alternatives');
    prioritize.push('premium experiences', 'fine dining', 'skip-the-line tickets', 'private tours', 'exclusive access');
  } else {
    avoid.push('obvious tourist traps');
    prioritize.push('balanced mix of upgrades and value options', 'local recommendations at various price points');
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
    notes += ': willing to pay for top-tier comfort + 1-2 signature upgrades; avoids tourist traps and low-ROI spend';
  } else if (spendStyle === 'value_focused') {
    notes += ': seeks best value at every price point; prioritizes quality over quantity; strategic upgrades only';
  } else if (spendStyle === 'splurge_forward') {
    notes += ': embraces premium experiences freely; prioritizes exclusivity and comfort over cost savings';
  } else {
    notes += ': balanced approach to spending; open to both value finds and occasional upgrades';
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
// EXPLICIT BUDGET CONSTRAINTS BLOCK WITH "DO NOT" RULES
// =============================================================================

function buildBudgetConstraintsBlock(budgetTier: string, budgetScore: number): string {
  const tier = (budgetTier || 'moderate').toLowerCase();
  
  // Map "moderate" to "standard" for consistency
  const normalizedTier = tier === 'moderate' ? 'standard' : tier;
  
  const constraints: Record<string, string> = {
    budget: `
${'='.repeat(70)}
🚫 BUDGET CONSTRAINTS (STRICT - BUDGET TIER)
${'='.repeat(70)}

DO NOT INCLUDE:
- Michelin-starred restaurants
- Hotel restaurants or rooftop bars at luxury hotels (Hassler, Waldorf, Four Seasons, etc.)
- Private tours or VIP experiences
- Spa treatments or wellness packages
- Anything described as "luxury", "exclusive", or "premium"
- Restaurants over €40 per person
- Activities over €30 per person
- Wine pairings or tasting menus

DO INCLUDE:
- Local trattorias and osterias
- Street food and markets
- Free attractions and landmarks
- Self-guided walks and neighborhood exploration
- Restaurants where locals eat (not tourist hotspots)
- Aperitivo spots with free snacks

Price is a feature, not a constraint to work around.
`,
    economy: `
${'='.repeat(70)}
💰 BUDGET CONSTRAINTS (ECONOMY TIER)
${'='.repeat(70)}

AVOID:
- Michelin-starred restaurants
- Private tours
- VIP/skip-the-line packages
- Hotel restaurants at luxury properties
- Anything over €50 per person for dining
- Activities over €40 per person

PREFER:
- Well-reviewed local restaurants (€15-35 per person)
- Free and low-cost attractions
- Self-guided exploration
- Markets and street food
`,
    standard: `
${'='.repeat(70)}
💰 BUDGET CONSTRAINTS (MODERATE/STANDARD TIER)
${'='.repeat(70)}

LIMIT:
- Maximum 1 "splurge" meal per trip (€80+ per person)
- No Michelin-starred restaurants unless it's the designated signature_meal slot
- No hotel restaurants at 5-star properties (Hassler, St. Regis, Four Seasons, etc.)
- No private tours unless specifically requested
- No spa treatments unless specifically requested

PREFER:
- Well-reviewed local restaurants (€25-50 per person)
- Highly-rated affordable experiences
- Quality over flash
- Local favorites over tourist magnets

WORD CHOICE:
- Do NOT use "luxury" in activity titles or descriptions
- Do NOT use "exclusive" or "VIP" framing
- Do NOT describe as "splurge-forward" - this user is value-conscious
`,
    comfort: `
${'='.repeat(70)}
💰 BUDGET CONSTRAINTS (COMFORT TIER)
${'='.repeat(70)}

ALLOWED:
- Higher-end restaurants (€50-80 per person)
- 1-2 "special occasion" meals per trip
- Quality-focused experiences
- Skip-the-line tickets (not VIP, just convenience)

AVOID:
- Private tours (prefer small group)
- Hotel spa packages at ultra-luxury properties
- Michelin 2-3 star (1 star OK if booked as signature meal)
`,
    premium: `
${'='.repeat(70)}
💫 BUDGET TIER: PREMIUM
${'='.repeat(70)}

ALLOWED:
- Elevated dining experiences
- Private tours for special interests
- VIP access where it adds value
- Michelin-starred restaurants (1 per trip max unless requested)

MAINTAIN BALANCE:
- Still mix high-end with authentic local spots
- Not every meal needs to be expensive
`,
    luxury: `
${'='.repeat(70)}
👑 BUDGET TIER: LUXURY
${'='.repeat(70)}

Premium experiences expected. Michelin dining, VIP access, and exclusive experiences are appropriate.
Prioritize exclusivity and unique access over price considerations.
`
  };
  
  return constraints[normalizedTier] || constraints.standard;
}

// =============================================================================
// ARCHETYPE-SPECIFIC CONSTRAINTS
// =============================================================================

function buildArchetypeConstraintsBlock(archetype?: string): string {
  if (!archetype) return '';
  
  const normalizedArchetype = archetype.toLowerCase().replace(/\s+/g, '_');
  
  const archetypeAvoid: Record<string, string[]> = {
    'flexible_wanderer': [
      'structured group tours',
      'luxury dining establishments',
      'spa treatments or wellness packages',
      'VIP or exclusive experiences',
      'hotel restaurants at luxury properties',
      'anything requiring reservations weeks in advance',
      'Michelin-starred restaurants',
      'private tours'
    ],
    'beach_therapist': [
      'spa packages (they want beach relaxation, not spa treatments)',
      'luxury resorts dining',
      'fine dining with dress codes',
      'packed itineraries',
      'early morning activities',
      'high-energy adventure sports'
    ],
    'slow_traveler': [
      'rushed experiences',
      'tourist hotspots at peak times',
      'back-to-back activities',
      'anything described as "must-see"',
      'group tours',
      'activities before 10am'
    ],
    'cultural_curator': [
      'tourist traps',
      'chain restaurants',
      'generic shopping malls',
      'beach lounging',
      'nightclub activities'
    ],
    'culinary_cartographer': [
      'chain restaurants',
      'hotel buffets',
      'tourist-trap restaurants',
      'fast food',
      'meals without local character'
    ],
    'adrenaline_architect': [
      'spa and relaxation',
      'slow-paced activities',
      'museum-heavy itineraries',
      'shopping trips',
      'leisurely lunches'
    ],
    'luxury_luminary': [
      'budget options',
      'street food as main meals',
      'hostels',
      'public transit',
      'self-guided tours'
    ],
    'mindful_explorer': [
      'crowded tourist spots',
      'loud nightlife',
      'rushed activities',
      'group tours over 8 people',
      'aggressive shopping areas'
    ],
    'sanctuary_seeker': [
      'group activities',
      'social dining experiences',
      'crowded attractions',
      'nightlife',
      'high-energy activities'
    ],
  };
  
  const archetypeInclude: Record<string, string[]> = {
    'flexible_wanderer': [
      'self-guided neighborhood walks',
      'local cafés and bakeries',
      'hidden viewpoints',
      'afternoon lingering spots',
      'authentic local restaurants (not tourist-facing)'
    ],
    'beach_therapist': [
      'beach time',
      'sunset viewing spots',
      'waterfront cafés',
      'relaxed outdoor dining',
      'coastal walks'
    ],
    'slow_traveler': [
      'extended café breaks',
      'park visits',
      'local markets',
      'long leisurely lunches',
      'neighborhood exploration'
    ],
  };
  
  const avoid = archetypeAvoid[normalizedArchetype];
  const include = archetypeInclude[normalizedArchetype];
  
  if (!avoid && !include) return '';
  
  const formattedArchetype = archetype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  let block = `
${'='.repeat(70)}
🎭 ARCHETYPE CONSTRAINTS: ${formattedArchetype}
${'='.repeat(70)}
`;
  
  if (avoid && avoid.length > 0) {
    block += `
This traveler specifically DOES NOT want:
${avoid.map(a => `  ❌ ${a}`).join('\n')}
`;
  }
  
  if (include && include.length > 0) {
    block += `
This traveler LOVES:
${include.map(a => `  ✅ ${a}`).join('\n')}
`;
  }
  
  block += `
Respect their travel identity. These are not suggestions — they are requirements.
`;
  
  return block;
}


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
  let archetypes: Array<{ name: string; pct: number; [key: string]: any }> = [];

  // TRUST CONTRACT: If the user has an explicit primary/secondary archetype (i.e. what the UI shows),
  // we must use that and NEVER infer a conflicting archetype (like "Luxury Seeker").
  // NOTE: This can live on canonical columns (travel_dna_profiles) OR inside profiles.travel_dna blob.
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
    budgetSection += `\n📊 Upgrade cadence: ${budgetIntent.splurgeCadence.dinners} nicer dinners, ${budgetIntent.splurgeCadence.experiences} upgraded experiences per trip`;
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
                    },
                    // =========================================================
                    // PERSONALIZATION GUARANTEE FIELDS
                    // =========================================================
                    personalization: {
                      type: "object",
                      description: "REQUIRED: Prove why this activity was chosen for THIS specific user",
                      properties: {
                        tags: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 2,
                          maxItems: 6,
                          description: "Machine-checkable tags tied to user inputs. MUST include at least 2 from: romantic, family-friendly, solo-traveler, local-authentic, tourist-highlight, budget-friendly, premium, splurge, low-pace, high-pace, accessible, adventure, relaxation, foodie, cultural, outdoor, indoor. Match to user's actual preferences."
                        },
                        whyThisFits: {
                          type: "string",
                          description: "1-2 sentences explaining why this activity fits THIS user. MUST reference at least ONE specific user input (trait, preference, trip intent, or dietary need). Example: 'Chosen for your high authenticity score - this neighborhood gem is off the tourist path' or 'Matches your seafood preference with locally-caught specialties'."
                        },
                        confidence: {
                          type: "number",
                          minimum: 0,
                          maximum: 1,
                          description: "How confident are you this matches the user? 0.9+ = strong match to stated preferences, 0.7-0.9 = good fit, 0.5-0.7 = general recommendation"
                        },
                        matchedInputs: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 1,
                          description: "Which specific user inputs influenced this choice. Examples: 'authenticity_trait:+8', 'food_likes:seafood', 'trip_intent:romantic', 'pace:relaxed', 'budget:premium', 'dietary:vegetarian'"
                        }
                      },
                      required: ["tags", "whyThisFits", "confidence", "matchedInputs"]
                    }
                  },
                  required: ["id", "title", "startTime", "endTime", "category", "location", "cost", "description", "tags", "bookingRequired", "transportation", "personalization"]
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

  // Canonical travel_dna_profiles columns (v1+)
  primary_archetype_name?: string | null;
  secondary_archetype_name?: string | null;
  dna_confidence_score?: number | null;
  // Some legacy rows also used this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  confidence_score?: any;
  
  // Full travel_dna blob from profiles table (contains primary_archetype_name, etc.)
  travel_dna?: Record<string, unknown>;
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
  // Phase 9: Raw data for prompt library extractors
  rawFlightSelection?: unknown;
  rawHotelSelection?: unknown;
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
  console.log(`[FlightHotel] ============ CHECKING FLIGHT & HOTEL DATA ============`);
  console.log(`[FlightHotel] Trip ID: ${tripId}`);
  
  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('flight_selection, hotel_selection')
      .eq('id', tripId)
      .maybeSingle();

    if (error || !trip) {
      console.log(`[FlightHotel] ❌ Failed to fetch trip data:`, error?.message || 'No trip found');
      return { context: '' };
    }
    
    console.log(`[FlightHotel] flight_selection present: ${!!trip.flight_selection}`);
    console.log(`[FlightHotel] hotel_selection present: ${!!trip.hotel_selection}`);

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
      // Handle multiple structures from different sources:
      // 1. Manual entry: { departure: { arrival: { time } }, return: { departure: { time } } }
      // 2. Flight search: { departure: { arrivalTime }, return: { departureTime } }
      // 3. Flat legacy: { arrivalTime, returnDepartureTime }
      const nestedDeparture = flightRaw.departure as Record<string, unknown> | undefined;
      const nestedReturn = flightRaw.return as Record<string, unknown> | undefined;
      
      // Try all possible paths for outbound arrival time
      const manualArrival = (nestedDeparture?.arrival as Record<string, unknown>)?.time as string | undefined;
      const searchArrival = nestedDeparture?.arrivalTime as string | undefined;
      const flatArrival = flightRaw.arrivalTime as string | undefined;
      const outboundArrival = manualArrival || searchArrival || flatArrival;
      
      // Try all possible paths for return departure time
      const manualReturnDep = (nestedReturn?.departure as Record<string, unknown>)?.time as string | undefined;
      const searchReturnDep = nestedReturn?.departureTime as string | undefined;
      const flatReturnDep = flightRaw.returnDepartureTime as string | undefined;
      const returnDeparture = manualReturnDep || searchReturnDep || flatReturnDep;
      
      console.log(`[FlightContext] Parsing flight_selection - manual arrival: ${manualArrival}, search arrival: ${searchArrival}, flat arrival: ${flatArrival} → using: ${outboundArrival}`);
      
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

    // Parse hotel information - handle both array (new) and object (legacy) formats
    interface HotelInfo {
      name?: string;
      address?: string;
      neighborhood?: string;
      checkIn?: string;
      checkOut?: string;
    }
    
    const hotelRaw = trip.hotel_selection;
    let hotel: HotelInfo | null = null;
    
    // Handle array format (multi-hotel support)
    if (Array.isArray(hotelRaw) && hotelRaw.length > 0) {
      // Use the first hotel for primary context
      hotel = hotelRaw[0] as HotelInfo;
      console.log(`[FlightHotel] Parsed hotel from array: ${hotel?.name || 'No name'}`);
    } else if (hotelRaw && typeof hotelRaw === 'object' && !Array.isArray(hotelRaw)) {
      // Legacy single object format
      hotel = hotelRaw as HotelInfo;
      console.log(`[FlightHotel] Parsed hotel from legacy object: ${hotel?.name || 'No name'}`);
    }
    
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
        sections.push(`\n${'='.repeat(40)}\n🏨 ACCOMMODATION (Use as daily starting/ending point)\n${'='.repeat(40)}\n${hotelInfo.join('\n')}\n⚠️ Start each day from the hotel area and end nearby for easy return.\n⚠️ CRITICAL: Day 1 activities must NOT begin before hotel check-in is complete. Standard check-in is 3:00 PM - do not schedule sightseeing before this unless arrival is very early.`);
      }
    } else {
      console.log(`[FlightHotel] ⚠️ NO HOTEL DATA FOUND - hotel_selection is empty or missing`);
      console.log(`[FlightHotel] Raw hotel_selection value:`, JSON.stringify(hotelRaw));
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
      // Phase 9: Pass raw data for prompt library extractors
      rawFlightSelection: trip.flight_selection,
      rawHotelSelection: trip.hotel_selection,
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

// Fetch behavioral enrichment signals for richer personalization
async function getBehavioralEnrichment(supabase: any, userId: string) {
  try {
    const { data: enrichments } = await supabase
      .from('user_enrichment')
      .select('enrichment_type, entity_id, entity_name, interaction_count, metadata')
      .eq('user_id', userId)
      .in('enrichment_type', ['category_preference', 'activity_remove', 'time_change'])
      .order('interaction_count', { ascending: false })
      .limit(50);
    
    if (!enrichments?.length) return null;
    
    // Aggregate category preferences
    const categoryScores = new Map<string, number>();
    const removedCategories: string[] = [];
    const timePrefs: { category: string; slot: string }[] = [];
    
    for (const e of enrichments) {
      if (e.enrichment_type === 'category_preference') {
        const weight = e.metadata?.weight || 1;
        const current = categoryScores.get(e.entity_id) || 0;
        categoryScores.set(e.entity_id, current + weight * (e.interaction_count || 1));
      } else if (e.enrichment_type === 'activity_remove' && e.metadata?.category) {
        removedCategories.push(e.metadata.category);
      } else if (e.enrichment_type === 'time_change' && e.metadata?.category && e.metadata?.new_slot) {
        timePrefs.push({ category: e.metadata.category, slot: e.metadata.new_slot });
      }
    }
    
    const likedCategories = Array.from(categoryScores.entries())
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat.replace(/_/g, ' '));
    
    const avoidedCategories = [...new Set(removedCategories)].slice(0, 5);
    
    return { likedCategories, avoidedCategories, timePrefs };
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
        food_dislikes,
        ai_assistance_level
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
    // CRITICAL: This is where updated archetypes like "flexible_wanderer" are stored!
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('travel_dna, travel_dna_overrides')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.travel_dna) {
      const dna = profile.travel_dna as Record<string, unknown>;
      console.log('[TravelDNA] Found profile.travel_dna blob');
      
      // Log the archetype to confirm it's being read
      const primaryArchetype = dna.primary_archetype_name;
      const secondaryArchetype = dna.secondary_archetype_name;
      console.log(`[TravelDNA] Archetype from profile: primary=${primaryArchetype}, secondary=${secondaryArchetype}`);
      
      let traitScores = dna.trait_scores as Record<string, number>;
      
      // Legacy profiles always have inverted polarity
      if (traitScores?.budget !== undefined) {
        traitScores = {
          ...traitScores,
          budget: normalizeBudgetTraitForPolarity(traitScores.budget, 1),
        };
      }
      
      // CRITICAL FIX: Return the FULL travel_dna blob so buildTravelerDNA can extract archetypes
      return {
        user_id: userId,
        trait_scores: traitScores,
        travel_dna: dna, // Pass the full blob containing primary_archetype_name
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
  budgetSection += `\n📊 Upgrade cadence: ${budgetIntent.splurgeCadence.dinners} dinners, ${budgetIntent.splurgeCadence.experiences} experiences`;
  
  sections.push(budgetSection);
  
  // Archetype blend section
  // TRUST CONTRACT: If explicit primary/secondary exist, do NOT infer.
  const explicitPrimary =
    (dna as any)?.primary_archetype_name ||
    (dna as any)?.travel_dna?.primary_archetype_name;
  const explicitSecondary =
    (dna as any)?.secondary_archetype_name ||
    (dna as any)?.travel_dna?.secondary_archetype_name;

  let archetypes: Array<{ name: string; pct: number }> | undefined = undefined;
  if (explicitPrimary && typeof explicitPrimary === 'string') {
    archetypes = [
      { name: explicitPrimary, pct: explicitSecondary ? 70 : 100 },
      ...(explicitSecondary && typeof explicitSecondary === 'string'
        ? [{ name: explicitSecondary, pct: 30 }]
        : []),
    ];
    console.log(`[TravelDNA] Using explicit archetypes (no inference): primary=${explicitPrimary}, secondary=${explicitSecondary || 'none'}`);
  } else {
    archetypes = dna.travel_dna_v2?.archetype_matches || dna.archetype_matches;
  }
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
    
    // Archetype guidance is provided via buildPersonaManuscript() (prompt-library.ts)
    // using canonical profile columns + traits, not hardcoded maps here.
    
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
    
    // AI Assistance Level - affects how detailed the itinerary output is
    if (prefs.ai_assistance_level) {
      const aiLevelInstructions: Record<string, string> = {
        'full': `🤖 FULL AI PLANNING: 
   → Provide SPECIFIC venue names, restaurant recommendations, and exact addresses
   → Include detailed timing, booking links, and insider tips
   → Suggest specific dishes to order, best seats, and optimal visiting strategies
   → Fill in all details - user wants turnkey itinerary ready to follow`,
        'balanced': `🤝 COLLABORATIVE PLANNING:
   → Provide specific recommendations but leave some flexibility
   → Name top venues but also suggest "alternatively, explore the neighborhood"
   → Balance detailed suggestions with room for personal discovery`,
        'minimal': `👤 MINIMAL ASSISTANCE - SKELETON ITINERARY:
   → Provide GENERAL suggestions, NOT specific venue names
   → Use phrases like "Breakfast in [neighborhood]" instead of specific restaurants
   → Say "Afternoon: Explore [area] - museums/galleries" instead of naming venues
   → Leave timing flexible: "Morning", "Afternoon", "Evening" blocks only
   → User prefers to fill in their own specific choices`,
      };
      personaItems.push(aiLevelInstructions[prefs.ai_assistance_level] || '');
    }
    
    if (personaItems.length > 0) {
      sections.push({ title: '🎭 TRAVELER PERSONA', items: personaItems });
    }

    // Core preferences
    if (prefs.interests?.length) {
      coreItems.push(`Interests: ${prefs.interests.slice(0, 6).join(', ')}`);
    }
    if (prefs.travel_pace) {
      const paceInstructions: Record<string, string> = {
        'relaxed': `RELAXED PACE: 
   → Maximum 4-5 activities per day (including meals)
   → Include 2+ hour downtime blocks for rest/exploration
   → No back-to-back activities - allow 30+ min buffers
   → Prioritize quality over quantity`,
        'balanced': `BALANCED PACE:
   → 5-6 activities per day (including meals)
   → Include at least one 1-hour downtime block
   → 15-20 min buffers between activities`,
        'active': `ACTIVE PACE:
   → Can handle 7-8 activities per day
   → Minimal downtime needed - keep them moving
   → Pack the day with experiences`,
      };
      coreItems.push(paceInstructions[prefs.travel_pace] || `Travel pace: ${prefs.travel_pace}`);
    }
    if (prefs.activity_level) {
      const activityInstructions: Record<string, string> = {
        'light': 'LIGHT ACTIVITY: Avoid strenuous walking, hiking, or physically demanding activities',
        'moderate': 'MODERATE ACTIVITY: Some walking is fine, but avoid exhausting activities',
        'active': 'ACTIVE: Can handle hiking, long walks, and physically demanding activities',
        'intense': 'INTENSE: Seeks challenging physical activities and adventure sports',
      };
      coreItems.push(activityInstructions[prefs.activity_level] || `Activity level: ${prefs.activity_level}`);
    }
    
    // TIMING PREFERENCES - Critical for when activities start!
    if (prefs.sleep_schedule || prefs.daytime_bias) {
      const timingItems: string[] = [];
      
      if (prefs.sleep_schedule) {
        const sleepInstructions: Record<string, string> = {
          'early_bird': `🌅 EARLY BIRD: 
   → START day at 7:00-8:00 AM
   → Schedule key attractions in morning when energy is highest
   → Plan dinner for 6:00-7:00 PM, end activities by 8:30 PM`,
          'night_owl': `🌙 NIGHT OWL:
   → START day at 10:00-11:00 AM (late breakfast)
   → Schedule key activities for afternoon/evening
   → Include nightlife, late dinners (8:00+ PM), evening tours`,
          'needs_day': `😴 NEEDS DAYTIME REST:
   → START day at 9:00-10:00 AM
   → Include a 2+ hour afternoon siesta/rest block (2-4 PM)
   → Resume activities in late afternoon
   → Plan dinner for 7:00-8:00 PM`,
        };
        timingItems.push(sleepInstructions[prefs.sleep_schedule] || `Sleep schedule: ${prefs.sleep_schedule}`);
      }
      
      if (prefs.daytime_bias) {
        const biasInstructions: Record<string, string> = {
          'morning': '☀️ MORNING PERSON: Front-load the day with key activities before noon',
          'afternoon': '🌤️ AFTERNOON PEAK: Schedule main attractions for 1:00-5:00 PM',
          'evening': '🌆 EVENING FOCUS: Light mornings, ramp up activity in late afternoon/evening',
        };
        if (biasInstructions[prefs.daytime_bias]) {
          timingItems.push(biasInstructions[prefs.daytime_bias]);
        }
      }
      
      if (timingItems.length > 0) {
        sections.push({ title: '⏰ TIMING & SCHEDULE PREFERENCES', items: timingItems });
      }
    }
    
    // Activity density constraints
    if (prefs.max_activities_per_day && prefs.max_activities_per_day < 8) {
      coreItems.push(`📊 MAX ${prefs.max_activities_per_day} activities per day (user-set limit)`);
    }
    if (prefs.preferred_downtime_minutes && prefs.preferred_downtime_minutes > 15) {
      coreItems.push(`⏳ Minimum ${prefs.preferred_downtime_minutes} minute buffers between activities`);
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
    // Quality requirement - ALWAYS included
    foodItems.push(`⭐ QUALITY REQUIREMENT: ONLY recommend restaurants with 4+ star ratings`);
    foodItems.push(`   → No low-quality, poorly-reviewed, or tourist-trap venues`);
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
    childrenCount: trip.metadata?.childrenCount || 0,
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
function validateGeneratedDay(day: StrictDay, dayNumber: number, isFirstDay: boolean, isLastDay: boolean, totalDays: number, previousDays: StrictDay[] = []): DayValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ---------------------------------------------------------------------------
  // Text normalization helpers (robust duplicate detection across punctuation,
  // accents/diacritics, and minor wording differences)
  // ---------------------------------------------------------------------------
  const normalizeText = (input: string): string => {
    return (input || '')
      .toLowerCase()
      // Remove diacritics (e.g., João → Joao)
      .normalize('NFD')
      // deno-lint-ignore no-control-regex
      .replace(/[\u0300-\u036f]/g, '')
      // Replace punctuation with spaces
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  type ExperienceType =
    | 'culinary_class'
    | 'wine_tasting'
    | 'walking_tour'
    | 'museum_gallery'
    | 'shopping'
    | 'dining'
    | 'transport'
    | 'accommodation'
    | 'other';

  const getExperienceType = (act: StrictActivity): ExperienceType => {
    const title = normalizeText(act.title || '');
    const category = normalizeText(act.category || '');

    // Always respect explicit logistics categories first
    if (category.includes('transport')) return 'transport';
    if (category.includes('accommodation')) return 'accommodation';

    // Culinary class/workshop detection (THIS is the big pain point)
    const isClassLike = /\b(class|workshop|lesson|masterclass|experience|session)\b/.test(title);
    const isCulinary = /\b(cook|cooking|culinary|chef|bake|baking|pastry|patisserie|food)\b/.test(title);
    if (isClassLike && isCulinary) return 'culinary_class';

    if (/\b(wine|tasting|vineyard|winery)\b/.test(title)) return 'wine_tasting';
    if (/\b(walking tour|guided tour|city tour|history tour)\b/.test(title)) return 'walking_tour';
    if (/\b(museum|gallery|exhibit|exhibition)\b/.test(title)) return 'museum_gallery';
    if (category.includes('shopping') || /\b(shop|shopping|market)\b/.test(title)) return 'shopping';
    if (category.includes('dining') || /\b(dinner|lunch|breakfast|brunch|restaurant)\b/.test(title)) return 'dining';

    return 'other';
  };

  // Extract activity concept (e.g., "pastel de nata baking class" -> "pastel de nata baking")
  // Moved outside the loop so it can be reused for trip-wide checks
  const extractConcept = (title: string): string => {
    // Remove venue names (usually after "at" or "with")
    const conceptPart = normalizeText(title).split(/\s+at\s+|\s+with\s+|\s+@\s+|\s+in\s+/i)[0];
    // Remove common generic tokens anywhere (not just at end)
    return conceptPart
      .replace(/\b(class|tour|experience|visit|workshop|session|lesson|masterclass)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Concept similarity helper (also used for trip-wide checks)
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
      const currTitle = normalizeText(act.title || '');
      const prevTitle = normalizeText(prevAct.title || '');
      
      // Use hoisted extractConcept function
      const currConcept = extractConcept(currTitle);
      const prevConcept = extractConcept(prevTitle);
      
      // Use hoisted conceptSimilarity function
      if (conceptSimilarity(currConcept, prevConcept)) {
        errors.push(`Activities ${i} and ${i + 1} are too similar: "${prevAct.title}" followed by "${act.title}" - AVOID duplicate concepts back-to-back`);
      }

      // HARD GUARD: back-to-back culinary classes/workshops (even if titles differ)
      const prevType = getExperienceType(prevAct);
      const currType = getExperienceType(act);
      if (prevType === 'culinary_class' && currType === 'culinary_class') {
        errors.push(`Back-to-back culinary classes are not allowed: "${prevAct.title}" followed by "${act.title}"`);
      }
      
      // Check for same meal type back-to-back (e.g., two breakfast spots, two dinner restaurants)
      const mealCategories = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'cafe', 'coffee'];
      const currMealType = mealCategories.find(m => currTitle.includes(m) || (act.category || '').toLowerCase().includes(m));
      const prevMealType = mealCategories.find(m => prevTitle.includes(m) || (prevAct.category || '').toLowerCase().includes(m));
      
      if (currMealType && prevMealType && currMealType === prevMealType) {
        errors.push(`Activities ${i} and ${i + 1} are both "${currMealType}" meals - NEVER schedule two ${currMealType} spots back-to-back`);
      }
      
      // Check for same activity category repeating (excluding transport/accommodation/downtime - those can repeat for logistics)
      const skipCategories = ['transport', 'accommodation', 'downtime', 'free_time'];
      if (act.category && prevAct.category && 
          act.category.toLowerCase() === prevAct.category.toLowerCase() &&
          !skipCategories.includes(act.category.toLowerCase())) {
        // Same category back-to-back (e.g., two "activity" entries, two "cultural" entries)
        warnings.push(`Activities ${i} and ${i + 1} are both "${act.category}" - consider more variety`);
      }
    }
  }

  // Day-level variety rules (prevents “entire itinerary is cooking/baking classes”)
  if (day.activities?.length) {
    const types = day.activities.map(getExperienceType);
    const culinaryCount = types.filter(t => t === 'culinary_class').length;
    if (culinaryCount > 1) {
      errors.push(`VARIETY RULE VIOLATION: Only ONE culinary class/workshop is allowed per day (found ${culinaryCount}).`);
    }
  }

  // ==========================================================================
  // TRIP-WIDE UNIQUENESS RULES - No activity type should appear more than once per trip
  // This is the KEY fix: each experience should only happen ONCE across the entire trip
  // ==========================================================================
  if (previousDays.length > 0 && day.activities?.length) {
    // Build set of all previous activity concepts (normalized titles)
    const previousConcepts = new Set<string>();
    const previousExperienceTypes: Record<string, number> = {};
    
    for (const prevDay of previousDays) {
      for (const prevAct of prevDay.activities || []) {
        const concept = extractConcept(normalizeText(prevAct.title || ''));
        if (concept.length > 5) previousConcepts.add(concept);
        
        const expType = getExperienceType(prevAct);
        previousExperienceTypes[expType] = (previousExperienceTypes[expType] || 0) + 1;
      }
    }
    
    // Check each activity in current day against trip-wide history
    for (const act of day.activities) {
      const actConcept = extractConcept(normalizeText(act.title || ''));
      const actType = getExperienceType(act);
      
      // Skip logistics - those can repeat (transfers, check-ins, etc.)
      if (actType === 'transport' || actType === 'accommodation' || actType === 'dining') {
        continue;
      }
      
      // STRICT: No activity should repeat if concept matches too closely
      for (const prevConcept of previousConcepts) {
        if (conceptSimilarity(actConcept, prevConcept)) {
          errors.push(`TRIP-WIDE DUPLICATE: "${act.title}" is too similar to an activity from a previous day. Each activity type should only appear ONCE across the entire trip.`);
          break;
        }
      }
      
      // STRICT: Culinary classes/workshops can only appear ONCE per TRIP (not per day)
      if (actType === 'culinary_class' && (previousExperienceTypes['culinary_class'] || 0) >= 1) {
        errors.push(`TRIP-WIDE LIMIT: A culinary class/workshop was already scheduled on a previous day. Only ONE culinary class/workshop is allowed per ENTIRE TRIP.`);
      }
      
      // STRICT: Wine tastings can only appear ONCE per TRIP
      if (actType === 'wine_tasting' && (previousExperienceTypes['wine_tasting'] || 0) >= 1) {
        errors.push(`TRIP-WIDE LIMIT: A wine tasting was already scheduled on a previous day. Only ONE wine tasting is allowed per ENTIRE TRIP.`);
      }
      
      // SOFT: Walking tours - max 2 per trip
      if (actType === 'walking_tour' && (previousExperienceTypes['walking_tour'] || 0) >= 2) {
        warnings.push(`Trip has ${previousExperienceTypes['walking_tour'] + 1} walking tours total. Consider more variety.`);
      }
      
      // SOFT: Museum/gallery - max 3 per trip
      if (actType === 'museum_gallery' && (previousExperienceTypes['museum_gallery'] || 0) >= 3) {
        warnings.push(`Trip has ${previousExperienceTypes['museum_gallery'] + 1} museums/galleries total. Consider more variety.`);
      }
    }
  }

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
  supabaseClient: any, // For DB-driven destination essentials
  perplexityApiKey?: string,
  maxRetries: number = 3
): Promise<StrictDay> {
  const isFirstDay = dayNumber === 1;
  const isLastDay = dayNumber === context.totalDays;
  const date = formatDate(context.startDate, dayNumber - 1);

  // Build previous activities list to avoid repetition
  const previousActivities = previousDays.flatMap(d => 
    d.activities.map(a => a.title).filter(Boolean)
  );

  // ==========================================================================
  // PHASE 9: Use modular prompt library for DNA-driven personalization
  // The library builds prompts based on:
  // 1. Flight data → Hotel data → DNA (interdependent decision tree)
  // 2. Full persona manuscript injection
  // 3. Day-specific constraints based on arrival/departure
  // ==========================================================================
  
  let dnaPromptSection = '';
  let dayConstraintsSection = '';
  
  if (context.travelerDNA && (context.flightData || context.hotelData)) {
    const tripCtx: PromptTripContext = {
      destination: context.destination,
      destinationCountry: context.destinationCountry,
      startDate: context.startDate,
      endDate: context.endDate,
      totalDays: context.totalDays,
      travelers: context.travelers,
      tripType: context.tripType,
      budgetTier: context.budgetTier,
      currency: context.currency,
    };
    
    const flightData = context.flightData || { hasOutboundFlight: false, hasReturnFlight: false };
    const hotelData = context.hotelData || { hasHotel: false };
    
    const { personaPrompt, dayConstraints } = buildDayPrompt(
      flightData,
      hotelData,
      context.travelerDNA,
      tripCtx,
      dayNumber
    );
    
    dnaPromptSection = personaPrompt;
    dayConstraintsSection = dayConstraints.constraints;
    
    console.log(`[Stage 2] Day ${dayNumber}: Using prompt library - energy=${dayConstraints.energyLevel}, maxActivities=${dayConstraints.maxActivities}, earliest=${dayConstraints.earliestStartTime}`);
  }

  // Quality enforcement rules that get stricter with retries
  const qualityRules = [
    'QUALITY RULES (STRICTLY ENFORCED):',
    '1. Every activity MUST have a title, startTime, endTime, category, and location',
    '2. Times MUST be in HH:MM format (24-hour, e.g., "09:00", "14:30")',
    '3. Hotel check-in/checkout: bookingRequired=false, cost.amount=0',
    '4. Airport transfers: bookingRequired=false (user arranges transport)',
    '5. Free time/leisure: bookingRequired=false, cost.amount=0',
    '6. Only tours, museums, and ticketed attractions should have bookingRequired=true',
    '7. NO DUPLICATE ACTIVITIES: NEVER schedule the same type of activity back-to-back',
    '8. **TRIP-WIDE UNIQUENESS**: Each unique experience (cooking class, wine tasting, etc.) should appear AT MOST ONCE in the ENTIRE trip',
    '9. VARIETY PER DAY: Mix sightseeing, cultural sites, museums, outdoor activities, dining',
    isFirstDay ? '10. DAY 1 MUST start with: Arrival → Transfer → Check-in (in that order)' : '',
    isLastDay && context.totalDays > 1 ? '10. LAST DAY MUST end with: Checkout → Transfer → Departure' : '',
  ].filter(Boolean).join('\n');

  // Build list of previous experience types for stricter rejection
  const previousExperienceTypes = new Set<string>();
  for (const prevDay of previousDays) {
    for (const act of prevDay.activities || []) {
      const title = (act.title || '').toLowerCase();
      if (/\b(class|workshop|lesson|masterclass)\b/.test(title) && /\b(cook|bake|pastry|culinary|food)\b/.test(title)) {
        previousExperienceTypes.add('culinary_class');
      }
      if (/\b(wine|tasting|vineyard)\b/.test(title)) {
        previousExperienceTypes.add('wine_tasting');
      }
    }
  }

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

      // Build destination essentials prompt (non-negotiables + hidden gems)
      // Now uses DB-driven data with freshness-based Perplexity enrichment
      const authenticityScore = context.travelerDNA?.traits?.authenticity || 0;
      const isFirstTimeVisitor = true; // TODO: Add first-time detection from trip form
      const destinationEssentialsPrompt = supabaseClient
        ? await buildDestinationEssentialsPromptWithDB(
            supabaseClient,
            context.destination,
            context.totalDays,
            authenticityScore,
            isFirstTimeVisitor,
            perplexityApiKey
          )
        : buildDestinationEssentialsPrompt(
            context.destination,
            context.totalDays,
            authenticityScore,
            isFirstTimeVisitor
          );

      // Build the system prompt with FULL DNA injection + Destination Essentials
      // The GENERATION HIERARCHY establishes clear conflict resolution priorities
      
      // ==========================================================================
      // PHASE 11: COMPREHENSIVE CONSTRAINTS - What Archetypes ACTUALLY Mean
      // ==========================================================================
      // Use the new comprehensive constraint system that includes:
      // 1. Full archetype definitions with meanings, violations, and day structure
      // 2. Trip-wide variety rules (no spa every day, no Michelin every day)
      // 3. Unscheduled time requirements for flexible archetypes
      // 4. Pacing enforcement based on pace trait
      // 5. Budget reality constraints with explicit price limits
      // 6. Anti-gaming naming rules
      const comprehensiveConstraints = buildAllConstraints(
        context.travelerDNA?.primaryArchetype,
        context.budgetTier,
        {
          pace: context.travelerDNA?.traits?.pace || 0,
          budget: context.travelerDNA?.traits?.budget || 0
        }
      );
      
      // Get archetype day structure for activity limits
      const archetypeDefinition = getArchetypeDefinition(context.travelerDNA?.primaryArchetype);
      const maxActivitiesFromArchetype = archetypeDefinition.dayStructure.maxScheduledActivities;
      
      const generationHierarchy = `
${'='.repeat(70)}
⚖️ GENERATION HIERARCHY — CONFLICT RESOLUTION RULES
${'='.repeat(70)}

When rules conflict, follow this priority order (1 = highest):

1. DESTINATION ESSENTIALS (highest priority)
   → First-time visitors MUST see iconic landmarks (Colosseum in Rome, Eiffel Tower in Paris)
   → These are non-negotiable unless user explicitly says "skip"

2. ARCHETYPE IDENTITY (critical - defines WHO the traveler is)
   → The PRIMARY archetype's meaning, avoid list, and day structure are LAW
   → "Flexible Wanderer" = unscheduled blocks, max 2 activities, NO luxury/spa/fine dining
   → "Beach Therapist" = beach-focused, NOT spa-focused. No spa treatments.
   → If an activity violates the archetype's avoid list, DO NOT INCLUDE IT

3. BUDGET CONSTRAINTS
   → Budget tier + budget trait score determine price limits
   → Value-focused travelers: NO Michelin, NO hotel bars, NO €100+ experiences
   → When archetype conflicts with budget, budget wins on COST, archetype wins on STYLE

4. PACING CONSTRAINTS
   → Pace trait determines activity density and timing
   → Pace -5 = max 2-3 activities, start at 10am, 60min buffers, unscheduled blocks
   → These are HARD LIMITS, not suggestions

5. VARIETY RULES
   → Max 1 spa per trip (unless Zen Seeker)
   → Max 1 Michelin per trip (unless Luxury Luminary)
   → No same-category activities back-to-back

6. TRAIT MODIFIERS (lowest priority — fine-tuning only)
   → Traits adjust timing and intensity within the above constraints
   → Traits do NOT override archetype identity, budget, or pacing constraints

CRITICAL: The archetype's "avoid" list is NON-NEGOTIABLE. If "Flexible Wanderer" avoids spa treatments, there are ZERO spa treatments.

${'='.repeat(70)}

${comprehensiveConstraints}
`;

      const systemPrompt = `You are an expert travel planner. Generate a SINGLE day's itinerary with PERFECT data quality.

${generationHierarchy}

${qualityRules}

${destinationEssentialsPrompt ? `${destinationEssentialsPrompt}

` : ''}${dnaPromptSection ? `${'='.repeat(70)}
TRAVELER DNA PROFILE (CRITICAL - Customize EVERYTHING to this person)
${'='.repeat(70)}
${dnaPromptSection}` : ''}

${dayConstraintsSection ? `${'='.repeat(70)}
DAY-SPECIFIC CONSTRAINTS (Flight/Hotel/DNA driven)
${'='.repeat(70)}
${dayConstraintsSection}` : ''}

ADDITIONAL CONTEXT:
${preferenceContext}

${flightHotelContext}${retryPrompt}`;

      // Build banned experience types list for this day
      const bannedTypes: string[] = [];
      if (previousExperienceTypes.has('culinary_class')) {
        bannedTypes.push('cooking classes', 'baking classes', 'culinary workshops', 'pastry classes', 'food classes');
      }
      if (previousExperienceTypes.has('wine_tasting')) {
        bannedTypes.push('wine tastings', 'vineyard tours', 'winery visits');
      }

      const userPrompt = `Generate Day ${dayNumber} of ${context.totalDays} for ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''}.

DATE: ${date}
TRAVELERS: ${context.travelers}
BUDGET: ${context.budgetTier || 'standard'} (~$${context.dailyBudget}/day per person)
ARCHETYPE: ${context.travelerDNA?.primaryArchetype || 'balanced'}
MAX ACTIVITIES: ${maxActivitiesFromArchetype} (from archetype day structure - this is a HARD LIMIT)

${previousActivities.length > 0 ? `AVOID REPEATING THESE SPECIFIC ACTIVITIES: ${previousActivities.join(', ')}\n` : ''}
NOTE: The previous-activities list is ONLY for de-duplication. Do NOT treat it as a signal for spending style.
${bannedTypes.length > 0 ? `\n🚫 BANNED EXPERIENCE TYPES (already done on previous days - DO NOT INCLUDE): ${bannedTypes.join(', ')}\n` : ''}

CRITICAL REMINDERS:
1. Maximum ${maxActivitiesFromArchetype} scheduled activities. Going over = FAILURE.
2. Check the archetype's avoid list. If it says "no spa", there are ZERO spa activities.
3. Check the budget constraints. If value-focused, no €100+ experiences.
4. ${context.travelerDNA?.primaryArchetype === 'flexible_wanderer' || context.travelerDNA?.primaryArchetype === 'slow_traveler' || (context.travelerDNA?.traits?.pace || 0) <= -3 ? 'Include at least one 2+ hour UNSCHEDULED block labeled "Free time to explore [neighborhood]"' : 'Follow the pacing guidelines for this archetype'}

Generate activities for this day following ALL constraints above.`;

      let data: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
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
          console.error(`[Stage 2] AI Gateway error for day ${dayNumber} (attempt ${attempt}): ${status}`, errorText);

          // Retry transient 5xx
          if (attempt < 3 && status >= 500) {
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
            continue;
          }

          throw new Error(status === 429 ? 'Rate limit exceeded' : status === 402 ? 'Credits exhausted' : 'AI generation failed');
        }

        data = await response.json();

        // The gateway can sometimes return HTTP 200 with an error payload.
        if ((data as any)?.error) {
          console.error(`[Stage 2] AI Gateway error payload (attempt ${attempt}):`, (data as any).error);
          const raw = (data as any).error?.message || 'Internal Server Error';
          const isTransient = raw === 'Internal Server Error' || (data as any).error?.code === 500;
          if (attempt < 3 && isTransient) {
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
            data = null;
            continue;
          }

          const msg = raw === 'Internal Server Error'
            ? 'AI service temporarily unavailable. Please try again in a moment.'
            : raw;
          throw new Error(`AI service error: ${msg}`);
        }

        break;
      }

      if (!data) {
        throw new Error('AI generation failed');
      }

      const message = data.choices?.[0]?.message;
      const toolCall = message?.tool_calls?.[0];

      let generatedDay: StrictDay;
      if (toolCall?.function?.arguments) {
        // Standard tool call response
        generatedDay = JSON.parse(toolCall.function.arguments) as StrictDay;
      } else if (message?.content) {
        // Fallback: AI returned content instead of tool call
        console.log("[Stage 2] AI returned content instead of tool_call, attempting to parse...");
        try {
          const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
          const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            generatedDay = JSON.parse(jsonMatch[0]) as StrictDay;
          } else {
            console.error("[Stage 2] No JSON found in content:", contentStr.substring(0, 500));
            throw new Error("Invalid AI response format - no JSON in content");
          }
        } catch (parseErr) {
          console.error("[Stage 2] Failed to parse content as JSON:", parseErr);
          throw new Error("Invalid AI response format - content not parseable");
        }
      } else {
        console.error("[Stage 2] Invalid AI response - no tool_calls or content:", JSON.stringify(data).substring(0, 1000));
        throw new Error("Invalid AI response format");
      }

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

      // Validate the generated day - pass previousDays for trip-wide uniqueness checks
      const validation = validateGeneratedDay(generatedDay, dayNumber, isFirstDay, isLastDay, context.totalDays, previousDays);
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
  flightHotelContext: string = '',
  supabaseClient?: any, // For DB-driven destination essentials
  perplexityApiKey?: string
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
          LOVABLE_API_KEY,
          supabaseClient,
          perplexityApiKey
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
    // Sanitize activity titles to remove system prefixes before saving
    const SYSTEM_PREFIXES = [
      'EDGE_ACTIVITY:', 'SIGNATURE_MEAL:', 'LINGER_BLOCK:', 'WELLNESS_MOMENT:',
      'AUTHENTIC_ENCOUNTER:', 'SOCIAL_EXPERIENCE:', 'SOLO_RETREAT:', 'DEEP_CONTEXT:',
      'SPLURGE_EXPERIENCE:', 'VIP_EXPERIENCE:', 'COUPLES_MOMENT:', 'CONNECTIVITY_SPOT:', 'FAMILY_ACTIVITY:',
    ];
    
    const sanitizeTitle = (title: string): string => {
      let sanitized = title.trim();
      for (const prefix of SYSTEM_PREFIXES) {
        if (sanitized.toUpperCase().startsWith(prefix.toUpperCase())) {
          sanitized = sanitized.slice(prefix.length).trim();
          break;
        }
      }
      return sanitized;
    };
    
    // Apply sanitization to all activity titles
    const sanitizedDays = days.map(day => ({
      ...day,
      activities: day.activities.map((act: StrictActivity) => ({
        ...act,
        title: sanitizeTitle(act.title),
      })),
    }));
    
    const totalActivities = sanitizedDays.reduce((sum, day) => sum + day.activities.length, 0);

    const itineraryData = {
      days: sanitizedDays,
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
  sourceProvider?: 'google_places' | 'foursquare' | 'viator' | 'internal_db' | 'ai_verified';
}

// Cached venue from verified_venues table
interface CachedVenue {
  id: string;
  name: string;
  google_place_id: string | null;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  rating: number | null;
  total_reviews: number | null;
  price_level: number | null;
  website: string | null;
  verification_confidence: number;
  verification_source: string;
}

/**
 * Normalize venue name for matching (lowercase, remove special chars)
 */
function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`´]/g, "'")
    .replace(/[^\w\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check verified_venues cache for a known venue
 * Returns cached data if found and not expired
 */
async function checkVenueCache(
  venueName: string,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<CachedVenue | null> {
  try {
    const normalizedName = normalizeVenueName(venueName);
    const normalizedDest = destination.toLowerCase().trim();
    
    // Use service role client for cache access
    const response = await fetch(`${supabaseUrl}/rest/v1/verified_venues?normalized_name=eq.${encodeURIComponent(normalizedName)}&destination=ilike.%25${encodeURIComponent(normalizedDest)}%25&expires_at=gt.${new Date().toISOString()}&select=*&limit=1`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      console.log(`[Stage 4] ✅ Cache HIT for "${venueName}" in ${destination}`);
      
      // Update usage stats (fire and forget)
      fetch(`${supabaseUrl}/rest/v1/verified_venues?id=eq.${data[0].id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          usage_count: (data[0].usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Refresh TTL
        })
      }).catch(() => {}); // Ignore errors
      
      return data[0];
    }
    
    return null;
  } catch (e) {
    console.log(`[Stage 4] Cache check error for "${venueName}":`, e);
    return null;
  }
}

/**
 * Cache a newly verified venue for future use
 */
async function cacheVerifiedVenue(
  venueName: string,
  destination: string,
  category: string,
  verification: VenueVerification,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  try {
    const normalizedName = normalizeVenueName(venueName);
    
    const venueData = {
      name: venueName,
      normalized_name: normalizedName,
      destination: destination.toLowerCase().trim(),
      category: category.toLowerCase(),
      address: verification.formattedAddress || null,
      coordinates: verification.coordinates || null,
      google_place_id: verification.placeId || null,
      rating: verification.rating?.value || null,
      total_reviews: verification.rating?.totalReviews || null,
      price_level: verification.priceLevel || null,
      website: verification.website || null,
      verification_source: verification.sourceProvider || 'google_places',
      verification_confidence: verification.confidence,
      last_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    // Upsert based on google_place_id or normalized_name + destination
    const response = await fetch(`${supabaseUrl}/rest/v1/verified_venues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(venueData)
    });
    
    if (response.ok) {
      console.log(`[Stage 4] ✅ Cached venue: "${venueName}" in ${destination}`);
    }
  } catch (e) {
    console.log(`[Stage 4] Cache write error for "${venueName}":`, e);
  }
}

/**
 * Dual-AI Venue Verification Pipeline
 * 1. Check internal cache first
 * 2. If miss: AI-1 (Gemini Flash) performs Google Places lookup
 * 3. AI-2 (GPT-5-mini) verifies semantic match between AI-generated name and real venue
 * 4. Cache verified venues for future use
 */
async function verifyVenueWithDualAI(
  activity: StrictActivity,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined,
  LOVABLE_API_KEY: string | undefined
): Promise<VenueVerification | null> {
  const venueName = activity.location?.name || activity.title;
  const category = activity.category || 'sightseeing';
  
  // Step 1: Check cache first
  const cached = await checkVenueCache(venueName, destination, supabaseUrl, supabaseKey);
  if (cached) {
    return {
      isValid: true,
      confidence: cached.verification_confidence,
      placeId: cached.google_place_id || undefined,
      formattedAddress: cached.address || undefined,
      coordinates: cached.coordinates || undefined,
      rating: cached.rating ? { value: cached.rating, totalReviews: cached.total_reviews || 0 } : undefined,
      priceLevel: cached.price_level || undefined,
      website: cached.website || undefined,
      sourceProvider: 'internal_db'
    };
  }
  
  // Step 2: Google Places lookup (existing function)
  const googleResult = await verifyVenueWithGooglePlaces(venueName, destination, GOOGLE_MAPS_API_KEY);
  
  if (!googleResult || !googleResult.isValid) {
    // No Google match - mark as AI-generated only
    return {
      isValid: false,
      confidence: 0.4,
      sourceProvider: 'ai_verified' // Fallback when unverified
    };
  }
  
  // Step 3: Semantic verification with second AI (for high-value venues)
  // Skip for transport/downtime categories
  const skipSemanticCheck = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'].includes(category.toLowerCase());
  
  let semanticConfidence = googleResult.confidence;
  
  if (!skipSemanticCheck && LOVABLE_API_KEY && googleResult.formattedAddress) {
    try {
      // Use GPT-5-mini for fast semantic matching
      const semanticResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-5-nano', // Fast + cheap for simple matching
          messages: [
            {
              role: 'system',
              content: `You are a venue verification assistant. Determine if two venue descriptions refer to the same place.
Return ONLY a JSON object: { "match": true/false, "confidence": 0.0-1.0, "reason": "brief explanation" }
Consider: name similarity, location match, category alignment. Be strict about name matching.`
            },
            {
              role: 'user',
              content: `AI-generated venue: "${venueName}" (category: ${category})
Google Places result: "${googleResult.formattedAddress}"
${googleResult.rating ? `Rating: ${googleResult.rating.value}/5 (${googleResult.rating.totalReviews} reviews)` : ''}

Are these the same venue?`
            }
          ],
          max_tokens: 100
        })
      });
      
      if (semanticResponse.ok) {
        const semanticData = await semanticResponse.json();
        const content = semanticData.choices?.[0]?.message?.content || '';
        
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            if (result.match === false) {
              console.log(`[Stage 4] ⚠️ Semantic mismatch for "${venueName}": ${result.reason}`);
              semanticConfidence = result.confidence * 0.5; // Reduce confidence significantly
            } else {
              semanticConfidence = Math.max(googleResult.confidence, result.confidence);
              console.log(`[Stage 4] ✅ Semantic match confirmed for "${venueName}" (${semanticConfidence.toFixed(2)})`);
            }
          }
        } catch (parseErr) {
          // JSON parse failed, use Google result as-is
        }
      }
    } catch (semanticError) {
      console.log(`[Stage 4] Semantic check skipped for "${venueName}":`, semanticError);
    }
  }
  
  // Step 4: Cache the verified venue
  const finalResult: VenueVerification = {
    ...googleResult,
    confidence: semanticConfidence,
    sourceProvider: 'google_places'
  };
  
  if (semanticConfidence >= 0.7) {
    // Only cache high-confidence matches
    cacheVerifiedVenue(venueName, destination, category, finalResult, supabaseUrl, supabaseKey);
  }
  
  return finalResult;
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
  GOOGLE_MAPS_API_KEY: string | undefined,
  LOVABLE_API_KEY: string | undefined
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

  // Run venue verification (with dual-AI + caching), photo fetch, and Viator search in parallel
  const [venueData, photoResult, viatorMatch] = await Promise.all([
    // Verify venue with Dual-AI pipeline (cache → Google Places → semantic match)
    verifyVenueWithDualAI(activity, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY),
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
  LOVABLE_API_KEY: string | undefined,
  maxRetries: number = 1
): Promise<{ activity: StrictActivity; success: boolean; retried: boolean }> {
  let retried = false;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const enriched = await enrichActivity(activity, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY);
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
  GOOGLE_MAPS_API_KEY: string | undefined,
  LOVABLE_API_KEY: string | undefined
): Promise<{ days: StrictDay[]; stats: EnrichmentStats }> {
  console.log(`[Stage 4] Starting enrichment for ${days.length} days with real photos + dual-AI venue verification`);

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
        batch.map(act => enrichActivityWithRetry(act, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY))
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
      let flightHotelResult = await getFlightHotelContext(supabase, tripId);
      
      // IMPORTANT: Use tripData.arrivalTime/departureTime as fallback when DB doesn't have flight data
      // This handles the case where user entered times in ItineraryContextForm but hasn't saved flight_selection
      if (tripData?.arrivalTime && !flightHotelResult.arrivalTime) {
        const arrival24 = normalizeTo24h(tripData.arrivalTime) || tripData.arrivalTime;
        const ARRIVAL_BUFFER_MINS = 4 * 60;
        const earliestActivity = minutesToHHMM((parseTimeToMinutes(arrival24) || 0) + ARRIVAL_BUFFER_MINS);
        
        flightHotelResult = {
          ...flightHotelResult,
          arrivalTime: tripData.arrivalTime,
          arrivalTime24: arrival24,
          earliestFirstActivityTime: earliestActivity,
          context: flightHotelResult.context || `Flight arrives at ${tripData.arrivalTime}. Plan Day 1 activities after ${earliestActivity}.`,
        };
        console.log(`[Stage 1.4] Using arrival time from tripData: ${tripData.arrivalTime}, earliest activity: ${earliestActivity}`);
      }
      
      if (tripData?.departureTime && !flightHotelResult.returnDepartureTime) {
        const departure24 = normalizeTo24h(tripData.departureTime) || tripData.departureTime;
        const latestActivity = addMinutesToHHMM(departure24, -180);
        
        flightHotelResult = {
          ...flightHotelResult,
          returnDepartureTime: tripData.departureTime,
          returnDepartureTime24: departure24,
          latestLastActivityTime: latestActivity,
          context: (flightHotelResult.context || '') + ` Return flight departs at ${tripData.departureTime}. Last activity must end by ${latestActivity}.`,
        };
        console.log(`[Stage 1.4] Using departure time from tripData: ${tripData.departureTime}, latest activity: ${latestActivity}`);
      }
      
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
      // PHASE 9: Build TravelerDNA and Flight/Hotel data for prompt library
      // This enables the modular decision tree: Flight → Hotel → DNA
      // =======================================================================
      console.log("[Stage 1.4.5] Building DNA/Flight/Hotel data for prompt library...");
      
      // Extract flight data using prompt-library extractors
      const promptFlightData = extractFlightData(flightHotelResult.rawFlightSelection);
      const promptHotelData = extractHotelData(flightHotelResult.rawHotelSelection);
      
      // Build TravelerDNA from existing data
      const promptTravelerDNA = buildTravelerDNA(
        travelDNA as Record<string, unknown> | null,
        prefs as Record<string, unknown> | null,
        traitOverrides
      );
      
      // Inject into context for use in generateSingleDayWithRetry
      context.travelerDNA = promptTravelerDNA;
      context.flightData = promptFlightData;
      context.hotelData = promptHotelData;
      
      console.log(
        `[Stage 1.4.5] DNA injected: primary=${promptTravelerDNA.primaryArchetype || 'none'}, secondary=${promptTravelerDNA.secondaryArchetype || 'none'}, tripBudgetTier=${context.budgetTier || 'none'}, pace=${promptTravelerDNA.traits.pace}, flight=${promptFlightData.hasOutboundFlight}, hotel=${promptHotelData.hasHotel}`
      );
      
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
      
      // =======================================================================
      // STAGE 1.95: Cold Start Detection & Fallback
      // =======================================================================
      console.log("[Stage 1.95] Assessing data completeness...");
      
      const tripHistoryResult = await supabase.from('trips').select('id').eq('user_id', userId || '').limit(10);
      const dataCompleteness = assessDataCompleteness(
        travelDNA as unknown as Record<string, unknown> | null,
        prefs as unknown as Record<string, unknown> | null,
        traitOverrides,
        tripHistoryResult.data
      );
      
      let coldStartContext = '';
      if (dataCompleteness.confidenceLevel === 'cold_start' || dataCompleteness.confidenceLevel === 'low') {
        console.log(`[Stage 1.95] Low confidence (${dataCompleteness.confidenceLevel}): ${dataCompleteness.dataGaps.join(', ')}`);
        
        const coldStartFallback = generateColdStartFallback(dataCompleteness, {
          tripType: context.tripType,
          budgetTier: context.budgetTier,
          travelers: context.travelers,
          destination: context.destination
        });
        
        coldStartContext = buildColdStartPrompt(coldStartFallback);
        console.log(`[Stage 1.95] Using default persona: ${coldStartFallback.defaultPersona.name}`);
      }
      
      // =======================================================================
      // STAGE 1.96: Build Forced Differentiators & Schedule Constraints
      // =======================================================================
      console.log("[Stage 1.96] Building personalization enforcement rules...");
      
      // Get trait scores from normalized context or Travel DNA
      const traitScores: Partial<TraitScores> = {
        planning: normalizedContext?.traits?.planning ?? travelDNA?.trait_scores?.planning ?? 0,
        social: normalizedContext?.traits?.social ?? travelDNA?.trait_scores?.social ?? 0,
        comfort: normalizedContext?.traits?.comfort ?? travelDNA?.trait_scores?.comfort ?? 0,
        pace: normalizedContext?.traits?.pace ?? travelDNA?.trait_scores?.pace ?? 0,
        authenticity: normalizedContext?.traits?.authenticity ?? travelDNA?.trait_scores?.authenticity ?? 0,
        adventure: normalizedContext?.traits?.adventure ?? travelDNA?.trait_scores?.adventure ?? 0,
        budget: normalizedContext?.traits?.budget ?? travelDNA?.trait_scores?.budget ?? 0,
        transformation: normalizedContext?.traits?.transformation ?? travelDNA?.trait_scores?.transformation ?? 0
      };
      
      // Get interests from preferences
      const userInterests = normalizedContext?.preferences?.interests || prefs?.interests || [];
      
      // Derive forced slots (trait-based required activities per day)
      // Build slot derivation context for archetype-specific slots
      const travelCompanions = prefs?.travel_companions || [];
      const hasChildrenFromCompanions = travelCompanions.some((c: string) => 
        c.toLowerCase().includes('family') || 
        c.toLowerCase().includes('kid') || 
        c.toLowerCase().includes('child')
      );
      // Use explicit childrenCount from trip metadata, or fall back to companion/tripType indicators
      const hasChildren = (context.childrenCount && context.childrenCount > 0) || 
        hasChildrenFromCompanions || 
        context.tripType === 'family';
      
      // Get archetype IDs from either normalized context or travel_dna_v2
      const primaryArchetypeId = normalizedContext?.archetypes?.[0]?.id || 
        travelDNA?.travel_dna_v2?.archetype_matches?.[0]?.archetype_id ||
        travelDNA?.archetype_matches?.[0]?.archetype_id;
      const secondaryArchetypeId = normalizedContext?.archetypes?.[1]?.id || 
        travelDNA?.travel_dna_v2?.archetype_matches?.[1]?.archetype_id ||
        travelDNA?.archetype_matches?.[1]?.archetype_id;
      
      const slotContext = {
        tripType: context.tripType,
        travelCompanions,
        hasChildren,
        primaryArchetype: primaryArchetypeId,
        secondaryArchetype: secondaryArchetypeId
      };
      const forcedSlots = deriveForcedSlots(traitScores, userInterests, 1, context.totalDays, slotContext);
      const forcedSlotsPrompt = buildForcedSlotsPrompt(forcedSlots);
      console.log(`[Stage 1.96] ${forcedSlots.length} forced differentiator slots required per day (context: tripType=${slotContext.tripType}, hasChildren=${slotContext.hasChildren}, archetype=${slotContext.primaryArchetype})`);
      
      // Derive schedule constraints (pace, walking, buffer times)
      const scheduleConstraints = deriveScheduleConstraints(
        traitScores,
        normalizedContext?.preferences?.mobilityNeeds || prefs?.mobility_needs
      );
      const scheduleConstraintsPrompt = buildScheduleConstraintsPrompt(scheduleConstraints);
      console.log(`[Stage 1.96] Schedule constraints: ${scheduleConstraints.minActivitiesPerDay}-${scheduleConstraints.maxActivitiesPerDay} activities/day, ${scheduleConstraints.bufferMinutesBetweenActivities}min buffers`);
      
      // Build explainability prompt
      const explainabilityContext: ExplainabilityContext = {
        interests: userInterests,
        foodLikes: prefs?.food_likes || [],
        foodDislikes: prefs?.food_dislikes || [],
        dietaryRestrictions: prefs?.dietary_restrictions || [],
        travelCompanions: prefs?.travel_companions || [],
        accommodationStyle: prefs?.accommodation_style,
        traits: {
          planning: traitScores.planning !== undefined ? { value: traitScores.planning, label: 'Planning' } : undefined,
          social: traitScores.social !== undefined ? { value: traitScores.social, label: 'Social' } : undefined,
          comfort: traitScores.comfort !== undefined ? { value: traitScores.comfort, label: 'Comfort' } : undefined,
          pace: traitScores.pace !== undefined ? { value: traitScores.pace, label: 'Pace' } : undefined,
          authenticity: traitScores.authenticity !== undefined ? { value: traitScores.authenticity, label: 'Authenticity' } : undefined,
          adventure: traitScores.adventure !== undefined ? { value: traitScores.adventure, label: 'Adventure' } : undefined,
          budget: traitScores.budget !== undefined ? { value: traitScores.budget, label: 'Budget' } : undefined,
          transformation: traitScores.transformation !== undefined ? { value: traitScores.transformation, label: 'Transformation' } : undefined,
        },
        tripIntents: context.tripType ? [context.tripType] : [],
        budgetTier: context.budgetTier,
        archetype: normalizedContext?.archetypes?.[0]?.name
      };
      const explainabilityPrompt = buildExplainabilityPrompt(explainabilityContext);
      
      // Build truth anchor prompt
      const truthAnchorPrompt = buildTruthAnchorPrompt();
      
      // =======================================================================
      // STAGE 1.97: Group Reconciliation (for multi-traveler trips)
      // =======================================================================
      let groupReconciliationPrompt = '';
      if (context.travelers > 1 && collaboratorPrefs.length > 0) {
        console.log("[Stage 1.97] Building group reconciliation rules...");
        
        // Build traveler profiles for reconciliation
        const travelerProfiles: TravelerProfile[] = [
          {
            id: userId || 'primary',
            name: 'Primary Traveler',
            traits: traitScores,
            interests: userInterests,
            dietaryRestrictions: prefs?.dietary_restrictions || [],
            mobilityNeeds: prefs?.mobility_needs,
            allergies: prefs?.allergies || [],
            isPrimary: true
          },
          ...collaboratorPrefs.map((cp: any, idx: number) => ({
            id: cp.user_id || `collab-${idx}`,
            name: `Traveler ${idx + 2}`,
            traits: cp.travel_dna?.trait_scores || {},
            interests: cp.interests || [],
            dietaryRestrictions: cp.dietary_restrictions || [],
            allergies: (cp as any).allergies || [],
            isPrimary: false
          }))
        ];
        
        const reconciliation = reconcileGroupPreferences(travelerProfiles);
        groupReconciliationPrompt = buildGroupReconciliationPrompt(travelerProfiles, reconciliation, 1);
        console.log(`[Stage 1.97] Group: ${reconciliation.hardConstraints.length} hard constraints, ${reconciliation.sharedOverlaps.length} shared interests`);
      }
      
      // =======================================================================
      // STAGE 1.98: Geographic Coherence - Zone clustering & travel constraints
      // =======================================================================
      console.log("[Stage 1.98] Building geographic coherence rules...");
      
      // Get curated zones for destination
      const cityZones = getCuratedZones(context.destination);
      if (cityZones) {
        console.log(`[Stage 1.98] Found ${cityZones.length} curated zones for ${context.destination}`);
      } else {
        console.log(`[Stage 1.98] No curated zones for ${context.destination}, will use geohash fallback`);
      }
      
      // Derive pace level from trait scores
      const paceScore = traitScores.pace || 0;
      const geoGraphicPaceLevel: 'relaxed' | 'balanced' | 'fast-paced' = 
        paceScore <= -2 ? 'relaxed' : paceScore >= 5 ? 'fast-paced' : 'balanced';
      
      // Get travel time constraints
      const travelConstraints = deriveTravelTimeConstraints(geoGraphicPaceLevel);
      console.log(`[Stage 1.98] Travel constraints (${geoGraphicPaceLevel}): max hop ${travelConstraints.maxHopMinutes}min, daily budget ${travelConstraints.maxDailyTransitMinutes}min`);
      
      // Get hotel neighborhood if available
      const hotelNeighborhood = flightHotelResult.context?.includes('Hotel:') 
        ? flightHotelResult.context.match(/Hotel:.*?in\s+([^,\n]+)/)?.[1]?.trim()
        : undefined;
      
      // Build geographic prompt
      const geographicPrompt = buildGeographicPrompt(
        context.destination,
        cityZones,
        hotelNeighborhood,
        travelConstraints
      );
      
      // Combine all context for maximum personalization
      // Order: Unified DNA context → raw prefs → enriched prefs → flight/hotel → LEARNINGS → RECENTLY USED → LOCAL EVENTS → NEW PERSONALIZATION MODULES → GEOGRAPHIC COHERENCE
      // NOTE: unifiedDNAContext includes budget intent, archetypes, blended traits, and deduplicated preferences
      const preferenceContext = unifiedDNAContext + rawPreferenceContext + enrichedPreferenceContext + flightHotelResult.context + tripLearningsContext + recentlyUsedContext + localEventsContext + coldStartContext + forcedSlotsPrompt + scheduleConstraintsPrompt + explainabilityPrompt + truthAnchorPrompt + groupReconciliationPrompt + geographicPrompt;

      // STAGE 2: AI Generation (batch with validation and retry)
      let aiResult;
      try {
        const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
        aiResult = await generateItineraryAI(context, preferenceContext, LOVABLE_API_KEY, flightHotelResult.context, supabase, perplexityApiKey);
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

      // =======================================================================
      // STAGE 2.6: Personalization Validation (Phase 3)
      // Validate itinerary against user preferences before saving
      // =======================================================================
      console.log("[Stage 2.6] Validating personalization compliance...");
      
      // Build validation context from available preferences
      const validationCtx = buildValidationContext(
        prefs || {},
        budgetIntent,
        travelDNA?.trait_scores || traitOverrides || {},
        [] // Trip intents loaded separately for full generation
      );
      
      const validationResult = validateItineraryPersonalization(aiResult.days, validationCtx);
      
      // Log validation results
      console.log(`[Stage 2.6] Personalization score: ${validationResult.personalizationScore}/100`);
      console.log(`[Stage 2.6] Stats: ${validationResult.stats.personalizationFieldsPresent}/${validationResult.stats.activitiesChecked} activities have personalization fields`);
      
      if (validationResult.violations.length > 0) {
        console.warn(`[Stage 2.6] Violations found: ${validationResult.violations.length}`);
        validationResult.violations.slice(0, 5).forEach(v => 
          console.warn(`  - [${v.severity}] ${v.type}: ${v.activityTitle} - ${v.details}`)
        );
      }
      
      // For now, log warnings but don't reject - we're gathering data on AI compliance
      // TODO: Enable rejection after baseline is established
      // if (!validationResult.isValid) {
      //   console.error("[Stage 2.6] VALIDATION FAILED - would trigger regeneration");
      // }

      // STAGE 3: Early Save (Critical - ensures user gets itinerary)
      await earlySaveItinerary(supabase, tripId, aiResult.days);

      // =======================================================================
      // STAGE 3.5: Geographic Validation & Reordering
      // =======================================================================
      console.log("[Stage 3.5] Validating geographic coherence...");
      
      const geoValidations: GeographicValidation[] = [];
      
      for (let dayIdx = 0; dayIdx < aiResult.days.length; dayIdx++) {
        const day = aiResult.days[dayIdx];
        
        // Convert activities to ActivityWithLocation format
        const activitiesWithLocation: ActivityWithLocation[] = day.activities.map((act: StrictActivity) => ({
          id: act.id,
          title: act.title,
          coordinates: act.location?.coordinates,
          neighborhood: act.location?.address?.split(',')[0],
          isLocked: (act as any).isLocked || false,
          category: act.category
        }));
        
        // Determine day anchor
        const dayAnchor = determineDayAnchor(activitiesWithLocation, undefined, hotelNeighborhood, cityZones);
        
        // Validate
        const validation = validateDayGeography(activitiesWithLocation, dayAnchor, travelConstraints, cityZones);
        geoValidations.push(validation);
        
        // If validation fails, try reordering
        if (!validation.isValid && validation.violations.some(v => v.type === 'backtracking' || v.type === 'long_hop')) {
          console.log(`[Stage 3.5] Day ${dayIdx + 1} failed validation (score: ${validation.score}), attempting reorder...`);
          const reordered = reorderActivitiesOptimally(activitiesWithLocation, dayAnchor);
          
          // Apply reordering to actual activities (preserve all data, just change order)
          const reorderedIds = reordered.map(a => a.id);
          day.activities = day.activities.sort((a: StrictActivity, b: StrictActivity) => {
            const aIdx = reorderedIds.indexOf(a.id);
            const bIdx = reorderedIds.indexOf(b.id);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          });
        }
      }
      
      // Log QA metrics
      logGeographicQAMetrics(geoValidations, tripId);

      // STAGE 4: Enrichment (real photos + venue verification via Google Places API v1)
      let enrichedDays: StrictDay[];
      let enrichmentStats: EnrichmentStats | null = null;
      try {
        const enrichmentResult = await enrichItinerary(aiResult.days, context.destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY);
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
      const { tripId, dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities, userId, keepActivities, currentActivities } = params;

      // =======================================================================
      // STEP 1: LOAD LOCKED ACTIVITIES **BEFORE** AI CALL
      // This is critical - we tell AI to skip these time slots entirely
      // =======================================================================
      interface LockedActivity {
        id: string;
        title: string;
        name?: string;
        description?: string;
        category?: string;
        startTime: string;
        endTime: string;
        durationMinutes?: number;
        location?: { name?: string; address?: string };
        cost?: { amount: number; currency: string };
        isLocked: boolean;
        tags?: string[];
        bookingRequired?: boolean;
        tips?: string;
        photos?: unknown;
        transportation?: unknown;
        [key: string]: unknown;
      }
      
      let lockedActivities: LockedActivity[] = [];
      
      // First, try to load locked activities from the normalized table
      if (tripId) {
        const { data: dayRow } = await supabase
          .from('itinerary_days')
          .select('id')
          .eq('trip_id', tripId)
          .eq('day_number', dayNumber)
          .maybeSingle();
        
        if (dayRow) {
          const { data: lockedFromDb } = await supabase
            .from('itinerary_activities')
            .select('*')
            .eq('trip_id', tripId)
            .eq('itinerary_day_id', dayRow.id)
            .eq('is_locked', true);
          
          if (lockedFromDb && lockedFromDb.length > 0) {
            lockedActivities = lockedFromDb.map(a => ({
              id: a.id,
              title: a.title,
              name: a.name || a.title,
              description: a.description || undefined,
              category: a.category || 'activity',
              startTime: a.start_time || '09:00',
              endTime: a.end_time || '10:00',
              durationMinutes: a.duration_minutes || 60,
              location: a.location as { name?: string; address?: string } || { name: '', address: '' },
              cost: a.cost as { amount: number; currency: string } || { amount: 0, currency: 'USD' },
              isLocked: true,
              tags: a.tags || [],
              bookingRequired: a.booking_required || false,
              tips: a.tips || undefined,
              photos: a.photos,
              transportation: a.transportation,
              // Preserve enriched data - DON'T re-fetch for locked activities
              rating: a.rating,
              website: a.website,
              viatorProductCode: a.viator_product_code,
              walkingDistance: a.walking_distance,
              walkingTime: a.walking_time,
            }));
            console.log(`[generate-day] Found ${lockedActivities.length} locked activities from DB for day ${dayNumber} (preserving existing enrichment)`);
          }
        }
      }
      
      // Fallback: check itinerary_data JSON for locked activities
      if (lockedActivities.length === 0 && tripId) {
        const { data: tripData } = await supabase
          .from('trips')
          .select('itinerary_data')
          .eq('id', tripId)
          .single();
        
        if (tripData?.itinerary_data) {
          const itineraryData = tripData.itinerary_data as { days?: Array<{ dayNumber: number; activities: Array<{ id: string; title?: string; name?: string; startTime?: string; endTime?: string; isLocked?: boolean; category?: string; location?: unknown; cost?: unknown; description?: string }> }> };
          const dayData = itineraryData.days?.find(d => d.dayNumber === dayNumber);
          if (dayData) {
            const lockedFromJson = dayData.activities.filter(a => a.isLocked);
            if (lockedFromJson.length > 0) {
              lockedActivities = lockedFromJson.map(a => ({
                id: a.id,
                title: a.title || a.name || 'Activity',
                name: a.name || a.title,
                description: a.description,
                category: a.category || 'activity',
                startTime: a.startTime || '09:00',
                endTime: a.endTime || '10:00',
                location: a.location as { name?: string; address?: string },
                cost: a.cost as { amount: number; currency: string },
                isLocked: true,
              }));
              console.log(`[generate-day] Found ${lockedActivities.length} locked activities from JSON for day ${dayNumber}`);
            }
          }
        }
      }
      
      // Legacy fallback: check currentActivities from request
      if (lockedActivities.length === 0 && keepActivities && keepActivities.length > 0 && currentActivities) {
        for (const act of currentActivities) {
          if (keepActivities.includes(act.id) && act.isLocked) {
            lockedActivities.push({
              id: act.id,
              title: act.title || act.name || 'Activity',
              name: act.name || act.title,
              description: act.description,
              category: act.category,
              startTime: act.startTime || '09:00',
              endTime: act.endTime || '10:00',
              durationMinutes: act.durationMinutes,
              location: act.location,
              cost: act.cost || act.estimatedCost,
              isLocked: true,
              tags: act.tags,
              bookingRequired: act.bookingRequired,
              tips: act.tips,
              photos: act.photos,
              transportation: act.transportation,
            });
          }
        }
        if (lockedActivities.length > 0) {
          console.log(`[generate-day] Preserving ${lockedActivities.length} locked activities from request (legacy)`);
        }
      }

      // =======================================================================
      // STEP 2: Build locked slots instruction for AI prompt
      // =======================================================================
      let lockedSlotsInstruction = '';
      if (lockedActivities.length > 0) {
        const lockedSlotsList = lockedActivities
          .sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0))
          .map(a => `- "${a.title}" from ${a.startTime} to ${a.endTime} (category: ${a.category})`)
          .join('\n');
        
        lockedSlotsInstruction = `
LOCKED ACTIVITIES - DO NOT REGENERATE THESE TIME SLOTS:
The user has locked the following activities. These are FIXED and CANNOT be changed.
You must NOT generate any activities that overlap with these time slots.
Plan activities ONLY for the available gaps between these locked blocks.

${lockedSlotsList}

Generate activities ONLY for the remaining unlocked time periods. 
DO NOT create any activity that starts or ends within a locked time slot.`;
        
        console.log(`[generate-day] Added ${lockedActivities.length} locked slots to AI prompt`);
      }

      // Get user preferences AND Travel DNA for personalization
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      const userPrefs = userId ? await getUserPreferences(supabase, userId) : null;
      const travelDNA = userId ? await getTravelDNAV2(supabase, userId) : null;
      
      // Build preference context (basic preferences)
      const basicPreferenceContext = buildPreferenceContext(insights, userPrefs);
      
      // Build Travel DNA context (archetypes, traits, budget intent) - CRITICAL for personalization
      const dnaResult = await buildTravelDNAContext(travelDNA, null, budgetTier, supabase, userId);
      const travelDNAContext = dnaResult.context;
      
      // Log personalization data for debugging
      if (travelDNA) {
        const archetypes = travelDNA.archetype_matches || travelDNA.travel_dna_v2?.archetype_matches;
        const primaryArchetype = Array.isArray(archetypes) ? archetypes[0]?.name : null;
        console.log(`[generate-day] Travel DNA loaded: archetype=${primaryArchetype}, traits=${JSON.stringify(travelDNA.trait_scores)}`);
      } else {
        console.log(`[generate-day] No Travel DNA profile found for user ${userId}`);
      }
      
      // Combine contexts: DNA context (archetypes, traits) + basic preferences
      const preferenceContext = travelDNAContext + '\n' + basicPreferenceContext;

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
      let flightContext = tripId ? await getFlightHotelContext(supabase, tripId) : { context: '' };
      const isFirstDay = dayNumber === 1;
      const isLastDay = dayNumber === totalDays;
      
      // IMPORTANT: Use preferences.arrivalTime/departureTime as fallback when DB doesn't have flight data
      // This handles the case where user entered times in ItineraryContextForm but hasn't saved flight_selection
      if (preferences?.arrivalTime && !flightContext.arrivalTime) {
        const arrival24 = normalizeTo24h(preferences.arrivalTime) || preferences.arrivalTime;
        const ARRIVAL_BUFFER_MINS = 4 * 60;
        const earliestActivity = minutesToHHMM((parseTimeToMinutes(arrival24) || 0) + ARRIVAL_BUFFER_MINS);
        
        flightContext = {
          ...flightContext,
          arrivalTime: preferences.arrivalTime,
          arrivalTime24: arrival24,
          earliestFirstActivityTime: earliestActivity,
          context: flightContext.context || `Flight arrives at ${preferences.arrivalTime}. Plan Day 1 activities after ${earliestActivity}.`,
        };
        console.log(`[generate-day] Using arrival time from preferences: ${preferences.arrivalTime}, earliest activity: ${earliestActivity}`);
      }
      
      if (preferences?.departureTime && !flightContext.returnDepartureTime) {
        const departure24 = normalizeTo24h(preferences.departureTime) || preferences.departureTime;
        const latestActivity = addMinutesToHHMM(departure24, -180);
        
        flightContext = {
          ...flightContext,
          returnDepartureTime: preferences.departureTime,
          returnDepartureTime24: departure24,
          latestLastActivityTime: latestActivity,
          context: (flightContext.context || '') + ` Return flight departs at ${preferences.departureTime}. Last activity must end by ${latestActivity}.`,
        };
        console.log(`[generate-day] Using departure time from preferences: ${preferences.departureTime}, latest activity: ${latestActivity}`);
      }
      
      console.log(`[generate-day] Day ${dayNumber}/${totalDays}, isFirst=${isFirstDay}, isLast=${isLastDay}, lockedCount=${lockedActivities.length}`);
      if (flightContext.arrivalTime) {
        console.log(`[generate-day] Flight arrival: ${flightContext.arrivalTime}, earliest activity: ${flightContext.earliestFirstActivityTime}`);
      }
      if (flightContext.returnDepartureTime) {
        console.log(`[generate-day] Return departure: ${flightContext.returnDepartureTime}, latest activity: ${flightContext.latestLastActivityTime}`);
      }

      // =========================================================================
      // SYSTEMATIC DECISION TREE FOR DAY CONSTRAINTS
      // Rule 1: Check Flight → Rule 2: Check Hotel → Rule 3: Apply TravelDNA
      // =========================================================================
      let dayConstraints = '';
      
      if (isFirstDay) {
        // ===== RULE 1: CHECK FLIGHT =====
        const hasFlightData = !!(flightContext.arrivalTime24 || flightContext.arrivalTime);
        
        // ===== RULE 2: CHECK HOTEL =====
        const hasHotelData = !!(flightContext.hotelName || flightContext.hotelAddress);
        
        console.log(`[Day1-Decision] Flight data: ${hasFlightData ? 'YES' : 'NO'}, Hotel data: ${hasHotelData ? 'YES' : 'NO'}`);
        
        if (hasFlightData) {
          // ===== FLIGHT PROVIDED: Use arrival time =====
          const arrival24 = flightContext.arrivalTime24 || normalizeTo24h(flightContext.arrivalTime!) || '18:00';
          const arrivalMins = parseTimeToMinutes(arrival24) ?? (18 * 60);
          
          // Categorize arrival time
          const isMorningArrival = arrivalMins < (12 * 60);      // Before noon
          const isAfternoonArrival = arrivalMins >= (12 * 60) && arrivalMins < (18 * 60); // Noon - 6 PM
          const isEveningArrival = arrivalMins >= (18 * 60);     // 6 PM or later
          
          // Calculate key times
          const customsClearance = addMinutesToHHMM(arrival24, 60);    // 1 hour for customs
          const transferStart = addMinutesToHHMM(arrival24, 75);      // After customs
          const transferEnd = addMinutesToHHMM(transferStart, 60);    // 1 hour transfer
          const hotelCheckIn = transferEnd;
          const settleInEnd = addMinutesToHHMM(hotelCheckIn, 30);     // 30 min to settle
          const earliestSightseeing = addMinutesToHHMM(settleInEnd, 30); // 30 min buffer
          
          // Hotel context for prompts
          const hotelNameDisplay = flightContext.hotelName || 'Selected Hotel';
          const hotelAddressDisplay = flightContext.hotelAddress || 'Hotel Address';
          
          console.log(`[Day1-Decision] Arrival at ${arrival24}: morning=${isMorningArrival}, afternoon=${isAfternoonArrival}, evening=${isEveningArrival}`);
          console.log(`[Day1-Decision] Timeline: customs=${customsClearance}, transfer=${transferStart}-${transferEnd}, checkin=${hotelCheckIn}, earliest activity=${earliestSightseeing}`);
          
          if (isMorningArrival) {
            // ===== MORNING ARRIVAL (before noon) =====
            // Consider: customs, jet lag, traveler profile (breakfast preference, rest needs)
            dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is a MORNING ARRIVAL - the traveler has likely been traveling overnight.

TRAVELER CONTEXT:
- The traveler has been on a long flight and may have jet lag
- They need to clear customs/immigration (estimate: 1 hour)
- Consider their energy level when planning activities

REQUIRED ACTIVITY SEQUENCE (in exact order):
1. "Arrival at Airport" 
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"

2. "Airport Transfer to Hotel"
   - startTime: "${transferStart}", endTime: "${transferEnd}"
   - category: "transport"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

3. "Hotel Check-in & Refresh"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - description: "Check in, freshen up, and get oriented to the area"

MORNING ARRIVAL GUIDELINES:
- After checking in (${settleInEnd}), the traveler may want a light breakfast or brunch near the hotel
- Consider their Travel DNA for pace preference - some may want to rest first, others to explore
- Start with LOW-ENERGY activities: a café, a leisurely neighborhood walk, or a nearby park
- Build energy throughout the day - save more intensive sightseeing for afternoon
- The traveler has a FULL DAY ahead - pace activities appropriately
- Earliest sightseeing/exploration: ${earliestSightseeing}

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
          } else if (isAfternoonArrival) {
            // ===== AFTERNOON ARRIVAL (noon to 6 PM) =====
            // Moderate energy, can do some light exploration
            dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is an AFTERNOON ARRIVAL.

REQUIRED ACTIVITY SEQUENCE (in exact order):
1. "Arrival at Airport"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"

2. "Airport Transfer to Hotel"
   - startTime: "${transferStart}", endTime: "${transferEnd}"
   - category: "transport"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

3. "Hotel Check-in"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - description: "Check in and freshen up"

AFTERNOON ARRIVAL GUIDELINES:
- After check-in (${settleInEnd}), plan 1-2 light activities
- Focus on the hotel neighborhood - nearby exploration, a café, or a walk
- End the day with a nice dinner near the hotel
- Earliest exploration: ${earliestSightseeing}
- Save major attractions for full days

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
          } else {
            // ===== EVENING ARRIVAL (6 PM or later) =====
            // Limited time, focus on logistics and rest
            dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is an EVENING ARRIVAL - limited time for activities today.

REQUIRED ACTIVITY SEQUENCE (in exact order):
1. "Arrival at Airport"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"

2. "Airport Transfer to Hotel"
   - startTime: "${transferStart}", endTime: "${transferEnd}"
   - category: "transport"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

3. "Hotel Check-in"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"

EVENING ARRIVAL GUIDELINES:
- Day 1 should ONLY include:
  * The 3 arrival activities above
  * OPTIONALLY: One dinner near the hotel (if time permits and traveler isn't exhausted)
- The traveler needs rest after a long journey
- NO intensive sightseeing on an evening arrival
- Maximum 4 activities total including the required sequence

DO NOT plan activities before ${arrival24}.`;
          }
        } else if (hasHotelData) {
          // ===== NO FLIGHT, BUT HOTEL PROVIDED =====
          // We know WHERE they're staying but not WHEN they arrive
          // Apply conservative assumptions based on standard check-in
          const defaultCheckIn = '15:00'; // Standard hotel check-in
          const settleInEnd = addMinutesToHHMM(defaultCheckIn, 30);
          const earliestActivity = addMinutesToHHMM(settleInEnd, 30);
          
          console.log(`[Day1-Decision] Hotel provided but no flight - using standard check-in (${defaultCheckIn})`);
          
          dayConstraints = `
HOTEL PROVIDED BUT ARRIVAL TIME UNKNOWN:
- Hotel: ${flightContext.hotelName}
- Address: ${flightContext.hotelAddress || 'Address on file'}

The traveler has a hotel but has NOT provided flight/arrival details.
We cannot assume morning availability.

SAFE ASSUMPTIONS:
- Standard hotel check-in: 3:00 PM (15:00)
- The traveler may be traveling to the destination during morning/early afternoon
- DO NOT schedule activities before 15:00

REQUIRED FIRST ACTIVITY:
1. "Hotel Check-in & Settle In"
   - startTime: "${defaultCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - location: { name: "${flightContext.hotelName}", address: "${flightContext.hotelAddress || 'Hotel Address'}" }

DAY 1 GUIDELINES:
- After check-in (${settleInEnd}), plan light afternoon activities
- Earliest sightseeing: ${earliestActivity}
- Focus on the hotel neighborhood
- End with dinner nearby
- This is an orientation day, not a full exploration day

DO NOT plan activities before ${defaultCheckIn}.`;
        } else {
          // ===== NO FLIGHT AND NO HOTEL =====
          // Apply most conservative "safe day one" assumptions
          console.log(`[Day1-Decision] No flight AND no hotel data - applying conservative defaults`);
          
          dayConstraints = `
⚠️ NO ARRIVAL OR HOTEL INFORMATION PROVIDED

The traveler has not specified:
- Flight arrival time
- Hotel/accommodation details

CONSERVATIVE DAY 1 APPROACH:
- We cannot assume the traveler is available in the morning
- We cannot assume a specific location to start from
- Apply maximum flexibility

SAFE ASSUMPTIONS:
- Assume arrival/check-in around 3:00 PM (15:00)
- DO NOT schedule any morning activities
- Start planning from 15:30 onwards
- Focus on flexible, central activities
- Plan activities that can be reached from any hotel location

STRUCTURE:
1. Activity 1 should start at 15:30 (allows for hotel check-in + settling)
2. Plan 2-3 light afternoon activities in central/accessible areas
3. End with dinner

DO NOT plan activities before 15:30 on Day 1.
The traveler may still be in transit during the morning.`;
        }
      } else if (isLastDay) {
        // ===== LAST DAY: DEPARTURE LOGIC =====
        const hasReturnFlight = !!(flightContext.returnDepartureTime || flightContext.returnDepartureTime24);
        const hasHotelData = !!(flightContext.hotelName || flightContext.hotelAddress);
        
        console.log(`[LastDay-Decision] Return flight: ${hasReturnFlight ? 'YES' : 'NO'}, Hotel: ${hasHotelData ? 'YES' : 'NO'}`);
        
        if (hasReturnFlight) {
          // ===== RETURN FLIGHT PROVIDED =====
          const departure24 = flightContext.returnDepartureTime24 || normalizeTo24h(flightContext.returnDepartureTime!) || '12:00';
          const departureMins = parseTimeToMinutes(departure24) ?? (12 * 60);
          
          // Calculate departure timeline
          const airportArrival = addMinutesToHHMM(departure24, -180);  // 3 hours before flight
          const transferStart = addMinutesToHHMM(airportArrival, -60); // 1 hour transfer
          const hotelCheckout = addMinutesToHHMM(transferStart, -30);  // 30 min to checkout
          const latestSightseeing = addMinutesToHHMM(hotelCheckout, -60); // 1 hour buffer for return
          
          const hotelNameDisplay = flightContext.hotelName || 'Hotel';
          
          // Determine if early or late departure
          const isEarlyDeparture = departureMins < (12 * 60); // Before noon
          const isMidDayDeparture = departureMins >= (12 * 60) && departureMins < (17 * 60); // Noon - 5 PM
          
          console.log(`[LastDay-Decision] Departure at ${departure24}: early=${isEarlyDeparture}, midday=${isMidDayDeparture}`);
          console.log(`[LastDay-Decision] Timeline: latestActivity=${latestSightseeing}, checkout=${hotelCheckout}, transfer=${transferStart}, airport=${airportArrival}`);
          
          dayConstraints = `
THE RETURN FLIGHT DEPARTS AT ${departure24} (${flightContext.returnDepartureTime || departure24}).
This is the LAST DAY - departure logistics are MANDATORY.

DEPARTURE TIMELINE (ENFORCED):
- Latest sightseeing must END by: ${latestSightseeing}
- Hotel checkout: ${hotelCheckout}
- Transfer to airport: ${transferStart}
- Arrive at airport: ${airportArrival} (3 hours before international flight)
- Flight departs: ${departure24}

${isEarlyDeparture ? `
EARLY DEPARTURE (before noon):
- Very limited time for activities
- Plan at MOST: breakfast near hotel, then checkout
- Focus on smooth departure, not sightseeing
` : isMidDayDeparture ? `
MID-DAY DEPARTURE:
- Plan 1-2 morning activities maximum
- Keep activities NEAR the hotel for easy return
- Leave buffer time for unexpected delays
` : `
AFTERNOON/EVENING DEPARTURE:
- Can include morning sightseeing and brunch
- All activities must end by ${latestSightseeing}
- Return to hotel with time to spare
`}

REQUIRED ENDING SEQUENCE (MUST appear in this order):
1. "Hotel Checkout"
   - startTime: "${hotelCheckout}", endTime: "${addMinutesToHHMM(hotelCheckout, 20)}"
   - category: "accommodation"
   - location: { name: "${hotelNameDisplay}" }

2. "Transfer to Airport"
   - startTime: "${transferStart}", endTime: "${airportArrival}"
   - category: "transport"

3. "Departure from Airport"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"
   - description: "Check-in, security, and boarding"

⚠️ DO NOT schedule ANY activities after ${latestSightseeing}.
⚠️ The departure sequence is NON-NEGOTIABLE.`;
        } else if (hasHotelData) {
          // ===== NO RETURN FLIGHT BUT HOTEL PROVIDED =====
          // Assume midday checkout, no airport constraints
          const defaultCheckout = '11:00'; // Standard checkout
          
          dayConstraints = `
LAST DAY - NO DEPARTURE TIME PROVIDED

The traveler has a hotel but hasn't specified a return flight.
Assume standard hotel checkout.

CHECKOUT GUIDELINES:
- Standard checkout time: ${defaultCheckout}
- Plan morning activities that return to hotel by ${addMinutesToHHMM(defaultCheckout, -60)}
- Include "Hotel Checkout" as an activity around ${defaultCheckout}
- After checkout, the traveler's plans are unknown

STRUCTURE:
1. Light morning activity (if time permits)
2. Return to hotel
3. "Hotel Checkout" at ${defaultCheckout}
4. You may suggest 1-2 activities after checkout, but keep them flexible`;
        } else {
          // ===== NO FLIGHT AND NO HOTEL =====
          dayConstraints = `
LAST DAY - NO DEPARTURE OR HOTEL INFORMATION

Plan a flexible last day:
- Start with morning activities
- Assume checkout around 11:00 AM
- Keep afternoon light and flexible
- The traveler may need to depart at any time`;
        }
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
${lockedSlotsInstruction}

General Requirements:
- Include FULL street addresses for all locations
- Provide realistic cost estimates in local currency
- Account for travel time between activities
- Include meals (breakfast, lunch, dinner as appropriate for the time of day)
- ONLY recommend restaurants and dining spots with 4+ star ratings - no low-quality or poorly-reviewed venues
- Every activity MUST have a "title" field (the display name)
- All times MUST be in 24-hour HH:MM format
${lockedActivities.length > 0 ? '- DO NOT generate activities for locked time slots listed above' : ''}`;

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
        let data: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
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

            const errorText = await response.text();
            console.error(`[generate-day] AI gateway error (attempt ${attempt}): ${status}`, errorText);

            // Retry transient 5xx
            if (attempt < 3 && status >= 500) {
              await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
              continue;
            }

            throw new Error("AI generation failed");
          }

          data = await response.json();

          // The gateway can sometimes return HTTP 200 with an error payload.
          if ((data as any)?.error) {
            console.error(`[generate-day] AI Gateway error payload (attempt ${attempt}):`, (data as any).error);
            const raw = (data as any).error?.message || 'Internal Server Error';
            const isTransient = raw === 'Internal Server Error' || (data as any).error?.code === 500;
            if (attempt < 3 && isTransient) {
              await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
              data = null;
              continue;
            }

            const msg = raw === 'Internal Server Error'
              ? 'AI service temporarily unavailable. Please try again in a moment.'
              : raw;
            throw new Error(`AI service error: ${msg}`);
          }

          break;
        }

        if (!data) {
          throw new Error('AI generation failed');
        }

        const message = data.choices?.[0]?.message;
        const toolCall = message?.tool_calls?.[0];

        let generatedDay;
        if (toolCall?.function?.arguments) {
          // Standard tool call response
          generatedDay = JSON.parse(toolCall.function.arguments);
        } else if (message?.content) {
          // Fallback: AI returned content instead of tool call
          console.log("[generate-day] AI returned content instead of tool_call, attempting to parse...");
          try {
            // Try to extract JSON from the content
            const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              generatedDay = JSON.parse(jsonMatch[0]);
            } else {
              console.error("[generate-day] No JSON found in content:", contentStr.substring(0, 500));
              throw new Error("Invalid AI response format - no JSON in content");
            }
          } catch (parseErr) {
            console.error("[generate-day] Failed to parse content as JSON:", parseErr);
            throw new Error("Invalid AI response format - content not parseable");
          }
        } else {
          console.error("[generate-day] Invalid AI response - no tool_calls or content:", JSON.stringify(data).substring(0, 1000));
          throw new Error("Invalid AI response format");
        }

        // Note: lockedActivities were already loaded BEFORE the AI call (see line ~4452-4565)
        // This ensures AI knows to skip those time slots, saving money and guaranteeing locks work

        // Normalize activities: ensure title exists, add IDs and enhancements
        let normalizedActivities = generatedDay.activities.map((act: { 
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
            categoryIcon: getCategoryIcon(act.category || 'activity'),
            isLocked: false, // New activities are unlocked by default
          };
        });

        // CRITICAL: Filter out activities that occur BEFORE arrival time on Day 1
        // This is a safety net in case the AI ignores the prompt constraints
        if (isFirstDay && flightContext.arrivalTime24) {
          const arrivalMins = parseTimeToMinutes(flightContext.arrivalTime24);
          if (arrivalMins !== null) {
            const beforeFilter = normalizedActivities.length;
            normalizedActivities = normalizedActivities.filter((act: { startTime?: string; category?: string; title?: string }) => {
              const actStart = parseTimeToMinutes(act.startTime || '00:00');
              if (actStart === null) return true;
              
              // Keep activities that start at or after arrival time
              // Exception: Allow "Arrival at Airport" type activities that match the arrival time
              const isArrivalActivity = (act.category === 'transport' || act.category === 'logistics') && 
                (act.title?.toLowerCase().includes('arrival') || act.title?.toLowerCase().includes('airport'));
              
              if (actStart < arrivalMins && !isArrivalActivity) {
                console.log(`[generate-day] FILTERED pre-arrival activity: "${act.title}" at ${act.startTime} (arrival is ${flightContext.arrivalTime24})`);
                return false;
              }
              return true;
            });
            
            if (normalizedActivities.length < beforeFilter) {
              console.log(`[generate-day] Removed ${beforeFilter - normalizedActivities.length} pre-arrival activities on Day 1`);
            }
          }
        }

        if (lockedActivities.length > 0) {
          // Remove any generated activities that conflict with locked activity times
          for (const locked of lockedActivities) {
            const lockedStart = parseTimeToMinutes(locked.startTime);
            const lockedEnd = parseTimeToMinutes(locked.endTime);
            
            if (lockedStart !== null && lockedEnd !== null) {
              // Filter out activities that overlap with locked ones
              normalizedActivities = normalizedActivities.filter((act: { startTime?: string; endTime?: string }) => {
                const actStart = parseTimeToMinutes(act.startTime || '00:00');
                const actEnd = parseTimeToMinutes(act.endTime || '23:59');
                if (actStart === null || actEnd === null) return true;
                
                // Check for overlap
                const overlaps = !(actEnd <= lockedStart || actStart >= lockedEnd);
                return !overlaps;
              });
            }
          }
          
          // Insert locked activities back and sort by time
          normalizedActivities = [...normalizedActivities, ...lockedActivities];
          normalizedActivities.sort((a: { startTime?: string }, b: { startTime?: string }) => {
            const aTime = parseTimeToMinutes(a.startTime || '00:00') ?? 0;
            const bTime = parseTimeToMinutes(b.startTime || '00:00') ?? 0;
            return aTime - bTime;
          });
          
          console.log(`[generate-day] Merged ${lockedActivities.length} locked activities, final count: ${normalizedActivities.length}`);
        }
        // =======================================================================
        // STEP: ENRICH NEW ACTIVITIES (ratings, photos, coordinates)
        // This ensures regenerated activities have the same rich data as initial generation
        // =======================================================================
        const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
        
        // Only enrich unlocked (newly generated) activities
        const activitiesToEnrich = normalizedActivities.filter((a: { isLocked?: boolean }) => !a.isLocked);
        const alreadyEnriched = normalizedActivities.filter((a: { isLocked?: boolean }) => a.isLocked);
        
        if (activitiesToEnrich.length > 0 && GOOGLE_MAPS_API_KEY) {
          console.log(`[generate-day] Enriching ${activitiesToEnrich.length} new activities with ratings/photos...`);
          
          // Enrich in parallel batches of 3 to avoid rate limits
          const batchSize = 3;
          const enrichedActivities: StrictActivity[] = [];
          
          for (let i = 0; i < activitiesToEnrich.length; i += batchSize) {
            const batch = activitiesToEnrich.slice(i, i + batchSize);
            const enrichedBatch = await Promise.all(
              batch.map(async (act: StrictActivity) => {
                try {
                  const result = await enrichActivityWithRetry(
                    act,
                    destination,
                    supabaseUrl,
                    supabaseKey,
                    GOOGLE_MAPS_API_KEY,
                    LOVABLE_API_KEY,
                    1 // maxRetries
                  );
                  return result.activity;
                } catch (e) {
                  console.log(`[generate-day] Enrichment failed for "${act.title}":`, e);
                  return act; // Return original if enrichment fails
                }
              })
            );
            enrichedActivities.push(...enrichedBatch);
          }
          
          // Merge enriched activities back with locked ones and sort by time
          normalizedActivities = [...enrichedActivities, ...alreadyEnriched];
          normalizedActivities.sort((a: { startTime?: string }, b: { startTime?: string }) => {
            const aTime = parseTimeToMinutes(a.startTime || '00:00') ?? 0;
            const bTime = parseTimeToMinutes(b.startTime || '00:00') ?? 0;
            return aTime - bTime;
          });
          
          const enrichedWithRatings = enrichedActivities.filter((a: { rating?: unknown }) => a.rating).length;
          console.log(`[generate-day] Enrichment complete: ${enrichedWithRatings}/${activitiesToEnrich.length} activities got ratings`);
        } else if (!GOOGLE_MAPS_API_KEY) {
          console.log('[generate-day] Skipping enrichment: GOOGLE_MAPS_API_KEY not configured');
        }

        generatedDay.activities = normalizedActivities;

        // Ensure day has a title
        generatedDay.title = generatedDay.title || generatedDay.theme || `Day ${dayNumber}`;

        // =======================================================================
        // PERSIST TO NORMALIZED TABLES: itinerary_days + itinerary_activities
        // =======================================================================
        if (tripId) {
          try {
            // Upsert day row
            const { data: dayRow, error: dayError } = await supabase
              .from('itinerary_days')
              .upsert({
                trip_id: tripId,
                day_number: dayNumber,
                date: date,
                title: generatedDay.title,
                theme: generatedDay.theme,
                narrative: generatedDay.narrative || null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'trip_id,day_number' })
              .select('id')
              .single();
            
            if (dayError) {
              console.error('[generate-day] Failed to upsert day:', dayError);
            } else if (dayRow) {
              // Delete old non-locked activities for this day, then insert new ones
              await supabase
                .from('itinerary_activities')
                .delete()
                .eq('itinerary_day_id', dayRow.id)
                .eq('is_locked', false);
              
              // Insert all activities.
              // IMPORTANT: The DB primary key is UUID, but the AI/frontend may produce ephemeral string IDs.
              // We store those in external_id and let the DB generate UUIDs, then we return UUIDs back to the client.
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              const isValidUUID = (str: string | undefined): boolean => !!str && uuidRegex.test(str);

              const makeRow = (
                act: {
                  id?: string;
                  title?: string;
                  name?: string;
                  description?: string;
                  category?: string;
                  startTime?: string;
                  endTime?: string;
                  durationMinutes?: number;
                  location?: { name?: string; address?: string };
                  cost?: { amount: number; currency: string };
                  isLocked?: boolean;
                  tags?: string[];
                  bookingRequired?: boolean;
                  tips?: string;
                  photos?: unknown;
                  walkingDistance?: string;
                  walkingTime?: string;
                  transportation?: unknown;
                  rating?: unknown;
                  website?: string;
                  viatorProductCode?: string;
                },
                idx: number
              ) => ({
                itinerary_day_id: dayRow.id,
                trip_id: tripId,
                sort_order: idx,
                title: act.title || act.name || 'Activity',
                name: act.name || act.title,
                description: act.description || null,
                category: act.category || 'activity',
                start_time: act.startTime || null,
                end_time: act.endTime || null,
                duration_minutes: act.durationMinutes || null,
                location: act.location || null,
                cost: act.cost || null,
                tags: act.tags || null,
                is_locked: act.isLocked || false,
                booking_required: act.bookingRequired || false,
                tips: act.tips || null,
                photos: act.photos || null,
                walking_distance: act.walkingDistance || null,
                walking_time: act.walkingTime || null,
                transportation: act.transportation || null,
                rating: act.rating || null,
                website: act.website || null,
                viator_product_code: act.viatorProductCode || null,
              });

              const uuidRows = normalizedActivities
                .filter((a: { id?: string }) => isValidUUID(a.id))
                .map((act: any, idx: number) => ({
                  id: act.id,
                  external_id: act.external_id || null,
                  ...makeRow(act, idx),
                }));

              const externalRows = normalizedActivities
                .filter((a: { id?: string }) => !isValidUUID(a.id))
                .map((act: any, idx: number) => ({
                  external_id: act.id || null,
                  ...makeRow(act, idx),
                }));

              // 1) Preserve/update UUID-based activities (e.g., locked activities already in DB)
              if (uuidRows.length > 0) {
                const { error: uuidErr } = await supabase
                  .from('itinerary_activities')
                  .upsert(uuidRows, { onConflict: 'id' });
                if (uuidErr) {
                  console.error('[generate-day] Failed to upsert UUID activities:', uuidErr);
                }
              }

              // 2) Upsert external-id based activities (newly generated)
              let persistedExternal: Array<{ id: string; external_id: string | null; is_locked: boolean | null }> = [];
              if (externalRows.length > 0) {
                const { data, error: extErr } = await supabase
                  .from('itinerary_activities')
                  .upsert(externalRows, { onConflict: 'trip_id,itinerary_day_id,external_id' })
                  .select('id, external_id, is_locked');
                if (extErr) {
                  console.error('[generate-day] Failed to upsert external-id activities:', extErr);
                } else {
                  persistedExternal = (data || []) as any;
                }
              }

              // Update the returned payload to use DB UUID ids (so future lock toggles + regen are stable)
              if (persistedExternal.length > 0) {
                const map = new Map(
                  persistedExternal
                    .filter(r => r.external_id)
                    .map(r => [r.external_id as string, r])
                );

                normalizedActivities = normalizedActivities.map((act: any) => {
                  if (isValidUUID(act.id)) return act;
                  const row = act.id ? map.get(act.id) : undefined;
                  if (!row) return act;
                  return {
                    ...act,
                    id: row.id,
                    isLocked: row.is_locked ?? act.isLocked,
                  };
                });

                // Ensure the response day uses the updated IDs
                generatedDay.activities = normalizedActivities;
              }

              console.log(
                `[generate-day] Persisted activities to itinerary_activities (uuid=${uuidRows.length}, external=${externalRows.length})`
              );
            }
          } catch (persistErr) {
            console.error('[generate-day] Persist error:', persistErr);
          }
        }

        // Save version to itinerary_versions table for undo functionality
        if (tripId) {
          try {
            const { error: versionError } = await supabase
              .from('itinerary_versions')
              .insert({
                trip_id: tripId,
                day_number: dayNumber,
                activities: generatedDay.activities,
                day_metadata: {
                  title: generatedDay.title,
                  theme: generatedDay.theme,
                  narrative: generatedDay.narrative,
                },
                created_by_action: action === 'regenerate-day' ? 'regenerate' : 'generate',
              });
            
            if (versionError) {
              console.error('[generate-day] Failed to save version:', versionError);
            } else {
              console.log('[generate-day] Saved version for day', dayNumber);
            }
          } catch (vErr) {
            console.error('[generate-day] Version save error:', vErr);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            day: generatedDay,
            dayNumber,
            totalDays,
            usedPersonalization: !!preferenceContext,
            flightAware: !!(flightContext.arrivalTime || flightContext.returnDepartureTime),
            preservedLocked: lockedActivities.length,
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

    // ==========================================================================
    // ACTION: toggle-activity-lock - Toggle lock on a single activity
    // ==========================================================================
    if (action === 'toggle-activity-lock') {
      const { tripId, activityId, isLocked, dayNumber, activityTitle, startTime } = params;
      
      if (!tripId || !activityId || typeof isLocked !== 'boolean') {
        return new Response(
          JSON.stringify({ error: "Missing tripId, activityId, or isLocked" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: trip } = await supabase
        .from('trips')
        .select('user_id')
        .eq('id', tripId)
        .single();
      
      if (!trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const isOwner = trip.user_id === authResult.userId;
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('permission')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const hasEditPermission = collab && (collab.permission === 'edit' || collab.permission === 'admin');
      
      if (!isOwner && !hasEditPermission) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Helper to check if a string is a valid UUID
      const isValidUUID = (str: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      let updateError: { message?: string; code?: string } | null = null;
      let updatedCount = 0;

      // Helper: best-effort fallback to set lock inside trips.itinerary_data JSON
      const tryUpdateLockInJson = async (): Promise<boolean> => {
        const { data: tripData, error: fetchErr } = await supabase
          .from('trips')
          .select('itinerary_data')
          .eq('id', tripId)
          .single();

        if (fetchErr || !tripData?.itinerary_data) return false;

        const itineraryData = tripData.itinerary_data as {
          days?: Array<{ dayNumber: number; activities: Array<{ id: string; isLocked?: boolean }> }>;
        };
        if (!itineraryData.days) return false;

        let found = false;
        const updatedDays = itineraryData.days.map(day => ({
          ...day,
          activities: day.activities.map(act => {
            if (act.id === activityId) {
              found = true;
              return { ...act, isLocked };
            }
            return act;
          })
        }));

        if (!found) return false;

        const { error: saveErr } = await supabase
          .from('trips')
          .update({ itinerary_data: { ...itineraryData, days: updatedDays } })
          .eq('id', tripId);

        return !saveErr;
      };

      if (isValidUUID(activityId)) {
        // Direct UUID update
        const { error, count } = await supabase
          .from('itinerary_activities')
          .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
          .eq('id', activityId)
          .eq('trip_id', tripId);
        
        updateError = error;
        updatedCount = count ?? 0;
      } else {
        // Fallback: match by trip + day + title + time (for ephemeral frontend IDs)
        console.log(`[toggle-activity-lock] Non-UUID activityId: ${activityId}, using fallback match`);
        
        if (!dayNumber || !activityTitle) {
          // Try to update in itinerary_data JSON as fallback
          const { data: tripData, error: fetchErr } = await supabase
            .from('trips')
            .select('itinerary_data')
            .eq('id', tripId)
            .single();
          
          if (!fetchErr && tripData?.itinerary_data) {
            const itineraryData = tripData.itinerary_data as { days?: Array<{ dayNumber: number; activities: Array<{ id: string; isLocked?: boolean }> }> };
            if (itineraryData.days) {
              let found = false;
              const updatedDays = itineraryData.days.map(day => ({
                ...day,
                activities: day.activities.map(act => {
                  if (act.id === activityId) {
                    found = true;
                    return { ...act, isLocked };
                  }
                  return act;
                })
              }));
              
              if (found) {
                const { error: saveErr } = await supabase
                  .from('trips')
                  .update({ itinerary_data: { ...itineraryData, days: updatedDays } })
                  .eq('id', tripId);
                
                if (!saveErr) {
                  console.log(`[toggle-activity-lock] Updated lock in itinerary_data JSON for ${activityId}`);
                  return new Response(
                    JSON.stringify({ success: true, activityId, isLocked, method: 'json' }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            }
          }
          
          return new Response(
            JSON.stringify({ error: "Cannot match activity without dayNumber and activityTitle for non-UUID IDs" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // First try the normalized tables
        const { data: dayRow } = await supabase
          .from('itinerary_days')
          .select('id')
          .eq('trip_id', tripId)
          .eq('day_number', dayNumber)
          .maybeSingle();
        
        if (!dayRow) {
          // Day not in normalized table - fall back to JSON update
          console.log(`[toggle-activity-lock] Day ${dayNumber} not in normalized table, falling back to JSON`);
          
          const { data: tripData, error: fetchErr } = await supabase
            .from('trips')
            .select('itinerary_data')
            .eq('id', tripId)
            .single();
          
          if (!fetchErr && tripData?.itinerary_data) {
            const itineraryData = tripData.itinerary_data as { days?: Array<{ dayNumber: number; activities: Array<{ id: string; isLocked?: boolean }> }> };
            if (itineraryData.days) {
              let found = false;
              const updatedDays = itineraryData.days.map(day => ({
                ...day,
                activities: day.activities.map(act => {
                  if (act.id === activityId) {
                    found = true;
                    return { ...act, isLocked };
                  }
                  return act;
                })
              }));
              
              if (found) {
                const { error: saveErr } = await supabase
                  .from('trips')
                  .update({ itinerary_data: { ...itineraryData, days: updatedDays } })
                  .eq('id', tripId);
                
                if (!saveErr) {
                  console.log(`[toggle-activity-lock] Updated lock in itinerary_data JSON for ${activityId}`);
                  return new Response(
                    JSON.stringify({ success: true, activityId, isLocked, method: 'json' }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            }
          }
          
          return new Response(
            JSON.stringify({ error: `Activity not found for day ${dayNumber}` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prefer matching by external_id (frontend ephemeral id) if present in DB
        const { data: actByExternal } = await supabase
          .from('itinerary_activities')
          .select('id')
          .eq('itinerary_day_id', dayRow.id)
          .eq('trip_id', tripId)
          .eq('external_id', activityId)
          .maybeSingle();

        if (actByExternal?.id) {
          const { error, count } = await supabase
            .from('itinerary_activities')
            .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
            .eq('id', actByExternal.id)
            .eq('trip_id', tripId);
          updateError = error;
          updatedCount = count ?? 0;
          console.log(`[toggle-activity-lock] Matched by external_id, updated id=${actByExternal.id}`);
        } else {
          // Fallback match by day + title + optional start_time
          let query = supabase
            .from('itinerary_activities')
            .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
            .eq('itinerary_day_id', dayRow.id)
            .eq('trip_id', tripId)
            .eq('title', activityTitle);
          
          if (startTime) {
            query = query.eq('start_time', startTime);
          }

          const { error, count } = await query;
          updateError = error;
          updatedCount = count ?? 0;
          
          console.log(`[toggle-activity-lock] Fallback match: day=${dayNumber}, title="${activityTitle}", time=${startTime}, updated=${updatedCount}`);
        }

        // If nothing was updated, the UI has an activity that isn't yet normalized.
        // Create the per-activity row from itinerary_data and lock it (also update JSON so both stores stay consistent).
        if (!updateError && updatedCount === 0) {
          const { data: tripData, error: fetchErr } = await supabase
            .from('trips')
            .select('itinerary_data')
            .eq('id', tripId)
            .single();

          if (!fetchErr && tripData?.itinerary_data) {
            const itineraryData = tripData.itinerary_data as {
              days?: Array<{ dayNumber: number; activities?: any[] }>;
            };
            const dayData = itineraryData.days?.find(d => d.dayNumber === dayNumber);
            const activities = (dayData?.activities || []) as any[];
            const idx = activities.findIndex(a => a?.id === activityId);
            const act = idx >= 0 ? activities[idx] : null;

            if (act) {
              const payload = {
                trip_id: tripId,
                itinerary_day_id: dayRow.id,
                external_id: activityId,
                sort_order: idx,
                title: act.title || act.name || activityTitle,
                name: act.name || act.title || activityTitle,
                description: act.description ?? null,
                category: act.category ?? null,
                start_time: act.startTime ?? startTime ?? null,
                end_time: act.endTime ?? null,
                duration_minutes: act.durationMinutes ?? null,
                location: act.location ?? null,
                cost: act.cost ?? act.estimatedCost ?? null,
                tags: act.tags ?? [],
                is_locked: isLocked,
                booking_required: act.bookingRequired ?? false,
                tips: act.tips ?? null,
                photos: act.photos ?? null,
                transportation: act.transportation ?? null,
              };

              const { error: insertErr } = await supabase
                .from('itinerary_activities')
                .insert(payload);

              if (!insertErr) {
                console.log(`[toggle-activity-lock] Inserted activity row from itinerary_data external_id=${activityId} locked=${isLocked}`);
                // Best-effort keep JSON in sync
                await tryUpdateLockInJson();
                return new Response(
                  JSON.stringify({ success: true, activityId, isLocked, method: 'insert_from_json' }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          }

          // Last resort: at least persist lock in JSON if we can.
          const jsonOk = await tryUpdateLockInJson();
          if (jsonOk) {
            console.log(`[toggle-activity-lock] Updated lock in itinerary_data JSON for ${activityId} (no normalized match)`);
            return new Response(
              JSON.stringify({ success: true, activityId, isLocked, method: 'json_fallback' }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ error: 'Activity not found to lock (no normalized match and JSON update failed)' }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      if (updateError) {
        console.error('[toggle-activity-lock] Update error:', updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update lock status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[toggle-activity-lock] Activity ${activityId} is_locked=${isLocked}, rows updated: ${updatedCount}`);

      // Keep itinerary_data JSON in sync when we successfully updated a normalized record.
      if (!updateError && updatedCount > 0) {
        await tryUpdateLockInJson();
      }
      
      return new Response(
        JSON.stringify({ success: true, activityId, isLocked, updatedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: sync-itinerary-tables - Migrate JSON itinerary_data to normalized tables
    // ==========================================================================
    if (action === 'sync-itinerary-tables') {
      const { tripId } = params;
      
      if (!tripId) {
        return new Response(
          JSON.stringify({ error: "Missing tripId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: trip } = await supabase
        .from('trips')
        .select('user_id, itinerary_data')
        .eq('id', tripId)
        .single();
      
      if (!trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const isOwner = trip.user_id === authResult.userId;
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('permission')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const hasEditPermission = collab && (collab.permission === 'edit' || collab.permission === 'admin');
      
      if (!isOwner && !hasEditPermission) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const itineraryData = trip.itinerary_data as { days?: unknown[] } | null;
      const days = itineraryData?.days || [];
      
      if (days.length === 0) {
        return new Response(
          JSON.stringify({ success: true, synced: 0, message: "No days to sync" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let syncedActivities = 0;
      
      for (const dayData of days) {
        const d = dayData as {
          dayNumber?: number;
          date?: string;
          title?: string;
          theme?: string;
          description?: string;
          narrative?: unknown;
          activities?: unknown[];
        };
        
        const dayNumber = d.dayNumber || 1;
        const date = d.date || new Date().toISOString().split('T')[0];
        
        // Upsert day
        const { data: dayRow, error: dayError } = await supabase
          .from('itinerary_days')
          .upsert({
            trip_id: tripId,
            day_number: dayNumber,
            date: date,
            title: d.title || d.theme,
            theme: d.theme,
            description: d.description || null,
            narrative: d.narrative || null,
          }, { onConflict: 'trip_id,day_number' })
          .select('id')
          .single();
        
        if (dayError || !dayRow) {
          console.error(`[sync-itinerary-tables] Failed to upsert day ${dayNumber}:`, dayError);
          continue;
        }
        
        const activities = d.activities || [];
        const activityRows = activities.map((act: unknown, idx: number) => {
          const a = act as {
            id?: string;
            title?: string;
            name?: string;
            description?: string;
            category?: string;
            startTime?: string;
            endTime?: string;
            start_time?: string;
            end_time?: string;
            durationMinutes?: number;
            location?: { name?: string; address?: string };
            cost?: { amount: number; currency: string };
            isLocked?: boolean;
            tags?: string[];
            bookingRequired?: boolean;
            booking_required?: boolean;
            tips?: string;
            photos?: unknown;
            walking_distance?: string;
            walking_time?: string;
            transportation?: unknown;
            rating?: unknown;
            website?: string;
            viatorProductCode?: string;
          };
          
          return {
            id: a.id || `sync-${tripId}-${dayNumber}-${idx}-${Date.now()}`,
            itinerary_day_id: dayRow.id,
            trip_id: tripId,
            sort_order: idx,
            title: a.title || a.name || 'Activity',
            name: a.name || a.title,
            description: a.description || null,
            category: a.category || 'activity',
            start_time: a.startTime || a.start_time || null,
            end_time: a.endTime || a.end_time || null,
            duration_minutes: a.durationMinutes || null,
            location: a.location || null,
            cost: a.cost || null,
            tags: a.tags || null,
            is_locked: a.isLocked || false, // Preserve existing lock state from JSON
            booking_required: a.bookingRequired || a.booking_required || false,
            tips: a.tips || null,
            photos: a.photos || null,
            walking_distance: a.walking_distance || null,
            walking_time: a.walking_time || null,
            transportation: a.transportation || null,
            rating: a.rating || null,
            website: a.website || null,
            viator_product_code: a.viatorProductCode || null,
          };
        });
        
        if (activityRows.length > 0) {
          const { error: actError } = await supabase
            .from('itinerary_activities')
            .upsert(activityRows, { onConflict: 'id' });
          
          if (actError) {
            console.error(`[sync-itinerary-tables] Failed to insert activities for day ${dayNumber}:`, actError);
          } else {
            syncedActivities += activityRows.length;
          }
        }
      }

      console.log(`[sync-itinerary-tables] Synced ${days.length} days, ${syncedActivities} activities`);
      
      return new Response(
        JSON.stringify({ success: true, syncedDays: days.length, syncedActivities }),
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
