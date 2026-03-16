import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost, CostTracker } from "../_shared/cost-tracker.ts";

// =============================================================================
// EXTRACTED ACTION HANDLERS — Each action in its own file with explicit params
// =============================================================================
import { handleGetTrip } from './action-get-trip.ts';
import { handleSaveItinerary } from './action-save-itinerary.ts';
import { handleGetItinerary } from './action-get-itinerary.ts';
import { handleToggleActivityLock } from './action-toggle-lock.ts';
import { handleSyncItineraryTables } from './action-sync-tables.ts';
import { handleRepairTripCosts } from './action-repair-costs.ts';
import { handleGenerateTrip } from './action-generate-trip.ts';
import { handleGenerateTripDay } from './action-generate-trip-day.ts';
import type { ActionContext } from './action-types.ts';

// =============================================================================
// EXTRACTED MODULES — Reduce bundle size for deploy
// =============================================================================
import {
  sanitizeDateString,
  sanitizeOptionFields,
  sanitizeAITextField,
  sanitizeGeneratedDay,
  sanitizeDateFields,
} from './sanitization.ts';

import {
  EXCHANGE_RATES_TO_USD,
  convertToUSD,
  normalizeCostToUSD,
  deriveIntelligenceFields,
  isRecurringEvent,
} from './currency-utils.ts';

import {
  buildSkipListPrompt,
  BUDGET_TRAIT_POLARITY,
  COMFORT_TRAIT_POLARITY,
  deriveBudgetIntent,
  buildBudgetConstraintsBlock,
  buildArchetypeConstraintsBlock as buildArchetypeConstraintsBlockLocal,
  formatGenerationRules,
  type BudgetIntent,
  type BudgetTierLevel,
  type SpendStyle,
} from './budget-constraints.ts';

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
  validateOpeningHours,
  type TruthAnchor,
  type OpeningHoursViolation
} from './truth-anchors.ts';

import {
  generateExplanation,
  validateExplanation,
  buildExplainabilityPrompt,
  type ExplainabilityContext,
  type Explanation
} from './explainability.ts';

// NOTE: cold-start.ts and feedback-instrumentation.ts were removed in cleanup phase.
// Cold start detection is now handled by profile-loader.ts dataCompleteness field.
// Feedback instrumentation was unused (empty tables).

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
  buildTransitionDayPrompt,
  buildFlightIntelligencePrompt,
  type FlightData as PromptFlightData,
  type HotelData as PromptHotelData,
  type TravelerDNA,
  type TripContext as PromptTripContext,
  type DayConstraints
} from './prompt-library.ts';

// =============================================================================
// MEAL POLICY — Dynamic meal requirements per day shape
// =============================================================================
import {
  deriveMealPolicy,
  buildMealRequirementsPrompt,
  type MealPolicy,
  type MealPolicyInput,
  type RequiredMeal,
} from './meal-policy.ts';

// =============================================================================
// PHASE 15: DYNAMIC DIETARY ENFORCEMENT ENGINE
// =============================================================================
import {
  buildDietaryEnforcementPrompt,
  expandDietaryAvoidList,
  checkDietaryViolations,
  getMaxDietarySeverity,
  type DietaryViolation
} from './dietary-rules.ts';

// =============================================================================
// PHASE 12: Trip Duration + Reservation Urgency + Children Ages
// =============================================================================
import {
  getTripDurationConfig,
  calculateDayEnergies,
  buildTripDurationPrompt,
  analyzeChildrenAges,
  buildChildrenAgesPrompt,
} from './trip-duration-rules.ts';

import {
  buildReservationUrgencyPrompt,
} from './reservation-urgency.ts';

// =============================================================================
// PHASE 2: Advanced Temporal & Environmental Intelligence
// =============================================================================
import {
  calculateJetLagImpact,
  buildJetLagPrompt,
  resolveTimezone,
} from './jet-lag-calculator.ts';

import {
  buildWeatherBackupPrompt,
  determineSeason,
} from './weather-backup.ts';

import {
  buildDailyEstimatesPrompt,
} from './daily-estimates.ts';

// =============================================================================
// PHASE 3: Premium Features - Group, Commitments, Must-Dos, Packing
// =============================================================================
import {
  blendGroupArchetypes,
  blendTraitScores,
  type TravelerArchetype,
} from './group-archetype-blending.ts';

import {
  analyzePreBookedCommitments,
  type PreBookedCommitment,
} from './pre-booked-commitments.ts';

import {
  parseMustDoInput,
  scheduleMustDos,
  buildMustHavesConstraintPrompt,
  getBlockedTimeRange,
  validateMustDosInItinerary,
  type MustDoPriority,
  type ScheduledMustDo,
  type ActivityType,
} from './must-do-priorities.ts';

import {
  generatePackingSuggestions,
} from './packing-suggestions.ts';

// =============================================================================
// PHASE 13: UNIFIED ARCHETYPE DATA - Single Source of Truth for All Archetype Info
// Merges: archetype-constraints.ts + experience-affinity.ts + destination-guides.ts
// =============================================================================
import {
  getFullArchetypeContext,
  buildFullPromptGuidance,
  buildFullPromptGuidanceAsync,
  getMaxActivities,
  isSpaOK,
  isMichelinOK,
  needsUnscheduledTime,
  // Re-exports for backward compatibility during migration
  buildAllConstraints,
  buildArchetypeConstraintsBlock as buildArchetypeConstraintsBlockNew,
  buildBudgetConstraints as buildBudgetConstraintsNew,
  buildTripWideVarietyRules,
  buildUnscheduledTimeRules,
  buildPacingRules,
  buildNamingRules,
  getArchetypeDefinition,
  buildExperienceGuidancePrompt,
  getExperienceAffinity,
  getTimePreferences,
  getEnvironmentPreferences,
  getPhysicalIntensity,
  buildDestinationGuidancePrompt,
  hasDestinationGuide,
  getArchetypeDestinationGuide,
  // New dynamic attraction matching (Phase 14)
  getMatchingAttractions,
  getOrGenerateArchetypeGuide,
  buildMatchedAttractionsPrompt,
  buildArchetypeGuidePrompt,
  EXPERIENCE_CATEGORIES,
} from './archetype-data.ts';

// =============================================================================
// PHASE 14: TRIP TYPE MODIFIERS - First-class input for celebration/group/purpose trips
// =============================================================================
import {
  buildTripTypePromptSection,
  getTripTypeModifier,
  getTripTypeInteraction,
} from './trip-type-modifiers.ts';

// =============================================================================
// PHASE 13B: UNIFIED PROFILE LOADER - Single Source of Truth for Traveler Data
// =============================================================================
import {
  loadTravelerProfile,
  type TravelerProfile as UnifiedTravelerProfile,
  type TraitScores as UnifiedTraitScores,
  type BudgetTier,
} from './profile-loader.ts';

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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// sanitization functions moved to ./sanitization.ts

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface MultiCityDayInfo {
  cityName: string;
  country?: string;
  isTransitionDay: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  transportType?: string;
  // Per-city hotel info for prompt injection
  hotelName?: string;
  hotelAddress?: string;
  hotelNeighborhood?: string;
  hotelCheckIn?: string;
  hotelCheckOut?: string;
  isFirstDayInCity?: boolean;
  isLastDayInCity?: boolean;
}

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
  childrenAges?: number[]; // Specific ages of children for toddler/teen logic
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
  dailyBudget?: number;
  /** Actual user-set total budget in cents (from trip settings), null if not set */
  budgetTotalCents?: number | null;
  /** Computed actual daily budget per person from user-set budget */
  actualDailyBudgetPerPerson?: number | null;
  currency?: string;
  // Phase 9: Full DNA injection for prompt library
  travelerDNA?: TravelerDNA;
  flightData?: PromptFlightData;
  hotelData?: PromptHotelData;
  // Phase 12: First-time visitor detection
  isFirstTimeVisitor?: boolean;
  firstTimePerCity?: Record<string, boolean>;
  // Phase 2: Advanced temporal intelligence
  originCity?: string;
  destinationTimezone?: string;
  jetLagSensitivity?: 'low' | 'moderate' | 'high';
  // Phase 3: Premium features
  preBookedCommitments?: PreBookedCommitment[];
  mustDoActivities?: string;
  additionalNotes?: string;
  interestCategories?: string[];
  mustHaves?: Array<{label: string; notes?: string}>;
  generationRules?: Array<{type: string; days?: string[]; from?: string; to?: string; reason?: string; date?: string; description?: string; hotelName?: string; additionalGuests?: number; note?: string; text?: string}>;
  /** Whether this generation is triggered by Smart Finish enrichment mode */
  isSmartFinish?: boolean;
  /** Smart Finish was requested for this trip (anchors must still be preserved) */
  smartFinishRequested?: boolean;
  /** Trip vibe/intent extracted from pasted text (e.g. "foodie adventure") */
  tripVibe?: string;
  /** Specific trip priorities extracted from pasted text */
  tripPriorities?: string[];
  /** User constraints from chat planner (full-day events, time blocks, preferences) */
  userConstraints?: Array<{type: string; description: string; day?: number; time?: string; allDay?: boolean}>;
  /** Flight details from chat planner */
  flightDetails?: string;
  groupArchetypes?: TravelerArchetype[];
  // Collaborator user IDs and names for suggestedFor attribution
  collaboratorTravelers?: Array<{ userId: string; name: string }>;
  // Blended DNA snapshot for saving to trip record
  blendedDnaSnapshot?: Record<string, unknown> | null;
  // Celebration day: User-specified day for birthday/anniversary celebration (1-indexed)
  celebrationDay?: number;
  // Multi-city support
  isMultiCity?: boolean;
  multiCityDayMap?: MultiCityDayInfo[];
  // Pre-fetched venue operating hours from verified_venues cache
  venueHoursCache?: Array<{ name: string; opening_hours: string[] }>;
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
  /** Traveler ID whose preferences most influenced this activity (group trips) */
  suggestedFor?: string;
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
  /** Hidden gem discovered through deep research */
  isHiddenGem?: boolean;
  /** Timing hack - scheduling at this time provides a meaningful advantage */
  hasTimingHack?: boolean;
  /** Why this time slot is optimal */
  bestTime?: string;
  /** Expected crowd level at the scheduled time */
  crowdLevel?: 'low' | 'moderate' | 'high';
  /** A unique Voyance-only insight */
  voyanceInsight?: string;
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
  accommodationNotes?: string[];
  practicalTips?: string[];
  // Multi-city tags
  city?: string;
  country?: string;
  isTransitionDay?: boolean;
  transitionFrom?: string;
  transitionTo?: string;
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

// currency-utils, intelligence fields, and isRecurringEvent moved to ./currency-utils.ts


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
      if (seenActivities.has(activityKey) && !isRecurringEvent(activity, ctx.mustDoActivities || [])) {
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
      
      // Check dietary restrictions using dynamic enforcement engine
      if (activity.category === 'dining') {
        const dietaryViolations = checkDietaryViolations(
          activity.title,
          activity.description || '',
          activity.tags || [],
          ctx.dietaryRestrictions
        );
        
        for (const dv of dietaryViolations) {
          // Map dietary severity to validation severity
          const severity = dv.severity === 'critical' ? 'critical' : 'major';
          
          violations.push({
            type: 'dietary',
            activityId: activity.id,
            activityTitle: activity.title,
            dayNumber: day.dayNumber,
            details: `${dv.violationType === 'cuisine' ? 'Venue type' : 'Ingredient'} "${dv.violatedTerm}" violates ${dv.ruleName} restriction`,
            severity
          });
        }
        
        // Also check non-dining activities that might serve food (tours, experiences)
      } else if (['tour', 'experience', 'cultural'].includes(activity.category)) {
        // Lighter check for non-dining but still important
        const dietaryViolations = checkDietaryViolations(
          activity.title,
          activity.description || '',
          activity.tags || [],
          ctx.dietaryRestrictions
        );
        
        // Only warn for non-dining activities
        for (const dv of dietaryViolations) {
          if (dv.severity === 'critical') {
            // Critical allergies still matter for tours (e.g., food tours, cooking classes)
            violations.push({
              type: 'dietary',
              activityId: activity.id,
              activityTitle: activity.title,
              dayNumber: day.dayNumber,
              details: `Activity mentions "${dv.violatedTerm}" which may conflict with ${dv.ruleName} (critical)`,
              severity: 'major'
            });
          } else {
            warnings.push({
              type: 'dietary_concern',
              message: `"${activity.title}" mentions "${dv.violatedTerm}" - verify compatibility with ${dv.ruleName}`,
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

// =============================================================================
// DESTINATION ID LOOKUP HELPER
// Resolves city name to destination UUID for dynamic feature matching
// =============================================================================
async function getDestinationId(supabase: any, destination: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('id')
      .or(`city.ilike.%${destination}%,country.ilike.%${destination}%`)
      .limit(1);
    
    if (error) {
      console.warn(`[getDestinationId] Query failed:`, error.message);
      return null;
    }
    
    const id = data?.[0]?.id || null;
    console.log(`[getDestinationId] ${destination} → ${id || 'not found'}`);
    return id;
  } catch (e) {
    console.warn(`[getDestinationId] Exception:`, e);
    return null;
  }
}

// =============================================================================
// TOURIST TRAP SKIP LIST
// Destination-specific activities we tell users to avoid - AI must not plan these
// =============================================================================
// Skip list, budget intent, budget constraints, archetype constraints, and generation rules
// moved to ./budget-constraints.ts


// User context normalization moved to ./user-context-normalization.ts
import {
  normalizeUserContext,
  buildNormalizedPromptContext,
  blendTraitWithOverride,
  calculateQuizCompleteness,
  deduplicatePreferences,
  inferArchetypesFromTraits,
  type NormalizedTraits,
  type NormalizedUserContext,
} from './user-context-normalization.ts';

// =============================================================================
// RATE LIMITING - Database-backed (survives cold starts)
// =============================================================================
import { checkDbRateLimit, type RateLimitRule } from "../_shared/db-rate-limiter.ts";

const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  'generate-full': { maxRequests: 3, windowMs: 300000 }, // 3 full generations per 5 min
  'generate-day': { maxRequests: 20, windowMs: 60000 },   // 20 day generations per min
  default: { maxRequests: 20, windowMs: 60000 }           // 20 requests per min for other actions
};

async function checkRateLimit(
  supabaseAdmin: any,
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number }> {
  const rule = RATE_LIMIT_RULES[action] || RATE_LIMIT_RULES.default;
  const result = await checkDbRateLimit(
    supabaseAdmin,
    userId,
    `generate-itinerary:${action}`,
    rule,
    userId,
  );
  return { allowed: result.allowed, remaining: result.remaining };
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
                        amount: { type: "number", minimum: 0, description: "REQUIRED: Realistic cost per person in local currency. Use 0 ONLY for truly free attractions (parks, churches, viewpoints). NEVER use 0 for: dining, restaurants, breakfast, lunch, dinner, cruises, tours, shows, or any paid activity." },
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
                          description: "Estimated cost for this transport leg. OMIT entirely for walking (walking is free). Only include for paid transport like taxi, metro, bus, rideshare.",
                          properties: {
                            amount: { type: "number", description: "Cost in local currency. Use 0 for free transport." },
                            currency: { type: "string", description: "ISO currency code" }
                          },
                          required: ["amount", "currency"]
                        },
                        instructions: { type: "string", description: "Include specific transit lines, stations, or route details when applicable" }
                      },
                      required: ["method", "duration"]
                    },
                    tips: { type: "string", description: "Insider tip or recommendation" },
                    contextualTips: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string", enum: ["timing", "booking", "money_saving", "transit", "cultural", "safety", "hidden_gem", "weather", "general"] },
                          text: { type: "string", description: "Specific, actionable tip (30+ chars)" }
                        },
                        required: ["type", "text"]
                      },
                      minItems: 1,
                      maxItems: 4,
                      description: "1-4 typed contextual tips for this activity (timing, booking, money-saving, transit, cultural, safety, hidden gem, weather)"
                    },
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
                  required: ["id", "title", "startTime", "endTime", "category", "location", "cost", "description", "tags", "bookingRequired", "transportation", "personalization", "tips", "crowdLevel", "isHiddenGem", "hasTimingHack"]
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

// =============================================================================
// EXTRACTED MODULES — Preference context, flight/hotel, group blending
// =============================================================================
import {
  getFlightHotelContext,
  getDynamicTransferPricing,
  getAirportTransferTime,
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
  type FlightHotelContextResult,
  type AirportTransferFare,
  type DynamicTransferResult,
} from './flight-hotel-context.ts';

import {
  getTravelDNAV2,
  getTraitOverrides,
  getUserPreferences,
  getLearnedPreferences,
  getBehavioralEnrichment,
  getCollaboratorPreferences,
  blendGroupPreferences,
  buildTravelDNAContext,
  buildPreferenceContext,
  enrichPreferencesWithAI,
  type TravelDNAProfile,
  type PreferenceProfile,
} from './preference-context.ts';

// Types, group blending, and collaborator preferences moved to ./preference-context.ts

// FlightHotelContextResult, time helpers, and getDynamicTransferPricing moved to ./flight-hotel-context.ts

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

/**
 * Fetch airport transfer time from destinations table
 * Returns destination-specific transfer time, or default 45 minutes
 */
async function getAirportTransferMinutes(supabase: any, destination: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('airport_transfer_minutes, city')
      .or(`city.ilike.%${destination}%,country.ilike.%${destination}%`)
      .limit(1);
    
    if (error || !data?.length) {
      console.log(`[AirportTransfer] No destination found for "${destination}", using default 45 min`);
      return 45;
    }
    
    const transferTime = data[0].airport_transfer_minutes || 45;
    console.log(`[AirportTransfer] Found ${data[0].city}: ${transferTime} minutes`);
    return transferTime;
  } catch (e) {
    console.error('[AirportTransfer] Error fetching transfer time:', e);
    return 45;
  }
}

// getFlightHotelContext moved to ./flight-hotel-context.ts

// getLearnedPreferences and getBehavioralEnrichment moved to ./preference-context.ts

// getUserPreferences, getTravelDNAV2, getTraitOverrides moved to ./preference-context.ts

// buildTravelDNAContext, buildPreferenceContext, enrichPreferencesWithAI moved to ./preference-context.ts

function calculateDays(startDate: string, endDate: string): number {
  // Timezone-safe: parse as local dates to avoid UTC off-by-one
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  // Inclusive end-date: last day IS an activity day (March 7-9 = 3 days)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(startDate: string, dayOffset: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
async function prepareContext(supabase: any, tripId: string, userId?: string, directTripData?: DirectTripData, requestSmartFinishMode?: boolean): Promise<GenerationContext | null> {
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
    childrenAges: trip.metadata?.childrenAges || [],
    tripType: trip.trip_type,
    budgetTier: trip.budget_tier,
    pace: trip.metadata?.pacing || trip.metadata?.pace || 'moderate',
    interests: trip.metadata?.interests || [],
    currency: 'USD',
    // Phase 2: Origin city and timezone for jet lag calculation
    originCity: trip.origin_city,
    destinationTimezone: resolveTimezone(trip.destination) || undefined,
    jetLagSensitivity: trip.metadata?.jetLagSensitivity || 'moderate',
    // Celebration day from user selection
    celebrationDay: trip.metadata?.celebrationDay,
    // User research notes / must-do activities from Page 2 paste field (can be string or array)
    mustDoActivities: (() => {
      const raw = trip.metadata?.mustDoActivities;
      if (Array.isArray(raw)) return raw.join('\n');
      return raw || undefined;
    })(),
    // "Anything else" / additional notes from planner
    additionalNotes: (trip.metadata?.additionalNotes as string) || undefined,
    // Interest categories selected by user (e.g. ['history', 'food', 'nightlife'])
    interestCategories: (trip.metadata?.interestCategories as string[]) || undefined,
    // Structured must-haves checklist (schedule constraints, hotel prefs, etc.)
    mustHaves: (trip.metadata?.mustHaves as Array<{label: string; notes?: string}>) || undefined,
    // Structured generation rules (blocked time, events, hotel changes, guest changes)
    generationRules: (trip.metadata?.generationRules as any[]) || undefined,
    // Pre-booked commitments (shows, reservations, tours with fixed times)
    preBookedCommitments: (trip.metadata?.preBookedCommitments as PreBookedCommitment[]) || undefined,
    firstTimePerCity: trip.metadata?.firstTimePerCity || undefined,
    // Smart Finish detection: prefer direct request body flag (avoids DB race condition),
    // then fall back to metadata checks for backward compatibility
    isSmartFinish: requestSmartFinishMode === true || trip.metadata?.smartFinishMode === true || (trip.metadata?.smartFinishSource || '').toString().includes('manual_builder'),
    smartFinishRequested: requestSmartFinishMode === true || !!trip.metadata?.smartFinishRequestedAt,
    tripVibe: trip.metadata?.tripVibe || undefined,
    tripPriorities: trip.metadata?.tripPriorities || undefined,
    // User constraints from chat planner (full-day events, time blocks, preferences)
    userConstraints: (trip.metadata?.userConstraints as any[]) || undefined,
    // Flight details from chat planner
    flightDetails: (trip.metadata?.flightDetails as string) || undefined,
  };

  // Set daily budget based on tier (fallback)
  const budgetMap: Record<string, number> = {
    budget: 75,
    economy: 100,
    standard: 150,
    comfort: 200,
    premium: 300,
    luxury: 500
  };
   context.dailyBudget = budgetMap[context.budgetTier || 'standard'] || 150;

  // Override with ACTUAL user-set budget if available
  const budgetTotalCents = trip.budget_total_cents;
  if (budgetTotalCents && budgetTotalCents > 0) {
    context.budgetTotalCents = budgetTotalCents;
    const travelers = context.travelers || 1;
    const days = context.totalDays || 1;
    // Subtract committed costs (flight + hotel) to get activity-only budget
    const flightCents = trip.flight_selection?.legs
      ? (trip.flight_selection.legs as any[]).reduce((sum: number, leg: any) => sum + (leg.price || 0), 0) * 100
      : trip.flight_selection?.outbound?.price ? Math.round((trip.flight_selection.outbound.price + (trip.flight_selection.return?.price || 0)) * 100) : 0;
    const hotelCents = trip.hotel_selection?.pricePerNight ? Math.round(trip.hotel_selection.pricePerNight * days * 100) : 0;
    const activityBudgetCents = Math.max(0, budgetTotalCents - flightCents - hotelCents);
    const actualDailyPerPerson = Math.round(activityBudgetCents / days / travelers) / 100; // convert to dollars
    context.actualDailyBudgetPerPerson = actualDailyPerPerson;
    context.dailyBudget = actualDailyPerPerson; // Override tier-based estimate
    console.log(`[Stage 1] User budget: $${budgetTotalCents / 100} total, $${actualDailyPerPerson}/day/person for activities (after flight=$${flightCents / 100}, hotel=$${hotelCents / 100})`);
  }

  // Store tripCities ref for per-city budget override (populated later in multi-city block)
  let resolvedTripCities: any[] | null = null;

  // =========================================================================
  // MULTI-CITY SUPPORT: Build day→city mapping from destinations or trip_cities
  // =========================================================================
  if (trip.is_multi_city) {
    context.isMultiCity = true;
    console.log(`[Stage 1] Multi-city trip detected`);
    
    // PRIORITY: Query trip_cities FIRST (has transport_type), fall back to destinations JSONB
    let tripCitiesResolved = false;
    try {
      const { data: tripCities } = await supabase
        .from('trip_cities')
        .select('*')
        .eq('trip_id', tripId)
        .order('city_order', { ascending: true });
      
      if (tripCities && tripCities.length >= 2) {
        resolvedTripCities = tripCities; // Store for per-city budget override
        const dayMap: MultiCityDayInfo[] = [];
        for (let i = 0; i < tripCities.length; i++) {
          const city = tripCities[i];
          const nights = city.nights || city.days_total || 1;
          
          // Extract per-city hotel info
          // hotel_selection can be an array [{name:...}] or a plain object {name:...}
          const rawHotel = city.hotel_selection as any;
          const cityHotel = Array.isArray(rawHotel) && rawHotel.length > 0 ? rawHotel[0] : rawHotel;
          const hotelName = cityHotel?.name as string | undefined;
          const hotelAddress = cityHotel?.address as string | undefined;
          const hotelNeighborhood = (cityHotel?.neighborhood as string) || hotelAddress;
          const hotelCheckIn = (cityHotel?.checkIn || cityHotel?.checkInTime || cityHotel?.check_in) as string | undefined;
          const hotelCheckOut = (cityHotel?.checkOut || cityHotel?.checkOutTime || cityHotel?.check_out) as string | undefined;
          
          for (let n = 0; n < nights; n++) {
            const isTransition = n === 0 && i > 0;
            const isSameCountry = isTransition && tripCities[i - 1].country === city.country;
            const defaultTransport = isSameCountry ? 'train' : 'flight';
            // transport_type may be stored on this city (correct) OR the previous city (legacy bug)
            const resolvedTransport = isTransition
              ? (city.transport_type || tripCities[i - 1].transport_type || defaultTransport)
              : undefined;
            dayMap.push({
              cityName: city.city_name,
              country: city.country,
              isTransitionDay: isTransition,
              transitionFrom: isTransition ? tripCities[i - 1].city_name : undefined,
              transitionTo: isTransition ? city.city_name : undefined,
              transportType: resolvedTransport,
              hotelName,
              hotelAddress,
              hotelNeighborhood,
              hotelCheckIn,
              hotelCheckOut,
              isFirstDayInCity: n === 0,
              isLastDayInCity: n === nights - 1,
            });
          }
        }
        while (dayMap.length < totalDays) {
          const last = dayMap[dayMap.length - 1] || { cityName: context.destination, isTransitionDay: false };
          dayMap.push({ ...last, isTransitionDay: false });
        }
        context.multiCityDayMap = dayMap.slice(0, totalDays);
        tripCitiesResolved = true;
        console.log(`[Stage 1] Multi-city day map (from trip_cities): ${context.multiCityDayMap.map(d => `${d.cityName}${d.isTransitionDay ? '(T)' : ''}`).join(' → ')}`);

        // ─── PER-CITY BUDGET OVERRIDE ───
        if (budgetTotalCents && budgetTotalCents > 0 && resolvedTripCities) {
          // Build a city-name → daily budget map for use in day generation
          const perCityDailyBudget: Record<string, number> = {};
          const travelers = context.travelers || 1;
          for (const city of resolvedTripCities) {
            const allocatedCents = (city as any).allocated_budget_cents;
            if (allocatedCents && allocatedCents > 0) {
              const cityNights = city.nights || city.days_total || 1;
              const cityHotelCents = city.hotel_cost_cents || 0;
              const cityActivityBudgetCents = Math.max(0, allocatedCents - cityHotelCents);
              const dailyPerPerson = Math.round(cityActivityBudgetCents / cityNights / travelers) / 100;
              perCityDailyBudget[city.city_name] = dailyPerPerson;
              console.log(`[Stage 1] City "${city.city_name}" budget: $${(allocatedCents/100).toFixed(2)} total, $${dailyPerPerson}/day/person for activities`);
            }
          }
          if (Object.keys(perCityDailyBudget).length > 0) {
            context.perCityDailyBudget = perCityDailyBudget;
          }
        }
      }
    } catch (e) {
      console.warn(`[Stage 1] Failed to query trip_cities, falling back to destinations JSONB:`, e);
    }

    // Fallback: destinations JSONB (lacks transportType)
    if (!tripCitiesResolved) {
      const destinations = trip.destinations as Array<{ city: string; country?: string; nights: number; order?: number }> | null;
      
      if (destinations && destinations.length >= 2) {
        const sorted = [...destinations].sort((a, b) => (a.order || 0) - (b.order || 0));
        
        const dayMap: MultiCityDayInfo[] = [];
        for (let i = 0; i < sorted.length; i++) {
          const dest = sorted[i];
          const nights = dest.nights || 1;
          
          for (let n = 0; n < nights; n++) {
            const isTransition = n === 0 && i > 0;
            const isSameCountry = isTransition && sorted[i - 1].country === dest.country;
            dayMap.push({
              cityName: dest.city,
              country: dest.country,
              isTransitionDay: isTransition,
              transitionFrom: isTransition ? sorted[i - 1].city : undefined,
              transitionTo: isTransition ? dest.city : undefined,
              transportType: isTransition ? (isSameCountry ? 'train' : 'flight') : undefined,
            });
          }
        }
        
        while (dayMap.length < totalDays) {
          const last = dayMap[dayMap.length - 1] || { cityName: context.destination, isTransitionDay: false };
          dayMap.push({ ...last, isTransitionDay: false });
        }
        context.multiCityDayMap = dayMap.slice(0, totalDays);
        
        console.log(`[Stage 1] Multi-city day map (from destinations JSONB): ${context.multiCityDayMap.map(d => d.cityName).join(' → ')}`);
      }
    }
    
    // If we still have no day map, log a warning (single-city or malformed data)
    if (!context.multiCityDayMap) {
      console.warn('[Stage 1] Multi-city trip detected but no day map could be built from trip_cities or destinations');
    }
  }

  console.log(`[Stage 1] Context prepared: ${context.totalDays} days in ${context.destination}${context.isMultiCity ? ' (multi-city)' : ''}`);
  return context;
}

// =============================================================================
// STAGE 2: AI GENERATION WITH BATCH PROCESSING, VALIDATION & RETRY
// =============================================================================

// Day validation + deduplication extracted to ./day-validation.ts
import {
  validateGeneratedDay,
  deduplicateActivities,
  detectMealSlots,
  type DayValidationResult,
  type StrictDayMinimal,
} from './day-validation.ts';



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
  maxRetries: number = 2
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
  
  if (context.travelerDNA) {
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
    
    const flightData = context.flightData || { hasOutboundFlight: false, hasReturnFlight: false } as any;
    const hotelData = context.hotelData || { hasHotel: false } as any;
    
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
    '7. NO DUPLICATE ACTIVITIES: NEVER schedule the same type of activity back-to-back. NEVER schedule two of the same category on the same day (e.g., two comedy shows, two museum visits, two walking tours). If the user requested ONE comedy show, generate exactly ONE.',
    '8. **TRIP-WIDE UNIQUENESS**: Each unique experience (cooking class, wine tasting, etc.) should appear AT MOST ONCE in the ENTIRE trip unless the user explicitly requested it on multiple days (e.g., "US Open Day 1, Day 2, Day 3")',
    '9. VARIETY PER DAY: Mix sightseeing, cultural sites, museums, outdoor activities, dining',
    '10. **ACTIVITY TITLE NAMING — CRITICAL**: The "title" field MUST be the venue or experience name ONLY. NEVER append the category, type, or a repeated word. Examples of WRONG titles: "Barton Springs Pool Pool", "Zilker Botanical Garden Garden", "Franklin Barbecue Barbecue", "Cosmic Coffee Coffee & Beer", "Record shopping shopping". CORRECT titles: "Barton Springs Pool", "Zilker Botanical Garden", "Franklin Barbecue", "Cosmic Coffee + Beer Garden". If the place name already contains the activity type (e.g., "Pool", "Garden", "Barbecue", "Coffee"), do NOT add it again.',
    '11. **DINING TITLE — CRITICAL**: For ALL dining/restaurant activities (category: "dining"), the "title" MUST be the restaurant or cafe name. NEVER use the neighborhood, district, or area as the title. Put the neighborhood in the "neighborhood" field instead. WRONG: { title: "Gaslamp Quarter", description: "Juniper & Ivy" }. WRONG: { title: "La Jolla", description: "The Taco Stand fish tacos" }. WRONG: { title: "Balboa Park", description: "The Prado restaurant" }. RIGHT: { title: "Juniper & Ivy", neighborhood: "Gaslamp Quarter" }. RIGHT: { title: "The Taco Stand", description: "fish tacos", neighborhood: "La Jolla" }. RIGHT: { title: "The Prado", neighborhood: "Balboa Park" }.',
    isFirstDay ? '12. **DAY 1 ARRIVAL STRUCTURE — CRITICAL**: Day 1 MUST begin with "Hotel Check-in & Refresh" (category: accommodation) as the FIRST activity. Do NOT include an "Arrival at Airport", "Arrival and Baggage Claim", or "Airport Transfer to Hotel" activity — arrival logistics are handled by a separate UI component. Start the day with hotel check-in, then proceed to real activities.' : '',
    isLastDay && context.totalDays > 1 ? '12. LAST DAY MUST end with: Checkout → Transfer → Departure' : '',
    '13. **HOTEL FIDELITY — CRITICAL**: If a specific hotel name and address are provided in the accommodation section, you MUST use that EXACT hotel name for ALL accommodation activities (check-in, return to hotel, freshen up, checkout, etc.). Do NOT invent, substitute, or suggest a different hotel. The user has already booked their accommodation.',
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
  let lastGeneratedOutput: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Stage 2] Generating day ${dayNumber}/${context.totalDays} (attempt ${attempt + 1}/${maxRetries + 1})`);

      // Build retry-specific prompt additions
      let retryPrompt = '';
      if (attempt > 0 && lastValidation) {
        const errorList = lastValidation.errors.map(e => `  - ${e}`).join('\n');
        const warningList = lastValidation.warnings.map(w => `  - ${w}`).join('\n');
        if (lastGeneratedOutput) {
          // Focused "fix this" prompt — sends previous output as context to avoid full regeneration
          retryPrompt = `\n\n⚠️ YOUR PREVIOUS OUTPUT HAD VALIDATION ERRORS. Here is your previous JSON output — fix ONLY the issues listed below and return the corrected complete day JSON. Do NOT change activities that are working correctly.\n\nERRORS TO FIX:\n${errorList}${lastValidation.warnings.length > 0 ? `\n\nWARNINGS:\n${warningList}` : ''}\n\nPREVIOUS OUTPUT (fix and return):\n${lastGeneratedOutput.substring(0, 8000)}`;
          console.log(`[Stage 2] Using focused retry prompt (${retryPrompt.length} chars vs full regen)`);
        } else {
          retryPrompt = `\n\n⚠️ PREVIOUS ATTEMPT FAILED VALIDATION. FIX THESE ISSUES:\n`;
          if (lastValidation.errors.length > 0) {
            retryPrompt += `ERRORS (must fix):\n${errorList}\n`;
          }
          if (lastValidation.warnings.length > 0) {
            retryPrompt += `WARNINGS (should fix):\n${warningList}\n`;
          }
        }
      }

      // Build destination essentials prompt (non-negotiables + hidden gems)
      // Now uses DB-driven data with freshness-based Perplexity enrichment
      const authenticityScore = context.travelerDNA?.traits?.authenticity || 0;
      // Resolve isFirstTimeVisitor per-city for multi-city trips
      const dayCityForVisitor = context.multiCityDayMap?.[dayNumber - 1];
      const currentCityName = dayCityForVisitor?.cityName || context.destination;
      const isFirstTimeVisitor = context.firstTimePerCity
        ? (context.firstTimePerCity[currentCityName] ?? context.isFirstTimeVisitor ?? true)
        : (context.isFirstTimeVisitor ?? true);
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
      const baseMaxActivitiesFromArchetype = archetypeDefinition.dayStructure.maxScheduledActivities;
      // Use archetype min if defined, otherwise derive from schedule constraints or default to reasonable floor
      const baseMinActivitiesFromArchetype = archetypeDefinition.dayStructure.minScheduledActivities
        || Math.max(3, Math.ceil(baseMaxActivitiesFromArchetype * 0.6));

      // Smart Finish should output a fully polished day (anchors + added value), not a sparse archetype-only day.
      const isSmartFinishGeneration = !!context.isSmartFinish;
      // Override activity counts for transition days — they have a fixed structure (6-8)
      const isTransitionDayForCounts = context.multiCityDayMap?.[dayNumber - 1]?.isTransitionDay || false;
      const effectiveMinActivities = isTransitionDayForCounts
        ? 6
        : isSmartFinishGeneration
          ? (isFirstDay || isLastDay ? Math.max(6, baseMinActivitiesFromArchetype) : Math.max(8, baseMinActivitiesFromArchetype))
          : baseMinActivitiesFromArchetype;
      const effectiveMaxActivities = isTransitionDayForCounts
        ? 10
        : isSmartFinishGeneration
          ? (isFirstDay || isLastDay ? Math.max(10, baseMaxActivitiesFromArchetype) : Math.max(14, baseMaxActivitiesFromArchetype))
          : baseMaxActivitiesFromArchetype;
      
      // =========================================================================
      // PHASE 12: Experience Affinity - What TO prioritize (the "pull" side)
      // =========================================================================
      const experienceGuidancePrompt = buildExperienceGuidancePrompt(
        context.travelerDNA?.primaryArchetype
      );
      
      // =========================================================================
      // PHASE 12B: Destination × Archetype Guide - City-specific recommendations
      // =========================================================================
      const destinationGuidancePrompt = buildDestinationGuidancePrompt(
        context.destination,
        context.travelerDNA?.primaryArchetype || 'balanced_story_collector'
      );
      
      const generationHierarchy = `
${'='.repeat(70)}
🎯 TRAIT MODERATION — THE MOST IMPORTANT RULE
${'='.repeat(70)}

Archetype traits are SEASONING, not the entire meal. The dominant archetype trait should influence ~30-40% of activities. The remaining 60-70% should be well-rounded travel anyone would enjoy. Do NOT max out any single trait. Every day should feel different.

FREE ACTIVITIES ARE VALID FOR ALL ARCHETYPES. A sunset walk is luxury, a park is adventurous, a market is cultural.

PER-ARCHETYPE DAILY BUDGET CEILINGS (per person, USD):
- Budget: ~$15-20/day | Economy: ~$30-45/day | Standard: ~$50-80/day
- Comfort: ~$100-150/day | Premium: ~$150-250/day | Luxury: ~$250-400/day
Optimize DOWNWARD within each tier. Luxury ≠ unlimited. A 15-day luxury trip should be ~$4,000-$6,000 total, NOT $36,000.

${'='.repeat(70)}
⚖️ GENERATION HIERARCHY — CONFLICT RESOLUTION RULES
${'='.repeat(70)}

When rules conflict, follow this priority order (1 = highest):

1. USER'S EXPLICIT INTERESTS & RESEARCH (highest priority)
   → If the user selected "Food & Cuisine", "Adventure", or "Nightlife" in their profile, those determine WHAT activities appear
   → If the user pasted specific restaurant/venue names, those MUST appear by name
   → User interests override archetype activity restrictions

2. DESTINATION ESSENTIALS
   → First-time visitors MUST see iconic landmarks (Colosseum in Rome, Eiffel Tower in Paris)
   → These are non-negotiable unless user explicitly says "skip"

3. ARCHETYPE NARRATIVE TONE (defines HOW activities are described, NOT what activities to include)
   → The archetype determines writing style, pacing feel, and descriptive tone
   → Interpreted through TRAIT MODERATION: 30-40% trait-aligned, 60-70% varied
   → Archetype "avoid" list applies ONLY when it doesn't conflict with the user's explicit interests

4. EXPERIENCE AFFINITY (secondary guidance)
   → Use these to fill REMAINING slots after user interests and essentials are placed

5. BUDGET CONSTRAINTS
   → Budget tier + budget trait score determine price limits
   → Use per-archetype daily budget ceilings above

6. PACING CONSTRAINTS → HARD LIMITS on activity density
7. VARIETY RULES → Max 1 spa per trip, Max 1 Michelin per trip (unless specific archetypes)
8. TRAIT MODIFIERS (lowest priority — fine-tuning only)

CRITICAL: User's explicit profile interests and pasted research ALWAYS outrank archetype defaults.
The archetype shapes the narrative VOICE, not the activity SELECTION.

${'='.repeat(70)}

${comprehensiveConstraints}

${experienceGuidancePrompt}

${destinationGuidancePrompt}
`;

      // Phase 2: Build temporal intelligence prompts
      const tripDurationPrompt = buildTripDurationPrompt(context.totalDays, !!context.flightData?.hasOutboundFlight, !!context.flightData?.hasReturnFlight);
      const childrenAgesPrompt = context.childrenAges?.length ? buildChildrenAgesPrompt(context.childrenAges) : '';
      const jetLagPrompt = buildJetLagPrompt(context.originCity || null, context.destinationTimezone || null, undefined, undefined, context.jetLagSensitivity);
      const weatherBackupPrompt = buildWeatherBackupPrompt(context.destination, context.startDate);
      const reservationPrompt = buildReservationUrgencyPrompt();
      const dailyEstimatesPrompt = buildDailyEstimatesPrompt(context.budgetTier);

      const systemPrompt = `You are an expert travel planner. Generate a SINGLE day's itinerary with PERFECT data quality.

${generationHierarchy}

${qualityRules}

${tripDurationPrompt}
${childrenAgesPrompt}
${jetLagPrompt}
${weatherBackupPrompt}
${reservationPrompt}
${dailyEstimatesPrompt}

${destinationEssentialsPrompt ? `${destinationEssentialsPrompt}

` : ''}${dnaPromptSection ? `${'='.repeat(70)}
TRAVELER DNA PROFILE (CRITICAL - Customize EVERYTHING to this person)
${'='.repeat(70)}
${dnaPromptSection}` : ''}

${dayConstraintsSection ? `${'='.repeat(70)}
DAY-SPECIFIC CONSTRAINTS (Flight/Hotel/DNA driven)
${'='.repeat(70)}
${dayConstraintsSection}` : ''}

${preferenceContext ? `${'='.repeat(70)}
🚨 USER'S EXPLICIT REQUESTS (MUST BE HONORED — FAILURE = REJECTED ITINERARY) 🚨
${'='.repeat(70)}
${preferenceContext}

⚠️ If the user asked for a specific activity (e.g., "skiing", "surfing", "hiking"), you MUST include it in the itinerary.
⚠️ If the user specified dietary preferences (e.g., "light dinner", "vegetarian"), respect them in ALL restaurant choices.
⚠️ Ignoring explicit user requests is the #1 reason itineraries get rejected. DO NOT substitute generic activities.
` : 'ADDITIONAL CONTEXT: (none)'}

${flightHotelContext}${retryPrompt}

${context.collaboratorTravelers && context.collaboratorTravelers.length > 0 ? `
${'='.repeat(70)}
🎯 GROUP TRIP ATTRIBUTION — suggestedFor REQUIRED
${'='.repeat(70)}
This is a GROUP TRIP. Some activities need a "suggestedFor" field to show which traveler's DNA inspired the choice.

Travelers in this group:
${context.collaboratorTravelers.map(t => `  - "${t.userId}" (${t.name})`).join('\n')}

Rules:
- LOGISTICAL activities (hotel check-in/check-out, airport arrival/departure, transfers, transit, packing, travel days) → DO NOT include suggestedFor. These are not DNA-driven.
- USER-REQUESTED must-do activities (things the user explicitly asked for, e.g. "US Open", a specific restaurant they named) → set suggestedFor to ALL traveler IDs comma-separated: "${context.collaboratorTravelers.map(t => t.userId).join(',')}" — these were requested by the group, not inspired by any individual's DNA.
- AI-CHOSEN activities (restaurants, bars, experiences YOU picked based on personality traits) → set suggestedFor to the SINGLE traveler whose DNA most influenced the pick. Only use comma-separated IDs if the activity genuinely matches multiple travelers' unique traits.
- Use the primary planner's ID ("${context.userId}") ONLY when it specifically matches their profile, NOT as a default
` : ''}

${'='.repeat(70)}
🧠 VOYANCE INTELLIGENCE FIELDS — MANDATORY FOR EVERY ACTIVITY
${'='.repeat(70)}
For EVERY activity you generate, you MUST include ALL of these intelligence fields:

1. "tips" (string, 30+ chars): A specific, actionable insider tip. NOT generic advice. Example: "Ask for the corner table with harbor view — regulars know it's the best seat" or "The gift shop has a back entrance that skips the main queue"
2. "crowdLevel" (string): Must be "low", "moderate", or "high" — your estimate at the SCHEDULED time
3. "isHiddenGem" (boolean): true ONLY for genuine discoveries (not in top-10 TripAdvisor, not in mainstream guides). At least 1-2 per day should be true.
4. "hasTimingHack" (boolean): true if THIS specific time slot gives an advantage (crowd avoidance, golden hour, special access). At least 2-3 per day should be true.
5. "bestTime" (string): If hasTimingHack=true, explain WHY (e.g., "Arrives before the 10am tour bus rush")
6. "voyanceInsight" (string): One unique fact most travelers don't know. Example: "The second floor has a hidden terrace that's not on any map"
7. "personalization.whyThisFits" (string): MUST reference at LEAST ONE specific traveler trait, preference, past trip, or interest by name. 
   ❌ BAD: "This fits your travel style" (too generic)
   ❌ BAD: "Popular with tourists" (not personalized)
   ✅ GOOD: "Your authenticity score of +7 means you'll prefer this local izakaya over the tourist-facing ramen chain"
   ✅ GOOD: "Since you loved the street food in Bangkok, this hawker-style market will feel familiar"
   ✅ GOOD: "With your luxury budget tier and love of omakase, this 8-seat counter is your signature meal"
8. "contextualTips" (array of objects): 1-4 TYPED tips per activity. Each tip has a "type" and "text":
   - "timing": Queue/crowd advice for this specific time. E.g., "Crown Jewels queue is shortest before 10am"
   - "booking": Reservation/ticket advice. E.g., "Books up 3 weeks in advance — reserve now"
   - "money_saving": Ways to save. E.g., "London Pass covers this + 2 other stops on your trip, saving £15"
   - "transit": Getting there tips. E.g., "Oyster card is cheaper than individual tickets"
   - "cultural": Etiquette/context. E.g., "Tipping 10-15% at restaurants; service charge often included"
   - "safety": Practical warnings. E.g., "Cash only at this market" or "No shorts allowed in this church"
   - "hidden_gem": Nearby discovery. E.g., "2 min away: The Lamb pub (est. 1729) — great mid-afternoon pint"
   - "weather": Weather-specific advice. E.g., "March averages 8°C — pack layers and a rain jacket"
   Every paid activity should have at least 1 contextual tip. Dining should include booking or cultural tips.

DO NOT leave these fields empty or omit them. They are the core intelligence layer.

${'='.repeat(70)}
🎯 CURATED PICKS — ONE BEST CHOICE PER SLOT (CRITICAL)
${'='.repeat(70)}
CRITICAL: Generate exactly ONE activity or restaurant per time slot. Do NOT generate multiple options, alternatives, or choices for any slot. Do NOT include isOption, optionGroup, or any selection/choice mechanism in the output. Every slot must have a single, definitive, curated recommendation based on the traveler's DNA. You are a personal travel curator delivering a finished plan — not a quiz with multiple choice answers.
If the traveler wants to swap an activity later, they can use the swap feature.

${'='.repeat(70)}
⏱️ BUFFER TIME — MANDATORY REALISTIC GAPS (CRITICAL)
${'='.repeat(70)}
REQUIRED — BUFFER TIME: Include realistic travel and transition time between every activity. NEVER schedule activities back-to-back with zero gap. Minimum gaps:
- 5 minutes between activities at the same venue/location
- 10-15 minutes between nearby activities within walking distance
- 15-20 minutes for restaurant arrivals (be seated, review menu, order)
- 20-30 minutes for hotel check-in or check-out
- 30-60 minutes for airport-related activities (security, customs, boarding)
- Include actual transit time between locations not within walking distance
Example: If an activity ends at 14:00 and the next location is a 20-minute taxi ride away, schedule the next activity at 14:30 (20 min transit + 10 min buffer), NOT at 14:00 or 14:20.

${'='.repeat(70)}
🏛️ OPERATING HOURS — HARD CONSTRAINT
${'='.repeat(70)}
REQUIRED — OPERATING HOURS: Never schedule an activity before its opening time or after its closing time. If a museum opens at 10:00, the earliest arrival is 10:00 — not 09:45, not 09:30. If a restaurant's last seating is 21:00, do not schedule a 20:45 dinner that would run past closing. When exact hours are unknown, use conservative defaults: most attractions 09:30-17:00, restaurants lunch 11:30-14:00 and dinner 18:00-21:30, outdoor activities sunrise to sunset.

${'='.repeat(70)}
🏷️ ARCHETYPE NAMING — EXACT MATCH ONLY
${'='.repeat(70)}
IMPORTANT — ARCHETYPE NAMES: When referring to the traveler's archetype or style, use ONLY the exact archetype name from their Travel DNA profile. Do not invent, modify, or embellish archetype names. If the profile says 'Luxury Seeker', write 'Luxury Seeker' — never 'Luxury Luminary', 'Luxury Connoisseur', 'Luxury Maven', or any creative variation. The archetype name must match exactly what exists in the system.

${'='.repeat(70)}
⚖️ ARCHETYPE BALANCE — SEASONING NOT THE MEAL
${'='.repeat(70)}
IMPORTANT — ARCHETYPE BALANCE: The traveler's archetype influences 30-40% of the itinerary. It is seasoning, NOT the entire meal. Every day must include a MIX of archetype-aligned and universally enjoyable activities.

Rules:
- Luxury Seeker: Quality experiences, but NOT helicopters, limos, VIP everything, or $500 dinners at every meal. A nice hotel, a great restaurant for dinner, and then they walk through a market, visit a free park, grab street food for lunch. Total trip budget ceiling: ~$4,000 for 15 days.
- Adventure Enthusiast: One adventurous activity per day MAX. They also eat at cafés, visit museums, and relax. Not skydiving → bungee jumping → white water rafting in one day.
- Culture Scholar: One cultural deep-dive per day, not four back-to-back museums. They also eat local food, explore neighborhoods, shop.
- Budget Traveler: $200-300 total trip budget. Street food, hostels, free attractions, public transit. Never suggest expensive restaurants or paid experiences unless free alternatives don't exist.
- Mid-Range: ~$1,000 total. Mix of affordable and moderate. 3-star hotels, some paid attractions, mostly casual dining with one nice dinner.
- Foodie: Food-focused doesn't mean every activity is eating. One signature food experience per day + regular sightseeing.

The goal: if you removed the archetype label, the itinerary should still read like a great, varied trip that anyone would enjoy.

${'='.repeat(70)}
✍️ OUTPUT QUALITY — CLEAN TEXT (CRITICAL)
${'='.repeat(70)}
OUTPUT QUALITY: All text must be clean, professional, correctly spelled English. Double-check every word. No garbled characters, no corrupted fragments, no mixed languages (unless providing a local place name in parentheses). No Chinese, Japanese, or other non-Latin characters in date fields or English text sections. No leaked schema field names (e.g., "duration:4" or "practicalTips;|") in user-facing text.

${'='.repeat(70)}
📋 ACCOMMODATION NOTES & PRACTICAL TIPS — REQUIRED (Day 1 only)
${'='.repeat(70)}
On Day 1 ONLY, include these top-level arrays in your response:
- "accommodationNotes": 2-3 tips about where to stay (best neighborhoods, hotel styles, booking tips)
- "practicalTips": 3-4 practical travel tips (transport, money-saving, cultural etiquette, safety, connectivity)
These help the traveler prepare for their trip.
`;

      // Build banned experience types list for this day
      const bannedTypes: string[] = [];
      if (previousExperienceTypes.has('culinary_class')) {
        bannedTypes.push('cooking classes', 'baking classes', 'culinary workshops', 'pastry classes', 'food classes');
      }
      if (previousExperienceTypes.has('wine_tasting')) {
        bannedTypes.push('wine tastings', 'vineyard tours', 'winery visits');
      }

      // Resolve per-day destination for multi-city trips
      const dayCity = context.multiCityDayMap?.[dayNumber - 1];
      const dayDestination = dayCity?.cityName || context.destination;
      const dayCountry = dayCity?.country || context.destinationCountry;
      const isTransitionDay = dayCity?.isTransitionDay || false;
      
      // Derive city-boundary flags for post-processing airport strip (fixes dead-code bug)
      const isLastDayInCity = dayCity?.isLastDayInCity || false;
      const nextDayInfoForStrip = context.multiCityDayMap?.[dayNumber]; // dayNumber is 0-indexed+1, so [dayNumber] = next day
      const nextLegTransport = nextDayInfoForStrip?.transportType || '';
      
      let multiCityPrompt = '';
      if (context.isMultiCity && dayCity) {
        const cityFirstTime = context.firstTimePerCity
          ? (context.firstTimePerCity[dayDestination] ?? true)
          : (context.isFirstTimeVisitor ?? true);
        const visitorLabel = cityFirstTime ? 'FIRST-TIME visitor' : 'RETURNING visitor';
        multiCityPrompt = `\n🌍 MULTI-CITY TRIP: This day is in **${dayDestination}${dayCountry ? `, ${dayCountry}` : ''}**. ALL activities MUST be located in ${dayDestination}.\n👤 VISITOR STATUS for ${dayDestination}: Traveler is a ${visitorLabel}.${cityFirstTime ? ' Include iconic landmarks and must-see attractions.' : ' Skip tourist staples — focus on hidden gems, local favorites, and deeper neighborhood exploration.'}`;
        
        // Inject per-city hotel context for geographic anchoring
        if (dayCity.hotelName) {
          const hotelArea = dayCity.hotelNeighborhood || dayCity.hotelAddress || '';
          const checkInTime = dayCity.hotelCheckIn || '15:00';
          const checkOutTime = dayCity.hotelCheckOut || '11:00';
          multiCityPrompt += `\n🏨 ACCOMMODATION in ${dayDestination}: "${dayCity.hotelName}"${hotelArea ? ` — Address: ${hotelArea}` : ''}.`;
          multiCityPrompt += `\n   Check-in: ${checkInTime}, Check-out: ${checkOutTime}.`;
          multiCityPrompt += `\n   🚫 CRITICAL: The user has ALREADY SELECTED this hotel. Use "${dayCity.hotelName}" for ALL accommodation references (check-in, return to hotel, freshen up, etc.). Do NOT invent, suggest, or substitute a different hotel.`;
          multiCityPrompt += `\n   ⚠️ Start each day from this hotel area and plan return in the evening.`;
          
          if (dayCity.isFirstDayInCity && !dayCity.isTransitionDay) {
            // Very first city, first day — arrival logistics
            multiCityPrompt += `\n   📍 ARRIVAL DAY: Traveler arrives and needs to get to the hotel. Include transit to ${dayCity.hotelName}, check-in (~30-60 min to settle in), THEN afternoon/evening activities near the hotel area.`;
          } else if (dayCity.isFirstDayInCity && dayCity.isTransitionDay) {
            // Transition day — handled by transition prompt, but add hotel check-in note
            multiCityPrompt += `\n   📍 CHECK-IN DAY: After arriving in ${dayDestination}, traveler checks into ${dayCity.hotelName}. Allow time for check-in and settling before activities.`;
          }
          
          if (dayCity.isLastDayInCity) {
            // Look ahead to find the next city's transport mode
            const nextDayInfo = context.multiCityDayMap?.[dayNumber];
            const nextLegTransport = nextDayInfo?.transportType || 'flight';
            const nextLegCity = nextDayInfo?.cityName || 'the next destination';
            const isNonFlightFullGen = nextLegTransport !== 'flight';
            const transportLabelFullGen = nextLegTransport.toUpperCase();
            multiCityPrompt += `\n   📍 CHECKOUT DAY: Traveler checks out of ${dayCity.hotelName} (typically by 11:00 AM). Tomorrow the traveler takes a ${transportLabelFullGen} to ${nextLegCity}. Plan morning around checkout — breakfast at/near hotel, pack and check out, then activities before departing.`;
            if (isNonFlightFullGen) {
              multiCityPrompt += `\n   ⚠️ DO NOT mention airports, flights, or "Transfer to Airport". The next leg is by ${transportLabelFullGen}.`;
            }
          }
        }
        
        if (isTransitionDay && dayCity.transitionFrom) {
          // Use the full transition day prompt builder instead of the weak 2-line fallback
          const transitionPrompt = buildTransitionDayPrompt({
            transitionFrom: dayCity.transitionFrom,
            transitionFromCountry: context.multiCityDayMap?.find(d => d.cityName === dayCity.transitionFrom)?.country,
            transitionTo: dayDestination,
            transitionToCountry: dayCountry,
            transportType: dayCity.transportType,
            travelers: context.travelers,
            budgetTier: context.budgetTier,
            primaryArchetype: context.travelerDNA?.primaryArchetype,
            currency: context.currency,
          });
          multiCityPrompt += `\n${transitionPrompt}`;
        }
      }

      const dayConstraintsForMeals = (context.userConstraints || []).filter((constraint: any) => {
        if (constraint?.day == null) return false;
        return Number(constraint.day) === dayNumber;
      });
      const lockedHoursForMeals = dayConstraintsForMeals.reduce((sum: number, constraint: any) => {
        if (constraint?.type === 'full_day_event') return sum + 12;
        if (constraint?.type === 'time_block') return sum + (Number(constraint.durationHours) || 2);
        return sum;
      }, 0);
      const hasFullDayEventForMeals = dayConstraintsForMeals.some((constraint: any) => constraint?.type === 'full_day_event');
      const dayMealPolicyInput: MealPolicyInput = {
        dayNumber,
        totalDays: context.totalDays,
        isFirstDay,
        isLastDay,
        isTransitionDay,
        hasFullDayEvent: hasFullDayEventForMeals,
        arrivalTime24: context.flightData?.arrivalTime24,
        departureTime24: context.flightData?.departureTime24,
        lockedHours: lockedHoursForMeals,
      };
      const dayMealPolicy = deriveMealPolicy(dayMealPolicyInput);
      const mealRequirementsBlock = buildMealRequirementsPrompt(dayMealPolicy);
      console.log(`[Stage 2] Day ${dayNumber} meal policy: mode=${dayMealPolicy.dayMode}, required=[${dayMealPolicy.requiredMeals.join(', ')}], usableHours=${dayMealPolicy.usableHours}`);

      // Calculate day-of-week for operating hours awareness
      const dateObj = new Date(date);
      const DAY_NAMES_GEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeekName = DAY_NAMES_GEN[dateObj.getDay()];
      
      const userPrompt = `Generate Day ${dayNumber} of ${context.totalDays} for ${dayDestination}${dayCountry ? `, ${dayCountry}` : ''}.

DATE: ${date} (${dayOfWeekName})
TRAVELERS: ${context.travelers}
BUDGET: ${context.budgetTier || 'standard'} (~$${context.dailyBudget}/day per person)${context.actualDailyBudgetPerPerson != null ? `
⚠️ HARD BUDGET CAP: The user has set a real budget of ~$${Math.round(context.actualDailyBudgetPerPerson * context.travelers)}/day total ($${context.actualDailyBudgetPerPerson}/person) for activities.
${context.actualDailyBudgetPerPerson < 10 ? `🚨 EXTREMELY TIGHT BUDGET: This budget is unrealistically low for ${context.destination || 'this destination'}. Do your best:
- Prioritize FREE activities: parks, temples, markets, viewpoints, walking tours, beaches, street art, public plazas.
- For meals, suggest the cheapest realistic options: street food stalls, convenience stores, budget eateries. Use real local prices.
- Do NOT invent fake low prices. If a typical meal costs $8-12 in this city, say so — do not claim $2.
- Include a "budget_note" field in your response: a 1-sentence honest note like "This budget is very tight for Tokyo — we've maximized free activities but meals will be the main expense."
- Still aim to fill the day with great experiences — many of the best travel moments are free.` : context.actualDailyBudgetPerPerson < 30 ? `⚡ TIGHT BUDGET: This is a lean budget. Lean heavily on free attractions, street food, and self-guided exploration. Limit paid activities to 1-2 per day max. Use realistic local prices — do not underestimate costs to fit the budget.` : `Stay within this cap. If an activity is expensive, balance with free/cheap alternatives elsewhere in the day.`}` : ''}
ARCHETYPE: ${context.travelerDNA?.primaryArchetype || 'balanced'}
ACTIVITY COUNT: ${effectiveMinActivities}-${effectiveMaxActivities} per day${isSmartFinishGeneration ? ' (SMART FINISH POLISH TARGET)' : ' (from archetype day structure - HARD LIMITS)'}
⚠️ MINIMUM ${effectiveMinActivities} activities required. Going UNDER = FAILURE. Going OVER ${effectiveMaxActivities} = FAILURE.
${mealRequirementsBlock}
${isSmartFinishGeneration ? 'SMART FINISH HARD RULE: Keep ALL user-provided anchor activities by exact name and build additional activities around them — never replace or drop anchors.' : ''}
${multiCityPrompt}

${(() => {
  // Separate recurring events from regular activities for dedup prompt
  const mustDoList = (context.mustDoActivities || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const recurringPrevious: string[] = [];
  const nonRecurringPrevious: string[] = [];
  for (const prevAct of previousActivities) {
    if (isRecurringEvent({ title: prevAct }, mustDoList)) {
      recurringPrevious.push(prevAct);
    } else {
      nonRecurringPrevious.push(prevAct);
    }
  }
  let lines = '';
  if (nonRecurringPrevious.length > 0) {
    lines += `AVOID REPEATING THESE ACTIVITIES (already done on previous days): ${nonRecurringPrevious.join(', ')}\n`;
  }
  if (recurringPrevious.length > 0) {
    lines += `THESE ARE MULTI-DAY EVENTS the traveler is attending across multiple days. CREATE A FULL ATTENDANCE ACTIVITY for each (not just a transfer to the venue): ${recurringPrevious.join(', ')}\n`;
  }
  lines += `\n🍽️ MEAL VARIETY RULE: Every breakfast, lunch, and dinner MUST be at a DIFFERENT restaurant/café than any previous day. Never recommend the same venue twice across the trip. Variety in cuisine type is also encouraged.\n`;
  return lines;
})()}
NOTE: The previous-activities list is ONLY for de-duplication. Do NOT treat it as a signal for spending style.
${bannedTypes.length > 0 ? `\n🚫 BANNED EXPERIENCE TYPES (already done on previous days - DO NOT INCLUDE): ${bannedTypes.join(', ')}\n` : ''}

CRITICAL REMINDERS:
1. ${effectiveMinActivities}-${effectiveMaxActivities} scheduled activities required. Going under ${effectiveMinActivities} OR over ${effectiveMaxActivities} = FAILURE.
2. Check the archetype's avoid list. If it says "no spa", there are ZERO spa activities.
3. Check the budget constraints. If value-focused, no €100+ experiences.
4. ${context.travelerDNA?.primaryArchetype === 'flexible_wanderer' || context.travelerDNA?.primaryArchetype === 'slow_traveler' || (context.travelerDNA?.traits?.pace || 0) <= -3 ? 'Include at least one 2+ hour UNSCHEDULED block labeled "Free time to explore [neighborhood]"' : 'Follow the pacing guidelines for this archetype'}
${context.isMultiCity ? `5. ALL activities MUST be in ${dayDestination}. Do NOT include activities from other cities.` : ''}

⏰ OPERATING HOURS — HARD RULE (THIS DAY IS ${dayOfWeekName.toUpperCase()}):
- NEVER schedule an activity before the venue opens or after it closes.
- If a museum/attraction opens at 10:00, the EARLIEST you can schedule a visit is 10:00 (plus buffer time for arrival/entry).
- If a bar/lounge closes at 23:00, you MUST schedule it to END by 23:00 — NOT start at 23:00.
- Many European museums close on MONDAYS. If today is Monday, do NOT schedule museum visits — use an alternative.
- Restaurants: do NOT schedule lunch at a place that opens for dinner only, or dinner at a lunch-only spot.
- Markets often have specific operating days — verify the market is open on ${dayOfWeekName} before including it.
- If you are unsure whether a venue is open on ${dayOfWeekName}, set closedRisk: true and suggest an alternative. WARNING: Confirmed-closed venues will be REMOVED from the itinerary in post-processing. Only use closedRisk for genuine uncertainty.
${(() => {
  // Inject known venue hours from verified_venues cache
  if (context.venueHoursCache && context.venueHoursCache.length > 0) {
    const dayIdx = dateObj.getDay();
    const DAY_N = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dn = DAY_N[dayIdx];
    const relevantHours = context.venueHoursCache
      .map(v => {
        const entry = v.opening_hours?.find(h => h.toLowerCase().startsWith(dn.toLowerCase()));
        return entry ? `  • ${v.name}: ${entry}` : null;
      })
      .filter(Boolean)
      .slice(0, 40); // Limit to avoid prompt bloat
    if (relevantHours.length > 0) {
      return `\n📋 KNOWN VENUE HOURS FOR ${dayOfWeekName.toUpperCase()} (from verified data — MUST RESPECT):\n${relevantHours.join('\n')}\nCONSTRAINT: If you include any venue listed above, schedule it WITHIN the hours shown. Violations = GENERATION FAILURE.`;
    }
  }
  return '';
})()}

🌐 LANGUAGE — HARD RULE:
- ALL text output (titles, descriptions, tips, addresses) MUST be in clean, correctly spelled English.
- For non-Latin-script destinations, use standard English transliterations or well-known English names.
- NEVER output Chinese characters (汉字), Japanese (漢字/かな), Korean (한글), Arabic, Cyrillic, or Thai script.
- NEVER produce garbled, corrupted, or nonsensical text fragments.

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
                            description: "COST RULES: walk/walking → estimatedCost.amount MUST be 0 (walking is free). metro/subway → 1-5. bus → 1-4. taxi/uber/rideshare → use realistic local rates.",
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
                          tips: { type: "string", description: "Insider tip for this activity (must be specific, actionable, 30+ chars)" },
                          contextualTips: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                type: { type: "string", enum: ["timing", "booking", "money_saving", "transit", "cultural", "safety", "hidden_gem", "weather", "general"] },
                                text: { type: "string" }
                              },
                              required: ["type", "text"]
                            },
                            description: "1-4 typed contextual tips"
                          },
                          rating: {
                            type: "object",
                            properties: { value: { type: "number" }, totalReviews: { type: "number" } }
                          },
                          website: { type: "string" },
                          suggestedFor: { type: "string", description: "User ID of the traveler whose preferences most influenced this activity choice (group trips only)" },
                          isHiddenGem: { type: "boolean", description: "true if this is a hidden gem discovered through deep research (Reddit, local sources, new openings). NOT for mainstream tourist attractions." },
                          hasTimingHack: { type: "boolean", description: "true if scheduling at this specific time provides a meaningful advantage (avoiding crowds, better light, special access)" },
                          bestTime: { type: "string", description: "If hasTimingHack=true, explain why this time slot is optimal (e.g. '9am avoids the 11am-3pm crowds')" },
                          crowdLevel: { type: "string", enum: ["low", "moderate", "high"], description: "Expected crowd level at the scheduled time" },
                          voyanceInsight: { type: "string", description: "A unique Voyance-only insight about this place that typical travel guides miss" },
                          personalization: {
                            type: "object",
                            properties: {
                              tags: { type: "array", items: { type: "string" }, description: "Machine-checkable tags from user inputs (e.g. romantic, foodie, low-pace)" },
                              whyThisFits: { type: "string", description: "1-2 sentences explaining why this activity fits THIS specific traveler's DNA/preferences" },
                              confidence: { type: "number", description: "0-1 confidence score for this recommendation" },
                              matchedInputs: { type: "array", items: { type: "string" }, description: "Which user preferences influenced this choice" }
                            },
                            required: ["tags", "whyThisFits", "confidence"]
                          }
                        },
                        required: ["id", "title", "startTime", "endTime", "category", "location", "cost", "bookingRequired", "personalization", "tips", "crowdLevel", "isHiddenGem", "hasTimingHack"]
                      }
                    },
                    accommodationNotes: { type: "array", items: { type: "string" }, description: "2-3 accommodation tips for this destination (e.g. best neighborhoods to stay, hotel recommendations, booking tips)" },
                    practicalTips: { type: "array", items: { type: "string" }, description: "3-4 practical travel tips for this destination (e.g. transport tips, money-saving advice, cultural etiquette, safety tips)" },
                    transportComparison: {
                      type: "array",
                      description: "Transport options for transition days between cities. Required when isTransitionDay is true.",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          mode: { type: "string", enum: ["train", "flight", "bus", "car", "ferry"] },
                          operator: { type: "string" },
                          inTransitDuration: { type: "string" },
                          doorToDoorDuration: { type: "string" },
                          cost: {
                            type: "object",
                            properties: {
                              perPerson: { type: "number" },
                              total: { type: "number" },
                              currency: { type: "string" },
                              includesTransfers: { type: "boolean" }
                            },
                            required: ["perPerson", "total", "currency"]
                          },
                          departure: {
                            type: "object",
                            properties: {
                              point: { type: "string" },
                              neighborhood: { type: "string" }
                            }
                          },
                          arrival: {
                            type: "object",
                            properties: {
                              point: { type: "string" },
                              neighborhood: { type: "string" }
                            }
                          },
                          pros: { type: "array", items: { type: "string" } },
                          cons: { type: "array", items: { type: "string" } },
                          bookingTip: { type: "string" },
                          scenicOpportunities: { type: "array", items: { type: "string" } },
                          isRecommended: { type: "boolean" },
                          recommendationReason: { type: "string" }
                        },
                        required: ["id", "mode", "operator", "inTransitDuration", "doorToDoorDuration", "cost", "departure", "arrival", "pros", "cons", "isRecommended"]
                      }
                    },
                    selectedTransportId: { type: "string", description: "ID of the recommended transport option" }
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

      // Track cost for this day generation
      // Note: This is cumulative - we're tracking per-day for now
      const dayTracker = trackCost('full_itinerary_day', 'google/gemini-3-flash-preview');
      dayTracker.setTripId(context.tripId);
      if (context.userId) dayTracker.setUserId(context.userId);
      dayTracker.recordAiUsage(data);
      dayTracker.addMetadata('dayNumber', dayNumber);
      dayTracker.addMetadata('destination', context.destination);
      await dayTracker.save();

      const message = data.choices?.[0]?.message;
      const toolCall = message?.tool_calls?.[0];

      let generatedDay: StrictDay;
      if (toolCall?.function?.arguments) {
        // Standard tool call response
        generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(toolCall.function.arguments))), dayNumber) as StrictDay;
      } else if (message?.content) {
        // Fallback: AI returned content instead of tool call
        console.log("[Stage 2] AI returned content instead of tool_call, attempting to parse...");
        try {
          const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
          const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(jsonMatch[0]))), dayNumber) as StrictDay;
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

      // Store output for focused retry prompts (reduces token waste by ~60%)
      try { lastGeneratedOutput = JSON.stringify(generatedDay).substring(0, 10000); } catch { lastGeneratedOutput = null; }

      // Normalize activities
      generatedDay.activities = generatedDay.activities.map((act, idx) => {
        // CRITICAL: Convert costs from local currency to USD
        // AI may return costs in local currency (e.g., JPY 6000 for ¥6000 dinner in Japan)
        const rawCost = act.cost || (act as any).estimatedCost;
        const normalizedCost = normalizeCostToUSD(rawCost);
        
        const normalizedAct = {
          ...act,
          id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
          title: act.title || `Activity ${idx + 1}`,
          durationMinutes: calculateDuration(act.startTime, act.endTime),
          categoryIcon: getCategoryIcon(act.category || 'activity'),
          cost: normalizedCost, // Always use USD-normalized cost
        };

        // Auto-fix logistics activities
        const logisticsKeywords = ['check-in', 'checkout', 'check-out', 'arrival', 'departure', 'transfer',
          'free time', 'at leisure', 'leisure time', 'downtime', 'rest',
          'relax at hotel', 'explore on your own', 'personal time'];
        const isLogistics = logisticsKeywords.some(kw => normalizedAct.title.toLowerCase().includes(kw)) ||
                            ['transport', 'accommodation', 'downtime', 'free_time'].includes(normalizedAct.category?.toLowerCase() || '');
        
        if (isLogistics) {
          normalizedAct.bookingRequired = false;
          // Only zero out non-transfer logistics
          if (!normalizedAct.title.toLowerCase().includes('transfer')) {
            normalizedAct.cost = { amount: 0, currency: 'USD' };
          }
        }

        // Auto-set bookingRequired for categories that genuinely need it
        const bookableCategories = ['museum', 'tour', 'cultural', 'activity', 'show', 'entertainment'];
        const bookableKeywords = ['museum', 'tour', 'guided', 'cooking class', 'wine tasting',
          'tickets', 'skip-the-line', 'timed entry', 'reservation'];
        const isBookable = bookableCategories.includes(normalizedAct.category?.toLowerCase() || '') ||
          bookableKeywords.some(kw => normalizedAct.title.toLowerCase().includes(kw));
        if (isBookable && !isLogistics) {
          normalizedAct.bookingRequired = true;
        }

        // Derive intelligence fields if AI didn't set them
        deriveIntelligenceFields(normalizedAct);

        return normalizedAct;
      });

      // ==========================================================================
      // HOTEL ADDRESS CORRECTION: Overwrite AI-hallucinated addresses on
      // accommodation/hotel-return activities with the actual hotel data.
      // The AI sometimes generates wrong addresses for "Return to Hotel" or
      // "Rest & Recharge" activities despite being given the correct address.
      // ==========================================================================
      {
        const actualHotelName = dayCity?.hotelName || context.hotelData?.hotelName;
        const actualHotelAddress = dayCity?.hotelAddress || context.hotelData?.hotelAddress;
        if (actualHotelName || actualHotelAddress) {
          const hotelKeywords = ['hotel', 'check-in', 'check in', 'checkout', 'check-out', 'check out', 'freshen up', 'rest & recharge', 'rest and recharge', 'return to', 'settle in', 'wind down', "dad's", "mom's", "parent", "home base", 'airbnb', 'vacation rental'];
          for (const act of generatedDay.activities) {
            const cat = (act.category || '').toLowerCase();
            const title = (act.title || '').toLowerCase();
            const isAccommodationActivity = cat === 'accommodation' || cat === 'relaxation' ||
              hotelKeywords.some(kw => title.includes(kw));
            
            if (isAccommodationActivity && (cat === 'accommodation' || cat === 'relaxation' || title.includes('hotel') || title.includes('home') || title.includes('airbnb') || title.includes('return') || title.includes('check'))) {
              if (actualHotelName && act.location) {
                act.location.name = actualHotelName;
              }
              if (actualHotelAddress && act.location) {
                act.location.address = actualHotelAddress;
              }
              if (!act.location && (actualHotelName || actualHotelAddress)) {
                (act as any).location = {
                  name: actualHotelName || 'Accommodation',
                  address: actualHotelAddress || '',
                };
              }
            }
          }
        }
      }

      // Force 24-hour HH:MM time format for UI consistency (some model outputs include AM/PM)
      for (const act of generatedDay.activities) {
        const parsedStart = parseTimeToMinutes(act.startTime || '');
        if (parsedStart !== null) act.startTime = minutesToHHMM(parsedStart);

        const parsedEnd = parseTimeToMinutes(act.endTime || '');
        if (parsedEnd !== null) act.endTime = minutesToHHMM(parsedEnd);
      }

      // ==========================================================================
      // TRANSIT-TIME ENFORCEMENT: Adjust gaps between activities based on each
      // activity's own transportation.duration instead of static 15-min buffers.
      // The AI often compresses gaps; this ensures the schedule is realistic.
      // ==========================================================================
      {
        // Sort by start time first
        generatedDay.activities.sort((a, b) => {
          const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
          const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
          return ta - tb;
        });

        let shifted = false;
        for (let i = 0; i < generatedDay.activities.length - 1; i++) {
          const current = generatedDay.activities[i];
          const next = generatedDay.activities[i + 1];

          const currentEndMins = parseTimeToMinutes(current.endTime || '');
          const nextStartMins = parseTimeToMinutes(next.startTime || '');
          if (currentEndMins === null || nextStartMins === null) continue;

          // Determine if current activity IS a transport/transit activity
          const currentIsTransport = ['transport', 'transportation', 'transit'].includes(
            (current.category || '').toLowerCase()
          ) || /\b(stroll|walk|taxi|uber|metro|bus|train|cab|ride|transfer)\b/i.test(current.title || '');

          // Parse the NEXT activity's transportation.duration (e.g., "25 min", "1h 30m")
          let requiredTransitMins = 0;
          const transitDur = next.transportation?.duration;
          if (transitDur && typeof transitDur === 'string') {
            const hMatch = transitDur.match(/(\d+)\s*h/i);
            const mMatch = transitDur.match(/(\d+)\s*m/i);
            if (hMatch) requiredTransitMins += parseInt(hMatch[1], 10) * 60;
            if (mMatch) requiredTransitMins += parseInt(mMatch[1], 10);
          }
          // Also check distanceKm as fallback
          if (requiredTransitMins === 0 && next.transportation?.distanceKm) {
            const dist = next.transportation.distanceKm;
            if (dist <= 1) requiredTransitMins = 10;       // walking distance
            else if (dist <= 5) requiredTransitMins = 20;   // short transit
            else if (dist <= 15) requiredTransitMins = 35;  // cross-city
            else requiredTransitMins = 45;                   // far
          }

          // DISTANCE-AWARE: Use haversine on coordinates if available and no transit info
          if (requiredTransitMins <= 10) {
            const curCoords = current.location?.coordinates || current.coordinates;
            const nextCoords = next.location?.coordinates || next.coordinates;
            if (curCoords?.lat && curCoords?.lng && nextCoords?.lat && nextCoords?.lng) {
              const distKm = haversineDistanceKm(curCoords.lat, curCoords.lng, nextCoords.lat, nextCoords.lng);
              let distBasedMin = 10;
              if (distKm >= 0.5) distBasedMin = 15;
              if (distKm >= 2) distBasedMin = 20;
              if (distKm >= 5) distBasedMin = 30;
              if (distKm >= 15) distBasedMin = 45;
              if (distBasedMin > requiredTransitMins) {
                requiredTransitMins = distBasedMin;
                console.log(`[Stage 2] Day ${dayNumber}: GPS distance ${distKm.toFixed(1)}km between "${current.title}" → "${next.title}" → requiring ${distBasedMin}min buffer`);
              }
            }
          }

          // When current IS a transport activity, the travel is already accounted for.
          // But we still need an ARRIVAL BUFFER at the next venue:
          // - Museum/attraction entry (bag check, ticket queue): 10 min
          // - Restaurant (check-in, seated): 10 min
          // - Hotel (front desk, elevator): 15 min
          // - Generic venue: 10 min
          if (currentIsTransport) {
            const nextCat = (next.category || '').toLowerCase();
            const nextTitle = (next.title || '').toLowerCase();
            let arrivalBuffer = 10; // default venue entry
            if (nextCat === 'accommodation' || /hotel|check.?in/i.test(nextTitle)) {
              arrivalBuffer = 15;
            } else if (nextCat === 'dining' || /restaurant|cafe|lunch|dinner|breakfast|brunch/i.test(nextTitle)) {
              arrivalBuffer = 10;
            } else if (/museum|gallery|palace|castle|cathedral/i.test(nextTitle)) {
              arrivalBuffer = 10;
            }
            // For transport→venue, required gap is just the arrival buffer
            // (travel time is already in the transport activity duration)
            requiredTransitMins = Math.max(requiredTransitMins, arrivalBuffer);
          }

          // Absolute minimum: 10 min (even for adjacent venues)
          if (requiredTransitMins < 10) requiredTransitMins = 10;

          const actualGap = nextStartMins - currentEndMins;
          if (actualGap < requiredTransitMins) {
            // Shift this activity and all subsequent ones forward
            const deficit = requiredTransitMins - actualGap;
            for (let j = i + 1; j < generatedDay.activities.length; j++) {
              const act = generatedDay.activities[j];
              const s = parseTimeToMinutes(act.startTime || '');
              const e = parseTimeToMinutes(act.endTime || '');
              if (s !== null) act.startTime = minutesToHHMM(s + deficit);
              if (e !== null) act.endTime = minutesToHHMM(e + deficit);
            }
            shifted = true;
          }
        }
        if (shifted) {
          console.log(`[Stage 2] Day ${dayNumber}: Adjusted activity times to respect transportation durations`);
        }
      }

      // ==========================================================================
      // DEPARTURE DAY SEQUENCE FIX: Ensure checkout comes BEFORE airport transfer
      // ==========================================================================
      if (isLastDay && generatedDay.activities.length > 1) {
        const checkoutIndex = generatedDay.activities.findIndex(a => 
          (a.title || '').toLowerCase().includes('checkout') || 
          (a.title || '').toLowerCase().includes('check-out') ||
          (a.title || '').toLowerCase().includes('check out')
        );
        const airportIndex = generatedDay.activities.findIndex(a => 
          ((a.title || '').toLowerCase().includes('airport') || 
           (a.title || '').toLowerCase().includes('departure transfer')) &&
          (a.category === 'transport' || (a.title || '').toLowerCase().includes('transfer'))
        );
        
        // If checkout exists and comes AFTER airport transfer, swap them
        if (checkoutIndex !== -1 && airportIndex !== -1 && checkoutIndex > airportIndex) {
          console.log(`[Stage 2] Fixing departure day sequence: moving checkout (index ${checkoutIndex}) before airport transfer (index ${airportIndex})`);
          
          const checkoutActivity = generatedDay.activities[checkoutIndex];
          const airportActivity = generatedDay.activities[airportIndex];
          
          // Preserve durations; re-anchor sequence so checkout happens right before transfer.
          const checkoutDuration = Math.max(
            5,
            calculateDuration(checkoutActivity.startTime, checkoutActivity.endTime) || 15
          );
          const transferDuration = Math.max(
            10,
            calculateDuration(airportActivity.startTime, airportActivity.endTime) || 60
          );

          // Choose an anchor start that doesn't overlap the previous activity (typically breakfast).
          let anchorStart = airportActivity.startTime;
          try {
            const sorted = [...generatedDay.activities].sort((a, b) => {
              const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
              const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
              return ta - tb;
            });
            const airportPos = sorted.findIndex(a => a.id === airportActivity.id);
            if (airportPos > 0) {
              const prev = sorted[airportPos - 1];
              const prevEndMins = parseTimeToMinutes(prev?.endTime || '') ?? null;
              const airportStartMins = parseTimeToMinutes(airportActivity.startTime || '') ?? null;
              if (prevEndMins !== null && airportStartMins !== null && prevEndMins > airportStartMins) {
                anchorStart = minutesToHHMM(prevEndMins);
              }
            }
          } catch {
            // Non-fatal, keep original anchor
          }

          // Checkout happens first, then transfer begins immediately after.
          checkoutActivity.startTime = anchorStart;
          checkoutActivity.endTime = addMinutesToHHMM(anchorStart, checkoutDuration);
          airportActivity.startTime = checkoutActivity.endTime;
          airportActivity.endTime = addMinutesToHHMM(airportActivity.startTime, transferDuration);
          
          // Swap positions in array
          generatedDay.activities[airportIndex] = checkoutActivity;
          generatedDay.activities[checkoutIndex] = airportActivity;
          
          // Re-sort by start time to ensure proper order
          generatedDay.activities.sort((a, b) => {
            const timeA = parseTimeToMinutes(a.startTime || '') ?? 99999;
            const timeB = parseTimeToMinutes(b.startTime || '') ?? 99999;
            return timeA - timeB;
          });
        }
      }

      // ==========================================================================
      // DEPARTURE DAY DEDUP: Remove duplicate airport/transfer/departure entries
      // The AI sometimes generates extra "Head to Airport" or duplicate transfers
      // ==========================================================================
      if (isLastDay && generatedDay.activities.length > 2) {
        const airportKeywords = ['airport', 'departure transfer', 'flight departure', 'depart from'];
        const airportActivities = generatedDay.activities.filter(a => {
          const t = (a.title || '').toLowerCase();
          return airportKeywords.some(kw => t.includes(kw));
        });

        if (airportActivities.length > 2) {
          // Keep only the last 2 airport-related activities (Transfer + Departure)
          // Remove earlier duplicates like "Head to Airport"
          const toRemoveIds = new Set<string>();
          const airportToKeep = airportActivities.slice(-2);
          for (const act of airportActivities) {
            if (!airportToKeep.includes(act)) {
              toRemoveIds.add(act.id);
            }
          }
          if (toRemoveIds.size > 0) {
            const removedTitles = generatedDay.activities
              .filter(a => toRemoveIds.has(a.id))
              .map(a => a.title);
            console.log(`[Stage 2] Day ${dayNumber}: Removing ${toRemoveIds.size} duplicate airport activities: ${removedTitles.join(', ')}`);
            generatedDay.activities = generatedDay.activities.filter(a => !toRemoveIds.has(a.id));
          }
        }
      }

      // ==========================================================================
      // NON-FLIGHT DEPARTURE DAY: Strip airport activities when next leg is train/bus/car/ferry
      // ==========================================================================
      if (isLastDayInCity && !isLastDay && nextLegTransport && nextLegTransport !== 'flight') {
        const beforeCount = generatedDay.activities.length;
        generatedDay.activities = generatedDay.activities.filter((a: any) => {
          const t = (a.title || '').toLowerCase();
          const isAirportRef =
            t.includes('airport') ||
            t.includes('taxi to airport') ||
            t.includes('transfer to airport') ||
            t.includes('departure transfer to airport') ||
            t.includes('flight departure') ||
            t.includes('head to airport');
          return !isAirportRef;
        });
        const removed = beforeCount - generatedDay.activities.length;
        if (removed > 0) {
          console.log(`[Stage 2] Day ${dayNumber}: Stripped ${removed} airport activities (next leg is ${nextLegTransport}, not flight)`);
        }
      }

      // ==========================================================================
      // ARRIVAL DAY: Strip arrival/baggage/transfer activities — handled by Arrival Game Plan UI
      // ==========================================================================
      if (isFirstDay && generatedDay.activities.length > 0) {
        const beforeCount = generatedDay.activities.length;
        generatedDay.activities = generatedDay.activities.filter((a: any) => {
          const t = (a.title || '').toLowerCase();
          const isArrivalActivity =
            (t.includes('arrival at') && (t.includes('airport') || t.includes('baggage'))) ||
            t.includes('baggage claim') ||
            t.includes('airport arrival') ||
            t.includes('arrive at airport') ||
            t.includes('land at') ||
            (a.category === 'transport' && t.includes('airport') && !t.includes('transfer'));
          return !isArrivalActivity;
        });
        const removed = beforeCount - generatedDay.activities.length;
        if (removed > 0) {
          console.log(`[Stage 2] Day 1: Stripped ${removed} arrival/baggage activities (handled by Arrival Game Plan UI)`);
        }
      }

      const mustDoList = (context.mustDoActivities || '').split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
      const detectedMeals = detectMealSlots(generatedDay.activities || []);
      console.log(`[Stage 2] Day ${dayNumber} meal diagnostics: mode=${dayMealPolicy.dayMode}, required=[${dayMealPolicy.requiredMeals.join(', ')}], detected=[${detectedMeals.join(', ')}]`);
      const validation = validateGeneratedDay(generatedDay, dayNumber, isFirstDay, isLastDay, context.totalDays, previousDays, !!context.isSmartFinish, mustDoList, dayMealPolicy.requiredMeals);

      // ==========================================================================
      // MINIMUM REAL ACTIVITY COUNT VALIDATION
      // Reject days with only logistics (transport/accommodation/downtime)
      // Now pushes to validation.errors to trigger retry loop
      // ==========================================================================
      {
        const realActivities = (generatedDay.activities || []).filter((a: any) => {
          const title = (a.title || '').toLowerCase();
          const category = (a.category || '').toLowerCase();
          const isLogistics = category === 'transport' || category === 'accommodation' || category === 'downtime' ||
            title.includes('head to airport') || title.includes('check-in') || title.includes('check-out') ||
            title.includes('checkout') || title.includes('transfer') || title.includes('arrival at');
          return !isLogistics;
        });
        const minimumRealActivities = isLastDay ? 1 : (isFirstDay ? 3 : 5);
        if (realActivities.length < minimumRealActivities) {
          console.warn(`[Stage 2] Day ${dayNumber} has only ${realActivities.length} real activities (minimum: ${minimumRealActivities}) — triggering retry`);
          validation.errors.push(
            `Day ${dayNumber} has only ${realActivities.length} real activities (transport/accommodation don't count). Minimum is ${minimumRealActivities}. Add more sightseeing, dining, or experience activities.`
          );
          validation.isValid = false;
        }
      }

      // ==========================================================================
      // GAP DETECTION: Retry if there are gaps > 3 hours between activities
      // ==========================================================================
      if (!isLastDay && generatedDay.activities.length >= 2) {
        const sorted = [...generatedDay.activities]
          .filter((a: any) => a.startTime)
          .sort((a: any, b: any) => {
            const parseMin = (t: string) => {
              const m = t.match(/(\d{1,2}):(\d{2})/);
              return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
            };
            return parseMin(a.startTime) - parseMin(b.startTime);
          });

        for (let i = 0; i < sorted.length - 1; i++) {
          const currentEnd = sorted[i].endTime || sorted[i].startTime;
          const nextStart = sorted[i + 1].startTime;
          if (currentEnd && nextStart) {
            const parseMin = (t: string) => {
              const m = t.match(/(\d{1,2}):(\d{2})/);
              return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
            };
            const gap = parseMin(nextStart) - parseMin(currentEnd);
            if (gap > 180) {
              console.warn(`[Stage 2] Day ${dayNumber} has a ${Math.round(gap / 60)}h gap between "${sorted[i].title}" (ends ${currentEnd}) and "${sorted[i + 1].title}" (starts ${nextStart}) — triggering retry`);
              validation.errors.push(
                `There is a ${Math.round(gap / 60)}-hour gap between "${sorted[i].title}" (ends ${currentEnd}) and "${sorted[i + 1].title}" (starts ${nextStart}). Fill this gap with activities, meals, or experiences. A full day should have no gaps longer than 2 hours unless it's intentional free time.`
              );
              validation.isValid = false;
              break;
            }
          }
        }
      }

      // ==========================================================================
      // USER PREFERENCE VALIDATION — now triggers retries
      // ==========================================================================
      {
        const userNotes = (preferenceContext || '').toLowerCase();
        const allActivityText = generatedDay.activities.map((a: any) => 
          `${(a.title || '')} ${(a.description || '')}`
        ).join(' ').toLowerCase();

        const ACTIVITY_KEYWORDS: Record<string, string[]> = {
          'skiing': ['ski', 'snow', 'slopes', 'big snow', 'mountain creek', 'ski resort'],
          'surfing': ['surf', 'beach break', 'waves', 'surf lesson'],
          'hiking': ['hike', 'trail', 'trek', 'summit'],
          'museum': ['museum', 'gallery', 'exhibit'],
          'shopping': ['shop', 'mall', 'boutique', 'market'],
          'spa': ['spa', 'massage', 'wellness', 'sauna'],
          'snorkeling': ['snorkel', 'reef', 'underwater'],
          'diving': ['dive', 'scuba', 'underwater'],
        };

        for (const [activity, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
          if (userNotes.includes(activity)) {
            const dayHasThis = keywords.some(kw => allActivityText.includes(kw));
            if (!dayHasThis && !isLastDay) {
              console.warn(`[Stage 2] User requested "${activity}" but Day ${dayNumber} has no matching activities — triggering retry`);
              validation.errors.push(
                `User explicitly requested "${activity}" but Day ${dayNumber} contains ZERO ${activity}-related activities. You MUST include at least one ${activity} activity. Check the user's preferences and honor them.`
              );
              validation.isValid = false;
            }
          }
        }

        // Check for "light dining" preference violations
        const wantsLightDining = userNotes.includes('light dinner') || userNotes.includes('light meal') || userNotes.includes('casual dinner') || userNotes.includes('simple dinner') || userNotes.includes('quick bite');
        if (wantsLightDining) {
          for (const act of generatedDay.activities) {
            const isDining = ((act as any).category || '').toLowerCase() === 'dining';
            const cost = (act as any).cost?.amount || 0;
            if (isDining && cost > 50) {
              console.warn(`[Stage 2] User requested light dining but got "${(act as any).title}" at $${cost} — triggering retry`);
              validation.errors.push(
                `User requested a light/casual dinner but "${(act as any).title}" costs $${cost}. Replace with a casual, affordable option under $40. The user explicitly asked for light dining — respect their preference.`
              );
              validation.isValid = false;
            }
          }
        }

        // Check for budget preference violations
        const wantsBudget = userNotes.includes('budget') || userNotes.includes('cheap') || userNotes.includes('affordable') || userNotes.includes('save money') || userNotes.includes('low cost');
        if (wantsBudget) {
          const expensiveActivities = generatedDay.activities.filter((a: any) => {
            const cost = (a as any).cost?.amount || 0;
            return cost > 75;
          });
          if (expensiveActivities.length > 0) {
            const names = expensiveActivities.map((a: any) => `"${a.title}" ($${(a as any).cost?.amount})`).join(', ');
            console.warn(`[Stage 2] User wants budget trip but Day ${dayNumber} has expensive activities: ${names} — triggering retry`);
            validation.errors.push(
              `User requested a BUDGET trip but Day ${dayNumber} includes expensive activities: ${names}. Replace with affordable alternatives under $50 each. The user explicitly asked for budget-friendly options.`
            );
            validation.isValid = false;
          }
        }
      }

      // Transition day validation: MUST contain at least one inter-city transport activity
      if (isTransitionDay && dayCity?.transitionFrom && dayCity?.transitionTo) {
        const hasTransport = generatedDay.activities?.some((a: any) => {
          const title = (a.title || '').toLowerCase();
          const category = (a.category || '').toLowerCase();
          const fromCity = (dayCity.transitionFrom || '').toLowerCase();
          const toCity = (dayCity.transitionTo || '').toLowerCase();
          return (category === 'transport' || category === 'transit') &&
            (title.includes(fromCity) || title.includes(toCity) ||
             title.includes('train') || title.includes('flight') || title.includes('bus') ||
             title.includes('eurostar') || title.includes('ferry'));
        });
        if (!hasTransport) {
          validation.errors.push(
            `Transition day ${dayNumber} (${dayCity.transitionFrom} → ${dayCity.transitionTo}) MUST contain at least one inter-city transport activity`
          );
          validation.isValid = false;
        }
      }

      // Smart Finish quality gate: ensure days are fully built out, not sparse drafts.
      if (context.isSmartFinish) {
        const minSmartFinishActivities = (isFirstDay || isLastDay) ? 6 : 8;
        if ((generatedDay.activities?.length || 0) < minSmartFinishActivities) {
          validation.errors.push(
            `Smart Finish requires at least ${minSmartFinishActivities} activities on Day ${dayNumber}; got ${generatedDay.activities?.length || 0}`
          );
          validation.isValid = false;
        }
      }

      lastValidation = validation;

      if (validation.errors.length > 0) {
        console.warn(`[Stage 2] Day ${dayNumber} validation errors:`, validation.errors);
      }
      if (validation.warnings.length > 0) {
        console.log(`[Stage 2] Day ${dayNumber} validation warnings:`, validation.warnings);
      }

      // If valid, return the day. On last retry, return only if NOT Smart Finish with hard errors.
      const hasHardErrors = validation.errors.length > 0;
      const isLastAttempt = attempt === maxRetries;
      const smartFinishBlocksReturn = context.isSmartFinish && hasHardErrors;
      if (validation.isValid || (isLastAttempt && !smartFinishBlocksReturn)) {
        // POST-VALIDATION: Strip any duplicate activities that slipped through
        const { day: dedupedDay, removed: removedDupes } = deduplicateActivities(generatedDay);
        if (removedDupes.length > 0) {
          console.warn(`[Stage 2] Day ${dayNumber}: Removed ${removedDupes.length} duplicate(s): ${removedDupes.join(', ')}`);
          generatedDay = dedupedDay;
        }

        // ====================================================================
        // MEAL INJECTION FALLBACK — If retries exhausted and meals still missing,
        // inject stub meal activities so no full day ships without B/L/D
        // ====================================================================
        if (isLastAttempt && !isFirstDay && !isLastDay) {
          const mealSlots: { type: string; keywords: string[]; time: string; endTime: string }[] = [
            { type: 'Breakfast', keywords: ['breakfast', 'brunch'], time: '08:30', endTime: '09:15' },
            { type: 'Lunch', keywords: ['lunch'], time: '12:30', endTime: '13:30' },
            { type: 'Dinner', keywords: ['dinner', 'supper', 'evening meal'], time: '19:00', endTime: '20:15' },
          ];

          for (const slot of mealSlots) {
            const hasMeal = generatedDay.activities.some((a: any) => {
              const title = (a.title || '').toLowerCase();
              const category = (a.category || '').toLowerCase();
              const isDining = category === 'dining' || category.includes('dining');
              const matchesMeal = slot.keywords.some(kw => title.includes(kw) || category.includes(kw));
              return isDining && matchesMeal;
            });

            if (!hasMeal) {
              const destination = context.destination || 'the destination';
              console.warn(`[Stage 2] Day ${dayNumber}: INJECTING missing ${slot.type} (retries exhausted)`);
              const stubMeal: any = {
                id: `injected-${slot.type.toLowerCase()}-${dayNumber}`,
                title: `${slot.type} — Local Restaurant`,
                startTime: slot.time,
                endTime: slot.endTime,
                category: 'dining',
                location: { name: `${slot.type} spot in ${destination}`, address: destination },
                cost: { amount: slot.type === 'Breakfast' ? 12 : slot.type === 'Lunch' ? 18 : 30, currency: context.currency || 'USD', source: 'injected_fallback' },
                description: `${slot.type} at a well-reviewed local spot. This meal was auto-added to ensure your day includes all three meals.`,
                tags: ['dining', slot.type.toLowerCase()],
                bookingRequired: false,
                transportation: { method: 'walk', duration: '5 min', estimatedCost: { amount: 0, currency: context.currency || 'USD' }, instructions: 'Short walk from previous activity' },
                tips: `Ask your hotel for a ${slot.type.toLowerCase()} recommendation nearby.`,
                _injected: true,
              };
              generatedDay.activities.push(stubMeal);
            }
          }

          // Re-sort activities by start time after injection
          generatedDay.activities.sort((a: any, b: any) => {
            const parseMin = (t: string) => {
              const m = (t || '').match(/(\d{1,2}):(\d{2})/);
              return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
            };
            return parseMin(a.startTime) - parseMin(b.startTime);
          });
        }

        // Tag day with multi-city info
        if (context.isMultiCity && dayCity) {
          generatedDay.city = dayCity.cityName;
          generatedDay.country = dayCity.country;
          generatedDay.isTransitionDay = dayCity.isTransitionDay;
          generatedDay.transitionFrom = dayCity.transitionFrom;
          generatedDay.transitionTo = dayCity.transitionTo;
          // Preserve transportComparison from AI response
          if (generatedDay.transportComparison) {
            console.log(`[Stage 2] Day ${dayNumber}: Transport comparison with ${generatedDay.transportComparison.length} options`);
          }
        }
        console.log(`[Stage 2] Day ${dayNumber} generated successfully (${generatedDay.activities.length} activities${dayCity ? `, city: ${dayCity.cityName}` : ''})`);
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
  const BATCH_SIZE = 3; // Generate 3 days at a time for speed (parallel)

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
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // ── Post-batch dedup pass ──────────────────────────────────────
  // Within a parallel batch, days can't see each other's activities,
  // so duplicates may appear. Detect and rename them here.
  const seenTitles = new Map<string, { dayNum: number; actIdx: number }>();
  let dedupCount = 0;
  for (const day of days) {
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i];
      const key = (act.title || act.name || '').toLowerCase().trim();
      if (!key) continue;
      // Skip logistics/accommodation — duplicates are expected (hotel check-in, etc.)
      const cat = (act.category || '').toLowerCase();
      if (['transport', 'transportation', 'accommodation', 'transfer', 'logistics'].includes(cat)) continue;

      const existing = seenTitles.get(key);
      if (existing && existing.dayNum !== day.dayNumber) {
        // Mark as duplicate — append day number to make title unique
        // The next generation stage or enrichment can refine this
        console.log(`[Stage 2] Dedup: "${act.title}" appears on Day ${existing.dayNum} and Day ${day.dayNumber}`);
        act.title = `${act.title} (Day ${day.dayNumber} version)`;
        act._isDuplicate = true;
        dedupCount++;
      } else {
        seenTitles.set(key, { dayNum: day.dayNumber, actIdx: i });
      }
    }
  }
  if (dedupCount > 0) {
    console.log(`[Stage 2] Post-batch dedup: marked ${dedupCount} duplicate activities`);
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

/**
 * Calculate haversine distance between two lat/lng points in km
 */
function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geocode a destination name to get its center coordinates for location biasing
 */
async function getDestinationCenter(
  destination: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${apiKey}`
    );
    const data = await response.json();
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

// Cache destination centers to avoid repeated geocoding
const destinationCenterCache = new Map<string, { lat: number; lng: number } | null>();

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
    // Get destination center for location biasing (cached)
    let destCenter = destinationCenterCache.get(destination);
    if (destCenter === undefined) {
      destCenter = await getDestinationCenter(destination, GOOGLE_MAPS_API_KEY);
      destinationCenterCache.set(destination, destCenter);
    }

    const textQuery = `${venueName} ${destination}`;
    console.log(`[Stage 4] Verifying venue: ${venueName}`);

    // Use AbortController for 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Build request body with location bias to strongly prefer results near destination
    const requestBody: Record<string, unknown> = {
      textQuery,
      maxResultCount: 1,
    };

    if (destCenter) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: destCenter.lat, longitude: destCenter.lng },
          radius: 30000.0, // 30km radius bias
        },
      };
    }

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.websiteUri,places.googleMapsUri",
        },
        body: JSON.stringify(requestBody),
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

    // CRITICAL: Distance guard — reject venues that are too far from the destination
    if (destCenter && place.location) {
      const distKm = haversineDistanceKm(
        destCenter.lat, destCenter.lng,
        place.location.latitude, place.location.longitude
      );
      if (distKm > 50) {
        console.log(`[Stage 4] ❌ REJECTED venue "${venueName}" → "${place.displayName?.text}" is ${distKm.toFixed(0)}km from ${destination} (max 50km)`);
        return null;
      }
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

  // CRITICAL FIX: Add a real per-activity timeout to prevent one slow enrichment from killing the whole request.
  // Edge runtime has a hard wall-clock limit; each activity must resolve quickly.
  const ENRICHMENT_TIMEOUT_MS = 10_000;

  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Enrichment timed out after ${ENRICHMENT_TIMEOUT_MS}ms`));
    }, ENRICHMENT_TIMEOUT_MS);
  });

  try {
    // Run venue verification, photo fetch, and Viator search in parallel
    const [venueData, photoResult, viatorMatch] = await Promise.race([
      Promise.all([
        verifyVenueWithDualAI(activity, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY)
          .catch(e => { console.log(`[Stage 4] Venue verify timeout/error for "${activity.title}":`, e.message); return null; }),
        !enriched.photos?.length 
          ? fetchActivityImage(activity.title, activity.category || 'sightseeing', destination, supabaseUrl, supabaseKey)
              .catch(e => { console.log(`[Stage 4] Image fetch timeout/error for "${activity.title}":`, e.message); return null; })
          : Promise.resolve(null),
        shouldSearchViator
          ? searchViatorForActivity(activity.title, destination, activity.category || 'sightseeing', supabaseUrl, supabaseKey)
              .catch(e => { console.log(`[Stage 4] Viator search timeout/error for "${activity.title}":`, e.message); return null; })
          : Promise.resolve(null),
      ]),
      timeoutPromise,
    ]);

    if (timeoutId !== undefined) clearTimeout(timeoutId);

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
  } catch (e) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    // Timeout or unexpected error — return activity with minimal enrichment
    console.warn(`[Stage 4] Enrichment aborted for "${activity.title}" (${e instanceof Error ? e.message : e})`);
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

  // Hard cap total Stage 4 time so we always return a response before edge runtime termination.
  const STAGE4_TIME_BUDGET_MS = 45_000;
  const stage4StartedAt = Date.now();

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const enrichedActivities: StrictActivity[] = [];

    // Process activities in batches of 3 with delays for rate limits
    // (3 activities × 2 API calls each = ~6 concurrent requests per batch)
    const BATCH_SIZE = 3;
    let budgetExceeded = false;

    for (let i = 0; i < day.activities.length; i += BATCH_SIZE) {
      const elapsedMs = Date.now() - stage4StartedAt;
      if (elapsedMs >= STAGE4_TIME_BUDGET_MS) {
        console.warn(`[Stage 4] Time budget reached at day ${day.dayNumber}. Returning remaining activities without enrichment.`);
        enrichedActivities.push(...day.activities.slice(i));
        budgetExceeded = true;
        break;
      }

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

    // If we hit the budget mid-trip, append remaining days as-is and return safely.
    if (budgetExceeded) {
      const remainingDays = days.slice(dayIndex + 1);
      if (remainingDays.length > 0) {
        console.warn(`[Stage 4] Appending ${remainingDays.length} remaining day(s) without enrichment due to time budget.`);
        enrichedDays.push(...remainingDays);
      }
      break;
    }
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
    // Canonical format: top-level `days` array so frontend parsers (parseItineraryDays)
    // read it directly via data.days. We also keep `itinerary.days` for backward compat.
    const generatedAccommodationNotes = enrichedData.days.flatMap(d => d.accommodationNotes || []).filter(Boolean).slice(0, 5);
    const generatedPracticalTips = enrichedData.days.flatMap(d => d.practicalTips || []).filter(Boolean).slice(0, 6);

    // For Smart Finish, preserve user-imported notes if generation didn't produce any
    let finalAccommodationNotes = generatedAccommodationNotes;
    let finalPracticalTips = generatedPracticalTips;
    if (context.isSmartFinish) {
      try {
        const { data: tripMeta } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
        const meta = tripMeta?.metadata || {};
        if (finalAccommodationNotes.length === 0 && Array.isArray(meta.accommodationNotes) && meta.accommodationNotes.length > 0) {
          finalAccommodationNotes = meta.accommodationNotes;
          console.log('[Stage 6] Preserving user-imported accommodationNotes from metadata');
        }
        if (finalPracticalTips.length === 0 && Array.isArray(meta.practicalTips) && meta.practicalTips.length > 0) {
          finalPracticalTips = meta.practicalTips;
          console.log('[Stage 6] Preserving user-imported practicalTips from metadata');
        }
      } catch (e) {
        console.warn('[Stage 6] Could not fetch metadata for note preservation:', e);
      }
    }

    const frontendReadyData = {
      success: true,
      status: 'ready',
      destination: context.destination,
      title: `${context.destination} - ${context.totalDays} Days`,
      tripId: context.tripId,
      totalDays: context.totalDays,
      // CANONICAL: top-level days array — this is what parseItineraryDays reads
      days: enrichedData.days,
      // Backward compat: keep nested itinerary.days for historical readers
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
      accommodationNotes: finalAccommodationNotes,
      practicalTips: finalPracticalTips,
      overview: enrichedData.overview,
      enrichmentMetadata: enrichedData.enrichmentMetadata
    };

    // Build DNA snapshot from unified profile for audit trail
    const dnaSnapshot = context.travelerDNA ? {
      archetype: context.travelerDNA.primaryArchetype,
      secondaryArchetype: context.travelerDNA.secondaryArchetype,
      traitScores: context.travelerDNA.traits,
      budgetTier: context.budgetTier,
      snapshotAt: new Date().toISOString(),
    } : null;

    // Compute correct end_date from the actual generated days
    // IMPORTANT: Never shrink end_date — only extend it if generation produced more days
    let computedEndDate: string | undefined;
    try {
      const daysArray = frontendReadyData?.days || frontendReadyData?.itinerary?.days;
      if (Array.isArray(daysArray) && daysArray.length > 0 && tripId) {
        const { data: tripRow } = await supabase
          .from('trips')
          .select('start_date, end_date')
          .eq('id', tripId)
          .single();
        if (tripRow?.start_date) {
          // Use timezone-safe formatDate helper instead of toISOString()
          const newEndDate = formatDate(tripRow.start_date, daysArray.length - 1);
          const existingEndDate = tripRow.end_date;

          // Calculate expected days from the stored date range
          if (existingEndDate) {
            const expectedDays = calculateDays(tripRow.start_date, existingEndDate);
            if (daysArray.length < expectedDays) {
              console.warn(`[Stage 6] Generated ${daysArray.length} days but trip has ${expectedDays} expected days (${tripRow.start_date} to ${existingEndDate}). Padding with blank days.`);
              // Pad the days array with blank placeholder days so UI always shows all expected days
              for (let padIdx = daysArray.length; padIdx < expectedDays; padIdx++) {
                const padDate = formatDate(tripRow.start_date, padIdx);
                const blankDay = {
                  dayNumber: padIdx + 1,
                  date: padDate,
                  theme: 'Free Day',
                  description: 'This day is yours to explore freely.',
                  activities: [],
                };
                daysArray.push(blankDay);
              }
              // Update the nested copy too
              if (frontendReadyData?.itinerary?.days) {
                frontendReadyData.itinerary.days = daysArray;
              }
              console.log(`[Stage 6] Padded to ${daysArray.length} days`);
              // Don't set computedEndDate — keep existing end_date
            } else if (daysArray.length > expectedDays) {
              console.log(`[Stage 6] Generated ${daysArray.length} days (more than expected ${expectedDays}). Extending end_date to ${newEndDate}.`);
              computedEndDate = newEndDate;
            }
            // If equal, no need to update
          } else {
            // No existing end_date, safe to set
            computedEndDate = newEndDate;
          }
        }
      }
    } catch (e) {
      console.warn('[Stage 6] Could not compute end_date:', e);
    }

    const updatePayload: Record<string, unknown> = {
      itinerary_data: frontendReadyData,
      itinerary_status: 'ready',
      dna_snapshot: dnaSnapshot,
      updated_at: new Date().toISOString(),
      ...(context.blendedDnaSnapshot && { blended_dna: context.blendedDnaSnapshot }),
    };
    if (computedEndDate) {
      updatePayload.end_date = computedEndDate;
    }

    const { error } = await supabase
      .from('trips')
      .update(updatePayload)
      .eq('id', tripId);

    if (error) {
      console.error('[Stage 6] Final save failed:', error);
      return false;
    }

    console.log('[Stage 6] Final save successful');

    // Trigger next journey leg if applicable
    await triggerNextJourneyLeg(supabase, tripId);

    // =========================================================================
    // PHASE 4: Write activity_costs rows — single source of truth for all totals
    // =========================================================================
    try {
      const allDays = enrichedData.days || [];
      const costRows: Array<Record<string, unknown>> = [];

      for (const day of allDays) {
        for (const act of (day.activities || [])) {
          // Skip downtime / free-time blocks
          const cat = (act.category || 'activity').toLowerCase();
          if (['downtime', 'free_time', 'accommodation'].includes(cat)) continue;

          const rawCost = (act as any).cost || (act as any).estimatedCost || { amount: 0, currency: 'USD' };
          let costPerPerson = typeof rawCost === 'number' ? rawCost : (rawCost.amount || 0);

          // Map itinerary categories to cost_reference categories
          const categoryMap: Record<string, string> = {
            dining: 'dining', breakfast: 'dining', brunch: 'dining', lunch: 'dining',
            dinner: 'dining', cafe: 'dining', coffee: 'dining', food: 'dining', restaurant: 'dining',
            transport: 'transport', transportation: 'transport', taxi: 'transport', metro: 'transport',
            activity: 'activity', attraction: 'activity', museum: 'activity', tour: 'activity',
            sightseeing: 'activity', experience: 'activity', entertainment: 'activity',
            nightlife: 'nightlife', bar: 'nightlife', club: 'nightlife',
            shopping: 'shopping', market: 'shopping',
          };
          const mappedCategory = categoryMap[cat] || 'activity';

          // "Never free" estimation: if AI returned $0 for categories that always cost money,
          // apply a reasonable default so DB values match frontend display
          if (costPerPerson <= 0) {
            const NEVER_FREE_CATEGORIES = [
              'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee',
              'cruise', 'boat', 'tour', 'activity', 'experience', 'spa', 'massage', 'show',
              'performance', 'concert', 'theater', 'theatre', 'nightlife', 'bar', 'club',
              'transfer', 'transport', 'transportation', 'airport', 'taxi', 'uber', 'rideshare',
            ];
            const NEVER_FREE_TITLE_KW = [
              'breakfast', 'brunch', 'lunch', 'dinner', 'cruise', 'tour',
              'restaurant', 'café', 'cafe', 'transfer', 'airport', 'taxi',
              'uber', 'private car', 'shuttle', 'train to', 'bus to',
            ];
            const titleLower = ((act as any).title || '').toLowerCase();
            const isNeverFree = NEVER_FREE_CATEGORIES.some(nfc => cat.includes(nfc)) ||
              NEVER_FREE_TITLE_KW.some(kw => titleLower.includes(kw));

            // Skip walks — they're always free
            const isWalk = ['walk', 'walking', 'stroll'].includes(cat) ||
              ['walk to', 'walk through', 'stroll', 'evening walk', 'neighborhood walk'].some(kw => titleLower.includes(kw));

            if (isNeverFree && !isWalk) {
              // Category-based default estimates (per person, USD)
              const defaults: Record<string, number> = {
                dining: 30, transport: 15, activity: 25, nightlife: 25, shopping: 20,
              };
              // Refine for meal type from title
              if (titleLower.includes('breakfast') || titleLower.includes('coffee') || titleLower.includes('café') || titleLower.includes('cafe')) {
                costPerPerson = 15;
              } else if (titleLower.includes('lunch') || titleLower.includes('brunch')) {
                costPerPerson = 25;
              } else if (titleLower.includes('dinner')) {
                costPerPerson = 40;
              } else if (titleLower.includes('transfer') || titleLower.includes('taxi') || titleLower.includes('uber') || titleLower.includes('shuttle')) {
                costPerPerson = 20;
              } else if (titleLower.includes('private car')) {
                costPerPerson = 50;
              } else {
                costPerPerson = defaults[mappedCategory] || 25;
              }
              console.log(`[Phase 4] Estimated $${costPerPerson}/pp for "${(act as any).title}" (was $0, category: ${cat})`);
            }
          }

          costRows.push({
            trip_id: tripId,
            activity_id: act.id,
            day_number: day.dayNumber || 1,
            cost_per_person_usd: Math.min(costPerPerson, 2000), // safety cap
            num_travelers: context.travelers || 1,
            category: mappedCategory,
            source: costPerPerson > 0 && (typeof rawCost === 'number' ? rawCost : (rawCost.amount || 0)) <= 0 ? 'estimated' : 'reference',
            confidence: costPerPerson > 0 && (typeof rawCost === 'number' ? rawCost : (rawCost.amount || 0)) <= 0 ? 'low' : 'medium',
          });
        }
      }

      if (costRows.length > 0) {
        // Delete existing rows for this trip, then insert fresh
        await supabase.from('activity_costs').delete().eq('trip_id', tripId);
        const { error: costErr } = await supabase.from('activity_costs').insert(costRows);
        if (costErr) {
          console.warn('[Stage 6] activity_costs insert error (non-blocking):', costErr.message);
        } else {
          console.log(`[Stage 6] Wrote ${costRows.length} activity_costs rows`);
        }
      }
    } catch (costWriteErr) {
      console.warn('[Stage 6] activity_costs write failed (non-blocking):', costWriteErr);
    }

    // =========================================================================
    // PHASE 5: Update trip_cities generation_status to 'generated'
    // =========================================================================
    try {
      const totalDays = (enrichedData.days || []).length;
      await supabase
        .from('trip_cities')
        .update({
          generation_status: 'generated',
          days_generated: totalDays,
        } as any)
        .eq('trip_id', tripId);
      console.log(`[Stage 6] Updated trip_cities generation_status to 'generated' (${totalDays} days)`);
    } catch (statusErr) {
      console.warn('[Stage 6] trip_cities status update failed (non-blocking):', statusErr);
    }

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
// TRIP ACCESS VERIFICATION HELPER
// Verifies user has access to trip (owner or accepted collaborator with edit permission)
// =============================================================================
interface TripAccessResult {
  allowed: boolean;
  isOwner: boolean;
  reason?: string;
}

async function verifyTripAccess(
  supabase: any,
  tripId: string,
  userId: string,
  requireEditPermission: boolean = false
): Promise<TripAccessResult> {
  if (!tripId || !userId) {
    return { allowed: false, isOwner: false, reason: "Missing tripId or userId" };
  }
  
  // Check if user is the trip owner
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();
  
  if (tripError || !trip) {
    return { allowed: false, isOwner: false, reason: "Trip not found" };
  }
  
  // Owner has full access
  if (trip.user_id === userId) {
    return { allowed: true, isOwner: true };
  }
  
  // Check collaborator access
  const { data: collab } = await supabase
    .from('trip_collaborators')
    .select('permission')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  
  if (!collab) {
    return { allowed: false, isOwner: false, reason: "Access denied - not a collaborator" };
  }
  
  // If we need edit permission, check the permission level
  if (requireEditPermission) {
    const hasEditPermission = collab.permission === 'edit' || 
                              collab.permission === 'admin' ||
                              collab.permission === 'editor' ||
                              collab.permission === 'contributor';
    if (!hasEditPermission) {
      return { allowed: false, isOwner: false, reason: "Viewer access only - cannot generate itinerary" };
    }
  }
  
  return { allowed: true, isOwner: false };
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

    // ── Service-role auth bypass for server-to-server self-chaining ──
    // When generate-trip-day calls itself via fetch() with the SERVICE_ROLE_KEY,
    // validateAuth() fails because a service role key is not a user JWT.
    // Detect this case and trust the userId from the request body instead.
    const bearerToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const isServiceRoleCall = bearerToken === supabaseKey;

    let authResult: { userId: string } | null = null;

    if (isServiceRoleCall) {
      // Parse body to peek at action + userId (we'll re-parse later via req.json() — 
      // but since we need to check before full routing, clone the request)
      const clonedReq = req.clone();
      const peekBody = await clonedReq.json();
      
      const allowedServiceRoleActions = ['generate-trip', 'generate-trip-day', 'generate-day', 'regenerate-day'];
      if (allowedServiceRoleActions.includes(peekBody.action) && peekBody.userId) {
        // Trusted internal call — skip user-auth, use provided userId
        authResult = { userId: peekBody.userId };
        console.log(`[generate-itinerary] Service-role bypass for ${peekBody.action}, userId: ${authResult.userId}`);
      } else {
        // Service role key used for a non-whitelisted action — reject
        console.error(`[generate-itinerary] Service-role call for non-whitelisted action: ${peekBody.action}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized action for service role" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Normal user request — validate JWT as usual
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
      });

      authResult = await validateAuth(req, authClient);
      if (!authResult) {
        console.error("[generate-itinerary] Unauthorized request");
        return new Response(
          JSON.stringify({ error: "Unauthorized. Please sign in to generate itineraries." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    console.log(`[generate-itinerary] Authenticated user: ${authResult.userId}`);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`);

    // Rate limit check for expensive operations
    const rateCheck = await checkRateLimit(supabase, authResult.userId, action);
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
      const { tripId, tripData, smartFinishMode: requestSmartFinishMode } = params;
      
      // PHASE 2 FIX: Use authenticated user ID as the canonical source of truth
      // This fixes missing personalization and hardens security (prevents userId spoofing)
      const userId = authResult.userId;
      
      // Security guard: if request body includes userId that differs from auth token, log and reject
      if (params.userId && params.userId !== userId) {
        console.warn(`[generate-full] userId mismatch! auth=${userId}, params=${params.userId} - rejecting`);
        return new Response(
          JSON.stringify({ error: "User ID mismatch. Please re-authenticate." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify trip access: user must be owner or accepted collaborator with edit permission
      const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, true);
      if (!tripAccessResult.allowed) {
        console.warn(`[generate-full] Access denied: user=${userId}, trip=${tripId}, reason=${tripAccessResult.reason}`);
        return new Response(
          JSON.stringify({ error: tripAccessResult.reason || "Trip not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[generate-full] ✓ Using authenticated userId: ${userId} (trip owner: ${tripAccessResult.isOwner})`);

      // =========================================================================
      // Credit authorization is handled by the client-side generation gate
      // (useGenerationGate.ts) BEFORE this function is called.
      // The gate charges credits at 60/day and only invokes this function
      // when authorized. No duplicate check needed here.
      // =========================================================================
      let originalTotalDays = 0; // Set after context prep

      // =======================================================================
      // STAGE 1.1: Prepare trip context (MUST happen before any context.* access)
      // =======================================================================
      const context = await prepareContext(supabase, tripId, userId, undefined, requestSmartFinishMode);
      if (!context) {
        console.error(`[generate-full] prepareContext returned null for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Trip not found or missing required data" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      originalTotalDays = context.totalDays;
      console.log(`[Stage 1.1] ✓ Context prepared: ${context.totalDays} days in ${context.destination}`);

      // Get user preferences for personalization
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      let prefs = userId ? await getUserPreferences(supabase, userId) : null;
      
      // =======================================================================
      // GROUP PREFERENCE BLENDING - For multi-traveler trips with linked friends
      // =======================================================================
      console.log("[Stage 1.2] Checking for trip collaborators...");
      const collaboratorPrefs = await getCollaboratorPreferences(supabase, tripId);
      let groupBlendingPromptSection = '';
      let blendedDnaSnapshot: Record<string, unknown> | null = null;
      
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

        // Build collaborator traveler list for suggestedFor attribution
        // Query BOTH trip_collaborators AND trip_members
        const [{ data: collabRows }, { data: memberRows }] = await Promise.all([
          supabase
            .from('trip_collaborators')
            .select('user_id')
            .eq('trip_id', tripId)
            .eq('include_preferences', true),
          supabase
            .from('trip_members')
            .select('user_id')
            .eq('trip_id', tripId)
            .not('user_id', 'is', null),
        ]);

        // Merge unique participant IDs from both tables
        const participantIds = new Set<string>();
        (collabRows || []).forEach((c: any) => { if (c.user_id) participantIds.add(c.user_id); });
        (memberRows || []).forEach((m: any) => { if (m.user_id) participantIds.add(m.user_id); });
        participantIds.delete(userId || ''); // Remove owner, we'll prepend

        const allUserIds = [userId, ...Array.from(participantIds)].filter(Boolean);
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, display_name, handle')
          .in('id', allUserIds);

        const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));

        context.collaboratorTravelers = allUserIds.map(uid => ({
          userId: uid!,
          name: profileMap.get(uid!) || 'Traveler',
        }));
        console.log(`[Stage 1.2] Attribution travelers: ${context.collaboratorTravelers.map(t => `${t.name}(${t.userId.slice(0,8)})`).join(', ')} (collabs: ${(collabRows || []).length}, members: ${(memberRows || []).length})`);

        // =======================================================================
        // STAGE 1.2.1: ARCHETYPE-LEVEL GROUP BLENDING
        // Load each companion's Travel DNA, run blendGroupArchetypes(), inject prompt
        // =======================================================================
        console.log("[Stage 1.2.1] Loading companion archetypes for group blending...");
        try {
          // Load companion DNA profiles
          const companionUserIds = Array.from(participantIds).filter(Boolean);
          const { data: companionDnaRows } = await supabase
            .from('travel_dna_profiles')
            .select('user_id, primary_archetype_name, trait_scores, travel_dna_v2')
            .in('user_id', companionUserIds);

          // Build TravelerArchetype array for blendGroupArchetypes
          const travelers: TravelerArchetype[] = [];
          
          // Add owner
          const ownerDnaRow = await supabase
            .from('travel_dna_profiles')
            .select('primary_archetype_name, trait_scores')
            .eq('user_id', userId)
            .maybeSingle();
          
          const ownerArchetype = ownerDnaRow?.data?.primary_archetype_name || 'balanced_story_collector';
          travelers.push({
            travelerId: userId,
            name: profileMap.get(userId) || 'You',
            archetype: ownerArchetype,
            isPrimary: true,
          });

          // Add companions with DNA
          const companionTraitScoresMap = new Map<string, Record<string, number>>();
          for (const dna of (companionDnaRows || [])) {
            const archetype = dna.primary_archetype_name 
              || (dna.travel_dna_v2 as any)?.primary_archetype_name 
              || 'balanced_story_collector';
            travelers.push({
              travelerId: dna.user_id,
              name: profileMap.get(dna.user_id) || 'Guest',
              archetype,
              isPrimary: false,
            });
            // Store trait scores for blending
            const rawScores = dna.trait_scores || (dna.travel_dna_v2 as any)?.trait_scores || {};
            companionTraitScoresMap.set(dna.user_id, {
              pace: Number(rawScores.pace ?? rawScores.travel_pace ?? 0),
              budget: Number(rawScores.budget ?? rawScores.value_focus ?? 0),
              social: Number(rawScores.social ?? rawScores.social_battery ?? 0),
              planning: Number(rawScores.planning ?? rawScores.planning_preference ?? 0),
              comfort: Number(rawScores.comfort ?? rawScores.comfort_level ?? 0),
              authenticity: Number(rawScores.authenticity ?? rawScores.cultural_depth ?? 0),
              adventure: Number(rawScores.adventure ?? rawScores.risk_tolerance ?? 0),
              cultural: Number(rawScores.cultural ?? rawScores.cultural_interest ?? 0),
              transformation: Number(rawScores.transformation ?? rawScores.wellness ?? 0),
            });
          }

          if (travelers.length > 1) {
            // Run archetype-level blending (day assignments, conflicts, split activities)
            const blendResult = await blendGroupArchetypes(travelers, context.totalDays, context.destination);
            groupBlendingPromptSection = blendResult.promptSection;
            console.log(`[Stage 1.2.1] ✓ Group archetype blending complete: ${travelers.length} travelers, ${blendResult.conflicts.length} conflicts, ${blendResult.splitOpportunities.length} split opportunities`);

            // Build blended trait scores snapshot using shared helper
            const ownerTraits = ownerDnaRow?.data?.trait_scores || {};
            const ownerTraitsNormalized: Record<string, number> = {
              pace: Number(ownerTraits.pace ?? 0),
              budget: Number(ownerTraits.budget ?? 0),
              social: Number(ownerTraits.social ?? 0),
              planning: Number(ownerTraits.planning ?? 0),
              comfort: Number(ownerTraits.comfort ?? 0),
              authenticity: Number(ownerTraits.authenticity ?? 0),
              adventure: Number(ownerTraits.adventure ?? 0),
              cultural: Number(ownerTraits.cultural ?? 0),
              transformation: Number(ownerTraits.transformation ?? 0),
            };

            const companionTraitsList = companionUserIds
              .map((uid: string) => companionTraitScoresMap.get(uid))
              .filter(Boolean) as Record<string, number>[];

            const blendedTraits = blendTraitScores(ownerTraitsNormalized, companionTraitsList);
            const ownerWeight = 0.5;
            const companionWeight = companionTraitsList.length > 0 ? 0.5 / companionTraitsList.length : 0;

            blendedDnaSnapshot = {
              blendedTraits,
              travelers: travelers.map(t => ({
                userId: t.travelerId,
                name: t.name,
                archetype: t.archetype,
                weight: t.isPrimary ? ownerWeight : companionWeight,
                isPrimary: t.isPrimary,
              })),
              blendMethod: 'weighted_average',
              generatedAt: new Date().toISOString(),
              conflicts: blendResult.conflicts.length,
              dayAssignments: blendResult.dayAssignments,
            };

            // Store group archetypes and blended DNA on context for downstream modules
            context.groupArchetypes = travelers;
            context.blendedDnaSnapshot = blendedDnaSnapshot;
          }
        } catch (blendErr) {
          console.warn("[Stage 1.2.1] Archetype blending failed (non-blocking):", blendErr);
        }
      }
      
      // =======================================================================
      // UNIFIED PROFILE LOADER - Single Source of Truth (Phase 2 Fix)
      // =======================================================================
      console.log("[Stage 1.3] Loading unified traveler profile...");
      const unifiedProfile = await loadTravelerProfile(supabase, userId, tripId, context.destination);
      
      // =======================================================================
      // STAGE 1.3.1: Merge Blended DNA into Unified Profile (Group Trip Fix)
      // =======================================================================
      if (context.blendedDnaSnapshot?.blendedTraits) {
        const blended = context.blendedDnaSnapshot.blendedTraits;
        for (const [key, value] of Object.entries(blended)) {
          if (key in unifiedProfile.traitScores) {
            (unifiedProfile.traitScores as Record<string, number>)[key] = value as number;
          }
        }
        console.log("[Stage 1.3.1] ✓ Overrode trait scores with blended group DNA");
      }
      
      console.log(`[Stage 1.3] ✓ Profile loaded via unified loader:`);
      console.log(`[Stage 1.3]   archetype=${unifiedProfile.archetype} (source: ${unifiedProfile.archetypeSource})`);
      console.log(`[Stage 1.3]   completeness=${unifiedProfile.dataCompleteness}%, fallback=${unifiedProfile.isFallback}`);
      console.log(`[Stage 1.3]   traits: pace=${unifiedProfile.traitScores.pace}, budget=${unifiedProfile.traitScores.budget}`);
      console.log(`[Stage 1.3]   avoidList: ${unifiedProfile.avoidList.length} items`);
      if (unifiedProfile.warnings.length > 0) {
        console.warn(`[Stage 1.3]   warnings: ${unifiedProfile.warnings.join(', ')}`);
      }
      
      // =======================================================================
      // PHASE 2 FIX: Removed legacy getTravelDNAV2 + normalizeUserContext dual path
      // All traveler data now comes from unifiedProfile (single source of truth)
      // =======================================================================
      
      // Derive budget intent directly from unified profile (no redundant normalization)
      const budgetIntent = deriveBudgetIntent(
        context.budgetTier,
        unifiedProfile.traitScores.budget,
        unifiedProfile.traitScores.comfort
      );
      
      // Log budget conflict if detected
      if (budgetIntent?.conflict) {
        console.log(`[Stage 1.3] 🚨 BUDGET CONFLICT: ${budgetIntent.conflictDetails}`);
        console.log(`[Stage 1.3] Reconciled to: ${budgetIntent.notes}`);
      }
      
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
              budget_trait: unifiedProfile.traitScores.budget,
              comfort_trait: unifiedProfile.traitScores.comfort,
              resolved_tier: budgetIntent.tier,
              resolved_spend_style: budgetIntent.spendStyle,
              confidence: unifiedProfile.dataCompleteness,
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
      
      // Build flight intelligence prompt if available
      const flightIntelligencePrompt = buildFlightIntelligencePrompt(flightHotelResult.rawFlightIntelligence);
      if (flightIntelligencePrompt) {
        console.log("[Stage 1.4.5] Flight intelligence prompt injected into context");
        context.flightIntelligencePrompt = flightIntelligencePrompt;
      }
      
      // Build TravelerDNA from unified profile (Phase 2 Fix: no legacy travelDNA/traitOverrides)
      const promptTravelerDNA = buildTravelerDNA(
        { 
          primary_archetype_name: unifiedProfile.archetype,
          trait_scores: unifiedProfile.traitScores,
          archetype_matches: [{ name: unifiedProfile.archetype }]
        } as Record<string, unknown>,
        prefs as Record<string, unknown> | null,
        unifiedProfile.traitScores as unknown as Record<string, number>
      );
      
      // Inject into context for use in generateSingleDayWithRetry
      context.travelerDNA = promptTravelerDNA;
      context.flightData = promptFlightData;
      context.hotelData = promptHotelData;
      
      // ─── Cross-day flight detection ───
      // If the outbound flight arrives on a date AFTER the trip start_date,
      // Day 1 is a departure/travel day. Log this for debugging.
      if (promptFlightData.arrivalDate && promptFlightData.departureDate
          && promptFlightData.arrivalDate > promptFlightData.departureDate) {
        console.log(`[Stage 1.4.5] ✈️ CROSS-DAY FLIGHT DETECTED: departs ${promptFlightData.departureDate}, arrives ${promptFlightData.arrivalDate}`);
        console.log(`[Stage 1.4.5] Day 1 will be a DEPARTURE TRAVEL DAY (no destination activities)`);
      }
      
      console.log(
        `[Stage 1.4.5] DNA injected: primary=${promptTravelerDNA.primaryArchetype || 'none'}, secondary=${promptTravelerDNA.secondaryArchetype || 'none'}, tripBudgetTier=${context.budgetTier || 'none'}, pace=${promptTravelerDNA.traits.pace}, flight=${promptFlightData.hasOutboundFlight}, hotel=${promptHotelData.hasHotel}, arrivalDate=${promptFlightData.arrivalDate || 'none'}, departureDate=${promptFlightData.departureDate || 'none'}`
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
      // STAGE 1.92: Hidden Gems Discovery (5-layer Perplexity engine)
      // Runs in parallel via dedicated edge function, results injected into AI prompt
      // =======================================================================
      console.log("[Stage 1.92] Discovering hidden gems...");
      let hiddenGemsContext = "";
      let discoveredGems: any[] = [];
      
      try {
        const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
        
        if (PERPLEXITY_API_KEY) {
          const gemsResponse = await fetch(`${supabaseUrl}/functions/v1/discover-hidden-gems`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              destination: context.destination,
              country: context.destinationCountry || '',
              archetypeName: unifiedProfile.primaryArchetype || 'Explorer',
              secondaryArchetype: unifiedProfile.secondaryArchetype || undefined,
              interests: unifiedProfile.interests || [],
              diningStyle: prefs?.dining_style || undefined,
              budgetTier: unifiedProfile.budgetTier || undefined,
              travelPace: prefs?.travel_pace || undefined,
              tripDuration: context.totalDays,
              isFirstVisit: context.isFirstTimeVisitor,
            }),
          });

          if (gemsResponse.ok) {
            const gemsData = await gemsResponse.json();
            discoveredGems = gemsData.gems || [];
            
            if (discoveredGems.length > 0) {
              // Build context for AI prompt - inject gems as strong candidates
              const gemLines = discoveredGems.slice(0, 8).map((g: any, i: number) => 
                `${i + 1}. ${g.name} (${g.category}) in ${g.neighborhood} — ${g.whyFitsYou} [Source: ${g.discoveryLayer}]${g.tip ? ` TIP: ${g.tip}` : ''}`
              ).join('\n');
              
              hiddenGemsContext = `\n## 💎 HIDDEN GEMS DISCOVERED (HIGH PRIORITY — INCLUDE 2-3 PER DAY)
The following spots were discovered through deep research (Reddit mining, local-language sources, new openings, neighborhood clusters) and are specifically matched to this traveler's ${unifiedProfile.primaryArchetype || 'Explorer'} archetype.

THESE ARE YOUR SECRET WEAPON — most travel apps cannot find these. Include at least 2-3 of these per day, mixed naturally into the schedule:
${gemLines}

RULES FOR HIDDEN GEMS:
- Mark each included gem with "isHiddenGem": true in the activity intelligence object
- In the "whyThisFits" field, reference why this specific gem matches the traveler
- Include the "discoverySource" field with the layer that found it (e.g., "Reddit Mining", "Local Language Sources")
- Prioritize gems over generic tourist attractions
- Space them throughout the trip (don't cluster all gems on one day)
`;
              console.log(`[Stage 1.92] Discovered ${discoveredGems.length} hidden gems, injecting ${Math.min(discoveredGems.length, 8)} into prompt`);
            } else {
              console.log("[Stage 1.92] No hidden gems found");
            }
          } else {
            console.warn(`[Stage 1.92] Hidden gems API error: ${gemsResponse.status}`);
            await gemsResponse.text(); // consume body
          }
        } else {
          console.log("[Stage 1.92] Skipping - Perplexity not configured");
        }
      } catch (gemsError) {
        console.warn("[Stage 1.92] Failed to discover hidden gems:", gemsError);
      }
      
      // =======================================================================
      // STAGE 1.93: Voyance Picks — Founder-curated must-include experiences
      // These are non-negotiable recommendations from the Voyance team
      // =======================================================================
      let voyancePicksContext = '';
      try {
        console.log("[Stage 1.93] Fetching Voyance Picks for", destination);
        const { data: voyancePicks, error: vpError } = await supabase
          .from('voyance_picks')
          .select('*')
          .eq('is_active', true)
          .ilike('destination', `%${destination.split(',')[0].trim()}%`);
        
        if (vpError) {
          console.warn("[Stage 1.93] DB error:", vpError.message);
        } else if (voyancePicks && voyancePicks.length > 0) {
          const pickLines = voyancePicks.map((p: any, i: number) => 
            `${i + 1}. **${p.name}** (${p.category}) in ${p.neighborhood || destination}
   WHY: ${p.why_essential}
   TIP: ${p.insider_tip || 'No specific tip'}
   BEST TIME: ${p.best_time || 'Any time'}
   PRICE: ${p.price_range || 'Varies'}`
          ).join('\n');
          
          voyancePicksContext = `
${'='.repeat(70)}
⭐ VOYANCE PICKS — FOUNDER-CURATED MUST-INCLUDES (HIGHEST PRIORITY)
${'='.repeat(70)}
These are hand-picked by the Voyance founders as ESSENTIAL experiences for ${destination}. 
They MUST be included in the itinerary regardless of traveler archetype or budget tier.
DO NOT SKIP THESE. Schedule them at their optimal time.

${pickLines}

RULES FOR VOYANCE PICKS:
- MUST appear in the itinerary — this is non-negotiable
- Mark with "isHiddenGem": true (these are curated discoveries)
- Set "isVoyancePick": true (this flags it as a founder-vetted pick in the UI)
- Set "voyanceInsight" to the WHY text above
- Use the TIP as the "tips" field
- In "personalization.whyThisFits", write "Voyance Founder Pick — [reason it fits this specific traveler]"
`;
          console.log(`[Stage 1.93] Injecting ${voyancePicks.length} Voyance Picks into prompt`);
        } else {
          console.log("[Stage 1.93] No Voyance Picks found for this destination");
        }
      } catch (vpErr) {
        console.warn("[Stage 1.93] Failed to fetch Voyance Picks:", vpErr);
      }
      
      // =======================================================================
      // STAGE 1.95: Cold Start Detection (simplified - using profile-loader)
      // Cold start handling is now integrated into loadTravelerProfile() which
      // provides dataCompleteness and isFallback flags. No separate module needed.
      // =======================================================================
      const coldStartContext = ''; // Removed: now handled by profile-loader
      
      // =======================================================================
      // STAGE 1.96: Build Forced Differentiators & Schedule Constraints
      // Phase 2 Fix: Use unified profile instead of manual extraction
      // =======================================================================
      console.log("[Stage 1.96] Building personalization enforcement rules...");
      
      // Use unified profile trait scores (fixes || vs ?? bug and ensures consistency)
      const traitScores: Partial<TraitScores> = {
        planning: unifiedProfile.traitScores.planning ?? 0,
        social: unifiedProfile.traitScores.social ?? 0,
        comfort: unifiedProfile.traitScores.comfort ?? 0,
        pace: unifiedProfile.traitScores.pace ?? 0,
        authenticity: unifiedProfile.traitScores.authenticity ?? 0,
        adventure: unifiedProfile.traitScores.adventure ?? 0,
        budget: unifiedProfile.traitScores.budget ?? 0,
        transformation: unifiedProfile.traitScores.transformation ?? 0
      };
      
      // Get interests from unified profile (Phase 2 Fix: removed normalizedContext reference)
      const userInterests = unifiedProfile.interests.length > 0 
        ? unifiedProfile.interests 
        : (prefs?.interests || []);
      
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
      
      // Phase 2 Fix: Use archetype from unified profile (single source of truth)
      const primaryArchetypeId = unifiedProfile.archetype;
      const secondaryArchetypeId: string | undefined = undefined; // Secondary archetype not in unified profile
      
      const slotContext = {
        tripType: context.tripType,
        travelCompanions,
        hasChildren,
        primaryArchetype: primaryArchetypeId,
        secondaryArchetype: secondaryArchetypeId,
        celebrationDay: context.celebrationDay,
      };
      const forcedSlots = deriveForcedSlots(traitScores, userInterests, 1, context.totalDays, slotContext);
      const forcedSlotsPrompt = buildForcedSlotsPrompt(forcedSlots);
      console.log(`[Stage 1.96] ${forcedSlots.length} forced differentiator slots required per day (context: tripType=${slotContext.tripType}, hasChildren=${slotContext.hasChildren}, archetype=${slotContext.primaryArchetype})`);
      
      // Derive schedule constraints (pace, walking, buffer times) - Phase 2 Fix: use unified profile
      // Phase 16: Pass recovery style and active hours for proper enforcement
      const scheduleConstraints = deriveScheduleConstraints(
        traitScores,
        unifiedProfile.mobilityNeeds || prefs?.mobility_needs,
        {
          recoveryStyle: (prefs as any)?.recovery_style as string[] | undefined,
          activeHoursPerDay: prefs?.active_hours_per_day as 'light' | 'moderate' | 'full' | undefined,
        }
      );
      const scheduleConstraintsPrompt = buildScheduleConstraintsPrompt(scheduleConstraints);
      console.log(`[Stage 1.96] Schedule constraints: ${scheduleConstraints.minActivitiesPerDay}-${scheduleConstraints.maxActivitiesPerDay} activities/day, ${scheduleConstraints.bufferMinutesBetweenActivities}min buffers`);
      
      // Build explainability prompt (Phase 2 Fix: Use unified profile archetype)
      const explainabilityContext: ExplainabilityContext = {
        interests: userInterests,
        foodLikes: prefs?.food_likes || [],
        foodDislikes: prefs?.food_dislikes || [],
        dietaryRestrictions: unifiedProfile.dietaryRestrictions.length > 0 
          ? unifiedProfile.dietaryRestrictions 
          : (prefs?.dietary_restrictions || []),
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
        tripIntents: unifiedProfile.tripIntents.length > 0 
          ? unifiedProfile.tripIntents 
          : (context.tripType ? [context.tripType] : []),
        budgetTier: unifiedProfile.budgetTier || context.budgetTier,
        archetype: unifiedProfile.archetype  // Phase 2 Fix: Use unified profile archetype
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
      
      // =======================================================================
      // STAGE 1.99: Build Unified Archetype Constraints (Phase 2 Fix)
      // Now with DYNAMIC features: attraction matching + AI-generated city guides
      // =======================================================================
      const effectiveBudgetTier = unifiedProfile.budgetTier || context.budgetTier || 'moderate';
      
      // Resolve destination ID for dynamic features (graceful fallback if not found)
      const destinationId = await getDestinationId(supabase, context.destination);
      
      // Use async builder for dynamic attraction matching + AI city guides
      const generationHierarchy = await buildFullPromptGuidanceAsync(
        supabase,
        unifiedProfile.archetype,
        context.destination,
        destinationId,
        effectiveBudgetTier,
        { pace: unifiedProfile.traitScores.pace, budget: unifiedProfile.traitScores.budget },
        LOVABLE_API_KEY
      );
      console.log(`[Stage 1.99] ✓ Generated unified archetype constraints for ${unifiedProfile.archetype} (${generationHierarchy.length} chars, dynamic=${!!destinationId})`);
      
      // =======================================================================
      // STAGE 1.991: Interest Override — User's explicit interests OUTRANK archetype
      // The archetype determines TONE/NARRATIVE, user interests determine ACTIVITY MIX
      // =======================================================================
      let interestOverridePrompt = "";
      const userInterestsForOverride = unifiedProfile.interests || context.interests || [];
      if (userInterestsForOverride.length > 0) {
        const interestActivityMap: Record<string, string> = {
          'food': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'cuisine': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'culinary': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'food & cuisine': 'At least 2-3 noteworthy dining experiences per day (food carts, local restaurants, markets, breweries)',
          'adventure': 'At least 1 adventure/active/outdoor activity per day (hiking, water sports, zip-lining, climbing)',
          'adventure & thrills': 'At least 1 adventure/active/outdoor activity per day (hiking, water sports, zip-lining, climbing)',
          'nightlife': 'Evening entertainment on at least half the nights (bars, live music, clubs, night markets)',
          'nightlife & entertainment': 'Evening entertainment on at least half the nights (bars, live music, clubs, night markets)',
          'culture': 'At least 1 cultural experience per day (museums, galleries, historic sites, local traditions)',
          'culture & history': 'At least 1 cultural experience per day (museums, galleries, historic sites, local traditions)',
          'nature': 'At least 1 nature/outdoor experience per day (parks, gardens, scenic viewpoints, nature reserves)',
          'nature & outdoors': 'At least 1 nature/outdoor experience per day (parks, gardens, scenic viewpoints, nature reserves)',
          'shopping': 'Include shopping opportunities (local markets, boutiques, artisan shops)',
          'wellness': 'Include wellness activities (yoga, spa, meditation, hot springs)',
          'art': 'Include art experiences (galleries, street art, studios, art districts)',
        };
        
        const matchedInterests: string[] = [];
        for (const interest of userInterestsForOverride) {
          const lower = interest.toLowerCase();
          for (const [key, instruction] of Object.entries(interestActivityMap)) {
            if (lower.includes(key) || key.includes(lower)) {
              matchedInterests.push(`- ${interest}: ${instruction}`);
              break;
            }
          }
        }
        
        if (matchedInterests.length > 0) {
          interestOverridePrompt = `
${'='.repeat(60)}
🎯 USER'S EXPLICIT INTERESTS — ACTIVITY MIX REQUIREMENTS
${'='.repeat(60)}

The user has EXPLICITLY selected these interests in their profile. These determine WHAT TYPES of activities to include:

${matchedInterests.join('\n')}

⚠️ CRITICAL RULE: The user's archetype (${unifiedProfile.archetype || 'none'}) determines the NARRATIVE TONE and DESCRIPTIONS of activities, but does NOT override which TYPES of activities to include.

Example: A "Beach Therapist" who selected "Food & Cuisine" and "Nightlife" should get:
- Food-focused days with great restaurants, food carts, and culinary experiences
- Evening entertainment and bar recommendations
- Written with a relaxed, restorative tone: "unwind over world-class ramen" not "rush to the ramen shop"

The archetype is FLAVOR, not the MENU. User interests ARE the menu.

DO NOT replace the user's selected interests with archetype-default activities.
If the archetype says "beach time 3-4 hours" but the user selected "Food & Cuisine" and the destination has no beaches, prioritize food experiences with the archetype's relaxed narrative tone instead.
${'='.repeat(60)}
`;
          console.log(`[Stage 1.991] ✓ Interest override prompt built for ${matchedInterests.length} interests: ${userInterestsForOverride.join(', ')}`);
        }
      }
      
      // =======================================================================
      // STAGE 1.995: Trip Type Modifiers - First-class input for celebrations/groups/purpose
      // =======================================================================
      const tripTypePrompt = buildTripTypePromptSection(
        context.tripType,
        unifiedProfile.archetype,
        context.totalDays,
        context.celebrationDay
      );
      if (tripTypePrompt) {
        console.log(`[Stage 1.995] ✓ Trip type "${context.tripType}" prompt built (${tripTypePrompt.length} chars)`);
      } else {
        console.log(`[Stage 1.995] No special trip type - using standard generation`);
      }
      
      // =======================================================================
      // STAGE 1.997: Tourist Trap Skip List (Visible Intelligence)
      // Prevent AI from recommending activities we explicitly tell users to avoid
      // =======================================================================
      const skipListPrompt = buildSkipListPrompt(context.destination);
      if (skipListPrompt) {
        console.log(`[Stage 1.997] ✓ Skip list built for ${context.destination}`);
      }
      
      // =======================================================================
      // STAGE 1.998: Dynamic Dietary Enforcement (Phase 15)
      // Builds cuisine/ingredient avoidance rules based on user dietary restrictions
      // =======================================================================
      const dietaryRestrictions = unifiedProfile.dietaryRestrictions.length > 0 
        ? unifiedProfile.dietaryRestrictions 
        : (prefs?.dietary_restrictions || []);
      const dietaryEnforcementPrompt = buildDietaryEnforcementPrompt(dietaryRestrictions);
      if (dietaryEnforcementPrompt) {
        const maxSeverity = getMaxDietarySeverity(dietaryRestrictions);
        console.log(`[Stage 1.998] ✓ Dietary enforcement built for ${dietaryRestrictions.length} restrictions (max severity: ${maxSeverity})`);
        console.log(`[Stage 1.998]   restrictions: ${dietaryRestrictions.join(', ')}`);
        
        // Also expand the avoid list with dietary-based cuisine/ingredient avoids
        const dietaryAvoids = expandDietaryAvoidList(dietaryRestrictions);
        if (dietaryAvoids.length > 0) {
          console.log(`[Stage 1.998]   auto-avoided: ${dietaryAvoids.slice(0, 10).join(', ')}${dietaryAvoids.length > 10 ? ` + ${dietaryAvoids.length - 10} more` : ''}`);
        }
      }
      
      // =======================================================================
      // STAGE 1.999: User Research Notes / Must-Do Activities
      // Inject user-provided must-sees, skip requests, and research notes
      // =======================================================================
      let userResearchPrompt = "";
      if (context.mustDoActivities && context.mustDoActivities.trim()) {
        // Keep all user itinerary anchors as must-have when Smart Finish was requested.
        const forceAllMust = !!context.isSmartFinish || !!context.smartFinishRequested;
        const mustDoAnalysis = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust, context.startDate, context.totalDays);
        
        // ═══════════════════════════════════════════════════════════════════════
        // CROSS-REFERENCE: Match must-do items against discovered local events
        // If a user says "U.S. Open" and Perplexity found the U.S. Open event,
        // inherit the event's dates/location and promote to all-day event.
        // ═══════════════════════════════════════════════════════════════════════
        if (mustDoAnalysis.length > 0 && fetchedLocalEvents.length > 0) {
          console.log(`[Stage 1.999] Cross-referencing ${mustDoAnalysis.length} must-dos against ${fetchedLocalEvents.length} local events...`);
          for (const mustDo of mustDoAnalysis) {
            const mustDoLower = mustDo.activityName.toLowerCase();
            const mustDoWords = mustDoLower.split(/\s+/).filter(w => w.length > 2);
            
            // Fuzzy match: check if any local event name shares 2+ significant words with the must-do
            for (const event of fetchedLocalEvents) {
              const eventLower = (event.name || '').toLowerCase();
              const matchingWords = mustDoWords.filter(w => eventLower.includes(w));
              
              // Match if 2+ words match, or if must-do name is contained in event name (or vice versa)
              if (matchingWords.length >= 2 || eventLower.includes(mustDoLower) || mustDoLower.includes(eventLower)) {
                // Promote to must priority with event data
                mustDo.priority = 'must';
                mustDo.venueName = event.location || undefined;
                mustDo.eventDates = event.dates || undefined;
                
                // If not already classified as an event, promote to at least half-day
                if (!mustDo.activityType || mustDo.activityType === 'standard') {
                  const eventType = (event.type || '').toLowerCase();
                  if (['sports', 'festival', 'convention'].includes(eventType)) {
                    mustDo.activityType = 'all_day_event';
                    mustDo.estimatedDuration = 420;
                  } else {
                    mustDo.activityType = 'half_day_event';
                    mustDo.estimatedDuration = Math.max(mustDo.estimatedDuration || 120, 210);
                  }
                }
                
                mustDo.requiresBooking = true;
                console.log(`[Stage 1.999] ✓ Cross-ref match: "${mustDo.activityName}" ↔ event "${event.name}" → ${mustDo.activityType} at ${mustDo.venueName || 'TBD'}`);
                break;
              }
            }
          }
        }
        
        if (mustDoAnalysis.length > 0) {
          const scheduled = scheduleMustDos(mustDoAnalysis, context.totalDays);
          userResearchPrompt = scheduled.promptSection;
          const eventCount = mustDoAnalysis.filter(m => m.activityType === 'all_day_event' || m.activityType === 'half_day_event').length;
          console.log(`[Stage 1.999] ✓ User research notes parsed: ${mustDoAnalysis.length} items (forceAllMust=${forceAllMust}), ${scheduled.scheduled.length} scheduled, ${eventCount} classified as events`);
        } else {
          // Raw text fallback — inject as-is with MANDATORY + ENRICHMENT language
          userResearchPrompt = `\n## 🚨 USER'S RESEARCHED RESTAURANTS & VENUES (MANDATORY)\n\nThe traveler has PERSONALLY RESEARCHED and CHOSEN these specific venues. You MUST include ALL of them in the itinerary. These are NON-NEGOTIABLE. Do NOT substitute your own recommendations for these.\n\n"${context.mustDoActivities.trim()}"\n\nRULES:\n- EVERY venue/restaurant listed above MUST appear by name in the final itinerary\n- Only add AI recommendations to fill REMAINING empty meal/activity slots\n- If a user-specified venue conflicts with another, keep the user's venue and move the other\n- Respect any "skip" or "avoid" requests\n- If the user mentions a FULL-DAY EVENT (e.g., "whole day at the U.S. Open"), do NOT plan other activities around it. That day has ONE purpose.\n- If the user mentions FLIGHT DETAILS, account for arrival/departure times on first/last days\n- If the user mentions SPECIFIC TIMES (e.g., "dinner at 7:30"), those times are LOCKED\n- User preferences like "authentic sushi" or "no tourist traps" apply to ALL venue selections\n\n## 🧭 SMART FINISH ENRICHMENT — ADD VALUE\nThe user's list is a STARTING POINT. You MUST add significant value:\n- Add exact street addresses, opening hours, booking URLs for every venue\n- Add transit directions between activities (walk/metro/taxi with duration & cost)\n- Fill ALL meal gaps (breakfast, lunch, dinner, coffee stops)\n- Add 2-4 DNA-matched activities per day between user venues\n- Add insider tips for each user-specified venue\n- Flag any activity that doesn't match the traveler's DNA with a "dnaFlag" field\n`;
          console.log(`[Stage 1.999] ✓ User research notes injected as raw text with MANDATORY enforcement (${context.mustDoActivities.length} chars)`);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 1.999a: Inject "Anything Else" / Additional Notes as trip anchors
      // Users type trip purpose here (e.g., "this trip is for the U.S. Open")
      // ═══════════════════════════════════════════════════════════════════════
      if (context.additionalNotes && context.additionalNotes.trim()) {
        const notes = context.additionalNotes.trim();
        userResearchPrompt += `\n## 🎯 TRAVELER'S TRIP PURPOSE / ADDITIONAL NOTES
The traveler provided these additional notes about their trip. These describe the PRIMARY PURPOSE or special requirements:

"${notes}"

CRITICAL: If these notes describe a specific event, activity, or purpose (e.g., "going for the U.S. Open", "attending a wedding", "here for a conference"), this MUST be treated as a NON-NEGOTIABLE anchor for the trip. Dedicate appropriate days to it.
If the purpose is a specific event, plan at least ONE full day around that event. The rest of the trip should complement this primary purpose.
`;
        console.log(`[Stage 1.999a] ✓ Additional notes / trip purpose injected (${notes.length} chars)`);
      }
      // Inject interest categories
      if ((context as any).interestCategories && (context as any).interestCategories.length > 0) {
        const categoryLabels: Record<string, string> = {
          history: 'History & Museums', food: 'Food & Dining', shopping: 'Shopping',
          nature: 'Parks & Nature', culture: 'Arts & Culture', nightlife: 'Nightlife',
        };
        const cats = (context as any).interestCategories as string[];
        const labels = cats.map(c => categoryLabels[c] || c).join(', ');
        userResearchPrompt += `\n## USER INTERESTS\nPrioritize activities in these categories: ${labels}. Lean heavily toward these when choosing between options.\n`;
        console.log(`[Stage 1.999b] ✓ Interest categories injected: ${labels}`);
      }

      // =======================================================================
      // STAGE 1.9993: User Constraints from Chat Planner
      // Convert structured user constraints into generation rules
      // =======================================================================
      let userConstraintPrompt = "";
      if (context.userConstraints && context.userConstraints.length > 0) {
        const constraintLines: string[] = [];
        constraintLines.push(`\n${'='.repeat(60)}`);
        constraintLines.push(`🚨 USER'S EXPLICIT CONSTRAINTS — THESE OVERRIDE ALL OTHER RULES`);
        constraintLines.push(`${'='.repeat(60)}`);
        constraintLines.push(`The traveler specifically stated these requirements. They OVERRIDE pacing rules, activity count targets, and all other system defaults.\n`);

        for (const constraint of context.userConstraints) {
          switch (constraint.type) {
            case 'full_day_event':
              constraintLines.push(`⭐ FULL-DAY EVENT${constraint.day ? ` (Day ${constraint.day})` : ''}: "${constraint.description}"`);
              constraintLines.push(`   → This event consumes the ENTIRE day. Do NOT add other activities, meals, or experiences to this day.`);
              constraintLines.push(`   → The only additions allowed: transit to/from the event, and possibly a late dinner AFTER if appropriate.`);
              constraintLines.push(`   → Do NOT apply normal pacing rules to this day. The user explicitly chose to spend it on this one thing.\n`);
              break;
            case 'time_block':
              constraintLines.push(`⏰ TIME-LOCKED${constraint.day ? ` (Day ${constraint.day})` : ''}: "${constraint.description}"${constraint.time ? ` at ${constraint.time}` : ''}`);
              constraintLines.push(`   → This activity is locked to this exact time. Build the rest of the day AROUND it.\n`);
              break;
            case 'avoid':
              constraintLines.push(`🚫 AVOID: "${constraint.description}"`);
              constraintLines.push(`   → Do NOT include anything matching this preference in any day.\n`);
              break;
            case 'preference':
              constraintLines.push(`💎 PREFERENCE: "${constraint.description}"`);
              constraintLines.push(`   → This should influence venue/activity selection across ALL days.\n`);
              break;
            case 'flight':
              constraintLines.push(`✈️ FLIGHT${constraint.day ? ` (Day ${constraint.day})` : ''}: "${constraint.description}"${constraint.time ? ` at ${constraint.time}` : ''}`);
              constraintLines.push(`   → Account for this flight in the day's schedule. Include airport transit time.\n`);
              break;
          }
        }

        constraintLines.push(`\n⚠️ HIERARCHY: User constraints > Trip vibe > DNA archetype > System pacing rules`);
        constraintLines.push(`If a user constraint conflicts with a pacing rule, the user constraint ALWAYS wins.`);
        constraintLines.push(`${'='.repeat(60)}\n`);
        userConstraintPrompt = constraintLines.join('\n');
        console.log(`[Stage 1.9993] ✓ User constraints injected: ${context.userConstraints.length} constraints`);
      }

      // Inject flight details into context
      let flightDetailsPrompt = "";
      if (context.flightDetails) {
        flightDetailsPrompt = `\n## ✈️ USER'S FLIGHT INFORMATION\n${context.flightDetails}\n\nAccount for arrival/departure times when planning the first and last days. Include airport transit.\n`;
        console.log(`[Stage 1.9993b] ✓ Flight details injected: ${context.flightDetails.length} chars`);
      }

      // Inject structured generation rules
      if (context.generationRules && context.generationRules.length > 0) {
        userResearchPrompt += formatGenerationRules(context.generationRules);
        console.log(`[Stage 1.999c] ✓ Generation rules injected: ${context.generationRules.length} rules`);
      }

      // =======================================================================
      let mustHavesPrompt = "";
      if (context.mustHaves && context.mustHaves.length > 0) {
        mustHavesPrompt = buildMustHavesConstraintPrompt(context.mustHaves, context.totalDays);
        console.log(`[Stage 1.9991] ✓ Must-haves checklist injected: ${context.mustHaves.length} items`);
      }

      // =======================================================================
      // STAGE 1.9992: Pre-Booked Commitments (fixed calendar events)
      // =======================================================================
      let preBookedPrompt = "";
      if (context.preBookedCommitments && context.preBookedCommitments.length > 0) {
        const commitmentAnalysis = analyzePreBookedCommitments(
          context.preBookedCommitments,
          context.startDate,
          context.endDate
        );
        preBookedPrompt = commitmentAnalysis.promptSection;
        console.log(`[Stage 1.9992] ✓ Pre-booked commitments injected: ${context.preBookedCommitments.length} items, ${commitmentAnalysis.tightDays.length} tight days`);
      }

      // =======================================================================
      // STAGE 1.9995: Trip Vibe Override — user's trip-specific intent
      // =======================================================================
      let tripVibePrompt = "";
      if (context.tripVibe || (context.tripPriorities && context.tripPriorities.length > 0)) {
        const vibeParts: string[] = [];
        vibeParts.push(`\n${'='.repeat(60)}`);
        vibeParts.push(`🎯 THIS TRIP'S SPECIFIC VIBE & INTENT`);
        vibeParts.push(`${'='.repeat(60)}`);
        if (context.tripVibe) {
          vibeParts.push(`\nTrip Vibe: "${context.tripVibe}"`);
          vibeParts.push(`This is what the traveler WANTS from THIS specific trip. It overrides the archetype's default activity mix.`);
        }
        if (context.tripPriorities && context.tripPriorities.length > 0) {
          vibeParts.push(`\nTrip Priorities (MUST be reflected in activity selection):`);
          for (const p of context.tripPriorities) {
            vibeParts.push(`  - ${p}`);
          }
        }
        vibeParts.push(`\n⚠️ The trip vibe is MORE SPECIFIC than the archetype. If the vibe says "foodie adventure" but the archetype says "beach therapy", prioritize food experiences with a relaxed descriptive tone.`);
        vibeParts.push(`${'='.repeat(60)}\n`);
        tripVibePrompt = vibeParts.join('\n');
        console.log(`[Stage 1.9995] ✓ Trip vibe prompt: "${context.tripVibe}", ${context.tripPriorities?.length || 0} priorities`);
      }

      // Combine all context for maximum personalization
      // Order: USER CONSTRAINTS (highest priority) → FLIGHT DETAILS → ARCHETYPE CONSTRAINTS → INTEREST OVERRIDE → TRIP VIBE → TRIP TYPE → SKIP LIST → DIETARY ENFORCEMENT → raw prefs → enriched prefs → flight/hotel → LEARNINGS → RECENTLY USED → LOCAL EVENTS → HIDDEN GEMS → NEW PERSONALIZATION MODULES → GEOGRAPHIC COHERENCE → USER RESEARCH
      // PRIORITY ORDER: System defaults first, then user constraints LAST (most recent = highest priority for AI)
      // Phase 2 Fix: Removed unifiedDNAContext - all traveler data now comes from generationHierarchy via unified profile
      const preferenceContext =
        // --- SYSTEM DEFAULTS (lowest priority — can be overridden by user) ---
        generationHierarchy + '\n\n' +
        interestOverridePrompt + '\n\n' +
        tripVibePrompt + '\n\n' +
        tripTypePrompt + '\n\n' +
        skipListPrompt + '\n\n' +
        dietaryEnforcementPrompt + '\n\n' +
        rawPreferenceContext +
        enrichedPreferenceContext +
        tripLearningsContext +
        recentlyUsedContext +
        localEventsContext +
        hiddenGemsContext +
        voyancePicksContext +
        coldStartContext +
        forcedSlotsPrompt +
        scheduleConstraintsPrompt +
        explainabilityPrompt +
        truthAnchorPrompt +
        groupReconciliationPrompt +
        groupBlendingPromptSection +
        geographicPrompt +
        // --- LOGISTICS (medium priority) ---
        flightHotelResult.context +
        (context.flightIntelligencePrompt ? '\n\n' + context.flightIntelligencePrompt : '') +
        flightDetailsPrompt + '\n\n' +
        // --- USER REQUIREMENTS (highest priority — OVERRIDE everything above) ---
        '\n\n⚠️ FINAL AUTHORITY — USER REQUIREMENTS BELOW OVERRIDE ALL RULES ABOVE ⚠️\n' +
        'If ANY rule above conflicts with a user requirement below, the user requirement WINS. ' +
        'This includes pacing rules, activity counts, archetype density targets, and trip vibe suggestions. ' +
        'The user\'s explicit requests are the single source of truth for this itinerary.\n\n' +
        userConstraintPrompt + '\n\n' +
        userResearchPrompt + '\n\n' +
        mustHavesPrompt + '\n\n' +
        preBookedPrompt;

      // STAGE 1.9999: Pre-fetch known venue hours from verified_venues cache
      try {
        const destForCache = context.destination.toLowerCase().trim();
        const cacheResp = await fetch(
          `${supabaseUrl}/rest/v1/verified_venues?destination=ilike.%25${encodeURIComponent(destForCache)}%25&opening_hours=not.is.null&select=name,opening_hours&limit=60`,
          {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            }
          }
        );
        if (cacheResp.ok) {
          const venueRows = await cacheResp.json();
          if (venueRows && venueRows.length > 0) {
            context.venueHoursCache = venueRows.map((v: any) => ({
              name: v.name,
              opening_hours: v.opening_hours,
            }));
            console.log(`[Stage 1.9999] ✓ Pre-fetched ${context.venueHoursCache!.length} venue hours for "${context.destination}"`);
          } else {
            console.log(`[Stage 1.9999] No cached venue hours found for "${context.destination}"`);
          }
        }
      } catch (e) {
        console.warn('[Stage 1.9999] Venue hours pre-fetch failed (non-blocking):', e);
      }

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
      // STAGE 2.55: Split Combined Arrival Blocks
      // If the AI returned a single "Arrive and check in" block for Day 1,
      // split it into 3 separate activities: arrival, transfer, check-in
      // =======================================================================
      if (aiResult.days.length > 0) {
        const day1 = aiResult.days[0];
        if (day1.activities && day1.activities.length > 0) {
          const combinedIdx = day1.activities.findIndex((a: any) => {
            const t = (a.title || '').toLowerCase();
            return (
              (t.includes('arrive') && t.includes('check')) ||
              (t.includes('arrival') && t.includes('check-in')) ||
              (t.includes('arrive') && t.includes('hotel') && !t.includes('transfer')) ||
              t === 'arrive and check in' ||
              t === 'arrive and check-in' ||
              t === 'arrival and check-in'
            );
          });
          
          if (combinedIdx !== -1) {
            const combined = day1.activities[combinedIdx];
            const startMin = parseTimeToMinutes(combined.startTime) || 0;
            const checkInStart = minutesToHHMM(startMin);
            const checkInEnd = minutesToHHMM(startMin + 30);
            
            // Prefer multi-city hotel data, fall back to single-city flightHotelResult
            const day1City = context.multiCityDayMap?.[0];
            const hotelN = day1City?.hotelName || flightHotelResult?.hotelName || 'Hotel';
            const hotelA = day1City?.hotelAddress || flightHotelResult?.hotelAddress || '';
            
            console.log(`[Stage 2.55] Replacing combined arrival block: "${combined.title}" with Hotel Check-in only (arrival handled by UI)`);
            
            const checkinActivity = {
              ...combined,
              title: 'Hotel Check-in & Refresh',
              description: 'Check in, freshen up, and get oriented to the area',
              startTime: checkInStart,
              endTime: checkInEnd,
              category: 'accommodation',
              type: 'accommodation',
              location: { name: hotelN, address: hotelA },
            };
            
            day1.activities.splice(combinedIdx, 1, checkinActivity);
            aiResult.days[0] = day1;
            console.log(`[Stage 2.55] ✓ Replaced with: Check-in (${checkInStart}-${checkInEnd})`);
          }
        }
      }

      // =======================================================================
      // STAGE 2.56: Guarantee Day 1 Hotel Check-in
      // If Day 1 doesn't have a check-in activity, inject one.
      // The AI sometimes omits it despite prompt instructions.
      // =======================================================================
      if (aiResult.days.length > 0) {
        const day1_56 = aiResult.days[0];
        if (day1_56.activities && day1_56.activities.length > 0) {
          const hasCheckIn = day1_56.activities.some((a: any) => {
            const t = (a.title || '').toLowerCase();
            const cat = (a.category || '').toLowerCase();
            return (
              cat === 'accommodation' && (
                t.includes('check-in') || t.includes('check in') ||
                t.includes('checkin') || t.includes('settle in') ||
                t.includes('refresh') || t.includes('hotel')
              )
            );
          });

          if (!hasCheckIn) {
            const day1City_56 = context.multiCityDayMap?.[0];
            const hotelName_56 = day1City_56?.hotelName || flightHotelResult?.hotelName || 'Hotel';
            const hotelAddress_56 = day1City_56?.hotelAddress || flightHotelResult?.hotelAddress || '';

            const firstActivity_56 = day1_56.activities[0];
            const firstStartMin_56 = parseTimeToMinutes(firstActivity_56?.startTime || '15:00') || (15 * 60);
            const checkInStartMin_56 = Math.max(12 * 60, firstStartMin_56 - 45);
            const checkInEndMin_56 = checkInStartMin_56 + 30;
            const checkInStart_56 = minutesToHHMM(checkInStartMin_56);
            const checkInEnd_56 = minutesToHHMM(checkInEndMin_56);

            const checkInActivity_56 = {
              id: `day1-checkin-${Date.now()}`,
              title: 'Hotel Check-in & Refresh',
              name: 'Hotel Check-in & Refresh',
              description: 'Check in, freshen up, and get oriented to the area',
              startTime: checkInStart_56,
              endTime: checkInEnd_56,
              category: 'accommodation',
              type: 'accommodation',
              location: { name: hotelName_56, address: hotelAddress_56 },
              cost: { amount: 0, currency: 'USD' },
              bookingRequired: false,
              isLocked: false,
              durationMinutes: 30,
            };

            day1_56.activities.unshift(checkInActivity_56);
            aiResult.days[0] = day1_56;
            console.log(`[Stage 2.56] ✓ Injected missing Hotel Check-in at ${checkInStart_56}-${checkInEnd_56} (hotel: ${hotelName_56})`);
          } else {
            console.log(`[Stage 2.56] Day 1 already has check-in activity — no injection needed`);
          }
        }

        // Also check multi-city transition days (first day in each new city)
        if (context.multiCityDayMap && aiResult.days.length > 1) {
          let prevDestination_56 = '';
          for (let dIdx = 1; dIdx < aiResult.days.length; dIdx++) {
            const dayCity_56 = context.multiCityDayMap[dIdx];
            const currentDest_56 = dayCity_56?.destination || '';

            if (currentDest_56 && currentDest_56 !== prevDestination_56 && prevDestination_56 !== '') {
              const transDay_56 = aiResult.days[dIdx];
              if (!transDay_56.activities || transDay_56.activities.length === 0) {
                prevDestination_56 = currentDest_56;
                continue;
              }

              const hasTransCheckIn = transDay_56.activities.some((a: any) => {
                const t = (a.title || '').toLowerCase();
                const cat = (a.category || '').toLowerCase();
                return cat === 'accommodation' && (
                  t.includes('check-in') || t.includes('check in') ||
                  t.includes('checkin') || t.includes('settle in') ||
                  t.includes('hotel')
                );
              });

              if (!hasTransCheckIn) {
                const transHotelName = dayCity_56?.hotelName || 'Hotel';
                const transHotelAddress = dayCity_56?.hotelAddress || '';
                const firstAct_56 = transDay_56.activities[0];
                const firstMin_56 = parseTimeToMinutes(firstAct_56?.startTime || '15:00') || (15 * 60);
                const ciStartMin_56 = Math.max(12 * 60, firstMin_56 - 45);
                const ciStart_56 = minutesToHHMM(ciStartMin_56);
                const ciEnd_56 = minutesToHHMM(ciStartMin_56 + 30);

                const ciActivity_56 = {
                  id: `day${dIdx + 1}-checkin-${Date.now()}`,
                  title: `Hotel Check-in – ${currentDest_56}`,
                  name: `Hotel Check-in – ${currentDest_56}`,
                  description: `Check in to hotel in ${currentDest_56}, freshen up after travel`,
                  startTime: ciStart_56,
                  endTime: ciEnd_56,
                  category: 'accommodation',
                  type: 'accommodation',
                  location: { name: transHotelName, address: transHotelAddress },
                  cost: { amount: 0, currency: 'USD' },
                  bookingRequired: false,
                  isLocked: false,
                  durationMinutes: 30,
                };

                transDay_56.activities.unshift(ciActivity_56);
                aiResult.days[dIdx] = transDay_56;
                console.log(`[Stage 2.56] ✓ Injected missing Hotel Check-in for ${currentDest_56} on Day ${dIdx + 1} at ${ciStart_56}-${ciEnd_56}`);
              }
            }
            prevDestination_56 = currentDest_56;
          }
        }
      }

      // =======================================================================
      // Validate itinerary against user preferences before saving
      // =======================================================================
      console.log("[Stage 2.6] Validating personalization compliance...");
      
      // Build validation context from available preferences (Phase 2 Fix: use unified profile)
      const validationCtx = buildValidationContext(
        prefs || {},
        budgetIntent,
        unifiedProfile.traitScores as unknown as Record<string, number>,
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
      
      // Enforce critical violations — dietary restrictions and severe personalization failures
      if (!validationResult.isValid) {
        const criticalViolations = validationResult.violations.filter((v: any) => v.severity === 'critical');
        const majorDietaryViolations = validationResult.violations.filter((v: any) => v.type === 'dietary' && v.severity === 'major');

        if (criticalViolations.length > 0 || majorDietaryViolations.length > 0) {
          console.error(`[Stage 2.6] CRITICAL VIOLATIONS DETECTED — ${criticalViolations.length} critical, ${majorDietaryViolations.length} dietary`);

          for (const v of [...criticalViolations, ...majorDietaryViolations]) {
            console.error(`  → [${v.severity}] ${v.type}: "${v.activityTitle}" on Day ${v.dayNumber} — ${v.details}`);
          }

          // For dietary violations, patch offending activities with warnings
          for (const v of majorDietaryViolations) {
            const day = aiResult.days.find((d: any) => d.dayNumber === v.dayNumber);
            if (day) {
              const actIdx = day.activities.findIndex((a: any) => a.title === v.activityTitle);
              if (actIdx >= 0) {
                const original = day.activities[actIdx];
                console.warn(`[Stage 2.6] Patching dietary violation: "${original.title}" → marking for user warning`);
                original.dietaryWarning = v.details;
                original.description = (original.description || '') + `\n⚠️ Note: This venue may not fully accommodate your dietary preferences. Consider asking about ${v.details.split('restriction')[0].trim()} options when booking.`;
              }
            }
          }
        }

        if (validationResult.personalizationScore < 40) {
          console.warn(`[Stage 2.6] LOW PERSONALIZATION SCORE: ${validationResult.personalizationScore}/100 — itinerary may feel generic`);
        }
      }

      // =======================================================================
      // STAGE 2.7: Overlap Fix (lightweight)
      // Only fix true overlaps and zero/negative gaps (< 5 min).
      // Distance-aware buffer enforcement happens in Stage 4.6 after
      // coordinates are available from enrichment.
      // =======================================================================
      const MIN_OVERLAP_GAP = 5;
      let overlapFixCount = 0;
      
      for (const day of aiResult.days) {
        if (!day.activities || day.activities.length < 2) continue;
        
        for (let i = 0; i < day.activities.length - 1; i++) {
          const current = day.activities[i];
          const next = day.activities[i + 1];
          
          const parseT = (t?: string): number | null => {
            if (!t) return null;
            const n = t.trim().toUpperCase();
            const m = n.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            const min = parseInt(m[2], 10);
            if (m[3] === 'PM' && h !== 12) h += 12;
            if (m[3] === 'AM' && h === 12) h = 0;
            return h * 60 + min;
          };
          
          const fmtT = (mins: number): string => {
            const dayMinutes = 24 * 60;
            const normalized = ((mins % dayMinutes) + dayMinutes) % dayMinutes;
            const h = Math.floor(normalized / 60);
            const m = normalized % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          };
          
          const startMins = parseT(current.startTime);
          if (startMins === null) continue;
          
          let durMins = 60;
          if (current.duration) {
            const d = String(current.duration).toLowerCase();
            const hm = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
            const mm = d.match(/([\d.]+)\s*(?:minutes?|mins?|m(?!onth))/);
            durMins = 0;
            if (hm) durMins += parseFloat(hm[1]) * 60;
            if (mm) durMins += parseFloat(mm[1]);
            if (durMins === 0) durMins = 60;
          }
          
          const endMins = startMins + durMins;
          const nextStartMins = parseT(next.startTime);
          if (nextStartMins === null) continue;
          
          const gap = nextStartMins - endMins;
          
          // Only fix true overlaps / near-zero gaps
          if (gap < MIN_OVERLAP_GAP) {
            const newStart = endMins + MIN_OVERLAP_GAP;
            const oldTime = next.startTime;
            next.startTime = fmtT(newStart);
            if (next.endTime) {
              const nextDur = (parseT(next.endTime) || (newStart + 60)) - (parseT(oldTime) || newStart);
              next.endTime = fmtT(newStart + Math.max(nextDur, 30));
            }
            overlapFixCount++;
            console.log(`[Stage 2.7] Day ${day.dayNumber}: Fixed overlap for "${next.title || next.name}" from ${oldTime} → ${next.startTime} (gap was ${gap} min)`);
          }
        }
      }
      
      if (overlapFixCount > 0) {
        console.log(`[Stage 2.7] Fixed ${overlapFixCount} overlaps/zero-gaps across all days`);
      }

      // =====================================================================
      // STAGE 2.8: Must-Do Validation (logging only — mirrors dietary check)
      // =====================================================================
      if (context.mustDoActivities && context.mustDoActivities.trim()) {
        try {
          const forceAllMust = !!context.isSmartFinish || !!context.smartFinishRequested;
          const mustDoCheck = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust, context.startDate, context.totalDays);
          if (mustDoCheck.length > 0) {
            const itineraryForValidation = aiResult.days.map((d: any) => ({
              dayNumber: d.dayNumber,
              activities: (d.activities || []).map((a: any) => ({ title: a.title || a.name || '' })),
            }));
            const validation = validateMustDosInItinerary(itineraryForValidation, mustDoCheck);

            if (!validation.allPresent && validation.missing.length > 0) {
              console.warn(`[Stage 2.8] ⚠️ MISSING must-do activities in generated itinerary:`);
              for (const m of validation.missing) {
                console.warn(`  ❌ "${m.activityName}" (priority: ${m.priority}) — NOT FOUND in any day`);
              }
              console.warn(`[Stage 2.8] ${validation.found.length}/${mustDoCheck.filter(x => x.priority === 'must').length} must-priority items found, ${validation.missing.length} missing`);
            } else {
              console.log(`[Stage 2.8] ✓ All must-do activities verified present in itinerary (${validation.found.length} found)`);
            }
          }
        } catch (mustDoValErr) {
          console.warn('[Stage 2.8] Must-do validation error (non-blocking):', mustDoValErr);
        }
      }

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

      // ── Access gate: determine if user qualifies for photo enrichment ──
      let canEnrichPhotos = true;
      try {
        // Check 1: Has any paid purchase?
        const { data: purchaseRow } = await supabase
          .from('credit_purchases')
          .select('id')
          .eq('user_id', context.userId)
          .not('credit_type', 'in', '("free_monthly","signup_bonus","referral_bonus")')
          .gt('remaining', -1)
          .limit(1)
          .maybeSingle();
        const hasCompletedPurchase = !!purchaseRow;

        // Check 2: Is this the user's first trip?
        const { count: tripCount } = await supabase
          .from('trips')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', context.userId)
          .not('itinerary_status', 'is', null);
        const isFirstTrip = (tripCount ?? 0) <= 1;

        // Check 3: Smart Finish purchased?
        const { data: tripRow } = await supabase
          .from('trips')
          .select('smart_finish_purchased')
          .eq('id', context.tripId)
          .maybeSingle();
        const tripHasSmartFinish = !!tripRow?.smart_finish_purchased;

        canEnrichPhotos = hasCompletedPurchase || tripHasSmartFinish || isFirstTrip;
        console.log(`[Stage 4] Photo enrichment gate: purchase=${hasCompletedPurchase}, firstTrip=${isFirstTrip}, smartFinish=${tripHasSmartFinish} → ${canEnrichPhotos ? 'ENRICH' : 'SKIP PHOTOS'}`);
      } catch (gateErr) {
        console.warn('[Stage 4] Access gate check failed, defaulting to enrich:', gateErr);
        canEnrichPhotos = true; // Fail-open
      }

      // STAGE 4: Enrichment (real photos + venue verification via Google Places API v1)
      let enrichedDays: StrictDay[];
      let enrichmentStats: EnrichmentStats | null = null;
      try {
        if (canEnrichPhotos) {
          const enrichmentResult = await enrichItinerary(aiResult.days, context.destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY, LOVABLE_API_KEY);
          enrichedDays = enrichmentResult.days;
          enrichmentStats = enrichmentResult.stats;
        } else {
          // Skip photo enrichment but still do venue verification without photos
          console.log('[Stage 4] Skipping photo enrichment for gated user — venue verification only');
          const enrichmentResult = await enrichItinerary(aiResult.days, context.destination, supabaseUrl, supabaseKey, undefined, LOVABLE_API_KEY);
          enrichedDays = enrichmentResult.days;
          enrichmentStats = enrichmentResult.stats;
          // Strip any photos that might have been added from cache
          for (const day of enrichedDays) {
            for (const act of day.activities) {
              act.photos = [];
            }
          }
        }
      } catch (enrichError) {
        console.warn('[generate-itinerary] Enrichment failed, using base itinerary:', enrichError);
        enrichedDays = aiResult.days;
      }

      // =======================================================================
      // STAGE 4.5: Opening Hours Validation & Auto-Fix
      // Detect activities scheduled outside operating hours and attempt to fix.
      // CONFIRMED CLOSURES (venue closed all day) → REMOVE the activity.
      // Time conflicts (venue open, wrong time) → shift time.
      // Unfixable time conflicts → tag as closedRisk (uncertain warning only).
      // =======================================================================
      if (context.startDate) {
        const hoursViolations = validateOpeningHours(enrichedDays, context.startDate);
        if (hoursViolations.length > 0) {
          console.warn(`[Stage 4.5] ⚠️ ${hoursViolations.length} opening hours conflict(s) detected — attempting auto-fix:`);
          
          let fixedCount = 0;
          let removedCount = 0;
          
          for (const violation of hoursViolations) {
            const day = enrichedDays[violation.dayNumber - 1];
            if (!day) continue;
            const activity = day.activities.find((a: StrictActivity) => a.id === violation.activityId);
            if (!activity) continue;
            
            // ─── CONFIRMED CLOSED ALL DAY → REMOVE the activity ───
            if (violation.isConfirmedClosed) {
              const removedTitle = activity.title;
              day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
              removedCount++;
              console.log(`  ✗ Day ${violation.dayNumber}: "${removedTitle}" — REMOVED (confirmed closed on this day)`);
              continue;
            }
            
            // ─── TIME CONFLICT (venue is open, but wrong time) → try shifting ───
            const openingHours = (activity as any).openingHours as string[] | undefined;
            if (openingHours && activity.startTime) {
              const startDate = new Date(context.startDate);
              startDate.setDate(startDate.getDate() + (violation.dayNumber - 1));
              const dayOfWeek = startDate.getDay();
              
              const DAY_NAMES_FIX = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const dayName = DAY_NAMES_FIX[dayOfWeek];
              const dayEntry = openingHours.find(h => h.toLowerCase().startsWith(dayName.toLowerCase()));
              
              if (dayEntry) {
                const entryLower = dayEntry.toLowerCase();
                // Double-check: if somehow closed entry slipped through (shouldn't with isConfirmedClosed above)
                if (entryLower.includes('closed') || entryLower.includes('fermé') || entryLower.includes('cerrado') || entryLower.includes('chiuso')) {
                  day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
                  removedCount++;
                  console.log(`  ✗ Day ${violation.dayNumber}: "${violation.activityTitle}" — REMOVED (closed, caught in fallback)`);
                  continue;
                }
                
                // Extract ALL time ranges for this day (handles split hours like lunch + dinner)
                const { extractTimeRanges: extractRanges } = await import('./truth-anchors.ts');
                // We need to use the function from truth-anchors if available, otherwise parse inline
                const rangeMatch12h = entryLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)\s*[–\-−to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)/gi);
                const rangeMatch24h = entryLower.match(/(\d{1,2}):(\d{2})\s*[–\-−to]+\s*(\d{1,2}):(\d{2})/g);
                
                // Parse opening and closing times
                let venueOpenMins = -1;
                let venueCloseMins = -1;
                
                const timeMatch = entryLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
                if (timeMatch) {
                  let openHour = parseInt(timeMatch[1]);
                  const openMin = parseInt(timeMatch[2]);
                  const period = timeMatch[3]?.toUpperCase();
                  if (period === 'PM' && openHour !== 12) openHour += 12;
                  if (period === 'AM' && openHour === 12) openHour = 0;
                  venueOpenMins = openHour * 60 + openMin;
                }
                
                // Extract closing time (second time in the range)
                const closeMatch = entryLower.match(/[–\-−to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
                if (closeMatch) {
                  let closeHour = parseInt(closeMatch[1]);
                  const closeMin = parseInt(closeMatch[2]);
                  const closePeriod = closeMatch[3]?.toUpperCase();
                  if (closePeriod === 'PM' && closeHour !== 12) closeHour += 12;
                  if (closePeriod === 'AM' && closeHour === 12) closeHour = 0;
                  venueCloseMins = closeHour * 60 + closeMin;
                  // Handle midnight: "11:00 PM – 12:00 AM" → close = 1440
                  if (venueCloseMins === 0) venueCloseMins = 1440;
                }
                
                if (venueOpenMins >= 0 && venueCloseMins > 0) {
                  const oldStartTime = activity.startTime;
                  const oldMins = parseInt(oldStartTime.split(':')[0]) * 60 + parseInt(oldStartTime.split(':')[1]);
                  const duration = activity.endTime 
                    ? (parseInt(activity.endTime.split(':')[0]) * 60 + parseInt(activity.endTime.split(':')[1])) - oldMins
                    : 60; // default 1 hour
                  
                  let newStartMins = -1;
                  
                  // Case A: Scheduled BEFORE venue opens → shift to opening + 10 min buffer
                  if (oldMins < venueOpenMins) {
                    newStartMins = venueOpenMins + 10;
                  }
                  // Case B: Scheduled AFTER venue closes (or too close to closing) → shift earlier
                  else if (oldMins >= venueCloseMins || (oldMins + duration) > venueCloseMins) {
                    // Place activity so it ends 15 min before closing
                    const latestStart = venueCloseMins - duration - 15;
                    if (latestStart >= venueOpenMins + 10) {
                      newStartMins = latestStart;
                    } else {
                      // Activity duration doesn't fit in opening window — REMOVE instead of warning
                      day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
                      removedCount++;
                      console.log(`  ✗ Day ${violation.dayNumber}: "${violation.activityTitle}" — REMOVED (duration ${duration}min doesn't fit in venue hours)`);
                      continue;
                    }
                  }
                  
                  if (newStartMins >= 0 && newStartMins !== oldMins) {
                    const newStartTime = `${Math.floor(newStartMins / 60).toString().padStart(2, '0')}:${(newStartMins % 60).toString().padStart(2, '0')}`;
                    const newEndMins = newStartMins + duration;
                    activity.startTime = newStartTime;
                    if (activity.endTime) {
                      activity.endTime = `${Math.floor(newEndMins / 60).toString().padStart(2, '0')}:${(newEndMins % 60).toString().padStart(2, '0')}`;
                    }
                    fixedCount++;
                    console.log(`  ✓ Day ${violation.dayNumber}: "${violation.activityTitle}" shifted ${oldStartTime} → ${newStartTime} (venue hours: ${Math.floor(venueOpenMins / 60).toString().padStart(2, '0')}:${(venueOpenMins % 60).toString().padStart(2, '0')}–${Math.floor(venueCloseMins / 60).toString().padStart(2, '0')}:${(venueCloseMins % 60).toString().padStart(2, '0')})`);
                    continue;
                  }
                }
              }
            }
            
            // Couldn't auto-fix and not confirmed closed — tag as uncertain warning only
            (activity as any).closedRisk = true;
            (activity as any).closedRiskReason = violation.reason;
            console.warn(`  - Day ${violation.dayNumber}: "${violation.activityTitle}" — ${violation.reason} (uncertain, tagged as warning)`);
          }
          
          const summary: string[] = [];
          if (fixedCount > 0) summary.push(`${fixedCount} time-shifted`);
          if (removedCount > 0) summary.push(`${removedCount} removed (confirmed closed)`);
          console.log(`[Stage 4.5] ✓ Results: ${summary.join(', ') || 'no fixes needed'} out of ${hoursViolations.length} conflicts`);
        } else {
          console.log("[Stage 4.5] ✓ No opening hours conflicts detected");
        }
      }

      // =======================================================================
      // STAGE 4.6: Distance-Aware Buffer Enforcement
      // Now that Stage 4 enrichment has added verified GPS coordinates,
      // calculate actual haversine distances between consecutive activities
      // and enforce realistic transit buffers based on distance.
      // =======================================================================
      {
        const distanceToMinBuffer = (distKm: number): number => {
          if (distKm < 0.5) return 10;   // < 500m: easy walk
          if (distKm < 2) return 15;      // 500m–2km: brisk walk
          if (distKm < 5) return 20;      // 2km–5km: short taxi
          if (distKm < 15) return 30;     // 5km–15km: taxi ride
          return 45;                       // > 15km: cross-city
        };

        let bufferFixCount = 0;

        for (const day of enrichedDays) {
          if (!day.activities || day.activities.length < 2) continue;

          for (let i = 0; i < day.activities.length - 1; i++) {
            const current = day.activities[i];
            const next = day.activities[i + 1];

            // Get coordinates from enriched location data
            const curCoords = current.location?.coordinates || current.coordinates;
            const nextCoords = next.location?.coordinates || next.coordinates;

            if (!curCoords?.lat || !curCoords?.lng || !nextCoords?.lat || !nextCoords?.lng) continue;

            const distKm = haversineDistanceKm(
              curCoords.lat, curCoords.lng,
              nextCoords.lat, nextCoords.lng
            );

            const requiredBuffer = distanceToMinBuffer(distKm);

            // Parse current end time and next start time
            const curEndMins = parseTimeToMinutes(current.endTime || current.startTime || '');
            const nextStartMins = parseTimeToMinutes(next.startTime || '');
            if (curEndMins === null || nextStartMins === null) continue;

            // If current has no endTime, estimate from duration
            let effectiveEndMins = curEndMins;
            if (!current.endTime && current.startTime) {
              const startM = parseTimeToMinutes(current.startTime);
              if (startM !== null) {
                let durMins = 60;
                if (current.duration) {
                  const d = String(current.duration).toLowerCase();
                  const hm = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
                  const mm = d.match(/([\d.]+)\s*(?:minutes?|mins?|m(?!onth))/);
                  durMins = 0;
                  if (hm) durMins += parseFloat(hm[1]) * 60;
                  if (mm) durMins += parseFloat(mm[1]);
                  if (durMins === 0) durMins = 60;
                }
                effectiveEndMins = startM + durMins;
              }
            }

            const actualGap = nextStartMins - effectiveEndMins;

            if (actualGap < requiredBuffer) {
              const deficit = requiredBuffer - actualGap;
              // Cascade-shift this activity and all subsequent ones forward
              for (let j = i + 1; j < day.activities.length; j++) {
                const act = day.activities[j];
                const s = parseTimeToMinutes(act.startTime || '');
                const e = parseTimeToMinutes(act.endTime || '');
                if (s !== null) act.startTime = minutesToHHMM(s + deficit);
                if (e !== null) act.endTime = minutesToHHMM(e + deficit);
              }
              bufferFixCount++;
              console.log(`[Stage 4.6] Day ${day.dayNumber}: "${current.title}" → "${next.title}" = ${distKm.toFixed(1)}km, needed ${requiredBuffer}min buffer but had ${actualGap}min — shifted +${deficit}min`);
            }
          }
        }

        if (bufferFixCount > 0) {
          console.log(`[Stage 4.6] ✓ Fixed ${bufferFixCount} insufficient distance-based buffers across all days`);
        } else {
          console.log(`[Stage 4.6] ✓ All transit buffers are sufficient for actual distances`);
        }
      }

      // =======================================================================
      // STAGE 4.7: Batch Geocode — fill in missing coordinates for route maps
      // Activities with addresses but no lat/lng from Google Places verification
      // =======================================================================
      if (GOOGLE_MAPS_API_KEY) {
        const activitiesToGeocode: { dayIdx: number; actIdx: number; address: string }[] = [];
        for (let di = 0; di < enrichedDays.length; di++) {
          for (let ai = 0; ai < enrichedDays[di].activities.length; ai++) {
            const act = enrichedDays[di].activities[ai];
            if (!act.location?.coordinates && act.location?.address && act.location.address.length > 5) {
              activitiesToGeocode.push({ dayIdx: di, actIdx: ai, address: act.location.address });
            }
          }
        }

        if (activitiesToGeocode.length > 0) {
          console.log(`[Stage 4.7] Batch geocoding ${activitiesToGeocode.length} activities without coordinates`);
          // Process in batches of 5 to respect rate limits
          const GEO_BATCH = 5;
          for (let gi = 0; gi < activitiesToGeocode.length; gi += GEO_BATCH) {
            const batch = activitiesToGeocode.slice(gi, gi + GEO_BATCH);
            const results = await Promise.all(batch.map(async (item) => {
              try {
                const resp = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(item.address)}&key=${GOOGLE_MAPS_API_KEY}`
                );
                const data = await resp.json();
                const loc = data.results?.[0]?.geometry?.location;
                return loc ? { ...item, lat: loc.lat as number, lng: loc.lng as number } : null;
              } catch {
                return null;
              }
            }));
            for (const r of results) {
              if (r) {
                enrichedDays[r.dayIdx].activities[r.actIdx].location = {
                  ...enrichedDays[r.dayIdx].activities[r.actIdx].location,
                  coordinates: { lat: r.lat, lng: r.lng },
                };
              }
            }
            if (gi + GEO_BATCH < activitiesToGeocode.length) {
              await new Promise(r => setTimeout(r, 200));
            }
          }
          const geocoded = activitiesToGeocode.length;
          const succeeded = enrichedDays.reduce(
            (s, d) => s + d.activities.filter(a => a.location?.coordinates).length, 0
          ) - enrichedDays.reduce(
            (s, d) => s + d.activities.filter(a => a.location?.coordinates && a.verified?.placeId).length, 0
          );
          console.log(`[Stage 4.7] Geocoded ${succeeded}/${geocoded} activities`);
        }
      }

      // =======================================================================
      // STAGE 4.9: Auto Route Optimization — reorder flexible activities
      // by geographic proximity. No API calls, no credits — quality feature.
      // =======================================================================
      try {
        const { autoOptimizeDayRoute } = await import('./auto-route-optimizer.ts');
        for (const day of enrichedDays) {
          day.activities = autoOptimizeDayRoute(day.activities as any[]) as typeof day.activities;
        }
        console.log(`[Stage 4.9] ✓ Auto route optimization applied to ${enrichedDays.length} days`);
      } catch (routeErr) {
        console.warn('[Stage 4.9] Auto route optimization failed (non-blocking):', routeErr);
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

      // Return complete response with free tier metadata
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
          enrichmentMetadata: enrichedItinerary.enrichmentMetadata,
          // Hidden gems discovered but not auto-included (for browsable section)
          hiddenGems: discoveredGems.length > 0 ? discoveredGems : undefined,
          // freeTierInfo removed — credit gating handled by client-side generation gate
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-day / regenerate-day - Single day generation with flight/hotel awareness
    // ==========================================================================
    if (action === 'generate-day' || action === 'regenerate-day') {
      // Extract params BUT NOT userId from request body
      const { tripId, dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities, keepActivities, currentActivities,
        isMultiCity: paramIsMultiCity, isTransitionDay: paramIsTransitionDay, transitionFrom: paramTransitionFrom, transitionTo: paramTransitionTo, transitionMode: paramTransitionMode,
        mustDoActivities: paramMustDoActivities, interestCategories: paramInterestCategories, generationRules: paramGenerationRules,
        pacing: paramPacing, isFirstTimeVisitor: paramIsFirstTimeVisitor,
        hotelOverride: paramHotelOverride, isFirstDayInCity: paramIsFirstDayInCity, isLastDayInCity: paramIsLastDayInCity } = params;
      
      // PHASE 2 FIX: Use authenticated user ID as the canonical source of truth
      // This is the critical fix - frontend calls often omit userId, but auth token is always present
      const userId = authResult.userId;
      
      // Security guard: if request body includes userId that differs from auth token, log and reject
      if (params.userId && params.userId !== userId) {
        console.warn(`[generate-day] userId mismatch! auth=${userId}, params=${params.userId} - rejecting`);
        return new Response(
          JSON.stringify({ error: "User ID mismatch. Please re-authenticate." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify trip access: user must be owner or accepted collaborator with edit permission
      if (tripId) {
        const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, true);
        if (!tripAccessResult.allowed) {
          console.warn(`[generate-day] Access denied: user=${userId}, trip=${tripId}, reason=${tripAccessResult.reason}`);
          return new Response(
            JSON.stringify({ error: tripAccessResult.reason || "Trip not found or access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log(`[generate-day] ✓ Using authenticated userId: ${userId} (trip owner: ${tripAccessResult.isOwner})`);
      } else {
        console.log(`[generate-day] ✓ Using authenticated userId: ${userId} (no tripId to verify)`);
      }


// =============================================================================
// JOURNEY NEXT-LEG AUTO-TRIGGER
// After a leg finishes generating, check if there's a queued next leg and kick it off.
// =============================================================================
async function triggerNextJourneyLeg(supabase: any, tripId: string): Promise<void> {
  try {
    // Fetch this trip's journey info
    const { data: currentTrip } = await supabase
      .from('trips')
      .select('journey_id, journey_order')
      .eq('id', tripId)
      .single();

    if (!currentTrip?.journey_id || !currentTrip?.journey_order) {
      return; // Not a journey leg
    }

    const nextOrder = currentTrip.journey_order + 1;

    // Find the next queued leg WITH full trip fields needed for generate-trip
    const { data: nextLeg } = await supabase
      .from('trips')
      .select('id, itinerary_status, destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city, user_id')
      .eq('journey_id', currentTrip.journey_id)
      .eq('journey_order', nextOrder)
      .single();

    if (!nextLeg || nextLeg.itinerary_status !== 'queued') {
      console.log(`[triggerNextJourneyLeg] No queued next leg for journey ${currentTrip.journey_id} order ${nextOrder}`);
      return;
    }

    console.log(`[triggerNextJourneyLeg] Triggering generation for next leg ${nextLeg.id} (order ${nextOrder}, dest: ${nextLeg.destination})`);

    // Invoke generate-itinerary with full generate-trip payload
    const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    try {
      const res = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          action: 'generate-trip',
          tripId: nextLeg.id,
          userId: nextLeg.user_id,
          destination: nextLeg.destination,
          destinationCountry: nextLeg.destination_country || '',
          startDate: nextLeg.start_date,
          endDate: nextLeg.end_date,
          travelers: nextLeg.travelers || 1,
          tripType: nextLeg.trip_type || 'vacation',
          budgetTier: nextLeg.budget_tier || 'moderate',
          isMultiCity: nextLeg.is_multi_city || false,
          creditsCharged: 0, // Already charged on leg 1
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`[triggerNextJourneyLeg] Non-2xx response for leg ${nextLeg.id}: ${res.status} — ${errorBody}`);
        // Fetch existing metadata to merge (preserve must-dos, personalization)
        const { data: legMeta } = await supabase.from('trips').select('metadata').eq('id', nextLeg.id).single();
        const existingMeta = (legMeta?.metadata as Record<string, unknown>) || {};
        // Reset to queued so frontend fallback can retry
        await supabase.from('trips').update({
          itinerary_status: 'queued',
          metadata: {
            ...existingMeta,
            chain_error: `Backend returned ${res.status}`,
            chain_error_at: new Date().toISOString(),
          },
        }).eq('id', nextLeg.id);
        return;
      }

      console.log(`[triggerNextJourneyLeg] Next leg ${nextLeg.id} invoke status: ${res.status}`);
    } catch (fetchErr) {
      console.error(`[triggerNextJourneyLeg] Failed to invoke next leg ${nextLeg.id}:`, fetchErr);
      // Fetch existing metadata to merge (preserve must-dos, personalization)
      const { data: legMeta } = await supabase.from('trips').select('metadata').eq('id', nextLeg.id).single();
      const existingMeta = (legMeta?.metadata as Record<string, unknown>) || {};
      // Reset status so the frontend fallback can retry
      await supabase.from('trips').update({
        itinerary_status: 'queued',
        metadata: {
          ...existingMeta,
          chain_error: String(fetchErr),
          chain_error_at: new Date().toISOString(),
        },
      }).eq('id', nextLeg.id);
    }
  } catch (err) {
    console.error('[triggerNextJourneyLeg] Error:', err);
  }
}


      // =======================================================================
      // TRANSITION DAY RESOLVER: Determine if this day is a transition day
      // Uses explicit params from frontend, or resolves from trip_cities DB
      // =======================================================================
      let resolvedIsTransitionDay = !!paramIsTransitionDay;
      let resolvedTransitionFrom = paramTransitionFrom || '';
      let resolvedTransitionTo = paramTransitionTo || '';
      let resolvedTransportMode = paramTransitionMode || '';
      let resolvedTransportDetails: any = null;
      let resolvedNextLegTransport = '';
      let resolvedNextLegCity = '';
      let resolvedIsMultiCity = !!paramIsMultiCity;
      let resolvedDestination = destination;
      let resolvedCountry = destinationCountry;

      // If we have a tripId, try to resolve transition context from trip_cities
      if (tripId && !resolvedIsTransitionDay) {
        try {
          const { data: tripCities } = await supabase
            .from('trip_cities')
            .select('city_name, country, city_order, nights, days_total, transition_day_mode, transport_type, transport_details')
            .eq('trip_id', tripId)
            .order('city_order', { ascending: true });

          if (tripCities && tripCities.length > 1) {
            resolvedIsMultiCity = true;
            let dayCounter = 0;
            for (const city of tripCities) {
              const cityNights = (city as any).nights || (city as any).days_total || 1;
              for (let n = 0; n < cityNights; n++) {
                dayCounter++;
                if (dayCounter === dayNumber) {
                  resolvedDestination = city.city_name || destination;
                  resolvedCountry = (city as any).country || destinationCountry;
                  // Check if this is the last day in this city — capture next leg transport
                  if (n === cityNights - 1) {
                    const nextCity = tripCities.find((c: any) => c.city_order === city.city_order + 1);
                    if (nextCity) {
                      const isSameCountry = nextCity.country === city.country;
                      resolvedNextLegTransport = (nextCity as any).transport_type || (isSameCountry ? 'train' : 'flight');
                      resolvedNextLegCity = nextCity.city_name || '';
                    }
                  }
                  if (n === 0 && city.city_order > 0 && (city as any).transition_day_mode !== 'skip') {
                    resolvedIsTransitionDay = true;
                    const prevCity = tripCities.find((c: any) => c.city_order === city.city_order - 1);
                    resolvedTransitionFrom = prevCity?.city_name || '';
                    resolvedTransitionTo = city.city_name || '';
                    resolvedTransportMode = (city as any).transport_type || 'train';
                    // Capture transport_details for schedule injection, normalizing legacy field names
                    if ((city as any).transport_details) {
                      const raw = (city as any).transport_details;
                      const td: any = { ...raw };
                      // Normalize "operator" → "carrier"
                      if (raw.operator && !raw.carrier) td.carrier = raw.operator;
                      // For flights: "departureStation"/"arrivalStation" may hold airport names
                      if (resolvedTransportMode === 'flight') {
                        if (raw.departureStation && !raw.departureAirport) td.departureAirport = raw.departureStation;
                        if (raw.arrivalStation && !raw.arrivalAirport) td.arrivalAirport = raw.arrivalStation;
                      }
                      // For cars: map pickup/dropoff to departure/arrival stations for prompt
                      if (resolvedTransportMode === 'car') {
                        if (raw.pickupLocation && !raw.departureStation) td.departureStation = raw.pickupLocation;
                        if (raw.dropoffLocation && !raw.arrivalStation) td.arrivalStation = raw.dropoffLocation;
                        if (raw.rentalCompany && !raw.carrier) td.carrier = raw.rentalCompany;
                      }
                      // Normalize duration variants
                      if (!raw.duration) {
                        if (raw.inTransitDuration) td.duration = raw.inTransitDuration;
                        else if (raw.doorToDoorDuration) td.duration = raw.doorToDoorDuration;
                      }
                      resolvedTransportDetails = td;
                    }
                  }
                  break;
                }
              }
              if (dayCounter >= dayNumber) break;
            }
            console.log(`[generate-day] Transition resolver: day=${dayNumber}, isTransition=${resolvedIsTransitionDay}, from=${resolvedTransitionFrom}, to=${resolvedTransitionTo}, mode=${resolvedTransportMode}`);
          }
        } catch (e) {
          console.warn('[generate-day] Could not resolve transition context from trip_cities:', e);
        }
      } else if (resolvedIsTransitionDay) {
        console.log(`[generate-day] Using explicit transition params: from=${resolvedTransitionFrom}, to=${resolvedTransitionTo}, mode=${resolvedTransportMode}`);
      }

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

Do NOT generate any activity that is similar in type or theme to a locked activity.
For example, if "Comedy Show" is locked, do NOT suggest "Stand-Up Night" or any other comedy activity.
If "US Open" is locked, do NOT suggest "Tennis Match" or any other tennis event.
Each locked activity is unique — do not create alternatives, variations, or substitutes.

${lockedSlotsList}

Generate activities ONLY for the remaining unlocked time periods. 
DO NOT create any activity that starts or ends within a locked time slot.`;
        
        console.log(`[generate-day] Added ${lockedActivities.length} locked slots to AI prompt`);
      }

      // ==========================================================================
      // PHASE 2 FIX: Removed legacy getTravelDNAV2 + buildTravelDNAContext dual path
      // All traveler data now comes from loadTravelerProfile (single source of truth)
      // This eliminates conflicting archetype/trait resolution between prompts
      // ==========================================================================
      
      // Get user preferences for basic interests/restrictions (NOT for archetype/traits)
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      const userPrefs = userId ? await getUserPreferences(supabase, userId) : null;
      
      // Build basic preference context (interests, restrictions only - no archetype/traits)
      const basicPreferenceContext = buildPreferenceContext(insights, userPrefs);
      
      // NOTE: preferenceContext is now built from unified profile in the prompt below
      // The archetype, traits, budget, and avoid list all come from loadTravelerProfile()
      // This ensures system prompt and user prompt use the SAME data source
      const preferenceContext = basicPreferenceContext;

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

      // Load personalization inputs from request body first, then fall back to trip metadata
      let mustDoPrompt = '';
      let mustDoEventItems: ScheduledMustDo[] = [];
      let metadata: Record<string, unknown> | null = null;
      if (tripId) {
        const { data: tripMeta } = await supabase
          .from('trips')
          .select('metadata, creation_source')
          .eq('id', tripId)
          .single();
        metadata = (tripMeta?.metadata as Record<string, unknown> | null) || null;
      }

      const requestMustDoText = Array.isArray(paramMustDoActivities)
        ? paramMustDoActivities.join('\n')
        : (typeof paramMustDoActivities === 'string' ? paramMustDoActivities : '');

      const mustDoActivities = requestMustDoText || (() => {
        const raw = metadata?.mustDoActivities;
        return Array.isArray(raw) ? raw.join('\n') : (raw as string || '');
      })();

      const interestCategories = (
        Array.isArray(paramInterestCategories) && paramInterestCategories.length > 0
          ? paramInterestCategories
          : ((metadata?.interestCategories as string[]) || [])
      );

      const genRules = (
        Array.isArray(paramGenerationRules) && paramGenerationRules.length > 0
          ? paramGenerationRules
          : ((metadata?.generationRules as any[]) || [])
      );

      const effectivePacing = typeof paramPacing === 'string'
        ? paramPacing
        : ((metadata?.pacing as string) || 'balanced');

      const effectiveIsFirstTimeVisitor = typeof paramIsFirstTimeVisitor === 'boolean'
        ? paramIsFirstTimeVisitor
        : ((metadata?.isFirstTimeVisitor as boolean) ?? true);

      const isSmartFinish = metadata?.smartFinishMode === true || (metadata?.smartFinishSource || '').toString().includes('manual_builder');
      const smartFinishRequested = !!metadata?.smartFinishRequestedAt || isSmartFinish;

      if (mustDoActivities.trim()) {
        const forceAllMust = !!isSmartFinish || !!smartFinishRequested;
        const mustDoAnalysis = parseMustDoInput(mustDoActivities, destination, forceAllMust, preferences?.startDate || date?.split('T')[0], totalDays);
        if (mustDoAnalysis.length > 0) {
          const scheduled = scheduleMustDos(mustDoAnalysis, totalDays);
          // Only include items relevant to this day
          const dayItems = scheduled.scheduled.filter(s => s.assignedDay === dayNumber);
          // Save event items for post-generation overlap stripping
          mustDoEventItems = dayItems.filter(s => 
            s.priority.activityType === 'all_day_event' || s.priority.activityType === 'half_day_event'
          );
          if (dayItems.length > 0) {
            // Build blocked time info for events
            // Build blocked time info for events — explicitly instruct AI to CREATE the event card
            const blockedTimeLines = mustDoEventItems.map(ev => {
              const { blockedStart, blockedEnd } = getBlockedTimeRange(ev);
              return `⏰ "${ev.priority.title}" — BLOCKED TIME: ${blockedStart}–${blockedEnd}
  YOU MUST CREATE AN ACTIVITY ENTRY for "${ev.priority.title}" with startTime: "${blockedStart}", endTime: "${blockedEnd}".
  This MUST appear as a real activity card in the JSON output. Do NOT schedule any OTHER activities in this window.`;
            }).join('\n');
            mustDoPrompt = `\n## 🚨 USER'S MUST-DO VENUES FOR DAY ${dayNumber} (MANDATORY)\n\nThe traveler has PERSONALLY RESEARCHED these venues. You MUST include them:\n${dayItems.map(item => `- ${item.priority.title} (${item.priority.priority})${item.priority.activityType === 'all_day_event' ? ' [ALL-DAY EVENT — YOU MUST generate an activity card for this event]' : item.priority.activityType === 'half_day_event' ? ' [HALF-DAY EVENT — YOU MUST generate an activity card for this event]' : ''}`).join('\n')}\n${blockedTimeLines ? '\n' + blockedTimeLines + '\n' : ''}\nRULES:\n- EVERY must-do venue listed above MUST appear as its own activity entry in the JSON output\n- For ALL-DAY events: CREATE the event as an activity card, then do NOT schedule OTHER activities during its time window\n- For HALF-DAY events: CREATE the event as an activity card, then fill the OTHER half of the day\n- Any OTHER activity overlapping a BLOCKED TIME window is a HARD FAILURE\n- Only add AI recommendations to fill remaining slots OUTSIDE blocked windows\n- CRITICAL DEDUP RULE: Do NOT generate a SEPARATE activity that is the same TYPE as a must-do. For example, if the user has "Comedy Show" as a must-do, do NOT also add your own "Stand-Up Comedy" or "Comedy Night" activity. The user's must-do IS the comedy show — you just need to create the card for it with a proper venue, not add a second one.\n- When creating the activity card for a must-do, use a PROPERLY FORMATTED title with a specific venue name (e.g., "Comedy Show at Comedy Cellar" not just the raw user text).\n`;
          } else {
            // No items specifically for this day, but include unschedulable ones as suggestions
            const unscheduledItems = scheduled.unschedulable || [];
            if (unscheduledItems.length > 0) {
              mustDoPrompt = `\n## User's Researched Venues (try to include if appropriate)\n${unscheduledItems.map(u => `- ${u.priority.title} (${u.priority.priority})`).join('\n')}\n`;
            }
          }
          console.log(`[generate-day] Must-do activities parsed: ${mustDoAnalysis.length} items total`);
          console.log(`[generate-day] Day ${dayNumber}: ${dayItems.length} assigned items, ${mustDoEventItems.length} event(s)`);
          for (const di of dayItems) {
            console.log(`[generate-day]   → "${di.priority.title}" (${di.priority.activityType}, preferredDay=${di.priority.preferredDay}, assigned=${di.assignedDay})`);
          }
          if (mustDoEventItems.length === 0 && dayItems.length === 0) {
            const allScheduled = scheduled.scheduled;
            console.log(`[generate-day] ⚠️ No items for Day ${dayNumber}. Full schedule:`);
            for (const s of allScheduled) {
              console.log(`[generate-day]   → "${s.priority.title}" assigned to Day ${s.assignedDay} (preferred=${s.priority.preferredDay})`);
            }
          }
          
          // Add global must-do context so this day knows about other days' committed activities
          const otherDayItems = scheduled.scheduled.filter(s => s.assignedDay !== dayNumber);
          if (otherDayItems.length > 0) {
            mustDoPrompt += '\n\n📋 OTHER DAYS HAVE THESE COMMITTED ACTIVITIES (for your awareness — do NOT schedule these today):\n';
            for (const other of otherDayItems) {
              mustDoPrompt += `- Day ${other.assignedDay}: ${other.priority.title} (${other.priority.activityType})\n`;
            }
            mustDoPrompt += 'Keep today\'s schedule compatible with the overall trip plan.\n';
          }
        } else {
          // Raw text fallback
          mustDoPrompt = `\n## 🚨 USER'S RESEARCHED RESTAURANTS & VENUES (MANDATORY)\n\nThe traveler has researched these specific venues. Include as many as possible in the itinerary:\n"${mustDoActivities.trim()}"\n`;
          console.log(`[generate-day] Must-do raw text injected (${mustDoActivities.length} chars)`);
        }
      }

      // Inject interest categories into prompt
      if (interestCategories.length > 0) {
        const categoryLabels: Record<string, string> = {
          history: 'History & Museums', food: 'Food & Dining', shopping: 'Shopping',
          nature: 'Parks & Nature', culture: 'Arts & Culture', nightlife: 'Nightlife',
        };
        const labels = interestCategories.map(c => categoryLabels[c] || c).join(', ');
        mustDoPrompt += `\n## USER INTERESTS\nThe user is especially interested in: ${labels}. Weight recommendations toward these categories.\n`;
        console.log(`[generate-day] Interest categories injected: ${labels}`);
      }

      // Inject structured generation rules for per-day generation
      if (genRules.length > 0) {
        mustDoPrompt += formatGenerationRules(genRules);
        console.log(`[generate-day] Generation rules injected: ${genRules.length} rules`);
      }

      // Inject explicit visitor-type and pacing constraints
      mustDoPrompt += `\n## VISITOR TYPE\n${effectiveIsFirstTimeVisitor ? 'Traveler is a FIRST-TIME visitor. Prioritize iconic landmarks and essential highlights for this city.' : 'Traveler is a RETURNING visitor. Prioritize hidden gems, local favorites, and deeper neighborhood exploration over tourist staples.'}\n`;

      const pacingGuidance: Record<string, string> = {
        relaxed: 'PACING = RELAXED: Fewer activities with generous downtime and slower transitions.',
        balanced: 'PACING = BALANCED: Normal day density with a healthy mix of activities and breathing room.',
        packed: 'PACING = PACKED: Maximize meaningful activities while keeping sequencing realistic.',
      };
      const pacingInstruction = pacingGuidance[(effectivePacing || 'balanced').toLowerCase()] || pacingGuidance.balanced;
      mustDoPrompt += `\n## PACING\n${pacingInstruction}\n`;

      let mustHavesConstraintPrompt = '';
      let preBookedCommitmentsPrompt = '';
      if (tripId) {
        // Re-use the tripMeta we already fetched above if available, otherwise fetch
        const metadataForConstraints = (tripId && mustDoPrompt !== undefined) 
          ? (await supabase.from('trips').select('metadata').eq('id', tripId).single()).data?.metadata as Record<string, unknown> | null
          : null;
        
        // Must-haves checklist
        const mustHavesList = (metadataForConstraints?.mustHaves as Array<{label: string; notes?: string}>) || [];
        if (mustHavesList.length > 0) {
          mustHavesConstraintPrompt = buildMustHavesConstraintPrompt(mustHavesList, totalDays);
          console.log(`[generate-day] Must-haves checklist injected: ${mustHavesList.length} items`);
        }
        
        // Pre-booked commitments (shows, reservations, tours with fixed times)
        const preBookedList = (metadataForConstraints?.preBookedCommitments as PreBookedCommitment[]) || [];
        if (preBookedList.length > 0) {
          const startDate = preferences?.startDate || body.date?.split('T')[0] || '';
          const endDate = preferences?.endDate || '';
          const commitmentAnalysis = analyzePreBookedCommitments(preBookedList, startDate, endDate);
          // For per-day generation, only include commitments relevant to this day's date
          const dayDate = body.date?.split('T')[0] || '';
          const dayAvail = commitmentAnalysis.dayBlocks.get(dayDate);
          if (dayAvail && dayAvail.blockedPeriods.length > 0) {
            preBookedCommitmentsPrompt = `\n## 📅 PRE-BOOKED COMMITMENTS FOR THIS DAY (NON-NEGOTIABLE)\n\nThe traveler has FIXED commitments today. You MUST schedule around them:\n${dayAvail.blockedPeriods.map(b => `- "${b.commitment.title}" from ${b.startTime} to ${b.endTime}${b.commitment.location ? ` at ${b.commitment.location}` : ''} [${b.commitment.category}]`).join('\n')}\n\nAvailable time slots:\n${dayAvail.availableSlots.map(s => `- ${s.startTime} to ${s.endTime} (${s.durationMinutes} min, ${s.period})`).join('\n')}\n\nRULES:\n- Do NOT schedule any activity during the blocked periods above\n- Include the pre-booked event AS an activity in the itinerary (category: "${dayAvail.blockedPeriods[0]?.commitment.category || 'event'}")\n- Plan activities ONLY in the available time slots\n`;
            console.log(`[generate-day] Pre-booked commitments for day ${dayNumber}: ${dayAvail.blockedPeriods.length} events`);
          } else if (commitmentAnalysis.promptSection) {
            // Include full prompt as context even if no events on this specific day
            preBookedCommitmentsPrompt = `\n## 📅 Pre-Booked Commitments (other days)\nThe traveler has pre-booked events on other days. No fixed events today — plan freely.\n`;
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Inject "Anything Else" / Additional Notes into per-day generation
      // This was previously only in the full-trip path — Bug 2 fix
      // ═══════════════════════════════════════════════════════════════════════
      let additionalNotesPrompt = '';
      const additionalNotes = (metadata?.additionalNotes as string) || '';
      if (additionalNotes.trim()) {
        additionalNotesPrompt = `\n## 🎯 TRAVELER'S TRIP PURPOSE / ADDITIONAL NOTES
The traveler provided these additional notes about their trip. These describe the PRIMARY PURPOSE or special requirements:

"${additionalNotes.trim()}"

CRITICAL: If these notes describe a specific event, activity, or purpose (e.g., "going for the U.S. Open", "attending a wedding", "here for a conference"), this MUST be treated as a NON-NEGOTIABLE anchor for the trip. Dedicate appropriate days to it.
If the purpose is a specific event, plan at least ONE full day around that event. The rest of the trip should complement this primary purpose.
`;
        console.log(`[generate-day] Additional notes / trip purpose injected (${additionalNotes.trim().length} chars)`);

        // Defense-in-depth: parse additionalNotes for events that should be in the must-do pipeline
        if (!mustDoPrompt.trim()) {
          const detectedFromNotes = parseMustDoInput(additionalNotes, destination, false, preferences?.startDate || date?.split('T')[0], totalDays);
          const eventItems = detectedFromNotes.filter(p => p.activityType === 'all_day_event' || p.activityType === 'half_day_event');
          if (eventItems.length > 0) {
            const scheduled = scheduleMustDos(eventItems, totalDays);
            const dayItems = scheduled.scheduled.filter(s => s.assignedDay === dayNumber);
            if (dayItems.length > 0) {
              mustDoPrompt = `\n## 🚨 EVENT DETECTED FROM TRIP PURPOSE (MANDATORY)\n\nThe traveler's trip purpose includes a specific event. You MUST plan this day around it:\n${dayItems.map(item => `- ${item.priority.title} (${item.priority.priority})${item.priority.activityType === 'all_day_event' ? ' [ALL-DAY EVENT — plan the ENTIRE day around this]' : ' [HALF-DAY EVENT]'}`).join('\n')}\n\nRULES:\n- This event is the PRIMARY purpose of the trip\n- Plan the entire day around this event\n- Supporting activities (meals, transport) should complement the event\n`;
              console.log(`[generate-day] Event detected from additionalNotes: ${eventItems.map(e => e.title).join(', ')} — assigned to day ${dayNumber}`);
            }
          }
        }
      }

      // CRITICAL: Fetch flight/hotel context for Day 1 and last day timing
      let flightContext = tripId ? await getFlightHotelContext(supabase, tripId) : { context: '' };

      // For multi-city trips, override the hotel data with per-city hotel from generate-trip-day chain
      if (paramHotelOverride && paramHotelOverride.name) {
        flightContext = {
          ...flightContext,
          hotelName: paramHotelOverride.name,
          hotelAddress: paramHotelOverride.address || flightContext.hotelAddress,
        };
        console.log(`[generate-day] Hotel override applied: "${paramHotelOverride.name}" (from per-city data)`);
      }
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
          
          // Hotel and airport context for prompts
          const hotelNameDisplay = flightContext.hotelName || 'Selected Hotel';
          const hotelAddressDisplay = flightContext.hotelAddress || 'Hotel Address';
          // Enhanced airport name extraction with metadata fallback
          let arrivalAirportDisplay = flightContext.arrivalAirport || '';
          if (!arrivalAirportDisplay && metadata?.flightDetails) {
            const flightStr = typeof metadata.flightDetails === 'string' ? metadata.flightDetails : '';
            const airportMatch = flightStr.match(/\b(JFK|LaGuardia|LGA|EWR|Newark|LAX|SFO|ORD|ATL|DFW|MIA|BOS|SEA|DEN|PHX)\b/i);
            if (airportMatch) {
              const airportNames: Record<string, string> = {
                'JFK': 'JFK Airport', 'LAGUARDIA': 'LaGuardia Airport (LGA)', 'LGA': 'LaGuardia Airport (LGA)',
                'EWR': 'Newark Liberty Airport (EWR)', 'NEWARK': 'Newark Liberty Airport (EWR)',
                'LAX': 'Los Angeles Airport (LAX)', 'SFO': 'San Francisco Airport (SFO)',
                'ORD': "O'Hare Airport (ORD)", 'ATL': 'Hartsfield-Jackson Airport (ATL)',
                'DFW': 'Dallas/Fort Worth Airport (DFW)', 'MIA': 'Miami Airport (MIA)',
                'BOS': 'Boston Logan Airport (BOS)', 'SEA': 'Seattle-Tacoma Airport (SEA)',
                'DEN': 'Denver Airport (DEN)', 'PHX': 'Phoenix Sky Harbor Airport (PHX)',
              };
              arrivalAirportDisplay = airportNames[airportMatch[1].toUpperCase()] || `${airportMatch[1]} Airport`;
            }
          }
          arrivalAirportDisplay = arrivalAirportDisplay || 'Airport';
          
          console.log(`[Day1-Decision] Arrival at ${arrival24}: morning=${isMorningArrival}, afternoon=${isAfternoonArrival}, evening=${isEveningArrival}`);
          console.log(`[Day1-Decision] Timeline: customs=${customsClearance}, transfer=${transferStart}-${transferEnd}, checkin=${hotelCheckIn}, earliest activity=${earliestSightseeing}`);
          
          // Check if Day 1 has a user-requested all-day event
          const day1HasAllDayEvent = mustDoEventItems?.some(
            (item: any) => item.priority?.activityType === 'all_day_event'
          );
          
          if (day1HasAllDayEvent) {
            // ===== MODIFIED DAY 1: User has an all-day event — skip hotel-first flow =====
            const allDayEvent = mustDoEventItems.find(
              (item: any) => item.priority?.activityType === 'all_day_event'
            );
            const eventName = allDayEvent?.priority?.title || 'Event';
            
            console.log(`[Day1-Decision] ALL-DAY EVENT detected: "${eventName}" — using direct-to-event template`);
            
            dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
The traveler has an ALL-DAY EVENT today: "${eventName}".

⚠️ MODIFIED DAY 1 — USER HAS AN ALL-DAY EVENT:
The traveler has explicitly requested "${eventName}" as an all-day event on Day 1.
Do NOT follow the standard arrival-transfer-checkin sequence. Instead:

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry):
1. "Arrival at ${arrivalAirportDisplay}"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"

2. "Transfer to ${eventName}"
   - startTime: "${addMinutesToHHMM(arrival24, 30)}", endTime: "${addMinutesToHHMM(arrival24, 90)}"
   - category: "transit"
   - description: "Head directly to the event from the airport."
   - tips: "Bag storage: Most major venues and transit hubs have luggage storage services (like LuggageHero or Bounce). Store your bags before the event and pick them up on the way to the hotel."

3. "${eventName}" (ALL-DAY EVENT)
   - This is the main activity. Schedule it for the appropriate duration after transfer.
   - category: appropriate category for the event

4. "Transfer to ${flightContext.hotelName || 'Hotel'}"
   - startTime: after the event ends (estimate based on event duration + 30 min)
   - category: "transit"
   - description: "Head to the hotel after the event"

5. "Hotel Check-in"
   - startTime: 30 minutes after transfer starts
   - category: "accommodation"
   - description: "Late check-in after a full day at ${eventName}. Drop bags, freshen up."
   - location: { name: "${flightContext.hotelName || 'Hotel'}", address: "${flightContext.hotelAddress || ''}" }
   - tags: ["check-in", "late-checkin", "structural"]
   - ⚠️ THIS IS REQUIRED. Do NOT skip this activity. The traveler MUST check in to their hotel.

6. Dinner (if time permits — only add if check-in ends before 21:30)

⚠️ IMPORTANT CONSTRAINTS:
- The traveler CHOSE to go directly to the event. Respect this choice.
- Do NOT add a hotel check-in BEFORE the event.
- Do NOT generate a separate "Airport Transfer to Hotel" activity before the event.
- Activities 4 and 5 (transfer + hotel check-in) are MANDATORY after the event. The traveler needs to get to their hotel.

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
          } else if (isMorningArrival) {
            // ===== MORNING ARRIVAL (before noon) =====
            // Consider: customs, jet lag, traveler profile (breakfast preference, rest needs)
            dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is a MORNING ARRIVAL - the traveler has likely been traveling overnight.

TRAVELER CONTEXT:
- The traveler has been on a long flight and may have jet lag
- They need to clear customs/immigration (estimate: 1 hour)
- Consider their energy level when planning activities

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at ${arrivalAirportDisplay}" 
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"
   - ⚠️ This MUST be its own activity block — do NOT merge with check-in

2. "Hotel Check-in & Refresh"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - description: "Check in, freshen up, and get oriented to the area"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

Do NOT generate an "Airport Transfer to Hotel" activity — the transfer is handled by a separate UI widget.

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

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at ${arrivalAirportDisplay}"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"
   - ⚠️ This MUST be its own activity block — do NOT merge with check-in

2. "Hotel Check-in & Refresh"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - description: "Check in and freshen up"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

Do NOT generate an "Airport Transfer to Hotel" activity — the transfer is handled by a separate UI widget.

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

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at ${arrivalAirportDisplay}"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - ⚠️ This MUST be its own activity block — do NOT merge with check-in

2. "Hotel Check-in"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

Do NOT generate an "Airport Transfer to Hotel" activity — the transfer is handled by a separate UI widget.

EVENING ARRIVAL GUIDELINES:
- Day 1 should ONLY include:
  * The 2 arrival activities above
  * OPTIONALLY: One dinner near the hotel (if time permits and traveler isn't exhausted)
- The traveler needs rest after a long journey
- NO intensive sightseeing on an evening arrival
- Maximum 3 activities total including the required sequence

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
        // ===== LAST DAY: DEPARTURE LOGIC WITH LUGGAGE REALITY =====
        const hasReturnFlight = !!(flightContext.returnDepartureTime || flightContext.returnDepartureTime24);
        const hasHotelData = !!(flightContext.hotelName || flightContext.hotelAddress);
        
        // Get destination-specific airport transfer time
        const airportTransferMins = destination ? await getAirportTransferMinutes(supabase, destination) : 45;
        
        console.log(`[LastDay-Decision] Return flight: ${hasReturnFlight ? 'YES' : 'NO'}, Hotel: ${hasHotelData ? 'YES' : 'NO'}, Transfer: ${airportTransferMins} min`);
        
        if (hasReturnFlight) {
          // ===== RETURN FLIGHT PROVIDED =====
          const departure24 = flightContext.returnDepartureTime24 || normalizeTo24h(flightContext.returnDepartureTime!) || '12:00';
          const departureMins = parseTimeToMinutes(departure24) ?? (12 * 60);
          
          // International check-in buffer: 3 hours, domestic: 2 hours
          const checkInBuffer = 180; // Assume international for safety
          const transferBuffer = airportTransferMins + 30; // Transfer + cushion
          const totalBufferMins = checkInBuffer + transferBuffer;
          
          // Calculate departure timeline
          const leaveHotelBy = addMinutesToHHMM(departure24, -totalBufferMins);
          const hotelCheckout = addMinutesToHHMM(leaveHotelBy, -30); // 30 min to checkout & collect luggage
          const airportArrival = addMinutesToHHMM(departure24, -checkInBuffer);
          
          // LUGGAGE REALITY: After checkout, traveler has bags
          // Activities must be near hotel OR use luggage storage
          const latestSightseeing = addMinutesToHHMM(hotelCheckout, -60); // 1 hour to return to hotel
          
          const hotelNameDisplay = flightContext.hotelName || 'Hotel';
          
          // Categorize flight time for realistic planning
          const isEarlyFlight = departureMins < (12 * 60); // Before noon
          const isMidDayFlight = departureMins >= (12 * 60) && departureMins < (15 * 60); // Noon - 3 PM
          const isAfternoonFlight = departureMins >= (15 * 60) && departureMins < (18 * 60); // 3 PM - 6 PM
          // Evening: 6 PM+
          
          console.log(`[LastDay-Decision] Flight at ${departure24}: early=${isEarlyFlight}, midday=${isMidDayFlight}, afternoon=${isAfternoonFlight}`);
          console.log(`[LastDay-Decision] Timeline: checkout=${hotelCheckout}, leave=${leaveHotelBy}, airport=${airportArrival}, latest activity=${latestSightseeing}`);
          
          if (isEarlyFlight) {
            // ===== EARLY FLIGHT (Before 12pm): No real activities possible =====
            dayConstraints = `
=== DEPARTURE DAY: EARLY FLIGHT (${departure24}) ===

Reality: An early flight means NO sightseeing activities possible.

Flight: ${departure24}
Airport transfer: ~${airportTransferMins} minutes
Leave hotel by: ${leaveHotelBy}

HARD CONSTRAINTS:
- Wake up, pack, and prepare for departure
- Breakfast at hotel ONLY if time permits
- Checkout: ${hotelCheckout}
- Leave for airport: ${leaveHotelBy}

DEPARTURE DAY ACTIVITIES: NONE or just breakfast

REQUIRED SEQUENCE:
1. "Wake up & Final Pack" (if including)
   - category: "personal"
   
2. "Hotel Checkout"
   - startTime: "${hotelCheckout}", endTime: "${addMinutesToHHMM(hotelCheckout, 15)}"
   - category: "accommodation"
   - location: { name: "${hotelNameDisplay}" }

3. "Transfer to Airport"
   - startTime: "${leaveHotelBy}", endTime: "${airportArrival}"
   - category: "transport"

4. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"
   - description: "Check-in, security, and boarding"

⚠️ DO NOT schedule sightseeing. This is logistics only.
THE TRAVELER IS LEAVING. Keep it stress-free.`;

          } else if (isMidDayFlight) {
            // ===== MIDDAY FLIGHT (12pm - 3pm): 1 light activity max =====
            // Calculate a realistic breakfast time that still allows checkout before transfer
            const breakfastStart = '08:30';
            const breakfastEnd = '09:30';
            // Checkout must happen BEFORE leaveHotelBy - use calculated time
            const checkoutStart = addMinutesToHHMM(leaveHotelBy, -45); // 45 min before leaving
            const checkoutEnd = addMinutesToHHMM(leaveHotelBy, -30); // Complete 30 min before leaving
            
            dayConstraints = `
=== DEPARTURE DAY: MIDDAY FLIGHT (${departure24}) ===

Flight: ${departure24}
Airport transfer: ~${airportTransferMins} minutes
Leave hotel by: ${leaveHotelBy}
Checkout by: ${checkoutEnd}

HARD CONSTRAINTS:
- Last activity must END by: ${latestSightseeing}
- After checkout, traveler HAS LUGGAGE
- All activities must be NEAR HOTEL (walking distance)

LUGGAGE REALITY:
- Store luggage at hotel after breakfast
- Do ONE nearby activity (10-15 min walk max from hotel)
- Return to collect luggage
- Leave for airport

DEPARTURE DAY ACTIVITIES: 1 maximum (near hotel only)

⚠️ CRITICAL SEQUENCE - CHECKOUT MUST HAPPEN BEFORE AIRPORT TRANSFER:
1. "Breakfast at hotel or nearby café"
   - startTime: "${breakfastStart}", endTime: "${breakfastEnd}"
   - category: "dining"
   - NEAR HOTEL

2. "Hotel Checkout & Luggage Storage"
   - startTime: "${checkoutStart}", endTime: "${checkoutEnd}"
   - category: "accommodation"
   - description: "Check out, store luggage with hotel"

3. ONE OPTIONAL light activity (if time permits):
   - Must be walking distance from hotel
   - Must END by ${latestSightseeing}
   - Example: "Final stroll through [neighborhood near hotel]"

4. "Collect Luggage & Transfer to Airport"
   - startTime: "${leaveHotelBy}", endTime: "${airportArrival}"
   - category: "transport"
   - description: "Collect bags from hotel and depart for airport"

5. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"
   - description: "Check-in, security, and boarding"

⚠️ DO NOT schedule activities across the city.
⚠️ DO NOT plan activities after ${latestSightseeing}.
⚠️ CHECKOUT (step 2) MUST have an earlier startTime than TRANSFER (step 4). VIOLATION = REGENERATION.
THE TRAVELER IS LEAVING. Make it a gentle goodbye, not a marathon.`;

          } else if (isAfternoonFlight) {
            // ===== AFTERNOON FLIGHT (3pm - 6pm): 1-2 activities near hotel =====
            // Calculate checkout time - must be before any transfer
            const checkoutStart = addMinutesToHHMM(leaveHotelBy, -60); // 1 hour before leaving
            const checkoutEnd = addMinutesToHHMM(leaveHotelBy, -45); // Complete 45 min before leaving
            const collectLuggageTime = addMinutesToHHMM(leaveHotelBy, -15); // 15 min to collect and go
            
            dayConstraints = `
=== DEPARTURE DAY: AFTERNOON FLIGHT (${departure24}) ===

Flight: ${departure24}
Airport transfer: ~${airportTransferMins} minutes
Leave hotel by: ${leaveHotelBy}
Checkout by: ${checkoutEnd}

HARD CONSTRAINTS:
- Last activity must END by: ${latestSightseeing}
- After checkout, traveler HAS LUGGAGE
- Stay in ONE AREA near hotel

LUGGAGE REALITY:
- Check out, store luggage with hotel
- Activities in hotel neighborhood ONLY
- No cross-city travel with bags

DEPARTURE DAY ACTIVITIES: 1-2 maximum (morning only, near hotel)

⚠️ CRITICAL SEQUENCE - CHECKOUT MUST HAPPEN BEFORE AIRPORT TRANSFER:
1. "Breakfast"
   - startTime: "08:30", endTime: "09:30"
   - Near hotel

2. ONE morning activity
   - Must be NEAR hotel (walking distance)
   - End by ${latestSightseeing}
   
3. "Light Lunch" (optional)
   - Near hotel or on way back

4. "Hotel Checkout & Collect Luggage"
   - startTime: "${checkoutStart}", endTime: "${checkoutEnd}"
   - category: "accommodation"
   - description: "Check out and collect stored luggage"

5. "Transfer to Airport"
   - startTime: "${leaveHotelBy}", endTime: "${airportArrival}"
   - category: "transport"

6. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"

⚠️ NO activities scheduled after ${latestSightseeing}.
⚠️ Stay near hotel. Do not go across the city.
⚠️ CHECKOUT (step 4) MUST have an earlier startTime than TRANSFER (step 5). VIOLATION = REGENERATION.
THE TRAVELER IS LEAVING. Make it relaxed.`;

          } else {
            // ===== EVENING FLIGHT (6pm+): 2-3 activities possible but condensed =====
            // For evening flights, checkout can be standard noon time
            const checkoutTime = '12:00';
            const checkoutEnd = '12:30';
            const collectLuggageStart = addMinutesToHHMM(leaveHotelBy, -30);
            
            dayConstraints = `
=== DEPARTURE DAY: EVENING FLIGHT (${departure24}) ===

Flight: ${departure24}
Airport transfer: ~${airportTransferMins} minutes
Leave hotel by: ${leaveHotelBy}
Checkout: ${checkoutTime} (noon, standard checkout)

HARD CONSTRAINTS:
- Last activity must END by: ${latestSightseeing}
- After checkout, traveler HAS LUGGAGE
- Recommend luggage storage with hotel

EVENING DEPARTURE = MORE FLEXIBILITY, but still constrained

LUGGAGE REALITY:
- Check out at noon, store luggage with hotel
- All afternoon activities in ONE area (hotel neighborhood preferred)
- Return to hotel with time to spare
- Collect luggage and leave

DEPARTURE DAY ACTIVITIES: 2-3 maximum, but CONDENSED

⚠️ CRITICAL SEQUENCE - ALL ACTIVITIES MUST BE CHRONOLOGICALLY ORDERED:
1. "Breakfast"
   - startTime: "08:30", endTime: "09:30"
   - category: "dining"

2. Morning activity (can be 10-15 min from hotel)
   
3. "Hotel Checkout & Luggage Storage"
   - startTime: "${checkoutTime}", endTime: "${checkoutEnd}"
   - category: "accommodation"
   - description: "Check out and store luggage with hotel for afternoon activities"

4. "Lunch"
   - Near hotel
   - category: "dining"

5. ONE afternoon activity (optional)
   - Must stay in same area/neighborhood
   - Low-stakes (can be cut short if needed)

6. "Collect Luggage & Transfer to Airport"
   - startTime: "${collectLuggageStart}", endTime: "${airportArrival}"
   - category: "transport"
   - description: "Return to hotel, collect stored luggage, and head to airport"

7. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"
   - description: "Check-in, security, and boarding"

⚠️ All activities after checkout must be in ONE area.
⚠️ Final activity should be LOW-STAKES (can be skipped if running late).
⚠️ No reservations that can't be cancelled.
⚠️ CHECKOUT must happen BEFORE luggage collection/transfer. VIOLATION = REGENERATION.
THE TRAVELER IS LEAVING. A gentle goodbye, not a marathon.`;
          }
          
        } else if (hasHotelData) {
          // ===== NO RETURN FLIGHT BUT HOTEL PROVIDED =====
          // SAFE ASSUMPTION: Midday departure (not evening!)
          // Better to under-schedule than have traveler miss flight
          
          const assumedDeparture = '14:00'; // Assume 2 PM flight
          const safeTransfer = 45; // Default transfer time
          const checkInBuffer = 180; // 3 hours
          const leaveBy = addMinutesToHHMM(assumedDeparture, -(checkInBuffer + safeTransfer + 30));
          const checkout = '11:00';
          const latestActivity = addMinutesToHHMM(checkout, -60);
          
          dayConstraints = `
=== DEPARTURE DAY: NO FLIGHT DETAILS PROVIDED ===

⚠️ SAFE ASSUMPTION: Midday departure (~2:00 PM flight)

We don't have your flight details, so we're keeping this day VERY light
to ensure you don't miss your flight.

CONSERVATIVE TIMELINE:
- Last activity ends: ${latestActivity}
- Hotel checkout: ${checkout}
- Leave for airport: ${leaveBy} (assuming 2 PM flight)

DEPARTURE DAY ACTIVITIES: 1 maximum

REALISTIC STRUCTURE:
1. "Breakfast at hotel or nearby"
   - 08:30 - 09:30

2. "Final stroll around hotel neighborhood" (OPTIONAL)
   - Must end by ${latestActivity}
   - Walking distance from hotel only

3. "Hotel Checkout"
   - startTime: "${checkout}", endTime: "11:15"
   - category: "accommodation"
   - location: { name: "${flightContext.hotelName || 'Hotel'}" }

4. "Transfer to Airport"
   - startTime: "${leaveBy}"
   - category: "transport"

⚠️ DO NOT schedule activities after 10:00 AM.
⚠️ Plan ONLY near-hotel activities.
⚠️ Assume the traveler needs to leave by ${leaveBy}.

NOTE: Add your flight details to unlock more of the day if departing later.`;
          
        } else {
          // ===== NO FLIGHT AND NO HOTEL =====
          // Most conservative: assume midday departure
          dayConstraints = `
=== DEPARTURE DAY: NO FLIGHT OR HOTEL INFORMATION ===

⚠️ SAFE ASSUMPTION: Midday departure

Without flight or hotel details, we're planning conservatively
to ensure you don't miss your departure.

CONSERVATIVE TIMELINE:
- Assume checkout around 11:00 AM
- Assume you need to leave for airport by 11:30 AM
- Last activity should end by 10:00 AM

DEPARTURE DAY ACTIVITIES: 1 maximum (breakfast)

STRUCTURE:
1. "Breakfast" 
   - 08:30 - 09:30

2. (Optional) "Final morning stroll"
   - 09:30 - 10:00
   - Very nearby, flexible

3. "Checkout & Departure Preparation"
   - 10:30 - 11:00

⚠️ DO NOT schedule activities after 10:30 AM.
⚠️ Keep the morning light and stress-free.

Add your flight and hotel details for a more complete last day.`;
        }
      }

      // ===== MULTI-CITY: Per-City Boundary Constraints =====
      if (paramIsMultiCity) {
        const mcHotelName = paramHotelOverride?.name || flightContext.hotelName || 'Hotel';

        if (paramIsFirstDayInCity && !isFirstDay && !paramIsTransitionDay) {
          dayConstraints += `\n\n🏨 CITY ARRIVAL — CHECK-IN DAY:
- This is the first day in ${destination}. The traveler needs to check into "${mcHotelName}".
- REQUIRED: Include a "Hotel Check-in & Refresh" activity (typically 30-60 min).
- Plan afternoon/evening activities after check-in, clustered near the hotel area.
- Use "${mcHotelName}" for ALL hotel references. Do NOT invent a different hotel.`;
        }

        if (paramIsLastDayInCity && !isLastDay) {
          const nextTransport = resolvedNextLegTransport || 'flight';
          const nextCity = resolvedNextLegCity || 'the next destination';
          const transportLabel = nextTransport.toUpperCase();
          const isNonFlight = nextTransport !== 'flight';
          
          // Build transport-specific departure instructions
          let departureFacility = 'airport';
          let departureInstructions = '';
          if (nextTransport === 'train') {
            departureFacility = 'train station';
            departureInstructions = `
- REQUIRED: Include a "Transfer to Train Station" activity (category: "transport") showing the taxi/rideshare/metro from the hotel to the train station. Include the station name and address in the location field.
- REQUIRED: Include a "${transportLabel} to ${nextCity}" departure activity (category: "transport") as the LAST activity. Include the train station name, address, and platform/track info if known.
- ⚠️ ABSOLUTELY DO NOT mention airports, flights, or "Transfer to Airport". The departure is from a TRAIN STATION.`;
          } else if (nextTransport === 'bus') {
            departureFacility = 'bus station';
            departureInstructions = `
- REQUIRED: Include a "Transfer to Bus Station" activity (category: "transport") showing the taxi/rideshare/metro from the hotel to the bus terminal. Include the station name and address in the location field.
- REQUIRED: Include a "${transportLabel} to ${nextCity}" departure activity (category: "transport") as the LAST activity. Include the bus terminal name and address.
- ⚠️ ABSOLUTELY DO NOT mention airports, flights, or "Transfer to Airport". The departure is from a BUS STATION.`;
          } else if (nextTransport === 'ferry') {
            departureFacility = 'ferry terminal';
            departureInstructions = `
- REQUIRED: Include a "Transfer to Ferry Terminal" activity (category: "transport") showing the taxi/rideshare from the hotel to the ferry port. Include the terminal name and address in the location field.
- REQUIRED: Include a "${transportLabel} to ${nextCity}" departure activity (category: "transport") as the LAST activity. Include the ferry terminal name and address.
- ⚠️ ABSOLUTELY DO NOT mention airports, flights, or "Transfer to Airport". The departure is from a FERRY TERMINAL.`;
          } else if (nextTransport === 'car') {
            departureInstructions = `
- REQUIRED: Include a "Drive to ${nextCity}" departure activity (category: "transport") as the LAST activity.
- ⚠️ ABSOLUTELY DO NOT mention airports, flights, or "Transfer to Airport". The traveler is DRIVING to the next destination.`;
          }
          
          dayConstraints += `\n\n🏨 CITY DEPARTURE — CHECKOUT DAY:
- This is the LAST DAY in ${destination}. The traveler departs for ${nextCity} by ${transportLabel}.
- REQUIRED: Include "Hotel Checkout" activity in the morning (typically by 11:00 AM).
- Plan morning activities around checkout. Luggage storage may be needed.
- Use "${mcHotelName}" for the checkout activity. Do NOT invent a different hotel.${isNonFlight ? departureInstructions : ''}`;
        }

        if (mcHotelName && mcHotelName !== 'Hotel') {
          dayConstraints += `\n\n🏨 ACCOMMODATION: "${mcHotelName}" — use this name for ALL hotel references. Do NOT substitute a different hotel name.`;
        }
      }


      let transportPreferencePrompt = '';
      const transportModesFromRequest = preferences?.transportationModes as string[] | undefined;
      const primaryTransportFromRequest = preferences?.primaryTransport as string | undefined;
      const hasRentalCarFromRequest = preferences?.hasRentalCar as boolean | undefined;
      
      let resolvedTransportModes: string[] = transportModesFromRequest || [];
      let resolvedPrimaryTransport: string | undefined = primaryTransportFromRequest;
      let resolvedHasRentalCar: boolean = hasRentalCarFromRequest || false;
      
      // If not provided in request, fetch from DB
      if (resolvedTransportModes.length === 0 && tripId) {
        try {
          const { data: tripTransport } = await supabase
            .from('trips')
            .select('transportation_preferences')
            .eq('id', tripId)
            .single();
          
          if (tripTransport?.transportation_preferences) {
            const tp = tripTransport.transportation_preferences as any;
            if (Array.isArray(tp)) {
              // Multi-city format: array of { type, fromCity, toCity, ... }
              resolvedTransportModes = tp.map((t: any) => t.type || t.mode).filter(Boolean);
            } else if (tp.modes) {
              // Single-city format: { modes: string[], primaryMode?: string }
              resolvedTransportModes = tp.modes;
              resolvedPrimaryTransport = tp.primaryMode;
              resolvedHasRentalCar = tp.modes?.includes('rental_car') || false;
            }
          }
        } catch (e) {
          console.warn('[generate-day] Could not fetch transport preferences:', e);
        }
      }
      
      if (resolvedTransportModes.length > 0) {
        const modeLabels: Record<string, string> = {
          'walking': 'Walking',
          'public_transit': 'Public transit (metro, bus, tram)',
          'rideshare': 'Rideshare/Taxi (Uber, Lyft, local taxi)',
          'rental_car': 'Rental car (driving)',
          'train': 'Train',
          'bus': 'Bus',
          'car': 'Car',
          'ferry': 'Ferry',
          'flight': 'Flight',
        };
        const modeList = resolvedTransportModes.map(m => modeLabels[m] || m).join(', ');
        const primary = resolvedPrimaryTransport ? (modeLabels[resolvedPrimaryTransport] || resolvedPrimaryTransport) : null;
        
        transportPreferencePrompt = `
${'='.repeat(70)}
🚗 USER TRANSPORT PREFERENCES — MUST RESPECT
${'='.repeat(70)}
The traveler has explicitly selected these transport modes: ${modeList}
${primary ? `Primary mode: ${primary}` : ''}
${resolvedHasRentalCar ? 'The traveler HAS a rental car — suggest driving with parking info, NOT public transit for longer distances.' : ''}

RULES:
- ONLY suggest transport modes the user selected
- ${resolvedTransportModes.includes('walking') ? 'Walking: suggest for distances under 15-20 min walk' : 'DO NOT suggest walking as primary transit (brief walks within a venue area are OK)'}
- ${resolvedTransportModes.includes('public_transit') ? 'Public transit: include specific line/route numbers, station names, and fares' : 'DO NOT suggest metro/bus/tram unless the user selected public transit'}
- ${resolvedTransportModes.includes('rideshare') ? 'Rideshare/Taxi: include estimated fare and ride duration' : 'DO NOT suggest Uber/Lyft/taxi unless the user selected rideshare'}
- ${resolvedHasRentalCar ? 'Rental car: suggest driving routes, include parking info and costs at each venue' : 'DO NOT suggest driving/rental car unless the user selected it'}
- NEVER suggest a transport mode the user did NOT select
`;
        console.log(`[generate-day] Transport preferences injected: ${resolvedTransportModes.join(', ')}${primary ? ` (primary: ${primary})` : ''}`);
      }

      // Build system prompt with day-specific timing constraints EMBEDDED
      let timingInstructions = '';
      let dayMealPolicy: MealPolicy | null = null; // Will be set for non-first/last days
      if (isFirstDay && dayConstraints) {
        // Derive meal policy for arrival day
        dayMealPolicy = deriveMealPolicy({
          dayNumber, totalDays, isFirstDay: true, isLastDay: dayNumber === totalDays,
          arrivalTime24: flightContext.arrivalTime24 || undefined,
          earliestAvailable: flightContext.earliestFirstActivityTime || undefined,
        });
        console.log(`[generate-day] Day ${dayNumber} (arrival) meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}]`);
        
        // For arrival day, put constraints directly in system prompt for maximum weight
        timingInstructions = `
CRITICAL ARRIVAL DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

${buildMealRequirementsPrompt(dayMealPolicy)}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
      } else if (isLastDay && dayConstraints) {
        // Derive meal policy for departure day
        dayMealPolicy = deriveMealPolicy({
          dayNumber, totalDays, isFirstDay: false, isLastDay: true,
          departureTime24: flightContext.returnDepartureTime24 || flightContext.returnDepartureTime || undefined,
          latestAvailable: flightContext.latestLastActivityTime || undefined,
        });
        console.log(`[generate-day] Day ${dayNumber} (departure) meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}]`);
        
        timingInstructions = `
CRITICAL DEPARTURE DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

${buildMealRequirementsPrompt(dayMealPolicy)}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
      } else {
        // ===== REGULAR DAY (may be full exploration or constrained) =====
        const hotelNameForDay = flightContext.hotelName || '';
        const hotelNeighborhood = flightContext.hotelAddress || '';
        
        // ── Derive meal policy for this day ──
        const dayMealInput: MealPolicyInput = {
          dayNumber,
          totalDays,
          isFirstDay: false,
          isLastDay: false,
          isTransitionDay: resolvedIsTransitionDay,
          hasFullDayEvent: !!((metadata?.userConstraints as any[]) || []).find(
            (c: any) => c.type === 'full_day_event' && (c.day === dayNumber || !c.day)
          ),
          earliestAvailable: undefined, // will use defaults
          latestAvailable: undefined,
          lockedHours: (() => {
            // Sum locked hours from time_block constraints on this day
            const constraints = (metadata?.userConstraints as any[]) || [];
            let locked = 0;
            for (const c of constraints as any[]) {
              if (c.type === 'time_block' && c.day === dayNumber && c.time) {
                // Estimate 2 hours per time block if no duration specified
                locked += 2;
              }
              if (c.type === 'full_day_event' && (c.day === dayNumber || !c.day)) {
                locked += 12;
              }
            }
            return locked;
          })(),
        };
        const dayMealPolicy = deriveMealPolicy(dayMealInput);
        const mealRequirementsBlock = buildMealRequirementsPrompt(dayMealPolicy);
        
        console.log(`[generate-day] Day ${dayNumber} meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}], usableHours=${dayMealPolicy.usableHours}`);
        
        timingInstructions = `
${dayMealPolicy.isFullExplorationDay ? 'FULL EXPLORATION DAY' : dayMealPolicy.dayMode.replace(/_/g, ' ').toUpperCase()} — HOUR-BY-HOUR TRAVEL PLAN (NOT a suggestion list):

This day must be a COMPLETE itinerary from morning to night. Every hour accounted for.

REQUIRED DAY STRUCTURE:
${dayMealPolicy.requiredMeals.includes('breakfast') ? '1. BREAKFAST (category: "dining") — Near hotel, real restaurant name, ~price, walking distance' : ''}
2. TRANSIT between every pair of consecutive activities (category: "transport")
   - Include mode (${resolvedTransportModes.length > 0 ? resolvedTransportModes.join('/') : 'walk/taxi/metro/bus'}), duration, cost, route details
   - 10+ minute walks or any paid transit = separate activity entry
3. MORNING ACTIVITIES — At least 1 paid + 1 free activity
${dayMealPolicy.requiredMeals.includes('lunch') ? '4. LUNCH (category: "dining") — Restaurant near previous location, ~price, 1 alternative in tips' : ''}
5. AFTERNOON ACTIVITIES — At least 1-2 paid + 1 free activity  
6. HOTEL RETURN (if dinner venue is far) — "Freshen up" with category "accommodation"
${dayMealPolicy.requiredMeals.includes('dinner') ? '7. DINNER (category: "dining") — Restaurant, price range, dress code, reservation needed?, 1 alternative in tips' : ''}
8. EVENING/NIGHTLIFE — Bar, jazz club, night market, show, rooftop, dessert spot (at least 1 suggestion)
9. RETURN TO HOTEL — With transport mode and time
10. NEXT MORNING PREVIEW — In the tips of the LAST activity: "Tomorrow: Wake [time]. Breakfast at [place] ([distance], ~[price])."

${mealRequirementsBlock}

TRANSIT RULES:
- Between EVERY pair of consecutive stops, include transit info
${resolvedTransportModes.length > 0 ? `- USER'S PREFERRED MODES: ${resolvedTransportModes.join(', ')} — use ONLY these modes` : '- For walks >10 min: create a separate transport activity entry'}
- For walks <5 min: note in the tips of the preceding activity
- Always include: mode, duration, cost (free for walking), and route/line for public transit

ACTIVITY MIX:
- Minimum 3 PAID activities (museums, tours, attractions with ticket prices)
- Minimum 2 FREE activities (parks, viewpoints, walks, markets, street art)
- Place free activities between paid ones to prevent fatigue
- Include at least 1 coffee/snack opportunity between long gaps

EVENING REQUIREMENT:
- The day does NOT end at dinner. Include at least 1 post-dinner suggestion:
  Jazz, rooftop bar, night market, show, river cruise, neighborhood walk, live music, dessert
- Mark as optional in description if appropriate

PRICES ON EVERYTHING:
- Every meal: approximate price per person
- Every attraction: entry/ticket fee
- Every transit: fare (walking = free)
- estimatedCost.amount = 0 for genuinely free activities
- Approximate is acceptable. MISSING is not.

PRACTICAL TIPS (in "tips" field of each activity):
- Booking requirements, queue advice, dress codes, closure days
- "Book online to skip the line" / "Closed Mondays" / "Best photos at sunset"
${hotelNameForDay ? `\nHOTEL: ${hotelNameForDay}${hotelNeighborhood ? ` (${hotelNeighborhood})` : ''}` : ''}
Start and end the day near the hotel when practical.`;
      }

      // =======================================================================
      // TRANSITION DAY OVERRIDE: Replace timing instructions for transition days
      // This is the critical fix that prevents "teleporting" between cities
      // =======================================================================
      let transitionDayPromptBlock = '';
      if (resolvedIsTransitionDay && resolvedTransitionFrom && resolvedTransitionTo) {
        console.log(`[generate-day] 🚆 TRANSITION DAY DETECTED: ${resolvedTransitionFrom} → ${resolvedTransitionTo} via ${resolvedTransportMode}`);
        
        // Use the existing robust transition prompt builder
        transitionDayPromptBlock = buildTransitionDayPrompt({
          transitionFrom: resolvedTransitionFrom,
          transitionFromCountry: resolvedCountry,
          transitionTo: resolvedTransitionTo,
          transitionToCountry: resolvedCountry,
          transportType: resolvedTransportMode || 'train',
          travelers: travelers || 1,
          budgetTier: budgetTier || 'moderate',
          currency: 'USD',
          transportDetails: resolvedTransportDetails || undefined,
        });
        
        // Override timing instructions completely for transition days
        timingInstructions = `
CRITICAL TRANSITION DAY INSTRUCTIONS — THIS IS A TRAVEL DAY, NOT AN EXPLORATION DAY:
${transitionDayPromptBlock}

FAILURE TO INCLUDE INTER-CITY TRAVEL IS UNACCEPTABLE. NO TELEPORTING.`;
        
        console.log(`[generate-day] Transition prompt injected: ${transitionDayPromptBlock.length} chars`);
      }

      // PHASE 2 FIX: Use Unified Profile Loader (Single Source of Truth)
      // This replaces 100+ lines of manual archetype/trait resolution with bugs
      // ==========================================================================
      
      const profile = await loadTravelerProfile(supabase, userId, tripId, destination);
      
      // Extract data from unified profile
      const primaryArchetype = profile.archetype;
      const traitScores = profile.traitScores;
      
      // Log profile resolution for debugging
      console.log(`[generate-day] ✓ Profile loaded via unified loader:`);
      console.log(`[generate-day]   archetype=${primaryArchetype} (source: ${profile.archetypeSource})`);
      console.log(`[generate-day]   completeness=${profile.dataCompleteness}%, fallback=${profile.isFallback}`);
      console.log(`[generate-day]   traits: pace=${traitScores.pace}, budget=${traitScores.budget}`);
      console.log(`[generate-day]   avoidList: ${profile.avoidList.length} items`);
      if (profile.warnings.length > 0) {
        console.warn(`[generate-day]   warnings: ${profile.warnings.join(', ')}`);
      }
      
      // Use profile's budget tier if available, fallback to params
      const effectiveBudgetTier = profile.budgetTier || budgetTier || 'moderate';

      // ==========================================================================
      // READ GENERATION CONTEXT: Enrichment computed once in generate-trip
      // Includes: dietary, jet lag, weather, children, duration, group blending,
      // past learnings, recently used, forced slots, schedule constraints
      // ==========================================================================
      let generationContextPrompts = '';
      // GAP 1: Extract blended trait scores from generation_context for group trips
      let blendedTraitScores: Record<string, number> | null = null;
      // GAP 2: Extract blended DNA snapshot for avoid-list intersection
      let blendedDnaSnapshot: { travelers: Array<{ archetype: string }> } | null = null;
      // GAP 4: Track stale context for regeneration detection
      let gcTravelerCount = 0;
      
      if (tripId) {
        try {
          const { data: gcTrip } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
          const gc = ((gcTrip?.metadata as Record<string, unknown>)?.generation_context as Record<string, unknown>) || {};
          
          const promptParts: string[] = [];
          
          if (gc.dietaryEnforcementPrompt) promptParts.push(gc.dietaryEnforcementPrompt as string);
          if (gc.jetLagPrompt && dayNumber <= 2) promptParts.push(gc.jetLagPrompt as string);
          if (gc.weatherBackupPrompt) promptParts.push(gc.weatherBackupPrompt as string);
          if (gc.tripDurationPrompt) promptParts.push(gc.tripDurationPrompt as string);
          if (gc.childrenAgesPrompt) promptParts.push(gc.childrenAgesPrompt as string);
          if (gc.reservationUrgencyPrompt) promptParts.push(gc.reservationUrgencyPrompt as string);
          if (gc.dailyEstimatesPrompt) promptParts.push(gc.dailyEstimatesPrompt as string);
          if (gc.groupBlendingPrompt) promptParts.push(gc.groupBlendingPrompt as string);
          if (gc.forcedSlotsPrompt) promptParts.push(gc.forcedSlotsPrompt as string);
          if (gc.scheduleConstraintsPrompt) promptParts.push(gc.scheduleConstraintsPrompt as string);
          if (gc.pastTripLearnings) promptParts.push(gc.pastTripLearnings as string);
          
          if (gc.recentlyUsedActivities) {
            const recentNames = gc.recentlyUsedActivities as string[];
            if (recentNames.length > 0) {
              promptParts.push(`\n## ⚠️ RECENTLY USED (avoid for variety):\nAvoid these activities/restaurants used in recent ${resolvedDestination} itineraries:\n- ${recentNames.join('\n- ')}\n`);
            }
          }
          
          // GAP 1: Extract blended trait scores for group trips
          if (gc.blendedTraitScores && typeof gc.blendedTraitScores === 'object') {
            blendedTraitScores = gc.blendedTraitScores as Record<string, number>;
            console.log(`[generate-day] ✓ Using BLENDED trait scores: pace=${blendedTraitScores.pace}, budget=${blendedTraitScores.budget}`);
          }
          
          // GAP 2: Extract blended DNA snapshot for avoid-list relaxation
          if (gc.blendedDnaSnapshot && typeof gc.blendedDnaSnapshot === 'object') {
            blendedDnaSnapshot = gc.blendedDnaSnapshot as any;
            gcTravelerCount = (blendedDnaSnapshot?.travelers || []).length;
          }
          
          if (promptParts.length > 0) {
            generationContextPrompts = promptParts.join('\n\n');
            console.log(`[generate-day] Injected ${promptParts.length} enrichment prompts from generation_context`);
          }
        } catch (gcErr) {
          console.warn('[generate-day] Failed to read generation_context (non-blocking):', gcErr);
        }
        
        // GAP 4: Detect stale generation_context — if collaborators changed since initial generation
        if (gcTravelerCount > 0) {
          try {
            const [{ count: collabCount }, { count: memberCount }] = await Promise.all([
              supabase.from('trip_collaborators').select('*', { count: 'exact', head: true }).eq('trip_id', tripId).eq('include_preferences', true),
              supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', tripId),
            ]);
            const currentTravelerCount = 1 + (collabCount || 0) + (memberCount || 0); // +1 for owner
            // Deduplicate isn't perfect but if count differs significantly, context is stale
            if (Math.abs(currentTravelerCount - gcTravelerCount) >= 1) {
              console.warn(`[generate-day] ⚠️ STALE CONTEXT: generation_context has ${gcTravelerCount} travelers but current trip has ~${currentTravelerCount}. Blended traits may be outdated. Consider full regeneration.`);
              // Don't nullify blendedTraitScores — stale blended > no blended. Just warn.
            }
          } catch (staleErr) {
            console.warn('[generate-day] Stale context check failed (non-blocking):', staleErr);
          }
        }
      }
      
      // GAP 1: Determine effective trait scores — use blended for groups, owner for solo
      const effectiveTraitScores = blendedTraitScores 
        ? { pace: blendedTraitScores.pace ?? traitScores.pace, budget: blendedTraitScores.budget ?? traitScores.budget }
        : { pace: traitScores.pace, budget: traitScores.budget };

      console.log(`[generate-day] Budget tier: ${effectiveBudgetTier}`);

      // Fetch actual user-set budget for hard cap enforcement
      let actualDailyBudgetPerPerson: number | null = null;
      if (tripId) {
        try {
          const { data: tripBudgetData } = await supabase
            .from('trips')
            .select('budget_total_cents, flight_selection, hotel_selection')
            .eq('id', tripId)
            .single();
          if (tripBudgetData?.budget_total_cents && tripBudgetData.budget_total_cents > 0) {
            const trav = travelers || 1;
            const days = totalDays || 1;
            const flightCents = tripBudgetData.flight_selection?.legs
              ? (tripBudgetData.flight_selection.legs as any[]).reduce((sum: number, leg: any) => sum + (leg.price || 0), 0) * 100
              : tripBudgetData.flight_selection?.outbound?.price ? Math.round((tripBudgetData.flight_selection.outbound.price + (tripBudgetData.flight_selection.return?.price || 0)) * 100) : 0;
            const hotelCents = tripBudgetData.hotel_selection?.pricePerNight ? Math.round(tripBudgetData.hotel_selection.pricePerNight * days * 100) : 0;
            const activityBudgetCents = Math.max(0, tripBudgetData.budget_total_cents - flightCents - hotelCents);
            actualDailyBudgetPerPerson = Math.round(activityBudgetCents / days / trav) / 100;
            console.log(`[generate-day] Real budget: $${tripBudgetData.budget_total_cents / 100} total → $${actualDailyBudgetPerPerson}/day/person for activities`);

            // ─── PER-CITY BUDGET OVERRIDE ───
            if (resolvedDestination && tripId) {
              try {
                const { data: cityRow } = await supabase
                  .from('trip_cities')
                  .select('allocated_budget_cents, hotel_cost_cents, nights, days_total')
                  .eq('trip_id', tripId)
                  .eq('city_name', resolvedDestination)
                  .maybeSingle();
                if (cityRow?.allocated_budget_cents && cityRow.allocated_budget_cents > 0) {
                  const cityNights = cityRow.nights || cityRow.days_total || 1;
                  const cityHotelCents = cityRow.hotel_cost_cents || 0;
                  const cityActivityCents = Math.max(0, cityRow.allocated_budget_cents - cityHotelCents);
                  actualDailyBudgetPerPerson = Math.round(cityActivityCents / cityNights / trav) / 100;
                  console.log(`[generate-day] Per-city budget override for "${resolvedDestination}": $${(cityRow.allocated_budget_cents/100).toFixed(2)} allocated → $${actualDailyBudgetPerPerson}/day/person`);
                }
              } catch (e) {
                console.warn('[generate-day] Failed to fetch per-city budget:', e);
              }
            }
          }
        } catch (e) {
          console.warn('[generate-day] Failed to fetch budget:', e);
        }
      }
      
      // ==========================================================================
      // PHASE 2 FIX: Use buildFullPromptGuidanceAsync (with dynamic features)
      // Includes attraction matching + AI-generated city guides (graceful fallback)
      // ==========================================================================
      
      // Resolve destination ID for dynamic features (use resolvedDestination for multi-city)
      const destinationId = await getDestinationId(supabase, resolvedDestination);
      
      const generationHierarchy = await buildFullPromptGuidanceAsync(
        supabase,
        primaryArchetype,
        resolvedDestination,
        destinationId,
        effectiveBudgetTier,
        effectiveTraitScores,
        LOVABLE_API_KEY
      );
      
      console.log(`[generate-day] Full guidance built: ${generationHierarchy.length} chars (dynamic=${!!destinationId})`);
      
      // Fetch celebration day from trip metadata if available
      let celebrationDay: number | undefined;
      if (tripId) {
        const { data: tripMeta } = await supabase
          .from('trips')
          .select('metadata')
          .eq('id', tripId)
          .single();
        celebrationDay = tripMeta?.metadata?.celebrationDay;
      }
      
      // Build trip type prompt section (first-class input for celebrations/groups/purpose)
      const tripTypePrompt = buildTripTypePromptSection(
        tripType,
        primaryArchetype,
        totalDays,
        celebrationDay
      );
      if (tripTypePrompt) {
        console.log(`[generate-day] Trip type "${tripType}" prompt built (${tripTypePrompt.length} chars)`);
      }
      
      // GAP 2: For group trips, intersect avoid lists across all travelers' archetypes
      let groupAvoidOverride: string[] | null = null;
      if (blendedDnaSnapshot && blendedDnaSnapshot.travelers.length > 1) {
        try {
          const allAvoidLists = blendedDnaSnapshot.travelers.map(t => {
            const def = getArchetypeDefinition(t.archetype);
            return new Set(def.avoid.map((a: string) => a.toLowerCase()));
          });
          // Intersection: only enforce items ALL travelers' archetypes avoid
          const intersection = [...allAvoidLists[0]].filter(item => 
            allAvoidLists.every(avoidSet => avoidSet.has(item))
          );
          groupAvoidOverride = intersection;
          console.log(`[generate-day] ✓ Group avoid-list intersection: ${intersection.length} items (from ${allAvoidLists.length} archetypes)`);
        } catch (avoidErr) {
          console.warn('[generate-day] Group avoid-list intersection failed (non-blocking):', avoidErr);
        }
      }
      
      const archetypeContext = getFullArchetypeContext(
        primaryArchetype, 
        resolvedDestination, 
        effectiveBudgetTier, 
        effectiveTraitScores
      );
      const maxActivitiesFromArchetype = archetypeContext.definition.dayStructure.maxScheduledActivities;
      const minActivitiesFromArchetype = archetypeContext.definition.dayStructure.minScheduledActivities 
        || Math.max(3, Math.ceil(maxActivitiesFromArchetype * 0.6));

      // ==========================================================================
      // VOYANCE PICKS: Founder-curated must-includes for this destination
      // ==========================================================================
      let voyancePicksPrompt = '';
      try {
        const destCity = resolvedDestination.split(',')[0].trim();
        const { data: vpRows } = await supabase
          .from('voyance_picks')
          .select('*')
          .eq('is_active', true)
          .ilike('destination', `%${destCity}%`);
        
        if (vpRows && vpRows.length > 0) {
          const pickLines = vpRows.map((p: any, i: number) => 
            `${i + 1}. **${p.name}** (${p.category}) in ${p.neighborhood || destination} — ${p.why_essential}${p.insider_tip ? ` TIP: ${p.insider_tip}` : ''}${p.best_time ? ` BEST TIME: ${p.best_time}` : ''}`
          ).join('\n');
          voyancePicksPrompt = `\n${'='.repeat(70)}\n⭐ VOYANCE PICKS — MUST INCLUDE (HIGHEST PRIORITY)\n${'='.repeat(70)}\n${pickLines}\n- These MUST appear in the itinerary. Mark as isHiddenGem: true AND isVoyancePick: true.\n`;
          console.log(`[generate-day] Injecting ${vpRows.length} Voyance Picks`);
        }
      } catch (e) {
        console.warn("[generate-day] Voyance Picks fetch failed:", e);
      }

      // ==========================================================================
      // COLLABORATOR ATTRIBUTION: Load collaborators for suggestedFor coloring
      // ==========================================================================
      let collaboratorAttributionPrompt = '';
      let allUserIdsForAttribution: string[] = [];
      if (tripId) {
        // Query BOTH trip_collaborators AND trip_members to capture all participants
        const [{ data: collabRows }, { data: memberRows }] = await Promise.all([
          supabase
            .from('trip_collaborators')
            .select('user_id')
            .eq('trip_id', tripId)
            .eq('include_preferences', true),
          supabase
            .from('trip_members')
            .select('user_id')
            .eq('trip_id', tripId)
            .not('user_id', 'is', null),
        ]);

        // Merge unique participant IDs from both tables
        const participantIds = new Set<string>();
        (collabRows || []).forEach((c: any) => { if (c.user_id) participantIds.add(c.user_id); });
        (memberRows || []).forEach((m: any) => { if (m.user_id) participantIds.add(m.user_id); });
        // Remove owner since we'll prepend them
        participantIds.delete(userId);

        if (participantIds.size > 0) {
          const allUserIds = [userId, ...Array.from(participantIds)].filter(Boolean);
          allUserIdsForAttribution = allUserIds;
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, display_name, handle')
            .in('id', allUserIds);

          const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));
          const travelerList = allUserIds.map(uid => `  - "${uid}" (${profileMap.get(uid!) || 'Traveler'})`).join('\n');

          collaboratorAttributionPrompt = `
${'='.repeat(70)}
🎯 GROUP TRIP ATTRIBUTION — suggestedFor REQUIRED
${'='.repeat(70)}
This is a GROUP TRIP. Some activities need a "suggestedFor" field to show which traveler's DNA inspired the choice.

Travelers in this group:
${travelerList}

All traveler IDs combined: "${allUserIdsForAttribution.join(',')}"

Rules:
- LOGISTICAL activities (hotel check-in/check-out, airport arrival/departure, transfers, transit, packing, travel days) → DO NOT include suggestedFor. These are not DNA-driven.
- USER-REQUESTED must-do activities (things the user explicitly asked for, e.g. specific events or restaurants they named) → set suggestedFor to ALL traveler IDs comma-separated: "${allUserIdsForAttribution.join(',')}" — these were requested by the group, not inspired by any individual's DNA.
- AI-CHOSEN activities (restaurants, bars, experiences YOU picked based on personality traits) → set suggestedFor to the SINGLE traveler whose DNA most influenced the pick. Only use comma-separated IDs if the activity genuinely matches multiple travelers' unique traits.
- Use the primary planner's ID ("${userId}") ONLY when it specifically matches their profile, NOT as a default
`;
          console.log(`[generate-day] Attribution prompt injected for ${allUserIds.length} travelers (collabs: ${(collabRows || []).length}, members: ${(memberRows || []).length})`);
        }
      }

      // GAP 2: Build group avoid-list override prompt if applicable
      let groupAvoidPrompt = '';
      if (groupAvoidOverride && blendedDnaSnapshot && blendedDnaSnapshot.travelers.length > 1) {
        const ownerDef = getArchetypeDefinition(primaryArchetype);
        const ownerAvoidSet = new Set(ownerDef.avoid.map(a => a.toLowerCase()));
        const relaxedItems = [...ownerAvoidSet].filter(item => !groupAvoidOverride!.includes(item));
        if (relaxedItems.length > 0) {
          groupAvoidPrompt = `
${'='.repeat(70)}
🤝 GROUP TRIP AVOID-LIST RELAXATION
${'='.repeat(70)}
This is a GROUP trip. The owner's archetype normally avoids: ${ownerDef.avoid.join(', ')}.
However, since companions have different preferences, ONLY avoid items that ALL travelers' archetypes agree on:
${groupAvoidOverride.length > 0 ? `• Still avoid: ${groupAvoidOverride.join(', ')}` : '• No universal avoids — all activity types are fair game for this group.'}
• NOW ALLOWED (relaxed for group): ${relaxedItems.join(', ')}
Include some of the relaxed activities to satisfy companions' preferences.
`;
          console.log(`[generate-day] ✓ Avoid-list relaxed: ${relaxedItems.length} items now allowed for group`);
        }
      }
      
      const systemPrompt = `You are an expert travel planner creating a COMPLETE hour-by-hour travel plan — not a suggestion list.

${generationHierarchy}

${groupAvoidPrompt}

${tripTypePrompt}

${transportPreferencePrompt}

${timingInstructions}
${lockedSlotsInstruction}
${generationContextPrompts}

CORE PRINCIPLE: A Voyance itinerary plans the traveler's ENTIRE day, hour by hour, from waking up to going to sleep. It handles logistics, meals, transit, and the little decisions that stress people out when traveling.

General Requirements:
- Include FULL street addresses for all locations
- Provide realistic cost estimates in local currency — prices on EVERYTHING (meals, tickets, transit)
- PRICE CONTEXT IS MANDATORY: Every estimatedCost MUST include a "basis" field indicating what the price covers:
  • Attraction tickets: basis = "per_person" (tickets are individually priced). amount = price for ONE person.
  • Restaurant meals (à la carte): basis = "per_person" (average spend per diner). amount = per-person estimate.
  • Restaurant meals (set/tasting menu): basis = "per_person". amount = the set menu price per head.
  • Taxi/rideshare fares: basis = "flat" (shared ride). amount = total fare for the vehicle.
  • Public transit: basis = "per_person" (individual fare). amount = single fare.
  • Private tours: basis = "flat" (flat rate for the group). amount = total tour price.
  • Group tours: basis = "per_person". amount = per-person ticket.
  • Hotel/accommodation: basis = "per_room" (per room per night). amount = nightly rate.
  • Free activities: basis = "flat", amount = 0.
  This ensures the UI can calculate accurate group totals: per_person costs × travelers, flat costs as-is.
- Account for REALISTIC travel time between activities — if two places are in different neighborhoods, leave 30-60 min gap (not 15 min). Only use 15 min gaps for locations within walking distance. Travel time and rest/settling buffers are SEPARATE — add both.
- NEVER schedule zero-gap transitions. Every activity needs settling/buffer time ON TOP of travel: +5 min after walking, +10 min for taxi pickup/dropoff, +10 min for restaurant seating, +15 min for hotel check-in, +10 min for museum entry (ticket queue, bag check). Show this naturally: "Arrive ~6:30 PM. Check in, freshen up. Ready by 7:30 PM."
- Include TRANSIT between every pair of consecutive activities as separate entries with category "transport" (mode, duration, cost, route/line info). Walks under 5 min can be noted in tips instead.
- Include meals as specified by the day's meal policy (see timing instructions above) — each a real named restaurant with price
- Each lunch and dinner recommendation should include 1 ALTERNATIVE option in its "tips" field
- ONLY recommend restaurants and dining spots with 4+ star ratings - no low-quality or poorly-reviewed venues
- Every activity MUST have a "title" field (the display name)
- All times MUST be in 24-hour HH:MM format
- ACTIVITY COUNT: This includes meals, transit, and evening activities. Fill the day completely.
- Include at least 1 EVENING/NIGHTLIFE activity after dinner (bar, show, night market, jazz, rooftop, dessert spot)
- Include PRACTICAL TIPS inline: booking requirements, queue advice, dress codes, closure days, best times
- The LAST activity's tips field must include a NEXT MORNING PREVIEW: "Tomorrow: Wake [time]. Breakfast at [place] ([distance], ~[price])."
- For full exploration days: minimum 3 paid activities + 2 free activities + required meals (per meal policy) + evening option
${lockedActivities.length > 0 ? '- DO NOT generate activities for locked time slots listed above' : ''}
${collaboratorAttributionPrompt}
${voyancePicksPrompt}

CURATED PICKS — ONE BEST CHOICE PER SLOT (CRITICAL):
CRITICAL: Generate exactly ONE activity or restaurant per time slot. Do NOT generate multiple options, alternatives, or choices for any slot. Do NOT include isOption, optionGroup, or any selection/choice mechanism in the output. Every slot must have a single, definitive, curated recommendation. You are delivering a finished plan — not a quiz.

BUFFER TIME — MANDATORY:
Include realistic travel and transition time between every activity. NEVER schedule back-to-back with zero gap. Minimum gaps: 5 min same venue, 10-15 min walking distance, 15-20 min restaurant arrival, 20-30 min hotel check-in/out, 30-60 min airport. Include actual transit time for non-walking distances.

OPERATING HOURS — HARD CONSTRAINT:
Never schedule an activity before its opening time or after its closing time. Use conservative defaults when unknown: attractions 09:30-17:00, restaurants lunch 11:30-14:00 and dinner 18:00-21:30, outdoor activities sunrise to sunset.

ARCHETYPE NAMES — EXACT MATCH ONLY:
Use ONLY the exact archetype name from the traveler's DNA profile. Never invent variations like 'Luxury Luminary' or 'Culture Connoisseur'.

ARCHETYPE BALANCE:
Archetype influences 30-40% of activities. The rest must be universally enjoyable. Luxury ≠ $500 everything. Adventure ≠ 3 extreme sports per day. Food ≠ eating all day.

OUTPUT QUALITY:
All text must be clean, correctly spelled English. No garbled characters, no non-Latin script, no leaked schema field names.
`;

      // Use meal policy derived earlier (dayMealPolicy) instead of blanket isFullDay
      const isFullDay = dayMealPolicy?.isFullExplorationDay ?? (!isFirstDay && !isLastDay);
      const userPrompt = `Generate Day ${dayNumber} of ${totalDays} in ${resolvedDestination}${resolvedCountry ? `, ${resolvedCountry}` : ''}.

Date: ${date}
Travelers: ${travelers}
Budget: ${effectiveBudgetTier}${actualDailyBudgetPerPerson != null ? ` (~$${actualDailyBudgetPerPerson}/day per person)
⚠️ HARD BUDGET CAP: The user has set a real budget of ~$${Math.round(actualDailyBudgetPerPerson * (travelers || 1))}/day total ($${actualDailyBudgetPerPerson}/person) for activities.
${actualDailyBudgetPerPerson < 10 ? `🚨 EXTREMELY TIGHT BUDGET: Do your best — prioritize FREE activities (parks, temples, markets, viewpoints, walking tours). For meals, suggest cheapest realistic options (street food, convenience stores). Do NOT invent fake low prices — use real local costs. Include a "budget_note" field with an honest 1-sentence note about budget feasibility.` : actualDailyBudgetPerPerson < 30 ? `⚡ TIGHT BUDGET: Lean heavily on free attractions, street food, self-guided exploration. Limit paid activities to 1-2/day. Use realistic local prices.` : `Stay within this cap. Balance expensive activities with free alternatives.`}` : ''}
ARCHETYPE: ${primaryArchetype}
${isFullDay ? `DAY TYPE: Full exploration day — generate a COMPLETE hour-by-hour plan with ${dayMealPolicy?.requiredMeals?.length ?? 3} meals (${dayMealPolicy?.requiredMeals?.join(', ') ?? 'breakfast, lunch, dinner'}), transit between every stop, evening activity, and next-morning preview.` : dayMealPolicy && !isFirstDay && !isLastDay ? `DAY TYPE: ${dayMealPolicy.dayMode.replace(/_/g, ' ')} — ${dayMealPolicy.mealInstructionText}` : `SIGHTSEEING ACTIVITY COUNT: ${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} (adjust for arrival/departure constraints)`}
${preferences?.pace ? `Pace: ${preferences.pace}` : ''}
${preferences?.dayFocus ? `Day focus: ${preferences.dayFocus}` : ''}
${(() => {
  const focus = (preferences?.dayFocus || preferences?.rewriteInstructions || '').toLowerCase();
  const isBudgetDown = /cheap|budget|afford|save money|less expensive|lower cost|reduce.*cost|cut.*spending|frugal/i.test(focus);
  if (isBudgetDown && currentActivities?.length) {
    const currentCosts = currentActivities.map((a: any) => a.cost?.amount ?? a.estimatedCost ?? 0);
    const maxCurrent = Math.max(...currentCosts);
    const avgCurrent = currentCosts.reduce((s: number, c: number) => s + c, 0) / (currentCosts.length || 1);
    return `
🚨 BUDGET-DOWN REWRITE — HARD CONSTRAINT:
The user explicitly asked for CHEAPER options. Every replacement activity MUST cost LESS than what it replaces.
Current day average cost per activity: ~$${Math.round(avgCurrent)}. Current max: ~$${Math.round(maxCurrent)}.
Your replacements should average BELOW $${Math.round(avgCurrent * 0.5)} per activity.
Prefer FREE alternatives: public parks, free museums, self-guided walks, street food, markets, viewpoints.
NEVER suggest a more expensive alternative when the user asks for cheaper. This is non-negotiable.`;
  }
  return '';
})()}

CRITICAL TIME ORDERING & MEAL TIMING RULES:
- ALL activities MUST be in strict chronological order by startTime.
- Breakfast/brunch: 7:00 AM – 10:00 AM. NEVER schedule breakfast after 11:00 AM.
- Morning activities: 9:00 AM – 12:00 PM.
- Lunch: 11:30 AM – 1:30 PM.
- Afternoon activities: 1:00 PM – 5:00 PM.
- Dinner: 6:00 PM – 9:00 PM. NEVER schedule dinner before 5:00 PM.
- Evening activities/nightlife: 7:00 PM – 11:00 PM.
- Nightcap/late night: 9:00 PM – midnight. NEVER schedule a nightcap before 8:00 PM.
- Activities must flow logically: morning → midday → afternoon → evening → night.

${preferenceContext}
${tripIntentsContext}
${mustDoPrompt}
${additionalNotesPrompt}
${mustHavesConstraintPrompt}
${preBookedCommitmentsPrompt}
${(() => {
  if (!previousDayActivities?.length) return '';
  // Separate recurring/must-do events from regular activities
  const mustDoList = (paramMustDoActivities || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const recurring: string[] = [];
  const nonRecurring: string[] = [];
  for (const prev of previousDayActivities) {
    if (isRecurringEvent({ title: prev }, mustDoList)) {
      recurring.push(prev);
    } else {
      nonRecurring.push(prev);
    }
  }
  let result = '';
  if (nonRecurring.length > 0) {
    result += `\nAvoid repeating these specific venues/activities (be creative and pick DIFFERENT ones): ${nonRecurring.join(', ')}`;
  }
  if (recurring.length > 0) {
    result += `\nTHESE ARE MULTI-DAY EVENTS the traveler is attending across multiple days — YOU MUST CREATE A FULL ATTENDANCE ACTIVITY CARD for each (not just transit): ${recurring.join(', ')}`;
  }
  return result;
})()}

CRITICAL REMINDERS:
1. ${isFullDay ? `This is a FULL DAY: ${dayMealPolicy?.requiredMeals?.join(' + ') ?? 'breakfast + lunch + dinner'} + 3 paid activities + 2 free activities + transit between all stops + evening activity + next morning preview. Fill EVERY hour.` : dayMealPolicy && !isFirstDay && !isLastDay ? `This is a ${dayMealPolicy.dayMode.replace(/_/g, ' ')} day. Required meals: ${dayMealPolicy.requiredMeals.length > 0 ? dayMealPolicy.requiredMeals.join(', ') : 'none'}. Do NOT add extra meals beyond what the meal policy specifies.` : `${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} scheduled sightseeing activities for this ${isFirstDay ? 'arrival' : 'departure'} day.`}
2. Check the archetype's avoid list. If it says "no spa", there are ZERO spa activities.
3. Check the budget constraints. If value-focused, no €100+ experiences.
4. ${primaryArchetype === 'flexible_wanderer' || primaryArchetype === 'slow_traveler' || (traitScores.pace || 0) <= -3 ? 'Include at least one 2+ hour UNSCHEDULED block labeled "Free time to explore [neighborhood]"' : 'Follow the pacing guidelines for this archetype'}
5. ${isFullDay ? 'TRANSIT: Include a transport entry (category: "transport") between EVERY pair of consecutive activities. Include mode, duration, cost.' : ''}
6. ${isFullDay ? 'PRICES: Every meal, every ticket, every taxi must have a price. estimatedCost.amount = 0 for free activities. No blanks.' : ''}

${'='.repeat(70)}
🧠 VOYANCE INTELLIGENCE FIELDS — MANDATORY FOR EVERY ACTIVITY
${'='.repeat(70)}
For EVERY activity, you MUST include ALL of these intelligence fields:
1. "tips" (string, 30+ chars): Specific, actionable insider tip. NOT generic.${isFullDay ? ' For lunch/dinner: include 1 alternative restaurant. For last activity: include next morning preview.' : ''}
2. "crowdLevel": "low", "moderate", or "high" at the SCHEDULED time
3. "isHiddenGem" (boolean): true for genuine discoveries (not mainstream). At least 1-2 per day.
4. "hasTimingHack" (boolean): true if this time slot gives an advantage. At least 2-3 per day.
5. "bestTime" (string): If hasTimingHack=true, explain why this time is optimal.
6. "voyanceInsight" (string): One unique fact most travelers don't know.
7. "personalization.whyThisFits" (string): Reference specific traveler traits/preferences.

Generate activities following ALL constraints above.
IMPORTANT: Pick DIFFERENT restaurants/activities than listed above. Do not repeat.`;

      // ==========================================================================
      // Log Full Prompt Lengths before AI call
      // ==========================================================================
      console.log(`[generate-day] System prompt: ${systemPrompt.length} chars, User prompt: ${userPrompt.length} chars`);
      console.log(`[generate-day] Experience guidance included: ${archetypeContext.promptBlocks.affinity.length > 0 ? 'YES' : 'NO'} (${archetypeContext.promptBlocks.affinity.length} chars)`);
      console.log(`[generate-day] Destination guidance included: ${archetypeContext.promptBlocks.destination.length > 0 ? 'YES' : 'NO'} (${archetypeContext.promptBlocks.destination.length} chars)`);

      try {
        let data: any = null;
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          // Fall back to a faster model after 3 failed attempts to reduce provider timeouts
          const model = attempt <= 3 ? "google/gemini-3-flash-preview" : "google/gemini-2.5-flash";
          if (attempt > 3) {
            console.log(`[generate-day] Falling back to ${model} after ${attempt - 1} failures`);
          }
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
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
                            estimatedCost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" }, basis: { type: "string", enum: ["per_person", "flat", "per_room"], description: "per_person = price per traveler, flat = total price for the group/vehicle, per_room = per room per night" } } },
                            cost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" }, basis: { type: "string", enum: ["per_person", "flat", "per_room"] } } },
                            bookingRequired: { type: "boolean" },
                            tips: { type: "string", description: "Insider tip for this activity (must be specific, actionable, 30+ chars)" },
                            coordinates: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } },
                            type: { type: "string" },
                            suggestedFor: { type: "string", description: "User ID of the traveler whose preferences most influenced this activity (group trips)" },
                            isHiddenGem: { type: "boolean", description: "true if this is a hidden gem discovered through deep research. NOT for mainstream tourist attractions." },
                            hasTimingHack: { type: "boolean", description: "true if scheduling at this specific time provides a meaningful advantage" },
                            bestTime: { type: "string", description: "If hasTimingHack=true, explain why this time is optimal" },
                            crowdLevel: { type: "string", enum: ["low", "moderate", "high"], description: "Expected crowd level at the scheduled time" },
                            voyanceInsight: { type: "string", description: "A unique Voyance-only insight about this place" },
                            personalization: {
                              type: "object",
                              properties: {
                                tags: { type: "array", items: { type: "string" } },
                                whyThisFits: { type: "string", description: "Why this fits THIS traveler's DNA" },
                                confidence: { type: "number" },
                                matchedInputs: { type: "array", items: { type: "string" } }
                              },
                              required: ["tags", "whyThisFits", "confidence"]
                            }
                          },
                          required: ["title", "category", "startTime", "endTime", "location", "personalization", "tips", "crowdLevel", "isHiddenGem", "hasTimingHack"]
                        }
                      },
                      accommodationNotes: { type: "array", items: { type: "string" }, description: "2-3 accommodation tips for this destination" },
                      practicalTips: { type: "array", items: { type: "string" }, description: "3-4 practical travel tips for this destination" },
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

            // Retry transient 5xx (including 524 provider timeout)
            if (attempt < maxAttempts && status >= 500) {
              const backoff = Math.min(2000 * attempt, 8000);
              console.log(`[generate-day] Retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})...`);
              await new Promise((resolve) => setTimeout(resolve, backoff));
              continue;
            }

            throw new Error("AI generation failed");
          }

          data = await response.json();

          // The gateway can sometimes return HTTP 200 with an error payload.
          if ((data as any)?.error) {
            console.error(`[generate-day] AI Gateway error payload (attempt ${attempt}):`, (data as any).error);
            const raw = (data as any).error?.message || 'Internal Server Error';
            const errorCode = (data as any).error?.code;
            // Treat 500, 524 (provider timeout), and generic errors as transient
            const isTransient = raw === 'Internal Server Error' || raw === 'Provider returned error' || errorCode === 500 || errorCode === 524;
            if (attempt < maxAttempts && isTransient) {
              const backoff = Math.min(2000 * attempt, 8000);
              console.log(`[generate-day] Provider error (code ${errorCode}), retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})...`);
              await new Promise((resolve) => setTimeout(resolve, backoff));
              data = null;
              continue;
            }

            const msg = raw === 'Internal Server Error' || raw === 'Provider returned error'
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
          generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(toolCall.function.arguments))), dayNumber);
        } else if (message?.content) {
          // Fallback: AI returned content instead of tool call
          console.log("[generate-day] AI returned content instead of tool_call, attempting to parse...");
          try {
            // Try to extract JSON from the content
            const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(jsonMatch[0]))), dayNumber);
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
          estimatedCost?: { amount: number; currency: string; basis?: string };
          cost?: { amount: number; currency: string; basis?: string };
          location?: string | { name?: string; address?: string };
        }, idx: number) => {
          // Normalize title: use title, fallback to name
          const normalizedTitle = act.title || act.name || `Activity ${idx + 1}`;
          
          // Normalize cost: convert from local currency to USD for consistent storage
          // AI may return costs in local currency (e.g., JPY 6000 for Japan)
          const rawCost = act.cost || act.estimatedCost || { amount: 0, currency: 'USD' };
          const normalizedCost = normalizeCostToUSD(rawCost);
          // Preserve cost basis (per_person, flat, per_room) from AI response
          const costBasis = (act.cost as any)?.basis || (act.estimatedCost as any)?.basis || 'per_person';
          
          // Normalize location: convert string to object if needed
          let normalizedLocation = act.location;
          if (typeof act.location === 'string') {
            normalizedLocation = { name: act.location, address: act.location };
          }
          
          const normalized = {
            ...act,
            id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
            title: normalizedTitle,
            name: normalizedTitle, // Keep both for compatibility
            cost: normalizedCost,
            costBasis: costBasis, // per_person | flat | per_room
            location: normalizedLocation,
            durationMinutes: act.startTime && act.endTime ? calculateDuration(act.startTime, act.endTime) : 60,
            categoryIcon: getCategoryIcon(act.category || 'activity'),
            isLocked: false, // New activities are unlocked by default
          };
          // Derive intelligence fields if AI didn't set them
          deriveIntelligenceFields(normalized);
          return normalized;
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

          // Semantic dedup: remove generated activities whose titles are similar to locked ones
          const beforeSemanticDedup = normalizedActivities.length;
          normalizedActivities = normalizedActivities.filter((genAct: any) => {
            const genTitle = (genAct.title || '').toLowerCase();
            for (const locked of lockedActivities) {
              const lockedTitle = (locked.title || '').toLowerCase();
              // Substring match
              if (genTitle.includes(lockedTitle) || lockedTitle.includes(genTitle)) {
                console.log(`[generate-day] Removing "${genAct.title}" — duplicate of locked "${locked.title}"`);
                return false;
              }
              // Keyword match (50% threshold)
              const keywords = lockedTitle.replace(/\b(the|a|an|at|in|on|for|and|or|to|of)\b/g, '').split(/\s+/).filter((w: string) => w.length > 2);
              if (keywords.length > 0) {
                const matchCount = keywords.filter((kw: string) => genTitle.includes(kw)).length;
                if (matchCount >= Math.ceil(keywords.length * 0.5) && matchCount >= 1) {
                  console.log(`[generate-day] Removing "${genAct.title}" — semantic duplicate of locked "${locked.title}"`);
                  return false;
                }
              }
            }
            return true;
          });
          if (normalizedActivities.length < beforeSemanticDedup) {
            console.log(`[generate-day] Semantic dedup removed ${beforeSemanticDedup - normalizedActivities.length} activities that duplicated locked ones`);
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
          
          // Time budget: cap enrichment so the overall request stays within edge runtime limits.
          // AI generation + prompt building already consumed significant time; leave headroom for DB saves.
          const ENRICHMENT_TIME_BUDGET_MS = 25_000;
          const enrichStartedAt = Date.now();
          
          // Enrich in parallel batches of 3 to avoid rate limits
          const batchSize = 3;
          const enrichedActivities: StrictActivity[] = [];
          let enrichmentBudgetExceeded = false;
          
          for (let i = 0; i < activitiesToEnrich.length; i += batchSize) {
            // Check time budget before starting next batch
            const elapsed = Date.now() - enrichStartedAt;
            if (elapsed >= ENRICHMENT_TIME_BUDGET_MS) {
              console.warn(`[generate-day] Enrichment time budget reached (${elapsed}ms). Skipping remaining ${activitiesToEnrich.length - i} activities.`);
              enrichedActivities.push(...activitiesToEnrich.slice(i));
              enrichmentBudgetExceeded = true;
              break;
            }
            
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
          
          if (enrichmentBudgetExceeded) {
            console.log(`[generate-day] Enrichment partial: ${enrichedActivities.filter((a: { rating?: unknown }) => a.rating).length} enriched, rest returned as-is`);
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

        // =======================================================================
        // Opening Hours Validation for single-day generation
        // Confirmed closures → REMOVE. Uncertain → tag as closedRisk warning.
        // =======================================================================
        if (date) {
          const dayDate = new Date(date);
          const dayOfWeek = dayDate.getDay();
          const { isVenueOpenOnDay, isVenueClosedAllDay } = await import('./truth-anchors.ts');
          
          const activitiesToRemove: string[] = [];
          for (const act of normalizedActivities) {
            if (!act.openingHours || act.openingHours.length === 0) continue;
            const skipCats = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
            if (skipCats.includes(act.category?.toLowerCase() || '')) continue;
            
            const result = isVenueOpenOnDay(act.openingHours, dayOfWeek, act.startTime);
            if (!result.isOpen) {
              const closedAllDay = isVenueClosedAllDay(act.openingHours, dayOfWeek);
              if (closedAllDay) {
                // Confirmed closed → remove
                console.log(`[generate-day] ✗ "${act.title}" — REMOVED (confirmed closed all day)`);
                activitiesToRemove.push(act.id);
              } else {
                // Time conflict only → uncertain warning
                console.warn(`[generate-day] ⚠️ "${act.title}" time conflict: ${result.reason}`);
                (act as any).closedRisk = true;
                (act as any).closedRiskReason = result.reason;
              }
            }
          }
          
          if (activitiesToRemove.length > 0) {
            normalizedActivities = normalizedActivities.filter((a: { id: string }) => !activitiesToRemove.includes(a.id));
            console.log(`[generate-day] Removed ${activitiesToRemove.length} confirmed-closed activities`);
          }
        }

        // =======================================================================
        // AUTO ROUTE OPTIMIZATION: Reorder flexible activities by proximity
        // No API calls, no credit charge — uses coordinates from enrichment
        // =======================================================================
        try {
          const { autoOptimizeDayRoute } = await import('./auto-route-optimizer.ts');
          normalizedActivities = autoOptimizeDayRoute(normalizedActivities);
        } catch (routeErr) {
          console.warn(`[generate-day] Auto route optimization failed (non-blocking):`, routeErr);
        }

        generatedDay.activities = normalizedActivities;

        // =======================================================================
        // MUST-DO EVENT OVERLAP STRIPPING
        // If this day has all-day or half-day events, remove any non-structural
        // activities that overlap the blocked time window
        // =======================================================================
        if (mustDoEventItems.length > 0) {
          const beforeCount = normalizedActivities.length;
          for (const eventItem of mustDoEventItems) {
            const { blockedStart, blockedEnd } = getBlockedTimeRange(eventItem);
            const blockedStartMins = parseTimeToMinutes(blockedStart);
            const blockedEndMins = parseTimeToMinutes(blockedEnd);
            if (blockedStartMins === null || blockedEndMins === null) continue;

            const eventTitleLower = eventItem.priority.title.toLowerCase();
            normalizedActivities = normalizedActivities.filter((act: any) => {
              // Always keep the event itself (fuzzy title match)
              const actTitle = (act.title || '').toLowerCase();
              if (actTitle.includes(eventTitleLower) || eventTitleLower.includes(actTitle)) return true;
              // Always keep structural categories: transit, transport, hotel, meals
              const cat = (act.category || '').toLowerCase();
              if (['transport', 'transportation', 'transit', 'hotel', 'accommodation'].includes(cat)) return true;
              // Keep meals (breakfast before event, dinner after)
              if (cat === 'food' || cat === 'dining' || cat === 'restaurant' || cat === 'meal') {
                // Keep if meal ends before blocked start or starts after blocked end
                const mealStart = parseTimeToMinutes(act.startTime);
                const mealEnd = parseTimeToMinutes(act.endTime);
                if (mealStart !== null && mealEnd !== null) {
                  if (mealEnd <= blockedStartMins || mealStart >= blockedEndMins) return true;
                }
                // Meal overlaps the event window — drop it
                return false;
              }
              // For all other activities, check time overlap
              const actStart = parseTimeToMinutes(act.startTime);
              const actEnd = parseTimeToMinutes(act.endTime);
              if (actStart === null || actEnd === null) return true; // can't determine, keep
              // Remove if overlaps: activity starts before event ends AND ends after event starts
              if (actStart < blockedEndMins && actEnd > blockedStartMins) {
                console.log(`[generate-day] 🗑️ Removing "${act.title}" (${act.startTime}-${act.endTime}) — overlaps blocked time ${blockedStart}-${blockedEnd} for "${eventItem.priority.title}"`);
                return false;
              }
              return true;
            });
          }
          const removed = beforeCount - normalizedActivities.length;
          if (removed > 0) {
            console.log(`[generate-day] ✓ Stripped ${removed} activities overlapping must-do event time blocks`);
            generatedDay.activities = normalizedActivities;
          }
        }

        // =======================================================================
        // DETERMINISTIC EVENT BACKFILL
        // If any must-do event is STILL missing from the day (model skipped it),
        // inject a synthetic activity entry so the card always appears.
        // =======================================================================
        if (mustDoEventItems.length > 0) {
          for (const eventItem of mustDoEventItems) {
            const { blockedStart, blockedEnd } = getBlockedTimeRange(eventItem);
            const eventTitleLower = eventItem.priority.title.toLowerCase();

            // Check if a NON-TRANSPORT activity matching this event already exists
            // Transit activities like "Subway to US Open" contain the event name but are NOT the event
            const transportCategories = ['transport', 'transportation', 'transit', 'transfer'];
            const transportTitlePatterns = /\b(transfer|transit|taxi|uber|subway|metro|bus|drive|ride|lyft|car service|shuttle|walk(?:ing)?)\s+(to|from|back)\b/i;
            // Extract core keywords from the must-do title for semantic matching
            // e.g., "Comedy Show" → ["comedy", "show"]
            const coreKeywords = eventTitleLower
              .replace(/\b(the|a|an|at|in|on|for|and|or|to|of|my|our)\b/g, '')
              .split(/\s+/)
              .filter(w => w.length > 2);

            const eventExists = generatedDay.activities.some((act: any) => {
              const actTitle = (act.title || '').toLowerCase();
              const actCategory = (act.category || '').toLowerCase();

              // Transport/transit activities do NOT count as the event itself
              if (transportCategories.includes(actCategory)) return false;
              if (transportTitlePatterns.test(act.title || '')) return false;
              // Empty or very short titles are false positives
              if (actTitle.length < 3) return false;

              // Exact/substring match (original logic)
              const titleMatchesEvent = actTitle.includes(eventTitleLower) || eventTitleLower.includes(actTitle);
              if (titleMatchesEvent) return true;

              // Semantic keyword match — if the AI generated a different title
              // for the same activity (e.g., "Friday Night Stand-Up Comedy" vs "Comedy Show"),
              // check if a majority of the must-do's core keywords appear in the AI title
              if (coreKeywords.length > 0) {
                const matchCount = coreKeywords.filter(kw => actTitle.includes(kw)).length;
                const matchRatio = matchCount / coreKeywords.length;
                if (matchRatio >= 0.5 && matchCount >= 1) {
                  console.log(`[generate-day] Semantic match: must-do "${eventTitleLower}" ↔ AI activity "${actTitle}" (${matchCount}/${coreKeywords.length} keywords)`);
                  return true;
                }
              }

              return false;
            });

            // Also check if this must-do is already locked on the day — no need to backfill
            const eventIsLocked = lockedActivities.some((locked: any) => {
              const lockedTitle = (locked.title || '').toLowerCase();
              if (lockedTitle.includes(eventTitleLower) || eventTitleLower.includes(lockedTitle)) return true;
              if (coreKeywords.length > 0) {
                const matchCount = coreKeywords.filter((kw: string) => lockedTitle.includes(kw)).length;
                if (matchCount >= Math.ceil(coreKeywords.length * 0.5) && matchCount >= 1) return true;
              }
              return false;
            });
            if (eventIsLocked) {
              console.log(`[generate-day] Skipping must-do backfill "${eventItem.priority.title}" — already locked on this day`);
              continue;
            }

            if (!eventExists) {
              console.log(`[generate-day] ⚠️ BACKFILL: Must-do event "${eventItem.priority.title}" missing from Day ${dayNumber} — injecting deterministic activity card`);

              // Find the right insertion point (chronological order)
              let insertIndex = generatedDay.activities.length;
              const blockedStartMins = parseTimeToMinutes(blockedStart);
              for (let i = 0; i < generatedDay.activities.length; i++) {
                const act = generatedDay.activities[i];
                const actStart = parseTimeToMinutes(act.startTime);
                if (actStart !== null && blockedStartMins !== null && actStart >= blockedStartMins) {
                  insertIndex = i;
                  break;
                }
              }

              const syntheticEvent = {
                id: crypto.randomUUID(),
                title: eventItem.priority.title,
                startTime: blockedStart,
                endTime: blockedEnd,
                category: 'activity',
                description: `${eventItem.priority.title} — user's scheduled event for this day.${eventItem.priority.requiresBooking ? ' Tickets/advance booking required.' : ''}`,
                location: eventItem.priority.venueName
                  ? { name: eventItem.priority.venueName }
                  : { name: eventItem.priority.title },
                estimatedCost: { amount: 0, currency: 'USD' },
                tips: `This is your dedicated ${eventItem.priority.title} day. Arrive early to get settled and enjoy the full experience.`,
                crowdLevel: 'high',
                isHiddenGem: false,
                hasTimingHack: false,
                voyanceInsight: `Multi-day event attendance — enjoy today's experience!`,
                personalization: {
                  whyThisFits: `You specifically requested ${eventItem.priority.title} for this day.`,
                },
                bookingRequired: eventItem.priority.requiresBooking || false,
              };

              generatedDay.activities.splice(insertIndex, 0, syntheticEvent);
              console.log(`[generate-day] ✅ BACKFILL: Injected "${eventItem.priority.title}" at position ${insertIndex} (${blockedStart}–${blockedEnd})`);
            }
          }
        }

        // Sync normalizedActivities with any backfilled events
        normalizedActivities = generatedDay.activities;

        // If AI omitted the travel activity, inject deterministic fallback
        // =======================================================================
        if (resolvedIsTransitionDay && resolvedTransitionFrom && resolvedTransitionTo) {
          const hasInterCityTravel = normalizedActivities.some((act: { title?: string; category?: string; description?: string }) => {
            const t = (act.title || '').toLowerCase();
            const d = (act.description || '').toLowerCase();
            const fromLower = resolvedTransitionFrom.toLowerCase();
            const toLower = resolvedTransitionTo.toLowerCase();
            const isTransport = act.category === 'transport' || act.category === 'transportation';
            const mentionsBothCities = (t.includes(fromLower) || d.includes(fromLower)) && (t.includes(toLower) || d.includes(toLower));
            const mentionsMode = t.includes(resolvedTransportMode) || d.includes(resolvedTransportMode) || t.includes('travel') || t.includes('transfer');
            return isTransport && (mentionsBothCities || mentionsMode);
          });

          if (!hasInterCityTravel) {
            console.warn(`[generate-day] ⚠️ TELEPORTING DETECTED! No inter-city travel found for ${resolvedTransitionFrom} → ${resolvedTransitionTo}. Injecting fallback transport blocks.`);
            
            const modeLabel = resolvedTransportMode.charAt(0).toUpperCase() + resolvedTransportMode.slice(1);
            const td = resolvedTransportDetails || {};
            
            // Use real times from transport_details if available, else defaults
            const hasTimes = !!(td.departureTime || td.arrivalTime);
            const depTime = td.departureTime || '10:30';
            const arrTime = td.arrivalTime || '13:30';
            const depStation = td.departureStation || td.departureAirport || `${modeLabel} Station`;
            const arrStation = td.arrivalStation || td.arrivalAirport || `${modeLabel} Station`;
            const carrier = td.carrier || '';
            const duration = td.duration || '';
            const costPP = td.costPerPerson || 50;

            // Calculate derived times from real schedule
            const depMins = parseTimeToMinutes(depTime);
            const arrMins = parseTimeToMinutes(arrTime);
            // Transfer to station: 45 min before departure
            const transferDepStart = depMins ? minutesToHHMM(depMins - 45) : '09:30';
            const transferDepEnd = depMins ? minutesToHHMM(depMins) : '10:15';
            // Checkout: 30 min before transfer
            const checkoutStart = depMins ? minutesToHHMM(depMins - 75) : '09:00';
            const checkoutEnd = depMins ? minutesToHHMM(depMins - 45) : '09:30';
            // Transfer from station: starts at arrival
            const transferArrStart = arrMins ? minutesToHHMM(arrMins) : '13:30';
            const transferArrEnd = arrMins ? minutesToHHMM(arrMins + 45) : '14:15';
            // Check-in: after transfer
            const checkinStart = arrMins ? minutesToHHMM(arrMins + 45) : '14:15';
            const checkinEnd = arrMins ? minutesToHHMM(arrMins + 90) : '15:00';

            const interCityDesc = hasTimes
              ? `${carrier ? carrier + ' — ' : ''}${resolvedTransportMode} from ${resolvedTransitionFrom} to ${resolvedTransitionTo}. Departs ${depTime}, arrives ${arrTime}${duration ? ` (${duration})` : ''}.`
              : `Inter-city ${resolvedTransportMode} travel from ${resolvedTransitionFrom} to ${resolvedTransitionTo}. Duration varies by route and operator.`;

            const fallbackTransport = [
              {
                id: `day${dayNumber}-checkout-${Date.now()}`,
                title: `Hotel Checkout – ${resolvedTransitionFrom}`,
                name: `Hotel Checkout – ${resolvedTransitionFrom}`,
                category: 'accommodation',
                startTime: checkoutStart,
                endTime: checkoutEnd,
                description: `Check out of hotel in ${resolvedTransitionFrom} and prepare for travel day`,
                location: { name: `Hotel in ${resolvedTransitionFrom}`, address: resolvedTransitionFrom },
                cost: { amount: 0, currency: 'USD' },
                isLocked: false,
                durationMinutes: 30,
              },
              {
                id: `day${dayNumber}-transfer-depart-${Date.now()}`,
                title: `Transfer to ${depStation}`,
                name: `Transfer to ${depStation}`,
                category: 'transport',
                startTime: transferDepStart,
                endTime: transferDepEnd,
                description: `Travel to ${depStation} in ${resolvedTransitionFrom}`,
                location: { name: depStation, address: resolvedTransitionFrom },
                cost: { amount: 15, currency: 'USD', basis: 'flat' },
                isLocked: false,
                durationMinutes: 45,
              },
              {
                id: `day${dayNumber}-intercity-${Date.now()}`,
                title: `${modeLabel} – ${resolvedTransitionFrom} to ${resolvedTransitionTo}`,
                name: `${modeLabel} – ${resolvedTransitionFrom} to ${resolvedTransitionTo}`,
                category: 'transport',
                startTime: depTime,
                endTime: arrTime,
                description: interCityDesc,
                location: { name: `${resolvedTransitionFrom} → ${resolvedTransitionTo}`, address: '' },
                cost: { amount: costPP, currency: td.currency || 'USD', basis: 'per_person' },
                isLocked: false,
                durationMinutes: (arrMins && depMins) ? Math.max(30, arrMins - depMins) : 180,
              },
              {
                id: `day${dayNumber}-transfer-arrive-${Date.now()}`,
                title: `Transfer to Hotel – ${resolvedTransitionTo}`,
                name: `Transfer to Hotel – ${resolvedTransitionTo}`,
                category: 'transport',
                startTime: transferArrStart,
                endTime: transferArrEnd,
                description: `Travel from ${arrStation} to hotel in ${resolvedTransitionTo}`,
                location: { name: `Hotel in ${resolvedTransitionTo}`, address: resolvedTransitionTo },
                cost: { amount: 15, currency: 'USD', basis: 'flat' },
                isLocked: false,
                durationMinutes: 45,
              },
              {
                id: `day${dayNumber}-checkin-${Date.now()}`,
                title: `Hotel Check-in – ${resolvedTransitionTo}`,
                name: `Hotel Check-in – ${resolvedTransitionTo}`,
                category: 'accommodation',
                startTime: checkinStart,
                endTime: checkinEnd,
                description: `Check in to hotel in ${resolvedTransitionTo}, freshen up and rest after travel`,
                location: { name: `Hotel in ${resolvedTransitionTo}`, address: resolvedTransitionTo },
                cost: { amount: 0, currency: 'USD' },
                isLocked: false,
                durationMinutes: 45,
              },
            ];

            // Prepend travel blocks, keep evening activities from AI
            const eveningActivities = normalizedActivities.filter((act: { startTime?: string }) => {
              const mins = parseTimeToMinutes(act.startTime || '00:00');
              return mins !== null && mins >= 15 * 60; // 3pm or later
            });
            
            generatedDay.activities = [...fallbackTransport, ...eveningActivities];
            normalizedActivities = generatedDay.activities;
            console.log(`[generate-day] Injected ${fallbackTransport.length} fallback travel blocks + ${eveningActivities.length} evening activities`);
          } else {
            console.log(`[generate-day] ✓ Transition day has inter-city travel activity`);
          }

          // Persist transition metadata on the generated day
          generatedDay.city = resolvedTransitionTo;
          generatedDay.country = resolvedCountry;
          generatedDay.isTransitionDay = true;
          generatedDay.transitionFrom = resolvedTransitionFrom;
          generatedDay.transitionTo = resolvedTransitionTo;
          generatedDay.transportType = resolvedTransportMode;
          generatedDay.title = generatedDay.title || `${resolvedTransitionFrom} → ${resolvedTransitionTo} (Travel Day)`;
        } else if (resolvedIsMultiCity) {
          // Even for non-transition days in multi-city, persist city metadata
          generatedDay.city = resolvedDestination;
          generatedDay.country = resolvedCountry;
          generatedDay.isTransitionDay = false;
        }

        generatedDay.title = generatedDay.title || generatedDay.theme || `Day ${dayNumber}`;

        // =======================================================================
        // TRIP-WIDE DUPLICATE VALIDATION (same as full generation path)
        // Build previousDays from existing itinerary, call validateGeneratedDay
        // =======================================================================
        if (tripId) {
          try {
            // Fetch trip's itinerary_data to build previousDays
            const { data: tripItinData } = await supabase
              .from('trips')
              .select('itinerary_data')
              .eq('id', tripId)
              .single();

            const existingDays = (tripItinData?.itinerary_data as any)?.days || [];
            const previousDaysForValidation: StrictDayMinimal[] = existingDays
              .filter((d: any) => d.dayNumber !== dayNumber)
              .map((d: any) => ({
                dayNumber: d.dayNumber || 0,
                date: d.date || '',
                title: d.title || d.theme || '',
                theme: d.theme,
                activities: (d.activities || []).map((a: any) => ({
                  id: a.id || '',
                  title: a.title || a.name || '',
                  startTime: a.startTime || a.start_time || '',
                  endTime: a.endTime || a.end_time || '',
                  category: a.category || 'activity',
                  location: a.location || { name: '', address: '' },
                  cost: a.cost || a.estimatedCost || { amount: 0, currency: 'USD' },
                  description: a.description || '',
                  tags: a.tags || [],
                  bookingRequired: a.bookingRequired || false,
                  transportation: a.transportation || { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
                })),
              }));

            if (previousDaysForValidation.length > 0) {
              const isFirstDay = dayNumber === 1;
              const isLastDay = dayNumber === totalDays;
              const mustDoList = (paramMustDoActivities || '').split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);

              // Build the current day in StrictDayMinimal format
              const currentDayForValidation: StrictDayMinimal = {
                dayNumber,
                date: date || '',
                title: generatedDay.title || '',
                theme: generatedDay.theme,
                activities: (generatedDay.activities || []).map((a: any) => ({
                  id: a.id || '',
                  title: a.title || a.name || '',
                  startTime: a.startTime || '',
                  endTime: a.endTime || '',
                  category: a.category || 'activity',
                  location: a.location || { name: '', address: '' },
                  cost: a.cost || a.estimatedCost || { amount: 0, currency: 'USD' },
                  description: a.description || '',
                  tags: a.tags || [],
                  bookingRequired: a.bookingRequired || false,
                  transportation: a.transportation || { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
                })),
              };

              const dayValidation = validateGeneratedDay(
                currentDayForValidation,
                dayNumber,
                isFirstDay,
                isLastDay,
                totalDays,
                previousDaysForValidation,
                false, // not smart finish
                mustDoList
              );

              if (dayValidation.errors.length > 0) {
                console.warn(`[generate-day] Trip-wide validation errors for Day ${dayNumber}:`, dayValidation.errors);

                // Strip duplicates found by validation instead of full retry
                // Remove activities flagged as MEAL REPEAT or TRIP-WIDE DUPLICATE
                const duplicateTitles: string[] = [];
                for (const err of dayValidation.errors) {
                  // Extract activity title from error messages like 'MEAL REPEAT: "Restaurant X" on Day 3...'
                  // or 'TRIP-WIDE DUPLICATE: "Activity Y" is too similar to...'
                  const titleMatch = err.match(/(?:MEAL REPEAT|TRIP-WIDE DUPLICATE|CONCEPT SIMILARITY):\s*"([^"]+)"/i);
                  if (titleMatch) {
                    duplicateTitles.push(titleMatch[1].toLowerCase());
                  }
                }

                if (duplicateTitles.length > 0) {
                  const beforeCount = generatedDay.activities.length;
                  generatedDay.activities = generatedDay.activities.filter((act: any) => {
                    const actTitle = (act.title || '').toLowerCase();
                    const isDupe = duplicateTitles.some(dt => actTitle.includes(dt) || dt.includes(actTitle));
                    if (isDupe) {
                      // Don't remove locked activities
                      if (act.isLocked) return true;
                      console.log(`[generate-day] 🗑️ Removing duplicate activity "${act.title}" (matched trip-wide validation)`);
                      return false;
                    }
                    return true;
                  });
                  const removedCount = beforeCount - generatedDay.activities.length;
                  if (removedCount > 0) {
                    console.log(`[generate-day] ✓ Stripped ${removedCount} trip-wide duplicate activities from Day ${dayNumber}`);
                    normalizedActivities = generatedDay.activities;
                  }
                }
              }

              if (dayValidation.warnings.length > 0) {
                console.log(`[generate-day] Trip-wide validation warnings for Day ${dayNumber}:`, dayValidation.warnings);
              }
            }
          } catch (validationErr) {
            console.warn('[generate-day] Trip-wide duplicate validation failed (non-blocking):', validationErr);
          }
        }

        // =======================================================================
        // PERSONALIZATION VALIDATION: Check avoid-list & dietary violations
        // Ported from generate-full Stage 2 — ensures per-day quality bar
        // =======================================================================
        if (tripId && profile) {
          try {
            const userPrefsForVal = userId ? await getUserPreferences(supabase, userId) : null;
            const budgetIntentForVal = deriveBudgetIntent(
              effectiveBudgetTier,
              profile.traitScores.budget,
              profile.traitScores.comfort
            );
            
            const tripIntentsForVal = profile.tripIntents || [];
            const valContext = buildValidationContext(
              userPrefsForVal || {},
              budgetIntentForVal,
              profile.traitScores,
              tripIntentsForVal
            );
            
            // Override with unified profile data for accuracy
            if (profile.dietaryRestrictions.length > 0) {
              valContext.dietaryRestrictions = profile.dietaryRestrictions;
            }
            if (profile.avoidList.length > 0) {
              valContext.avoidList = [...valContext.avoidList, ...profile.avoidList];
            }
            
            const personalizationResult = validateItineraryPersonalization(
              [{ ...generatedDay, activities: normalizedActivities }] as StrictDay[],
              valContext
            );
            
            if (personalizationResult.violations.length > 0) {
              const criticalViolations = personalizationResult.violations.filter(v => v.severity === 'critical');
              console.warn(`[generate-day] Personalization validation: ${personalizationResult.violations.length} violations (${criticalViolations.length} critical), score=${personalizationResult.personalizationScore}/100`);
              
              // Strip activities with critical avoid-list or dietary violations
              if (criticalViolations.length > 0) {
                const criticalActivityIds = new Set(criticalViolations.map(v => v.activityId).filter(Boolean));
                if (criticalActivityIds.size > 0) {
                  const beforeCount = generatedDay.activities.length;
                  generatedDay.activities = generatedDay.activities.filter((act: any) => {
                    if (act.isLocked) return true;
                    if (criticalActivityIds.has(act.id)) {
                      console.log(`[generate-day] 🚫 Removing "${act.title}" — critical personalization violation`);
                      return false;
                    }
                    return true;
                  });
                  normalizedActivities = generatedDay.activities;
                  const removedCount = beforeCount - generatedDay.activities.length;
                  if (removedCount > 0) {
                    console.log(`[generate-day] ✓ Stripped ${removedCount} activities with critical personalization violations`);
                  }
                }
              }
            } else {
              console.log(`[generate-day] ✓ Personalization validation passed (score=${personalizationResult.personalizationScore}/100)`);
            }
          } catch (persValErr) {
            console.warn('[generate-day] Personalization validation failed (non-blocking):', persValErr);
          }
        }

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

              // 2) Insert external-id based activities (newly generated)
              // NOTE: We use delete-then-insert instead of upsert because there is no
              // unique constraint on (trip_id, itinerary_day_id, external_id), which
              // caused 42P10 errors and silently dropped activities.
              let persistedExternal: Array<{ id: string; external_id: string | null; is_locked: boolean | null }> = [];
              if (externalRows.length > 0) {
                // First, delete existing non-locked external-id activities for this day
                // so we can cleanly insert the new set
                const externalIds = externalRows
                  .map((r: any) => r.external_id)
                  .filter(Boolean);
                
                if (externalIds.length > 0 && itineraryDayId) {
                  await supabase
                    .from('itinerary_activities')
                    .delete()
                    .eq('trip_id', tripId)
                    .eq('itinerary_day_id', itineraryDayId)
                    .eq('is_locked', false)
                    .in('external_id', externalIds);
                }

                // Also clean up any orphan non-locked activities for this day
                // that don't have UUIDs (leftover from previous failed inserts)
                if (itineraryDayId) {
                  const keepUuids = uuidRows.map((r: any) => r.id);
                  if (keepUuids.length > 0) {
                    await supabase
                      .from('itinerary_activities')
                      .delete()
                      .eq('trip_id', tripId)
                      .eq('itinerary_day_id', itineraryDayId)
                      .eq('is_locked', false)
                      .not('id', 'in', `(${keepUuids.join(',')})`);
                  }
                }

                // Now insert fresh rows
                const { data, error: extErr } = await supabase
                  .from('itinerary_activities')
                  .insert(externalRows)
                  .select('id, external_id, is_locked');
                if (extErr) {
                  console.error('[generate-day] Failed to insert external-id activities:', extErr);
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
            // Build DNA snapshot for this generation version
            const versionDnaSnapshot = profile ? {
              archetype: profile.archetype,
              secondaryArchetype: profile.secondaryArchetype,
              archetypeSource: profile.archetypeSource,
              traitScores: profile.traitScores,
              budgetTier: profile.budgetTier,
              dataCompleteness: profile.dataCompleteness,
              isFallback: profile.isFallback,
              snapshotAt: new Date().toISOString(),
            } : null;

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
                  isTransitionDay: resolvedIsTransitionDay || undefined,
                  transitionFrom: resolvedTransitionFrom || undefined,
                  transitionTo: resolvedTransitionTo || undefined,
                  transportType: resolvedTransportMode || undefined,
                  city: resolvedDestination || undefined,
                },
                created_by_action: action === 'regenerate-day' ? 'regenerate' : 'generate',
                dna_snapshot: versionDnaSnapshot,
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

        // =====================================================================
        // POST-GENERATION: Validate must-do items for this day (logging only)
        // =====================================================================
        if (mustDoActivities && mustDoActivities.trim()) {
          try {
            const forceAllMust = !!isSmartFinish || !!smartFinishRequested;
            const dayMustDos = parseMustDoInput(mustDoActivities, destination, forceAllMust, preferences?.startDate || date?.split('T')[0], totalDays)
              .filter(m => m.priority === 'must');

            if (dayMustDos.length > 0) {
              const dayForValidation = [{
                dayNumber,
                activities: (normalizedActivities || []).map((a: any) => ({ title: a.title || a.name || '' })),
              }];
              const dayValidation = validateMustDosInItinerary(dayForValidation, dayMustDos);

              if (dayValidation.missing.length > 0) {
                console.warn(`[generate-day] ⚠️ Day ${dayNumber} missing must-do items: ${dayValidation.missing.map(m => m.activityName).join(', ')}`);
              } else if (dayValidation.found.length > 0) {
                console.log(`[generate-day] ✓ Day ${dayNumber} must-do validation passed (${dayValidation.found.length} found)`);
              }
            }
          } catch (valErr) {
            console.warn('[generate-day] Must-do validation error (non-blocking):', valErr);
          }
        }

        // =====================================================================
        // POST-GENERATION: Guarantee Hotel Check-in (mirrors Stage 2.56)
        // If this is Day 1 or a multi-city transition day, ensure check-in exists
        // =====================================================================
        const normalizedActivities2 = generatedDay?.activities || [];
        const needsCheckInGuarantee = dayNumber === 1 || resolvedIsTransitionDay;

        if (needsCheckInGuarantee && normalizedActivities2.length > 0) {
          const hasCheckIn = normalizedActivities2.some((a: any) => {
            const t = (a.title || a.name || '').toLowerCase();
            const cat = (a.category || '').toLowerCase();
            return (
              cat === 'accommodation' && (
                t.includes('check-in') || t.includes('check in') ||
                t.includes('checkin') || t.includes('settle in') ||
                t.includes('refresh') || t.includes('hotel')
              )
            );
          });

          if (!hasCheckIn) {
            // Resolve hotel name: multi-city first, then flightContext
            let hotelName = flightContext.hotelName || 'Hotel';
            let hotelAddress = flightContext.hotelAddress || '';

            // For multi-city, try to load hotel from trip_cities
            if (tripId && resolvedIsMultiCity) {
              try {
                const { data: tripCitiesForHotel } = await supabase
                  .from('trip_cities')
                  .select('city_name, hotel_selection, city_order, nights, days_total')
                  .eq('trip_id', tripId)
                  .order('city_order', { ascending: true });

                if (tripCitiesForHotel && tripCitiesForHotel.length > 0) {
                  let dc = 0;
                  for (const city of tripCitiesForHotel) {
                    const cityNights = (city as any).nights || (city as any).days_total || 1;
                    for (let n = 0; n < cityNights; n++) {
                      dc++;
                      if (dc === dayNumber) {
                        const rawHotel = city.hotel_selection as any;
                        const cityHotel = Array.isArray(rawHotel) && rawHotel.length > 0 ? rawHotel[0] : rawHotel;
                        if (cityHotel?.name) hotelName = cityHotel.name;
                        if (cityHotel?.address) hotelAddress = cityHotel.address;
                        break;
                      }
                    }
                    if (dc >= dayNumber) break;
                  }
                }
              } catch (e) {
                console.warn('[generate-day] Could not resolve multi-city hotel for check-in:', e);
              }
            }

            // Determine check-in time: 45 min before first activity, minimum 12:00
            const firstAct = normalizedActivities2[0];
            const firstStartMin = parseTimeToMinutes(firstAct?.startTime || '15:00') || (15 * 60);
            const checkInStartMin = Math.max(12 * 60, firstStartMin - 45);
            const checkInStart = minutesToHHMM(checkInStartMin);
            const checkInEnd = minutesToHHMM(checkInStartMin + 30);

            const checkInActivity = {
              id: `day${dayNumber}-checkin-regen-${Date.now()}`,
              title: dayNumber === 1 ? 'Hotel Check-in & Refresh' : `Hotel Check-in – ${resolvedDestination}`,
              name: dayNumber === 1 ? 'Hotel Check-in & Refresh' : `Hotel Check-in – ${resolvedDestination}`,
              description: dayNumber === 1
                ? 'Check in, freshen up, and get oriented to the area'
                : `Check in to hotel in ${resolvedDestination}, freshen up after travel`,
              startTime: checkInStart,
              endTime: checkInEnd,
              category: 'accommodation',
              type: 'accommodation',
              location: { name: hotelName, address: hotelAddress },
              cost: { amount: 0, currency: 'USD' },
              bookingRequired: false,
              isLocked: false,
              durationMinutes: 30,
            };

            normalizedActivities2.unshift(checkInActivity);
            generatedDay.activities = normalizedActivities2;
            console.log(`[generate-day] ✓ Injected missing Hotel Check-in at ${checkInStart}-${checkInEnd} (hotel: ${hotelName}) for Day ${dayNumber}`);
          } else {
            console.log(`[generate-day] Day ${dayNumber} already has check-in activity — no injection needed`);
          }
        }

        // =====================================================================
        // POST-GENERATION: Guarantee Hotel Checkout (mirrors check-in guarantee)
        // If this is the last day of the trip OR last day in a city, ensure checkout exists
        // =====================================================================
        const activitiesForCheckout = generatedDay?.activities || [];
        const needsCheckoutGuarantee = isLastDay || (paramIsLastDayInCity && !resolvedIsTransitionDay);

        if (needsCheckoutGuarantee && activitiesForCheckout.length > 0) {
          const hasCheckout = activitiesForCheckout.some((a: any) => {
            const t = (a.title || a.name || '').toLowerCase();
            const cat = (a.category || '').toLowerCase();
            return (
              cat === 'accommodation' && (
                t.includes('check-out') || t.includes('check out') ||
                t.includes('checkout')
              )
            );
          });

          if (!hasCheckout) {
            // Resolve hotel name
            let checkoutHotelName = paramHotelOverride?.name || flightContext.hotelName || 'Hotel';
            let checkoutHotelAddress = paramHotelOverride?.address || flightContext.hotelAddress || '';

            // For multi-city, try to load hotel from trip_cities (reuse same logic as check-in)
            if (tripId && resolvedIsMultiCity && checkoutHotelName === 'Hotel') {
              try {
                const { data: tripCitiesForCheckout } = await supabase
                  .from('trip_cities')
                  .select('city_name, hotel_selection, city_order, nights, days_total')
                  .eq('trip_id', tripId)
                  .order('city_order', { ascending: true });

                if (tripCitiesForCheckout && tripCitiesForCheckout.length > 0) {
                  let dc = 0;
                  for (const city of tripCitiesForCheckout) {
                    const cityNights = (city as any).nights || (city as any).days_total || 1;
                    for (let n = 0; n < cityNights; n++) {
                      dc++;
                      if (dc === dayNumber) {
                        const rawHotel = city.hotel_selection as any;
                        const cityHotel = Array.isArray(rawHotel) && rawHotel.length > 0 ? rawHotel[0] : rawHotel;
                        if (cityHotel?.name) checkoutHotelName = cityHotel.name;
                        if (cityHotel?.address) checkoutHotelAddress = cityHotel.address;
                        break;
                      }
                    }
                    if (dc >= dayNumber) break;
                  }
                }
              } catch (e) {
                console.warn('[generate-day] Could not resolve multi-city hotel for checkout:', e);
              }
            }

            // Determine checkout time
            let checkoutStartMin: number;
            const returnDep24 = flightContext.returnDepartureTime24 || (flightContext.returnDepartureTime ? normalizeTo24h(flightContext.returnDepartureTime) : null);
            const returnDepMins = returnDep24 ? (parseTimeToMinutes(returnDep24) ?? null) : null;
            if (isLastDay && returnDepMins !== null) {
              // 3.5 hours before flight, minimum 07:00
              checkoutStartMin = Math.max(7 * 60, returnDepMins - 210);
            } else {
              // Default: 11:00 AM for intermediate city departures or no-flight last day
              checkoutStartMin = 11 * 60;
            }

            const checkoutStart = minutesToHHMM(checkoutStartMin);
            const checkoutEnd = minutesToHHMM(checkoutStartMin + 30);

            const checkoutActivity = {
              id: `day${dayNumber}-checkout-guarantee-${Date.now()}`,
              title: `Hotel Checkout from ${checkoutHotelName}`,
              name: `Hotel Checkout from ${checkoutHotelName}`,
              description: isLastDay
                ? 'Check out, collect luggage, and prepare for departure.'
                : `Check out from ${checkoutHotelName}. Store luggage if needed before continuing your day.`,
              startTime: checkoutStart,
              endTime: checkoutEnd,
              category: 'accommodation',
              type: 'accommodation',
              location: { name: checkoutHotelName, address: checkoutHotelAddress },
              cost: { amount: 0, currency: 'USD' },
              bookingRequired: false,
              isLocked: false,
              durationMinutes: 30,
            };

            // Insert chronologically
            let insertIdx = activitiesForCheckout.length;
            for (let i = 0; i < activitiesForCheckout.length; i++) {
              const actStart = parseTimeToMinutes(activitiesForCheckout[i].startTime || '') ?? 99999;
              if (checkoutStartMin <= actStart) {
                insertIdx = i;
                break;
              }
            }
            activitiesForCheckout.splice(insertIdx, 0, checkoutActivity);
            generatedDay.activities = activitiesForCheckout;
            console.log(`[generate-day] ✓ Injected missing Hotel Checkout at ${checkoutStart}-${checkoutEnd} (hotel: ${checkoutHotelName}) for Day ${dayNumber}`);
          } else {
            console.log(`[generate-day] Day ${dayNumber} already has checkout activity — no injection needed`);
          }
        }

        // ====================================================================
        // DEPARTURE DAY SEQUENCE FIX (generate-day path):
        // If checkout exists AFTER airport transfer, swap them & re-anchor times
        // ====================================================================
        if (isLastDay && generatedDay.activities.length > 1) {
          const checkoutIdx = generatedDay.activities.findIndex((a: any) => {
            const t = (a.title || '').toLowerCase();
            return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
          });
          const airportIdx = generatedDay.activities.findIndex((a: any) => {
            const t = (a.title || '').toLowerCase();
            return (t.includes('airport') || t.includes('departure transfer')) &&
                   ((a.category || '').toLowerCase() === 'transport' || t.includes('transfer'));
          });

          if (checkoutIdx !== -1 && airportIdx !== -1 && checkoutIdx > airportIdx) {
            console.log(`[generate-day] Fixing departure sequence: checkout@${checkoutIdx} → before airport@${airportIdx}`);
            const checkoutAct = generatedDay.activities[checkoutIdx];
            const airportAct = generatedDay.activities[airportIdx];

            const checkoutDur = Math.max(5, ((parseTimeToMinutes(checkoutAct.endTime) ?? 0) - (parseTimeToMinutes(checkoutAct.startTime) ?? 0))) || 15;
            const transferDur = Math.max(10, ((parseTimeToMinutes(airportAct.endTime) ?? 0) - (parseTimeToMinutes(airportAct.startTime) ?? 0))) || 60;

            checkoutAct.startTime = airportAct.startTime;
            checkoutAct.endTime = addMinutesToHHMM(checkoutAct.startTime, checkoutDur);
            airportAct.startTime = checkoutAct.endTime;
            airportAct.endTime = addMinutesToHHMM(airportAct.startTime, transferDur);

            generatedDay.activities[airportIdx] = checkoutAct;
            generatedDay.activities[checkoutIdx] = airportAct;
            generatedDay.activities.sort((a: any, b: any) => {
              const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
              const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
              return ta - tb;
            });
          }
        }

        // ====================================================================
        // NON-FLIGHT DEPARTURE DAY: Strip airport activities (generate-day path)
        // ====================================================================
        if (paramIsLastDayInCity && !isLastDay && resolvedNextLegTransport && resolvedNextLegTransport !== 'flight') {
          const beforeCount = generatedDay.activities.length;
          generatedDay.activities = generatedDay.activities.filter((a: any) => {
            const t = (a.title || '').toLowerCase();
            const isAirportRef =
              t.includes('airport') ||
              t.includes('taxi to airport') ||
              t.includes('transfer to airport') ||
              t.includes('departure transfer to airport') ||
              t.includes('flight departure') ||
              t.includes('head to airport');
            return !isAirportRef;
          });
          const removed = beforeCount - generatedDay.activities.length;
          if (removed > 0) {
            console.log(`[generate-day] Day ${dayNumber}: Stripped ${removed} airport activities (next leg is ${resolvedNextLegTransport}, not flight)`);
          }
        }

        // ====================================================================
        if (allUserIdsForAttribution.length > 1 && generatedDay?.activities?.length) {
          let backfilledCount = 0;
          const transportCategories = ['transport', 'transit', 'transfer', 'transportation', 'flight', 'travel'];
          generatedDay.activities.forEach((act: any, idx: number) => {
            if (!act.suggestedFor) {
              const cat = (act.category || '').toLowerCase();
              if (transportCategories.includes(cat)) {
                // Transport is shared — assign all travelers
                act.suggestedFor = allUserIdsForAttribution.join(',');
              } else {
                // Round-robin assignment across travelers
                act.suggestedFor = allUserIdsForAttribution[idx % allUserIdsForAttribution.length];
              }
              backfilledCount++;
            }
          });
          if (backfilledCount > 0) {
            console.log(`[generate-day] ✓ Backfilled suggestedFor on ${backfilledCount}/${generatedDay.activities.length} activities for Day ${dayNumber}`);
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
          JSON.stringify({ success: false, error: "Day generation failed", code: "GENERATE_DAY_ERROR" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==========================================================================
    // EXTRACTED ACTIONS — Delegated to separate files for maintainability
    // Each handler receives an explicit ActionContext (no implicit scope leaking)
    // ==========================================================================
    if (action === 'get-trip') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleGetTrip(actCtx);
    }

    if (action === 'save-itinerary') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleSaveItinerary(actCtx);
    }

    if (action === 'get-itinerary') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleGetItinerary(actCtx);
    }

    if (action === 'toggle-activity-lock') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleToggleActivityLock(actCtx);
    }

    if (action === 'sync-itinerary-tables') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleSyncItineraryTables(actCtx);
    }

    if (action === 'repair-trip-costs') {
      const actCtx: ActionContext = { supabase, userId: authResult.userId, params };
      return handleRepairTripCosts(actCtx);
    }

    // ==========================================================================
    // ACTION: generate-trip — Server-side orchestrated day-by-day generation
    // The frontend calls this ONCE. The edge function sets status='generating',
    // returns immediately, and runs the day loop in the background via waitUntil.
    // Progress is saved to trips.itinerary_data after each day. On completion
    // status becomes 'ready'; on failure status becomes 'failed' and ungenerated
    // day credits are refunded server-side.
    // ==========================================================================
    if (action === 'generate-trip') {
      const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, isMultiCity, creditsCharged, requestedDays, resumeFromDay, isFirstTrip } = params;
      const userId = authResult.userId;

      if (!tripId || !destination || !startDate || !endDate) {
        return new Response(
          JSON.stringify({ error: "Missing required fields", code: "INVALID_INPUT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify trip access
      const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, true);
      if (!tripAccessResult.allowed) {
        return new Response(
          JSON.stringify({ error: tripAccessResult.reason || "Access denied", code: "FORBIDDEN" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Guard: prevent double generation if already in progress (not a resume)
      if (!resumeFromDay) {
        const { data: statusCheck } = await supabase.from('trips').select('itinerary_status, metadata').eq('id', tripId).single();
        if (statusCheck?.itinerary_status === 'generating') {
          const meta = (statusCheck.metadata as Record<string, unknown>) || {};
          const heartbeat = meta.generation_heartbeat ? new Date(meta.generation_heartbeat as string) : null;
          const staleThreshold = 5 * 60 * 1000; // 5 minutes
          const isStale = !heartbeat || (Date.now() - heartbeat.getTime() > staleThreshold);
          
          if (!isStale) {
            console.log(`[generate-trip] Trip ${tripId} already generating (heartbeat ${heartbeat?.toISOString()}), skipping duplicate`);
            return new Response(
              JSON.stringify({ success: true, status: 'already_generating', totalDays: (meta.generation_total_days as number) || 0 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.log(`[generate-trip] Trip ${tripId} has stale generation (heartbeat ${heartbeat?.toISOString()}), restarting`);
        }
      }

      // Calculate total days from canonical date span (inclusive end date).
      // This is the single source of truth — never override with sum of city days_total
      // because summing per-city inclusive counts double-counts transition days.
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      let totalDays = Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // If frontend provided requestedDays (e.g. from a resume with canonical count), honor it
      if (requestedDays && requestedDays > 0 && requestedDays !== totalDays) {
        console.log(`[generate-trip] Using requestedDays=${requestedDays} (date-based=${totalDays})`);
        totalDays = requestedDays;
      }

      // Log multi-city city-sum for diagnostics only (never override totalDays)
      if (isMultiCity) {
        try {
          const { data: tripCitiesForCount } = await supabase
            .from('trip_cities')
            .select('nights, days_total')
            .eq('trip_id', tripId);
          if (tripCitiesForCount && tripCitiesForCount.length > 0) {
            const sumDays = tripCitiesForCount.reduce((sum: number, c: any) => {
              const dt = (c as any).days_total;
              const n = (c as any).nights;
              return sum + (dt || ((n || 1) + 1));
            }, 0);
            if (sumDays !== totalDays) {
              console.log(`[generate-trip] Multi-city diagnostic: date-based totalDays=${totalDays}, city-days-sum=${sumDays} (using date-based)`);
            }
          }
        } catch (e) {
          console.warn('[generate-trip] Could not query trip_cities for diagnostics:', e);
        }
      }

      // Set status to generating + store metadata
      // CRITICAL: Clear itinerary_data.days when starting fresh (not resuming)
      // to prevent duplicate days from a previous failed/partial generation
      const { data: currentTrip } = await supabase.from('trips').select('metadata, itinerary_data').eq('id', tripId).single();
      const existingMeta = (currentTrip?.metadata as Record<string, unknown>) || {};
      const isResume = resumeFromDay && resumeFromDay > 1;
      
      // Generate a unique run ID to prevent stale invocations from overwriting data
      const generationRunId = crypto.randomUUID();
      
      const updatePayload: Record<string, unknown> = {
        itinerary_status: 'generating',
        metadata: {
          ...existingMeta,
          generation_started_at: new Date().toISOString(),
          generation_total_days: totalDays,
          generation_completed_days: isResume ? (resumeFromDay - 1) : 0,
          generation_error: null,
          generation_heartbeat: new Date().toISOString(),
          generation_run_id: generationRunId,
          chain_broken_at_day: null,
          chain_error: null,
        },
      };
      
      // If starting fresh (not resume), clear existing days to prevent duplicates
      if (!isResume) {
        const existingItData = (currentTrip?.itinerary_data as Record<string, unknown>) || {};
        updatePayload.itinerary_data = { ...existingItData, days: [], status: 'generating' };
        console.log(`[generate-trip] Clearing existing itinerary_data.days for fresh generation`);
        
        // Also clear normalized tables to prevent stale rows from poisoning self-heal logic
        try {
          // First get itinerary_days IDs to cascade-delete activities
          const { data: oldDays } = await supabase
            .from('itinerary_days')
            .select('id')
            .eq('trip_id', tripId);
          
          if (oldDays && oldDays.length > 0) {
            const oldDayIds = oldDays.map((d: any) => d.id);
            await supabase.from('itinerary_activities').delete().in('day_id', oldDayIds);
            await supabase.from('itinerary_days').delete().eq('trip_id', tripId);
            console.log(`[generate-trip] Cleared ${oldDays.length} stale itinerary_days rows for fresh generation`);
          }
        } catch (cleanupErr) {
          console.warn('[generate-trip] Failed to clear normalized tables:', cleanupErr);
        }
      }
      
      // =====================================================================
      // PRE-CHAIN ENRICHMENT: Compute once-per-trip context and store in metadata
      // This replaces the enrichment stages from generate-full (1.6-1.96)
      // Each generate-day call reads from generation_context instead of recomputing
      // =====================================================================
      if (!isResume) {
        console.log('[generate-trip] Computing generation_context enrichment...');
        const enrichmentContext: Record<string, unknown> = {};
        
        try {
          // 1. Load unified traveler profile
          const tripProfile = await loadTravelerProfile(supabase, userId, tripId, destination);
          enrichmentContext.archetype = tripProfile.archetype;
          enrichmentContext.traitScores = tripProfile.traitScores;
          enrichmentContext.budgetTier = tripProfile.budgetTier || budgetTier || 'moderate';
          enrichmentContext.dietaryRestrictions = tripProfile.dietaryRestrictions;
          enrichmentContext.avoidList = tripProfile.avoidList;
          enrichmentContext.interests = tripProfile.interests;
          enrichmentContext.mobilityNeeds = tripProfile.mobilityNeeds;
          console.log(`[generate-trip] Profile: archetype=${tripProfile.archetype}, completeness=${tripProfile.dataCompleteness}%`);
          
          // 2. Dietary enforcement prompt
          const dietaryPrompt = buildDietaryEnforcementPrompt(tripProfile.dietaryRestrictions);
          if (dietaryPrompt) {
            enrichmentContext.dietaryEnforcementPrompt = dietaryPrompt;
            console.log(`[generate-trip] Dietary enforcement built for ${tripProfile.dietaryRestrictions.length} restrictions`);
          }
          
          // 3. Jet lag assessment
          try {
            const { data: tripRow } = await supabase.from('trips').select('origin_city, flight_selection').eq('id', tripId).single();
            const originCity = tripRow?.origin_city || '';
            if (originCity && destination) {
              const originTz = resolveTimezone(originCity);
              const destTz = resolveTimezone(destination);
              if (originTz && destTz) {
                const jetLagImpact = calculateJetLagImpact(originTz, destTz);
                const jetLagPrompt = buildJetLagPrompt(jetLagImpact);
                if (jetLagPrompt) {
                  enrichmentContext.jetLagPrompt = jetLagPrompt;
                  console.log(`[generate-trip] Jet lag prompt built: ${jetLagImpact.hoursDifference}h difference`);
                }
              }
            }
          } catch (jlErr) {
            console.warn('[generate-trip] Jet lag calculation failed (non-blocking):', jlErr);
          }
          
          // 4. Weather backup prompt
          try {
            const season = determineSeason(startDate, destination);
            const weatherPrompt = buildWeatherBackupPrompt(destination, season);
            if (weatherPrompt) {
              enrichmentContext.weatherBackupPrompt = weatherPrompt;
              console.log(`[generate-trip] Weather backup prompt built for season: ${season}`);
            }
          } catch (wErr) {
            console.warn('[generate-trip] Weather prompt failed (non-blocking):', wErr);
          }
          
          // 5. Trip duration pacing
          try {
            const durationConfig = getTripDurationConfig(totalDays);
            const energies = calculateDayEnergies(totalDays, durationConfig);
            const durationPrompt = buildTripDurationPrompt(totalDays, durationConfig, energies);
            if (durationPrompt) {
              enrichmentContext.tripDurationPrompt = durationPrompt;
              console.log(`[generate-trip] Trip duration prompt built: ${totalDays} days, pattern=${durationConfig.pacingPattern}`);
            }
          } catch (tdErr) {
            console.warn('[generate-trip] Trip duration prompt failed (non-blocking):', tdErr);
          }
          
          // 6. Children ages
          try {
            const { data: tripForChildren } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
            const tripMeta = (tripForChildren?.metadata as Record<string, unknown>) || {};
            const childrenAges = (tripMeta.childrenAges as number[]) || [];
            if (childrenAges.length > 0) {
              const childrenAnalysis = analyzeChildrenAges(childrenAges);
              const childrenPrompt = buildChildrenAgesPrompt(childrenAnalysis);
              if (childrenPrompt) {
                enrichmentContext.childrenAgesPrompt = childrenPrompt;
                console.log(`[generate-trip] Children ages prompt built for ${childrenAges.length} children`);
              }
            }
          } catch (caErr) {
            console.warn('[generate-trip] Children ages prompt failed (non-blocking):', caErr);
          }
          
          // 7. Reservation urgency
          try {
            const reservationPrompt = buildReservationUrgencyPrompt(destination, startDate);
            if (reservationPrompt) {
              enrichmentContext.reservationUrgencyPrompt = reservationPrompt;
            }
          } catch (ruErr) {
            console.warn('[generate-trip] Reservation urgency failed (non-blocking):', ruErr);
          }
          
          // 8. Daily estimates prompt
          try {
            const dailyEstimatesPrompt = buildDailyEstimatesPrompt(budgetTier || 'standard');
            enrichmentContext.dailyEstimatesPrompt = dailyEstimatesPrompt;
          } catch {}
          
          // 9. Group archetype blending (for trips with collaborators)
          try {
            const [{ data: collabRows }, { data: memberRows }] = await Promise.all([
              supabase.from('trip_collaborators').select('user_id').eq('trip_id', tripId).eq('include_preferences', true),
              supabase.from('trip_members').select('user_id').eq('trip_id', tripId).not('user_id', 'is', null),
            ]);
            const participantIds = new Set<string>();
            (collabRows || []).forEach((c: any) => { if (c.user_id) participantIds.add(c.user_id); });
            (memberRows || []).forEach((m: any) => { if (m.user_id) participantIds.add(m.user_id); });
            participantIds.delete(userId);
            
            if (participantIds.size > 0) {
              const companionUserIds = Array.from(participantIds);
              const { data: companionDnaRows } = await supabase
                .from('travel_dna_profiles')
                .select('user_id, primary_archetype_name, trait_scores, travel_dna_v2')
                .in('user_id', companionUserIds);
              
              const { data: profileRows } = await supabase.from('profiles').select('id, display_name, handle').in('id', [userId, ...companionUserIds]);
              const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));
              
              // Build TravelerArchetype array
              const travelers: TravelerArchetype[] = [{ travelerId: userId, name: profileMap.get(userId) || 'You', archetype: tripProfile.archetype, isPrimary: true }];
              const companionTraitsList: Record<string, number>[] = [];
              
              for (const dna of (companionDnaRows || [])) {
                const archetype = dna.primary_archetype_name || (dna.travel_dna_v2 as any)?.primary_archetype_name || 'balanced_story_collector';
                travelers.push({ travelerId: dna.user_id, name: profileMap.get(dna.user_id) || 'Guest', archetype, isPrimary: false });
                const rawScores = dna.trait_scores || (dna.travel_dna_v2 as any)?.trait_scores || {};
                companionTraitsList.push({
                  pace: Number(rawScores.pace ?? 0), budget: Number(rawScores.budget ?? 0),
                  social: Number(rawScores.social ?? 0), planning: Number(rawScores.planning ?? 0),
                  comfort: Number(rawScores.comfort ?? 0), authenticity: Number(rawScores.authenticity ?? 0),
                  adventure: Number(rawScores.adventure ?? 0), cultural: Number(rawScores.cultural ?? 0),
                });
              }
              
              if (travelers.length > 1) {
                const blendResult = await blendGroupArchetypes(travelers, totalDays, destination);
                enrichmentContext.groupBlendingPrompt = blendResult.promptSection;
                
                // Compute blended trait scores
                const ownerWeight = 0.5;
                const companionWeight = companionTraitsList.length > 0 ? 0.5 / companionTraitsList.length : 0;
                const blendedTraits: Record<string, number> = {};
                const traitKeys = ['pace', 'budget', 'social', 'planning', 'comfort', 'authenticity', 'adventure', 'cultural'];
                for (const key of traitKeys) {
                  const ownerVal = (tripProfile.traitScores as any)[key] || 0;
                  const companionSum = companionTraitsList.reduce((sum, ct) => sum + (ct[key] || 0) * companionWeight, 0);
                  blendedTraits[key] = Math.round(ownerVal * ownerWeight + companionSum);
                }
                enrichmentContext.blendedTraitScores = blendedTraits;
                enrichmentContext.blendedDnaSnapshot = {
                  blendedTraits,
                  travelers: travelers.map(t => ({ userId: t.travelerId, name: t.name, archetype: t.archetype, weight: t.isPrimary ? ownerWeight : companionWeight, isPrimary: t.isPrimary })),
                  blendMethod: 'weighted_average',
                  generatedAt: new Date().toISOString(),
                };
                
                console.log(`[generate-trip] Group blending complete: ${travelers.length} travelers`);
              }
            }
          } catch (gbErr) {
            console.warn('[generate-trip] Group blending failed (non-blocking):', gbErr);
          }
          
          // 10. Past trip learnings
          try {
            const { data: learnings } = await supabase
              .from('trip_learnings')
              .select('destination, highlights, pain_points, pacing_feedback, discovered_likes, discovered_dislikes, lessons_summary')
              .eq('user_id', userId)
              .not('lessons_summary', 'is', null)
              .order('completed_at', { ascending: false })
              .limit(3);
            
            if (learnings && learnings.length > 0) {
              const sections: string[] = [];
              for (const l of learnings) {
                const parts: string[] = [];
                if (l.destination) parts.push(`Past trip to ${l.destination}:`);
                const highlights = l.highlights as Array<{ activity?: string; why?: string }> | null;
                if (highlights?.length) parts.push(`  ✓ Loved: ${highlights.slice(0, 2).map(h => `${h.activity || ''} (${h.why || ''})`).join(', ')}`);
                const painPoints = l.pain_points as Array<{ issue?: string; solution?: string }> | null;
                if (painPoints?.length) parts.push(`  ✗ Avoid: ${painPoints.slice(0, 2).map(p => `${p.issue || ''}${p.solution ? ` → ${p.solution}` : ''}`).join('; ')}`);
                if (l.lessons_summary) parts.push(`  📝 Key insight: ${l.lessons_summary}`);
                if (parts.length > 1) sections.push(parts.join('\n'));
              }
              if (sections.length > 0) {
                enrichmentContext.pastTripLearnings = `\n## 🔄 LEARNINGS FROM PAST TRIPS\n${sections.join('\n\n')}\n`;
                console.log(`[generate-trip] Loaded ${learnings.length} past trip learnings`);
              }
            }
          } catch (ptErr) {
            console.warn('[generate-trip] Past trip learnings failed (non-blocking):', ptErr);
          }
          
          // 11. Recently used activities for variety
          try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const destLower = destination.toLowerCase();
            const { data: recentTrips } = await supabase
              .from('trips')
              .select('destination, itinerary_data')
              .neq('id', tripId)
              .gte('created_at', thirtyDaysAgo)
              .not('itinerary_data', 'is', null)
              .limit(10);
            
            if (recentTrips?.length) {
              const names: string[] = [];
              for (const trip of recentTrips) {
                const tripDest = (trip.destination || '').toLowerCase();
                if (tripDest.includes(destLower) || destLower.includes(tripDest)) {
                  const itData = trip.itinerary_data as any;
                  for (const day of (itData?.days || [])) {
                    for (const act of (day.activities || [])) {
                      const n = act.title || act.name;
                      if (n && !names.includes(n)) names.push(n);
                    }
                  }
                }
              }
              if (names.length > 0) {
                enrichmentContext.recentlyUsedActivities = names.slice(0, 20);
                console.log(`[generate-trip] Found ${Math.min(names.length, 20)} recently used activities to avoid`);
              }
            }
          } catch (ruErr) {
            console.warn('[generate-trip] Recently used activities failed (non-blocking):', ruErr);
          }
          
          // 12. Forced personalization slots
          try {
            const userPrefsForSlots = userId ? await getUserPreferences(supabase, userId) : null;
            const slotTraits: Partial<TraitScores> = {
              planning: tripProfile.traitScores.planning ?? 0,
              social: tripProfile.traitScores.social ?? 0,
              comfort: tripProfile.traitScores.comfort ?? 0,
              pace: tripProfile.traitScores.pace ?? 0,
              authenticity: tripProfile.traitScores.authenticity ?? 0,
              adventure: tripProfile.traitScores.adventure ?? 0,
              budget: tripProfile.traitScores.budget ?? 0,
              transformation: 0,
            };
            const slotContext = {
              tripType: tripType || 'vacation',
              travelCompanions: userPrefsForSlots?.travel_companions || [],
              hasChildren: (travelers || 1) > 2,
              primaryArchetype: tripProfile.archetype,
              secondaryArchetype: undefined,
              celebrationDay: undefined,
            };
            const forcedSlots = deriveForcedSlots(slotTraits, tripProfile.interests, 1, totalDays, slotContext);
            if (forcedSlots.length > 0) {
              enrichmentContext.forcedSlotsPrompt = buildForcedSlotsPrompt(forcedSlots);
              console.log(`[generate-trip] ${forcedSlots.length} forced slots computed`);
            }
            
            const scheduleConstraints = deriveScheduleConstraints(slotTraits, tripProfile.mobilityNeeds);
            enrichmentContext.scheduleConstraintsPrompt = buildScheduleConstraintsPrompt(scheduleConstraints);
          } catch (fsErr) {
            console.warn('[generate-trip] Forced slots failed (non-blocking):', fsErr);
          }
          
          // Store blended DNA snapshot on trip record
          if (enrichmentContext.blendedDnaSnapshot) {
            try {
              await supabase.from('trips').update({ blended_dna_snapshot: enrichmentContext.blendedDnaSnapshot }).eq('id', tripId);
            } catch {}
          }
          
          console.log(`[generate-trip] Enrichment context computed with ${Object.keys(enrichmentContext).length} fields`);
        } catch (enrichErr) {
          console.warn('[generate-trip] Enrichment context computation failed (non-blocking):', enrichErr);
        }
        
        // Store generation_context in the update payload
        (updatePayload.metadata as Record<string, unknown>).generation_context = enrichmentContext;
      }
      
      await supabase.from('trips').update(updatePayload).eq('id', tripId);

      // Determine starting day (for resume support)
      const effectiveStartDay = resumeFromDay && resumeFromDay > 1 ? resumeFromDay : 1;

      // Fire the first day generation via self-chain (non-blocking)
      const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const initialChainBody = JSON.stringify({
        action: 'generate-trip-day',
        tripId,
        destination,
        destinationCountry,
        startDate,
        endDate,
        travelers: travelers || 1,
        tripType: tripType || 'vacation',
        budgetTier: budgetTier || 'moderate',
        userId,
        isMultiCity: isMultiCity || false,
        creditsCharged: creditsCharged || 0,
        requestedDays: requestedDays || totalDays,
        dayNumber: effectiveStartDay,
        totalDays,
        generationRunId,
        isFirstTrip: isFirstTrip || false,
      });

      // Retry loop with exponential backoff for intermittent 403 errors
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(generateUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: initialChainBody,
          });
          if (response.ok) break;
          const respText = await response.text().catch(() => '(no body)');
          console.error(`[generate-trip] Initial chain attempt ${attempt}/${maxRetries} returned ${response.status}: ${respText.slice(0, 200)}`);
          if (response.status >= 400 && response.status < 500) {
            console.error(`[generate-trip] Client error ${response.status} — not retrying`);
            break;
          }
        } catch (err) {
          console.error(`[generate-trip] Initial chain attempt ${attempt}/${maxRetries} error:`, err);
        }
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }

      // Return immediately — generation continues server-side via self-chaining
      return new Response(
        JSON.stringify({ success: true, status: 'generating', totalDays }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-trip-day — Generate a SINGLE day, then self-chain to next
    // Each invocation is its own short-lived function call (~60-90s max).
    // The chain continues server-side even if the user closes their browser.
    // ==========================================================================
    if (action === 'generate-trip-day') {
      const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, userId, isMultiCity, creditsCharged, requestedDays, dayNumber, totalDays, generationRunId, isFirstTrip } = params;

      if (!tripId || !dayNumber || !totalDays) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for day generation", code: "INVALID_INPUT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[generate-trip-day] Starting day ${dayNumber}/${totalDays} for trip ${tripId} (runId: ${generationRunId || 'none'})`);

      // Guard: check trip is still in "generating" state AND run ID matches (user might have cancelled or a new run started)
      const { data: tripCheck } = await supabase.from('trips').select('itinerary_status, metadata, itinerary_data').eq('id', tripId).single();
      if (!tripCheck || tripCheck.itinerary_status === 'cancelled' || tripCheck.itinerary_status === 'ready') {
        console.log(`[generate-trip-day] Trip ${tripId} status is ${tripCheck?.itinerary_status}, stopping chain`);
        return new Response(
          JSON.stringify({ status: tripCheck?.itinerary_status || 'cancelled', dayNumber }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Run ID idempotency guard: abort if a newer run has started
      if (generationRunId) {
        const tripMeta = (tripCheck.metadata as Record<string, unknown>) || {};
        const currentRunId = tripMeta.generation_run_id as string | undefined;
        if (currentRunId && currentRunId !== generationRunId) {
          console.log(`[generate-trip-day] Stale run detected: this=${generationRunId}, current=${currentRunId}. Aborting.`);
          return new Response(
            JSON.stringify({ status: 'stale_run', dayNumber, message: 'A newer generation run has started' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Resolve multi-city mapping
      let dayCityMap: Array<{ cityName: string; country?: string; isTransitionDay: boolean; transitionFrom?: string; transitionTo?: string; transportType?: string; hotelName?: string; hotelAddress?: string }> | null = null;
      if (isMultiCity) {
        try {
          const { data: tripCities } = await supabase
            .from('trip_cities')
            .select('city_name, country, city_order, nights, days_total, transition_day_mode, transport_type, hotel_selection')
            .eq('trip_id', tripId)
            .order('city_order', { ascending: true });

          if (tripCities && tripCities.length > 1) {
            const map: typeof dayCityMap = [];
            for (const city of tripCities) {
              const cityNights = (city as any).nights || (city as any).days_total || 1;
              for (let n = 0; n < cityNights; n++) {
                const isTransition = n === 0 && city.city_order > 0 && (city as any).transition_day_mode !== 'skip';
                const prevCity = city.city_order > 0 ? tripCities.find(c => c.city_order === city.city_order - 1) : null;
                // Extract per-city hotel data
                const rawHotel = (city as any).hotel_selection;
                const cityHotel = Array.isArray(rawHotel) && rawHotel.length > 0 ? rawHotel[0] : (rawHotel && typeof rawHotel === 'object' ? rawHotel : null);

                map.push({
                  cityName: city.city_name || destination,
                  country: (city as any).country || destinationCountry,
                  isTransitionDay: isTransition,
                  transitionFrom: isTransition ? prevCity?.city_name : undefined,
                  transitionTo: isTransition ? city.city_name : undefined,
                  transportType: isTransition ? (city.transport_type || undefined) : undefined,
                  hotelName: cityHotel?.name || cityHotel?.hotel_name || undefined,
                  hotelAddress: cityHotel?.address || undefined,
                });
              }
            }
            while (map.length < totalDays) map.push({ ...map[map.length - 1], isTransitionDay: false });
            dayCityMap = map.slice(0, totalDays);
          }
        } catch (e) {
          console.warn('[generate-trip-day] Could not load trip cities:', e);
        }
      }

      const cityInfo = dayCityMap?.[dayNumber - 1];

      // Load existing days from itinerary_data (for context)
      const existingData = (tripCheck.itinerary_data as any) || {};
      const existingDays: any[] = Array.isArray(existingData.days) ? existingData.days : [];
      const previousActivities: string[] = [];
      for (const day of existingDays) {
        if (day?.activities) {
          day.activities.forEach((act: any) => {
            previousActivities.push(act.title || act.name || '');
          });
        }
      }

      // Update heartbeat before generating (includes current city for multi-city progress)
      {
        const hbMeta = (tripCheck.metadata as Record<string, unknown>) || {};
        await supabase.from('trips').update({
          metadata: {
            ...hbMeta,
            generation_heartbeat: new Date().toISOString(),
            generation_current_day: dayNumber,
            generation_completed_days: dayNumber - 1,
            generation_total_days: totalDays,
            generation_current_city: cityInfo?.cityName || null,
          },
        }).eq('id', tripId);
      }

      // ─── PER-CITY STATUS: Mark city as 'generating' on first day ───
      if (isMultiCity && dayCityMap && cityInfo) {
        const prevCityInfo = dayNumber > 1 ? dayCityMap[dayNumber - 2] : null;
        if (!prevCityInfo || prevCityInfo.cityName !== cityInfo.cityName) {
          await supabase.from('trip_cities')
            .update({ generation_status: 'generating' } as any)
            .eq('trip_id', tripId)
            .eq('city_name', cityInfo.cityName);
          console.log(`[generate-trip-day] City "${cityInfo.cityName}" generation started`);
        }
      }

      // Generate this single day
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + dayNumber - 1);
      const formattedDate = dayDate.toISOString().split('T')[0];

      const MAX_RETRIES = 4;
      let dayResult: any = null;
      let lastError: string | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Call generate-day action internally
          const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;
          const resp = await fetch(generateUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              'apikey': Deno.env.get("SUPABASE_ANON_KEY") || '',
            },
            body: JSON.stringify({
              action: 'generate-day',
              tripId,
              dayNumber,
              totalDays,
              destination: cityInfo?.cityName || destination,
              destinationCountry: cityInfo?.country || destinationCountry,
              date: formattedDate,
              travelers: travelers || 1,
              tripType: tripType || 'vacation',
              budgetTier: budgetTier || 'moderate',
              userId,
              previousDayActivities: previousActivities,
              isMultiCity: isMultiCity || false,
              isTransitionDay: cityInfo?.isTransitionDay || false,
              transitionFrom: cityInfo?.transitionFrom,
              transitionTo: cityInfo?.transitionTo,
              transitionMode: cityInfo?.transportType,
              // Per-city hotel override for multi-city trips
              hotelOverride: cityInfo?.hotelName ? {
                name: cityInfo.hotelName,
                address: cityInfo.hotelAddress || '',
              } : undefined,
              isFirstDayInCity: cityInfo ? (dayNumber === 1 || dayCityMap![dayNumber - 2]?.cityName !== cityInfo.cityName) : false,
              isLastDayInCity: cityInfo ? (dayNumber === totalDays || (dayCityMap![dayNumber] && dayCityMap![dayNumber].cityName !== cityInfo.cityName)) : false,
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Day ${dayNumber} HTTP ${resp.status}: ${errText}`);
          }

          const data = await resp.json();
          if (data.error) throw new Error(data.error);
          if (!data.day) throw new Error(`No day data returned for day ${dayNumber}`);

          dayResult = data.day;
          break; // success
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[generate-trip-day] Day ${dayNumber} attempt ${attempt + 1} failed: ${msg}`);
          lastError = msg;
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
          }
        }
      }

      if (!dayResult) {
        // This day failed after all retries — mark as partial/failed
        console.error(`[generate-trip-day] Day ${dayNumber} failed permanently: ${lastError}`);
        
        const { data: failTrip } = await supabase.from('trips').select('metadata, unlocked_day_count').eq('id', tripId).single();
        const failMeta = (failTrip?.metadata as Record<string, unknown>) || {};
        const currentUnlocked = (failTrip as any)?.unlocked_day_count ?? 0;

        await supabase.from('trips').update({
          itinerary_status: existingDays.length > 0 ? 'partial' : 'failed',
          unlocked_day_count: Math.max(currentUnlocked, existingDays.length),
          metadata: {
            ...failMeta,
            generation_error: lastError || 'Generation failed',
            generation_failed_at: new Date().toISOString(),
            generation_failed_on_day: dayNumber,
            generation_completed_days: existingDays.length,
            generation_total_days: totalDays,
          },
        }).eq('id', tripId);

        // Server-side refund for ungenerated days
        const totalCharged = creditsCharged || 0;
        if (totalCharged > 0) {
          const effectiveTotalDays = requestedDays || totalDays;
          const creditsPerDay = Math.round(totalCharged / effectiveTotalDays);
          const ungenerated = Math.max(0, effectiveTotalDays - existingDays.length);
          const refundAmount = existingDays.length > 0 ? creditsPerDay * ungenerated : totalCharged;

          if (refundAmount > 0) {
            try {
              await supabase.from('credit_purchases').insert({
                user_id: userId,
                credit_type: 'refund',
                amount: refundAmount,
                remaining: refundAmount,
                source: 'system_refund',
                stripe_session_id: null,
              });

              await supabase.from('credit_ledger').insert({
                user_id: userId,
                transaction_type: 'refund',
                credits_delta: refundAmount,
                is_free_credit: false,
                action_type: 'refund',
                trip_id: tripId,
                notes: `Server-side refund: ${existingDays.length}/${effectiveTotalDays} days completed. +${refundAmount} credits restored.`,
                metadata: { reason: 'server_generation_failed', error: lastError },
              });

              // Sync balance cache
              const now = new Date().toISOString();
              const { data: purchases } = await supabase
                .from('credit_purchases')
                .select('remaining, credit_type, expires_at')
                .eq('user_id', userId)
                .gt('remaining', 0);

              let freeCredits = 0;
              let purchasedCredits = 0;
              for (const p of (purchases || [])) {
                if (p.expires_at && new Date(p.expires_at) < new Date()) continue;
                if (p.credit_type === 'free') {
                  freeCredits += p.remaining;
                } else {
                  purchasedCredits += p.remaining;
                }
              }

              await supabase.from('credit_balances').update({
                free_credits: freeCredits,
                purchased_credits: purchasedCredits,
                updated_at: now,
              }).eq('user_id', userId);

              console.log(`[generate-trip-day] Refunded ${refundAmount} credits for ${ungenerated} ungenerated days`);
            } catch (refundErr) {
              console.error(`[generate-trip-day] Refund failed:`, refundErr);
            }
          }
        }

        return new Response(
          JSON.stringify({ status: 'failed', dayNumber, error: lastError }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Day generated successfully — save it
      // CRITICAL: Replace any existing day with the same dayNumber to prevent duplicates
      // This handles retries, regeneration, and resume scenarios safely.
      const filteredExisting = existingDays.filter((d: any) => d?.dayNumber !== dayNumber);
      
      // === LAYER 1: HARD VALIDATION — deduplicate by date AND dayNumber ===
      const candidateDays = [...filteredExisting, dayResult];
      
      // Deduplicate by date — if two days share the same date, keep the one with more activities
      const byDate = new Map<string, any>();
      for (const d of candidateDays) {
        if (!d) continue;
        const dateKey = d.date || `day-${d.dayNumber}`;
        const existing = byDate.get(dateKey);
        if (!existing || (d.activities?.length || 0) >= (existing.activities?.length || 0)) {
          byDate.set(dateKey, d);
        } else {
          console.warn(`[generate-trip-day] Removing duplicate date ${dateKey} (kept version with ${existing.activities?.length || 0} activities)`);
        }
      }
      
      // Re-number sequentially by date order to ensure no gaps/repeats
      const updatedDays = Array.from(byDate.values())
        .sort((a: any, b: any) => {
          // Sort by date first, fallback to dayNumber
          const dateA = a.date ? new Date(a.date).getTime() : (a.dayNumber || 0);
          const dateB = b.date ? new Date(b.date).getTime() : (b.dayNumber || 0);
          return dateA - dateB;
        })
        .map((d: any, idx: number) => ({ ...d, dayNumber: idx + 1 }));
      
      if (updatedDays.length !== candidateDays.length) {
        console.warn(`[generate-trip-day] Day deduplication removed ${candidateDays.length - updatedDays.length} duplicate(s)`);
      }

      // ── NO-SHRINK GUARD (chain save) ──────────────────────────────────
      // After deduplication, ensure we never save fewer days than we started with.
      // Compare against BOTH in-memory existingDays AND canonical itinerary_days table count.
      let canonicalCount = existingDays.length;
      try {
        const { count: tableRowCount } = await supabase
          .from('itinerary_days')
          .select('id', { count: 'exact', head: true })
          .eq('trip_id', tripId);
        if (tableRowCount && tableRowCount > canonicalCount) {
          console.log(`[generate-trip-day] Canonical count elevated: JSON=${existingDays.length}, table=${tableRowCount}`);
          canonicalCount = tableRowCount;
        }
      } catch (e) {
        console.warn('[generate-trip-day] Could not query itinerary_days count:', e);
      }

      if (updatedDays.length < canonicalCount) {
        console.error(
          `[generate-trip-day] 🛡️ SHRINK BLOCKED in chain: updatedDays=${updatedDays.length} < canonical=${canonicalCount}. ` +
          `Falling back to existingDays + new day to prevent data loss.`
        );
        // Safe fallback: keep all existing days, replace only the current dayNumber
        const safeDays = existingDays
          .filter((d: any) => d?.dayNumber !== dayNumber)
          .concat([dayResult])
          .sort((a: any, b: any) => {
            const dateA = a.date ? new Date(a.date).getTime() : (a.dayNumber || 0);
            const dateB = b.date ? new Date(b.date).getTime() : (b.dayNumber || 0);
            return dateA - dateB;
          })
          .map((d: any, idx: number) => ({ ...d, dayNumber: idx + 1 }));
        updatedDays.length = 0;
        updatedDays.push(...safeDays);
      }

      // ── RUN ID CHECK BEFORE WRITE ──────────────────────────────────
      // Re-verify run ID is still current before persisting to prevent stale overwrites
      if (generationRunId) {
        const { data: preWriteTrip } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
        const preWriteMeta = (preWriteTrip?.metadata as Record<string, unknown>) || {};
        const currentRunId = preWriteMeta.generation_run_id as string | undefined;
        if (currentRunId && currentRunId !== generationRunId) {
          console.log(`[generate-trip-day] Stale run at write time: this=${generationRunId}, current=${currentRunId}. Aborting write.`);
          return new Response(
            JSON.stringify({ status: 'stale_run', dayNumber, message: 'A newer generation run has started' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const partialItinerary = {
        days: updatedDays,
        status: dayNumber >= totalDays ? 'ready' : 'generating',
        generatedAt: new Date().toISOString(),
      };

      // Progressive unlock: update unlocked_day_count = max(current, dayNumber)
      // For first trips, cap at 2 (FIRST_TRIP_FREE_DAYS) — remaining days unlock on purchase
      const { data: metaTrip } = await supabase.from('trips').select('metadata, unlocked_day_count').eq('id', tripId).single();
      const meta = (metaTrip?.metadata as Record<string, unknown>) || {};
      const currentUnlocked = (metaTrip as any)?.unlocked_day_count ?? 0;
      let newUnlocked = Math.max(currentUnlocked, dayNumber);
      if (isFirstTrip) {
        newUnlocked = Math.min(newUnlocked, 2); // FIRST_TRIP_FREE_DAYS
      }

      // === LAYER 4: Verify last day exists when generation is complete ===
      if (dayNumber >= totalDays && startDate && endDate) {
        const lastExpectedDate = endDate; // endDate is already YYYY-MM-DD
        const hasLastDay = updatedDays.some((d: any) => d.date === lastExpectedDate);
        if (!hasLastDay && updatedDays.length < totalDays) {
          console.warn(`[generate-trip-day] Last day (${lastExpectedDate}) missing — adding placeholder`);
          updatedDays.push({
            dayNumber: totalDays,
            date: lastExpectedDate,
            theme: 'Departure Day',
            description: 'Check out and head to the airport.',
            activities: [
              { id: `checkout-${totalDays}`, title: 'Hotel Checkout', category: 'accommodation', startTime: '10:00', endTime: '10:30', type: 'structural', timeBlockType: 'logistics' },
              { id: `transfer-${totalDays}`, title: 'Airport Transfer', category: 'transportation', startTime: '11:00', endTime: '12:00', type: 'structural', timeBlockType: 'logistics' },
              { id: `departure-${totalDays}`, title: 'Departure', category: 'transportation', startTime: '13:00', type: 'structural', timeBlockType: 'logistics' },
            ],
            status: 'placeholder',
          });
          // Re-sort and re-number after adding
          updatedDays.sort((a: any, b: any) => {
            const dateA = a.date ? new Date(a.date).getTime() : (a.dayNumber || 0);
            const dateB = b.date ? new Date(b.date).getTime() : (b.dayNumber || 0);
            return dateA - dateB;
          });
          updatedDays.forEach((d: any, idx: number) => { d.dayNumber = idx + 1; });
          // Update partialItinerary days reference
          partialItinerary.days = updatedDays;
        }
        
        // Final assertion: day count must match expected
        if (updatedDays.length !== totalDays) {
          console.error(`[generate-trip-day] ⚠️ Day count mismatch: got ${updatedDays.length}, expected ${totalDays}`);
        }
      }

      // ─── PER-CITY STATUS: Mark city as 'generated' on last day of each city ───
      if (isMultiCity && dayCityMap) {
        const currentCityInfo = dayCityMap[dayNumber - 1];
        const nextCityInfo = dayNumber < totalDays ? dayCityMap[dayNumber] : null;
        if (currentCityInfo && (!nextCityInfo || nextCityInfo.cityName !== currentCityInfo.cityName)) {
          await supabase.from('trip_cities')
            .update({ generation_status: 'generated' } as any)
            .eq('trip_id', tripId)
            .eq('city_name', currentCityInfo.cityName);
          console.log(`[generate-trip-day] City "${currentCityInfo.cityName}" generation complete`);
        }
      }

      if (dayNumber >= totalDays) {
        // All days complete — set status to ready
        await supabase.from('trips').update({
          itinerary_data: partialItinerary,
          itinerary_status: 'ready',
          unlocked_day_count: newUnlocked,
          metadata: {
            ...meta,
            generation_completed_days: totalDays,
            generation_completed_at: new Date().toISOString(),
            generation_heartbeat: new Date().toISOString(),
            generation_total_days: totalDays,
            generation_current_city: null,
            chain_broken_at_day: null,
            chain_error: null,
          },
        }).eq('id', tripId);

        console.log(`[generate-trip-day] ✅ Trip ${tripId} generation complete: ${totalDays} days`);

        // Trigger next journey leg if applicable
        await triggerNextJourneyLeg(supabase, tripId);

        return new Response(
          JSON.stringify({ status: 'complete', dayNumber, totalDays }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // More days remain — save progress and self-chain to next day
        const nextCityName = dayCityMap?.[dayNumber]?.cityName || null;
        await supabase.from('trips').update({
          itinerary_data: partialItinerary,
          unlocked_day_count: newUnlocked,
          metadata: {
            ...meta,
            generation_completed_days: dayNumber,
            generation_heartbeat: new Date().toISOString(),
            generation_total_days: totalDays,
            generation_current_city: nextCityName,
          },
        }).eq('id', tripId);

        console.log(`[generate-trip-day] Day ${dayNumber}/${totalDays} complete, chaining to day ${dayNumber + 1}`);

        // Fire-and-forget with retry: call ourselves for the next day
        // Uses SERVICE_ROLE_KEY so it's a server-to-server call independent of user session
        const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const chainBody = JSON.stringify({
          action: 'generate-trip-day',
          tripId,
          destination,
          destinationCountry,
          startDate,
          endDate,
          travelers,
          tripType,
          budgetTier,
          userId,
          isMultiCity,
          creditsCharged,
          requestedDays,
          dayNumber: dayNumber + 1,
          totalDays,
          generationRunId,
          isFirstTrip: isFirstTrip || false,
        });

        // Retry loop with exponential backoff for intermittent 403 errors
        const maxRetries = 3;
        let chainSuccess = false;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(generateUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: chainBody,
            });
            if (response.ok) {
              chainSuccess = true;
              break;
            }
            const respText = await response.text().catch(() => '(no body)');
            console.error(`[generate-trip-day] Chain attempt ${attempt}/${maxRetries} returned ${response.status}: ${respText.slice(0, 200)}`);
            if (response.status >= 400 && response.status < 500) {
              console.error(`[generate-trip-day] Client error ${response.status} — not retrying`);
              break;
            }
          } catch (err) {
            console.error(`[generate-trip-day] Chain attempt ${attempt}/${maxRetries} error:`, err);
          }
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
        if (!chainSuccess) {
          console.error(`[generate-trip-day] All ${maxRetries} chain attempts failed for day ${dayNumber + 1}`);

          // Update trip metadata so frontend knows chain broke
          try {
            const { data: currentTrip } = await supabase
              .from('trips')
              .select('metadata')
              .eq('id', tripId)
              .single();

            const currentMeta = (currentTrip?.metadata as Record<string, unknown>) || {};

            await supabase.from('trips').update({
              metadata: {
                ...currentMeta,
                chain_broken_at_day: dayNumber,
                chain_error: `Chain to day ${dayNumber + 1} failed after ${maxRetries} attempts`,
                generation_completed_days: dayNumber,
                generation_heartbeat: new Date().toISOString(),
              },
            }).eq('id', tripId);
          } catch (metaErr) {
            console.error('[generate-trip-day] Failed to update chain failure metadata:', metaErr);
          }
        }

        return new Response(
          JSON.stringify({ status: 'day_complete', dayNumber, totalDays, nextDay: dayNumber + 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-itinerary] Error:", error);

    // Best-effort: mark trip as failed so the frontend stops showing infinite spinner
    try {
      const failTripId = typeof params === 'object' && params?.tripId;
      if (failTripId && typeof supabase !== 'undefined') {
        await supabase.from('trips').update({ itinerary_status: 'failed' }).eq('id', failTripId);
        console.log(`[generate-itinerary] Marked trip ${failTripId} as failed`);
      }
    } catch (statusErr) {
      console.error("[generate-itinerary] Failed to set itinerary_status=failed:", statusErr);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Itinerary generation failed", code: "GENERATE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
