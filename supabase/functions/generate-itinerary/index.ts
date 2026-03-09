import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost, CostTracker } from "../_shared/cost-tracker.ts";

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

// =============================================================================
// DATE SANITIZATION — Strip non-ASCII chars that leak from CJK locale prompts
// =============================================================================
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sanitize a single date string: extract the YYYY-MM-DD portion and discard
 * any trailing garbage (e.g. Chinese characters like "控制").
 * Returns the cleaned date or the provided fallback.
 */
function sanitizeDateString(raw: unknown, fallback?: string): string {
  if (typeof raw !== 'string') return fallback || '';
  // Try to extract a valid YYYY-MM-DD from anywhere in the string
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (match && DATE_REGEX.test(match[0])) return match[0];
  if (fallback && DATE_REGEX.test(fallback)) return fallback;
  console.warn(`[sanitizeDateString] Could not extract valid date from: "${raw}"`);
  return fallback || '';
}

/**
 * Recursively walk a parsed AI response object and sanitize any field whose
 * key contains "date" (case-insensitive) so it strictly matches YYYY-MM-DD.
 */
/**
 * Strip isOption/optionGroup fields from AI response and deduplicate
 * activities that share an optionGroup (keep only the first per group).
 * This is a safety net — the prompt and schema already forbid these fields,
 * but if the AI leaks them we strip them here before DB save or render.
 */
function sanitizeOptionFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle the top-level day object with an activities array
  if (Array.isArray(obj.activities)) {
    const seenGroups = new Set<string>();
    obj.activities = obj.activities.filter((act: any) => {
      if (act && typeof act === 'object') {
        // If it has an optionGroup, keep only the first in each group
        if (act.optionGroup) {
          if (seenGroups.has(act.optionGroup)) return false;
          seenGroups.add(act.optionGroup);
        }
        // Strip the fields
        delete act.isOption;
        delete act.optionGroup;
      }
      return true;
    });
  }

  // Also handle arrays of days (full itinerary responses)
  if (Array.isArray(obj.days)) {
    for (const day of obj.days) {
      sanitizeOptionFields(day);
    }
  }

  return obj;
}

// =============================================================================
// DEEP TEXT SANITIZATION — Strip CJK artifacts & schema-leak fragments from AI text
// Applied to all generated day/activity string fields before save or return
// =============================================================================
const CJK_ARTIFACTS = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F]+/g;
const TEXT_SCHEMA_LEAK = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay)\s*[:;|]\s*[^,;|]*/gi;

function sanitizeAITextField(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(CJK_ARTIFACTS, '')
    .replace(TEXT_SCHEMA_LEAK, '')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;|:\s-]+|[,;|:\s-]+$/g, '')
    .trim();
}

/**
 * Deep-sanitize all user-facing text fields in a generated day object.
 * Strips CJK characters, schema-leak fragments, and garbled text.
 */
function sanitizeGeneratedDay(day: any, dayNumber: number): any {
  if (!day || typeof day !== 'object') return day;

  // Sanitize day-level text fields
  const cleanTitle = sanitizeAITextField(day.title);
  const cleanTheme = sanitizeAITextField(day.theme);
  day.title = cleanTitle || cleanTheme || `Day ${dayNumber}`;
  day.theme = cleanTheme || cleanTitle || day.title;

  // Sanitize day narrative
  if (day.narrative && typeof day.narrative === 'object') {
    if (day.narrative.theme) day.narrative.theme = sanitizeAITextField(day.narrative.theme) || day.theme;
    if (Array.isArray(day.narrative.highlights)) {
      day.narrative.highlights = day.narrative.highlights
        .map((h: string) => sanitizeAITextField(h))
        .filter((h: string) => h.length > 0);
    }
  }

  // Sanitize accommodationNotes and practicalTips arrays
  if (Array.isArray(day.accommodationNotes)) {
    day.accommodationNotes = day.accommodationNotes
      .map((n: string) => sanitizeAITextField(n))
      .filter((n: string) => n.length > 0);
  }
  if (Array.isArray(day.practicalTips)) {
    day.practicalTips = day.practicalTips
      .map((t: string) => sanitizeAITextField(t))
      .filter((t: string) => t.length > 0);
  }

  // Sanitize each activity's text fields
  if (Array.isArray(day.activities)) {
    day.activities = day.activities.map((act: any, idx: number) => {
      if (!act || typeof act !== 'object') return act;
      const cleanActTitle = sanitizeAITextField(act.title);
      const cleanActName = sanitizeAITextField(act.name);
      act.title = cleanActTitle || cleanActName || `Activity ${idx + 1}`;
      act.name = act.title;
      if (act.description) act.description = sanitizeAITextField(act.description) || undefined;
      if (typeof act.tips === 'string') act.tips = sanitizeAITextField(act.tips) || undefined;
      if (act.location && typeof act.location === 'object') {
        if (act.location.name) act.location.name = sanitizeAITextField(act.location.name) || act.location.name;
        if (act.location.address) act.location.address = sanitizeAITextField(act.location.address) || act.location.address;
      }
      if (act.transportation && typeof act.transportation === 'object') {
        if (act.transportation.instructions) act.transportation.instructions = sanitizeAITextField(act.transportation.instructions) || undefined;
        // Walking is always free — override any AI-hallucinated cost
        const method = (act.transportation.method || '').toLowerCase();
        if (method === 'walk' || method === 'walking') {
          act.transportation.estimatedCost = { amount: 0, currency: act.transportation.estimatedCost?.currency || 'USD' };
        }
      }
      if (act.voyanceInsight) act.voyanceInsight = sanitizeAITextField(act.voyanceInsight) || undefined;
      if (act.bestTime) act.bestTime = sanitizeAITextField(act.bestTime) || undefined;
      if (act.personalization && typeof act.personalization === 'object') {
        if (act.personalization.whyThisFits) act.personalization.whyThisFits = sanitizeAITextField(act.personalization.whyThisFits) || undefined;
      }
      return act;
    });
  }

  return day;
}

function sanitizeDateFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDateFields);
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string' && /date/i.test(key)) {
        const cleaned = sanitizeDateString(obj[key]);
        if (cleaned !== obj[key]) {
          console.warn(`[sanitizeDateFields] Cleaned "${key}": "${obj[key]}" → "${cleaned}"`);
          obj[key] = cleaned;
        }
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeDateFields(obj[key]);
      }
    }
  }
  return obj;
}

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

// =============================================================================
// CURRENCY CONVERSION - Normalize all costs to USD
// Exchange rates relative to USD (1 USD = X units of local currency)
// =============================================================================
const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CHF: 0.88,
  CAD: 1.36,
  AUD: 1.53,
  NZD: 1.64,
  CNY: 7.24,
  HKD: 7.82,
  SGD: 1.34,
  THB: 35.8,
  MXN: 17.2,
  BRL: 4.97,
  INR: 83.1,
  KRW: 1320,
  ZAR: 18.9,
  SEK: 10.45,
  NOK: 10.62,
  DKK: 6.87,
  PLN: 4.02,
  CZK: 23.1,
  HUF: 358,
  ILS: 3.65,
  AED: 3.67,
  TRY: 30.5,
  PHP: 55.8,
  IDR: 15650,
  MYR: 4.72,
  VND: 24500,
  TWD: 31.5,
  ARS: 850,
  COP: 3950,
  PEN: 3.72,
  EGP: 30.9,
  MAD: 10.1,
  QAR: 3.64,
  SAR: 3.75,
  KWD: 0.31,
  BHD: 0.377,
  OMR: 0.385,
  JOD: 0.71,
};

/**
 * Convert an amount from any currency to USD
 * This ensures all stored costs are normalized to USD for consistent display/comparison
 */
function convertToUSD(amount: number, sourceCurrency: string): number {
  if (!sourceCurrency || sourceCurrency.toUpperCase() === 'USD') {
    return amount;
  }
  const rate = EXCHANGE_RATES_TO_USD[sourceCurrency.toUpperCase()];
  if (!rate || rate === 0) {
    console.log(`[convertToUSD] Unknown currency ${sourceCurrency}, assuming USD`);
    return amount; // Fallback: assume already USD if rate not found
  }
  const converted = Math.round(amount / rate * 100) / 100; // Round to 2 decimal places
  console.log(`[convertToUSD] ${amount} ${sourceCurrency} -> ${converted} USD (rate: ${rate})`);
  return converted;
}

/**
 * Normalize cost to USD - handles both cost and estimatedCost fields
 */
function normalizeCostToUSD(cost: { amount: number; currency?: string } | undefined): { amount: number; currency: string } {
  if (!cost) {
    return { amount: 0, currency: 'USD' };
  }
  const currency = cost.currency || 'USD';
  const amountInUSD = convertToUSD(cost.amount, currency);
  return { 
    amount: amountInUSD, 
    currency: 'USD',
  };
}

// =============================================================================
// INTELLIGENCE FIELD DERIVATION
// If the AI doesn't set intelligence fields, derive them from text content
// =============================================================================
const TIMING_KW = ['before the crowds','avoid the rush','golden hour','sunrise','early morning','before tour buses','less crowded','off-peak','before it gets busy','at dusk','at dawn','at sunset','arrive early','beat the','ahead of'];
const GEM_KW = ['hidden','secret','locals only','off the beaten','lesser-known','under the radar','undiscovered','tucked away','neighborhood favorite','local favorite','insider','like a local','curated','unique find','zero tourists','nobody knows','local haunt','local institution'];
const NON_GEM_CAT = ['transport','accommodation','downtime','free_time','logistics'];

function deriveIntelligenceFields(act: any): any {
  const text = `${act.description || ''} ${act.tips || ''} ${act.personalization?.whyThisFits || ''} ${act.voyanceInsight || ''}`.toLowerCase();
  const category = (act.category || '').toLowerCase();

  // Derive isHiddenGem if not explicitly set
  if (act.isHiddenGem == null) {
    act.isHiddenGem = !NON_GEM_CAT.includes(category) && GEM_KW.some(kw => text.includes(kw));
  }

  // Derive hasTimingHack if not explicitly set
  if (act.hasTimingHack == null) {
    act.hasTimingHack = TIMING_KW.some(kw => text.includes(kw));
  }

  // Derive crowdLevel from description if not set
  if (!act.crowdLevel) {
    if (text.includes('crowded') || text.includes('busy') || text.includes('popular') || text.includes('lines') || text.includes('queue')) {
      act.crowdLevel = 'high';
    } else if (text.includes('quiet') || text.includes('peaceful') || text.includes('uncrowded') || text.includes('serene') || text.includes('zero tourists')) {
      act.crowdLevel = 'low';
    } else {
      act.crowdLevel = 'moderate';
    }
  }

  // Ensure tips has substance (>30 chars) — promote description snippet if tips is empty
  if (!act.tips || act.tips.length < 30) {
    const desc = act.description || '';
    if (desc.length > 40) {
      act.tips = desc.length > 120 ? desc.substring(0, 120) + '…' : desc;
    }
  }

  return act;
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
  mustDoActivities?: string[];
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
 * Detect activities that are multi-day events and SHOULD repeat across days.
 * These are exempt from trip-wide deduplication.
 */
function isRecurringEvent(activity: { title?: string; description?: string; duration?: number; isAllDay?: boolean }, userActivities: string[] = []): boolean {
  const title = (activity.title || '').toLowerCase();
  const desc = (activity.description || '').toLowerCase();
  const combined = `${title} ${desc}`;

  // Logistical activities are NEVER recurring events, even if they mention one
  // "Airport Transfer to U.S. Open" is a transfer, not a recurring event
  const logisticalPattern = /\b(transfer|transit|taxi|uber|rideshare|check.?in|check.?out|airport|depart|arrival|shuttle|car service|pick.?up|drop.?off)\b/i;
  if (logisticalPattern.test(title)) {
    return false;
  }

  const sportingEvents = [
    'us open', 'u.s. open', 'wimbledon', 'french open', 'australian open',
    'world cup', 'olympics', 'olympic games', 'formula 1', 'f1 grand prix',
    'tour de france', 'masters tournament', 'super bowl week',
    'world series', 'nba finals', 'stanley cup', 'ryder cup',
    'cricket world cup', 'rugby world cup', 'copa america',
  ];

  const festivals = [
    'coachella', 'glastonbury', 'burning man', 'tomorrowland', 'lollapalooza',
    'bonnaroo', 'primavera sound', 'reading festival', 'leeds festival',
    'mardi gras', 'carnival', 'oktoberfest', 'day of the dead', 'dia de los muertos',
    'diwali', 'holi', 'chinese new year', 'lunar new year', 'la tomatina',
    'rio carnival', 'venice carnival', 'edinburgh fringe', 'cannes film festival',
    'sundance', 'sxsw', 'art basel', 'comic-con', 'comic con',
    'fashion week', 'film festival', 'music festival', 'food festival',
  ];

  for (const event of [...sportingEvents, ...festivals]) {
    if (combined.includes(event)) return true;
  }

  for (const userAct of userActivities) {
    const userActLower = userAct.toLowerCase().trim();
    if (userActLower.length > 3 && (title.includes(userActLower) || userActLower.includes(title.substring(0, 20)))) {
      return true;
    }
  }

  if (activity.isAllDay) return true;
  if (activity.duration && activity.duration >= 300) return true;

  return false;
}


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
interface SkippedItem {
  name: string;
  reason: string;
  preferredAlternative?: string;
  keywords?: string[]; // Keywords to steer away from these spots
}

const DESTINATION_ALTERNATIVES: Record<string, SkippedItem[]> = {
  paris: [
    {
      name: 'Seine dinner cruises',
      reason: 'A sunset walk along the Seine with wine is more authentically Parisian',
      preferredAlternative: 'Seine-side picnic at sunset',
      keywords: ['seine cruise', 'river cruise', 'bateaux', 'boat cruise', 'dinner cruise', 'sunset cruise on seine']
    },
    {
      name: 'Champs-Élysées restaurants',
      reason: 'Le Marais and Canal Saint-Martin have far better dining',
      preferredAlternative: 'Le Marais or Canal Saint-Martin restaurants',
      keywords: ['champs-elysees restaurant', 'champs elysees dining']
    },
    {
      name: 'Montmartre portrait artists',
      reason: 'Explore Montmartre\'s galleries and cafés instead',
      preferredAlternative: 'Montmartre gallery walk',
      keywords: ['montmartre portrait', 'place du tertre artists']
    }
  ],
  tokyo: [
    {
      name: 'Robot Restaurant',
      reason: 'Golden Gai bars offer authentic Tokyo nightlife',
      preferredAlternative: 'Golden Gai bars in Shinjuku',
      keywords: ['robot restaurant', 'robot show']
    },
    {
      name: 'Tokyo Skytree',
      reason: 'Shibuya Sky offers equally stunning views with shorter waits',
      preferredAlternative: 'Shibuya Sky or Tokyo Tower at sunset',
      keywords: ['skytree observation', 'tokyo skytree']
    }
  ],
  rome: [
    {
      name: 'Piazza Navona restaurants',
      reason: 'Testaccio and Jewish Ghetto have Rome\'s best trattorias',
      preferredAlternative: 'Testaccio or Jewish Ghetto trattorias',
      keywords: ['piazza navona dining', 'navona restaurants']
    },
    {
      name: 'Via Veneto restaurants',
      reason: 'Trastevere has more authentic Roman dining',
      preferredAlternative: 'Trastevere trattorias',
      keywords: ['via veneto restaurant']
    }
  ],
  london: [
    {
      name: 'Leicester Square restaurants',
      reason: 'Borough Market and Soho side streets are where Londoners eat',
      preferredAlternative: 'Borough Market or Soho side streets',
      keywords: ['leicester square dining', 'leicester square restaurant']
    },
    {
      name: 'Hard Rock Cafe London',
      reason: 'Explore London\'s incredible independent restaurant scene instead',
      preferredAlternative: 'Independent restaurants in Shoreditch or Brixton',
      keywords: ['hard rock cafe']
    }
  ],
  barcelona: [
    {
      name: 'La Rambla restaurants',
      reason: 'El Born and Gràcia have Barcelona\'s best tapas bars',
      preferredAlternative: 'El Born or Gràcia tapas bars',
      keywords: ['rambla restaurant', 'las ramblas dining']
    },
    {
      name: 'Barceloneta beachfront restaurants',
      reason: 'Local seafood restaurants in El Poblenou are far better',
      preferredAlternative: 'El Poblenou seafood restaurants',
      keywords: ['barceloneta restaurant', 'beach paella']
    }
  ]
};

function buildSkipListPrompt(destination: string): string {
  const cityKey = destination.toLowerCase();
  const matchedCity = Object.keys(DESTINATION_ALTERNATIVES).find(key => 
    cityKey.includes(key) || key.includes(cityKey)
  );
  
  if (!matchedCity) {
    return '';
  }
  
  const altList = DESTINATION_ALTERNATIVES[matchedCity];
  if (!altList || altList.length === 0) {
    return '';
  }
  
  const preferItems = altList.map(item => {
    const keywords = item.keywords ? ` (steer away from: ${item.keywords.join(', ')})` : '';
    const alt = item.preferredAlternative ? ` → PREFER: ${item.preferredAlternative}` : '';
    return `  ✦ Instead of ${item.name}${keywords} — ${item.reason}${alt}`;
  }).join('\n');
  
  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                    LOCAL INSIDER ALTERNATIVES                         ║
╚═══════════════════════════════════════════════════════════════════════╝

IMPORTANT: Prefer these local-favorite alternatives over commonly visited spots.
We highlight these insider picks in our "Better Alternatives" section.
Using the preferred alternatives reinforces trust in our recommendations.

${preferItems}

GUIDANCE:
- If a celebration/birthday suggests a "cruise" → suggest a WALKING tour along the Seine, rooftop bar, or picnic instead
- If the user wants river views → recommend Pont Alexandre III at sunset, a riverside café, or Île Saint-Louis stroll
- Prefer the listed alternatives over the commonly visited spots above
`;
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

/** Convert structured generation rules into a prompt section */
function formatGenerationRules(rules: Array<{type: string; days?: string[]; from?: string; to?: string; reason?: string; date?: string; description?: string; hotelName?: string; additionalGuests?: number; note?: string; text?: string}>): string {
  if (!rules || rules.length === 0) return '';
  const dayMap: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const lines: string[] = ['\n## 🚨 RULES THE ITINERARY MUST FOLLOW\n', 'The traveler has set the following constraints. These are NON-NEGOTIABLE.\n'];
  rules.forEach((rule, i) => {
    const num = i + 1;
    switch (rule.type) {
      case 'blocked_time': {
        const dayNames = (rule.days || []).map(d => dayMap[d] || d).join(', ');
        lines.push(`${num}. BLOCKED TIME: On ${dayNames}, do NOT schedule any activities between ${rule.from} and ${rule.to}.${rule.reason ? ` Reason: ${rule.reason}.` : ''} Leave these hours completely free.`);
        break;
      }
      case 'special_event':
        lines.push(`${num}. SPECIAL EVENT on ${rule.date}: ${rule.description}. Adjust the day's plan accordingly.`);
        break;
      case 'hotel_change':
        lines.push(`${num}. HOTEL CHANGE on ${rule.date}: The traveler is changing hotels${rule.hotelName ? ` to ${rule.hotelName}` : ''}.${rule.note ? ` ${rule.note}.` : ''} Plan check-out from old hotel and check-in at new hotel.`);
        break;
      case 'guest_change': {
        const direction = (rule.additionalGuests || 0) > 0 ? 'joining' : 'leaving';
        const count = Math.abs(rule.additionalGuests || 0);
        lines.push(`${num}. GROUP CHANGE on ${rule.date}: ${count} traveler${count !== 1 ? 's' : ''} ${direction}.${rule.note ? ` (${rule.note})` : ''} From this date onward, plan for the new group size.`);
        break;
      }
      case 'free_text':
        lines.push(`${num}. USER CONSTRAINT: ${rule.text}`);
        break;
    }
  });
  lines.push('\nIMPORTANT: If ANY activity conflicts with the above rules, remove or reschedule it.\n');
  return lines.join('\n');
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
      'birthday': { comfort: 3, social: 2 },                   // Celebratory, social, special treatment
      'anniversary': { comfort: 4, social: -2, pace: -2 },     // Romantic celebration, intimate, relaxed
      'celebration': { comfort: 3, social: 2 },                // Festive, social, memorable
      'milestone': { comfort: 3, transformation: 2 },          // Special occasion, meaningful experiences
      'bachelorette': { social: 4, adventure: 2, pace: 2 },    // Party, group fun, high energy
      'bachelor': { social: 4, adventure: 3, pace: 2 },        // Party, adventure, high energy
      'graduation': { comfort: 2, social: 2, transformation: 2 }, // Celebratory milestone
      'retirement': { pace: -2, comfort: 3, transformation: 2 }, // Relaxed, meaningful
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
      'slow': -6, 'relaxed': -3, 'balanced': 0, 'moderate': 0, 'active': 4, 'packed': 7
    };
    if (paceMap[tripContext.pace] !== undefined) {
      const tripPace = paceMap[tripContext.pace];
      // Trip-level pacing is an explicit user choice — weight it heavily (80/20)
      const oldPace = blendedTraits.pace;
      blendedTraits.pace = Math.round((blendedTraits.pace * 0.2 + tripPace * 0.8) * 10) / 10;
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
        'birthday': '🎂 Birthday celebration: special experiences, celebratory dinners, memorable moments, treat-yourself activities',
        'anniversary': '💝 Anniversary trip: romantic celebration, special dinners, intimate experiences, milestone moments',
        'celebration': '🎉 Celebration trip: festive activities, special occasions, memorable experiences',
        'milestone': '🏆 Milestone trip: meaningful experiences, bucket-list activities, significant moments',
        'bachelorette': '👯‍♀️ Bachelorette party: group fun, nightlife, bonding activities, celebration',
        'bachelor': '🎊 Bachelor party: adventure, nightlife, group activities, celebration',
        'graduation': '🎓 Graduation trip: celebratory, reward experiences, new chapter adventures',
        'retirement': '🌅 Retirement celebration: relaxed pace, bucket-list experiences, meaningful moments',
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
    // Get collaborators linked to this trip who have include_preferences enabled
    const { data: collaborators, error: collabError } = await supabase
      .from('trip_collaborators')
      .select('user_id, include_preferences')
      .eq('trip_id', tripId)
      .eq('include_preferences', true); // Only include if flag is true

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
  rawFlightIntelligence?: unknown;
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

async function getFlightHotelContext(supabase: any, tripId: string): Promise<FlightHotelContextResult> {
  console.log(`[FlightHotel] ============ CHECKING FLIGHT & HOTEL DATA ============`);
  console.log(`[FlightHotel] Trip ID: ${tripId}`);
  
  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('flight_selection, hotel_selection, is_multi_city, flight_intelligence')
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

      // --- FLIGHT INTELLIGENCE OVERRIDE ---
      // If flight_intelligence has destinationSchedule, use its times instead.
      // This handles layover connections: e.g. ATL→MAD(layover)→PMI uses PMI arrival, not MAD.
      const flightIntel = trip.flight_intelligence as Record<string, unknown> | null;
      if (flightIntel) {
        const schedule = (flightIntel.destinationSchedule || flightIntel.destination_schedule) as Array<Record<string, unknown>> | undefined;
        if (schedule && Array.isArray(schedule)) {
          const firstDest = schedule.find((d: any) => d.isFirstDestination || d.is_first_destination);
          if (firstDest?.availableFrom || (firstDest as any)?.available_from) {
            const intelAvailable = ((firstDest.availableFrom || (firstDest as any).available_from) as string);
            const intelTime = intelAvailable.includes('T') ? intelAvailable.split('T')[1]?.substring(0, 5) : intelAvailable;
            if (intelTime) {
              const normalized = normalizeTo24h(intelTime);
              if (normalized) {
                earliestFirstActivity = normalized;
                // Extract actual arrival time from arrivalDatetime, NOT availableFrom
                const arrivalDt = (firstDest.arrivalDatetime || (firstDest as any).arrival_datetime) as string | null;
                if (arrivalDt?.includes('T')) {
                  const actualTime = arrivalDt.split('T')[1]?.substring(0, 5);
                  if (actualTime) {
                    const actualNormalized = normalizeTo24h(actualTime);
                    if (actualNormalized) {
                      arrivalTime24 = actualNormalized;
                      arrivalTimeStr = actualTime;
                    }
                  }
                }
                // Ensure minimum 4-hour buffer from actual arrival (generation engine standard)
                if (arrivalTime24) {
                  const arrivalMins = parseTimeToMinutes(arrivalTime24) || 0;
                  const earliestMins = parseTimeToMinutes(earliestFirstActivity) || 0;
                  const minEarliest = arrivalMins + 240; // 4 hours
                  if (earliestMins < minEarliest) {
                    earliestFirstActivity = minutesToHHMM(minEarliest);
                  }
                }
                console.log(`[FlightContext] ✈️ OVERRIDDEN by flight intelligence: arrival=${arrivalTime24}, earliest=${earliestFirstActivity}`);
              }
            }
          }
          // Override last destination departure
          const lastDest = schedule.find((d: any) => d.isLastDestination || d.is_last_destination);
          if (lastDest?.availableUntil || (lastDest as any)?.available_until) {
            const intelUntil = ((lastDest.availableUntil || (lastDest as any).available_until) as string);
            const untilTime = intelUntil.includes('T') ? intelUntil.split('T')[1]?.substring(0, 5) : intelUntil;
            if (untilTime) {
              const normalized = normalizeTo24h(untilTime);
              if (normalized) {
                latestLastActivity = normalized;
                console.log(`[FlightContext] ✈️ Last day OVERRIDDEN by intelligence: latest=${latestLastActivity}`);
              }
            }
          }
        }
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
    let splitStayHotels: Array<HotelInfo & { checkInDate?: string; checkOutDate?: string }> = [];
    
    // Handle array format (multi-hotel support / split stays)
    if (Array.isArray(hotelRaw) && hotelRaw.length > 0) {
      // Check if this is a split stay (multiple hotels with dates)
      if (hotelRaw.length > 1 && hotelRaw.some((h: any) => h.checkInDate)) {
        splitStayHotels = hotelRaw as Array<HotelInfo & { checkInDate?: string; checkOutDate?: string }>;
        hotel = hotelRaw[0] as HotelInfo; // primary for fallback
        console.log(`[FlightHotel] Split stay detected: ${splitStayHotels.length} hotels`);
        
        // Build per-hotel schedule for the prompt
        const hotelSchedule = splitStayHotels.map((h: any, i: number) => {
          const accomType = h.accommodationType || 'hotel';
          const accomEmoji = accomType === 'airbnb' ? '🏠' : accomType === 'rental' ? '🏡' : accomType === 'hostel' ? '🛏️' : '🏨';
          return `  ${i + 1}. ${accomEmoji} ${h.name}${h.address ? ` — ${h.address}` : ''}${h.neighborhood ? ` (${h.neighborhood})` : ''}\n     Check-in: ${h.checkInDate || 'trip start'} | Check-out: ${h.checkOutDate || 'trip end'}${h.checkInTime ? ` | Time: ${h.checkInTime}` : ''}`;
        }).join('\n');
        
        sections.push(`\n${'='.repeat(40)}\n🏨 SPLIT STAY — MULTIPLE ACCOMMODATIONS\n${'='.repeat(40)}\nThis traveler is doing a SPLIT STAY with ${splitStayHotels.length} different accommodations:\n${hotelSchedule}\n\n⚠️ CRITICAL SPLIT STAY RULES:\n• Each day MUST use the correct hotel based on the date ranges above.\n• On hotel transition days: start from the outgoing hotel, check out, then check in to the new hotel.\n• Activities should be clustered near the hotel that is active for that day.\n• Day 1 of each new hotel should include check-in logistics.\n• The last day at each hotel should include check-out before the transition.`);
      } else {
        // Single hotel in array format
        hotel = hotelRaw[0] as HotelInfo;
        hotelName = (hotel as any)?.name || '';
        hotelAddress = (hotel as any)?.address || '';
        console.log(`[FlightHotel] Parsed hotel from array: ${hotel?.name || 'No name'}`);
      }
    } else if (hotelRaw && typeof hotelRaw === 'object' && !Array.isArray(hotelRaw)) {
      // Legacy single object format
      hotel = hotelRaw as HotelInfo;
      console.log(`[FlightHotel] Parsed hotel from legacy object: ${hotel?.name || 'No name'}`);
    }
    
    // Multi-city fallback: read from trip_cities if trips.hotel_selection is empty
    if (!hotel && trip.is_multi_city) {
      try {
        const { data: tripCities } = await supabase
          .from('trip_cities')
          .select('city_name, hotel_selection')
          .eq('trip_id', tripId)
          .order('city_order', { ascending: true });
        
        if (tripCities && tripCities.length > 0) {
          // hotel_selection in trip_cities can be an array [{name:...}] or an object {name:...}
          const extractHotel = (hs: any): any | null => {
            if (Array.isArray(hs) && hs.length > 0) return hs[0];
            if (hs && typeof hs === 'object' && hs.name) return hs;
            return null;
          };
          const citiesWithHotels = tripCities
            .map((c: any) => ({ ...c, _hotel: extractHotel(c.hotel_selection) }))
            .filter((c: any) => c._hotel?.name);
          if (citiesWithHotels.length > 0) {
            // Use first city's hotel as primary context
            hotel = citiesWithHotels[0]._hotel as HotelInfo;
            console.log(`[FlightHotel] Parsed hotel from trip_cities (${citiesWithHotels[0].city_name}): ${hotel?.name || 'No name'}`);
            
            // Add multi-hotel summary if multiple cities have hotels
            if (citiesWithHotels.length > 1) {
              const hotelSummary = citiesWithHotels.map((c: any) => 
                `• ${c.city_name}: ${c._hotel.name}${c._hotel.address ? ` (${c._hotel.address})` : ''}`
              ).join('\n');
              sections.push(`\n${'='.repeat(40)}\n🏨 PER-CITY ACCOMMODATIONS\n${'='.repeat(40)}\n${hotelSummary}\n⚠️ Each city has its own hotel. Use the correct hotel as the daily base for that city's days.`);
            }
          }
        }
      } catch (e) {
        console.warn(`[FlightHotel] Failed to read trip_cities hotels:`, e);
      }
    }
    
    // For non-split-stay single hotels, add standard hotel context
    if (hotel && splitStayHotels.length === 0) {
      const hotelInfo: string[] = [];
      const accomType = hotel.accommodationType || 'hotel';
      const accomEmoji = accomType === 'airbnb' ? '🏠' : accomType === 'rental' ? '🏡' : accomType === 'hostel' ? '🛏️' : '🏨';
      const accomLabel = accomType === 'airbnb' ? 'Airbnb' : accomType === 'rental' ? 'Vacation Rental' : accomType === 'hostel' ? 'Hostel' : 'Hotel';
      if (hotel.name) {
        hotelInfo.push(`${accomEmoji} ${accomLabel}: ${hotel.name}`);
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
        sections.push(`\n${'='.repeat(40)}\n${accomEmoji} ACCOMMODATION — ${accomLabel.toUpperCase()} (Use as daily starting/ending point)\n${'='.repeat(40)}\n${hotelInfo.join('\n')}\n⚠️ Start each day from the ${accomLabel.toLowerCase()} area and end nearby for easy return.\n⚠️ CRITICAL: Day 1 activities must NOT begin before check-in is complete. Standard check-in is 3:00 PM - do not schedule sightseeing before this unless arrival is very early.`);
      }
    } else if (!hotel) {
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
      rawFlightIntelligence: trip.flight_intelligence,
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
        active_hours_per_day,
        allergies
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
    
    // (ai_assistance_level column removed — column does not exist in schema)
    
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
   → No back-to-back activities - allow 30+ min REST buffers AFTER travel time
   → Prioritize quality over quantity
   → TRAVEL TIME IS SEPARATE: Add realistic travel/transit time (15-45 min depending on distance) BETWEEN activities, then add rest buffer ON TOP`,
        'balanced': `BALANCED PACE:
   → 5-6 activities per day (including meals)
   → Include at least one 1-hour downtime block
   → TRAVEL TIME IS SEPARATE from rest buffers: Add realistic travel time (15-30 min for nearby, 30-60 min for cross-city) BETWEEN activities, plus 10-15 min settling buffer
   → If two activities are in different neighborhoods, the gap should be 30-60 min, NOT 15 min
   → A 15-min gap is ONLY acceptable for activities within walking distance of each other`,
        'active': `ACTIVE PACE:
   → Can handle 7-8 activities per day
   → Minimal downtime needed - keep them moving
   → Pack the day with experiences
   → Still account for realistic travel time between locations (10-30 min minimum depending on distance)`,
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
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a travel personalization expert. Create rich, detailed traveler profiles that help AI itinerary generators deeply understand each traveler." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
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
  // Timezone-safe: parse as local dates to avoid UTC off-by-one
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  // Inclusive end-date: last day IS an activity day (March 7-9 = 3 days)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
          const cityHotel = city.hotel_selection as Record<string, unknown> | null;
          const hotelName = cityHotel?.name as string | undefined;
          const hotelAddress = cityHotel?.address as string | undefined;
          const hotelNeighborhood = (cityHotel?.neighborhood as string) || hotelAddress;
          
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

// Day validation result
interface DayValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Validate a single generated day for quality and correctness
function validateGeneratedDay(day: StrictDay, dayNumber: number, isFirstDay: boolean, isLastDay: boolean, totalDays: number, previousDays: StrictDay[] = [], isSmartFinish: boolean = false): DayValidationResult {
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
    // One contains the other — but NOT if one is clearly a meal context
    // e.g. "old town san diego" (from "Old Town San Diego at Lunch") vs "old town san diego state historic park"
    // These are different activity types (dining vs sightseeing)
    const mealKeywords = ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'cafe', 'dessert', 'snack', 'food', 'eat', 'meal', 'drinks', 'cocktail', 'bar'];
    const aHasMeal = mealKeywords.some(kw => a.includes(kw));
    const bHasMeal = mealKeywords.some(kw => b.includes(kw));
    if (aHasMeal !== bHasMeal) return false; // one is meal, the other isn't — not duplicates
    
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
    const logisticsKeywords = ['check-in', 'checkout', 'check-out', 'check in', 'check out', 'arrival', 'departure', 'transfer', 'free time', 'at leisure', 'leisure time', 'downtime', 'rest', 'relax at hotel', 'explore on your own', 'personal time'];
    const transportLikeKeywords = ['rideshare', 'uber', 'lyft', 'taxi', 'metro', 'subway', 'tram', 'bus', 'train', 'ferry', 'flight'];
    const isLogistics = logisticsKeywords.some(kw => (act.title || '').toLowerCase().includes(kw)) ||
                        ['transport', 'accommodation', 'downtime', 'free_time'].includes(act.category?.toLowerCase() || '');

    const isTransportLikeActivity = (activity: StrictActivity): boolean => {
      const title = normalizeText(activity.title || '');
      const category = normalizeText(activity.category || '');
      return (
        category.includes('transport') ||
        category.includes('transit') ||
        transportLikeKeywords.some((kw) => title.includes(kw))
      );
    };
    
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
      const currIsTransportLike = isTransportLikeActivity(act);
      const prevIsTransportLike = isTransportLikeActivity(prevAct);
      
      // Use hoisted extractConcept function
      const currConcept = extractConcept(currTitle);
      const prevConcept = extractConcept(prevTitle);
      
      // Transport/logistics adjacency is expected in real itineraries (e.g. rideshare -> venue)
      if (!currIsTransportLike && !prevIsTransportLike && conceptSimilarity(currConcept, prevConcept)) {
        if (isSmartFinish) {
          // In Smart Finish, user anchors may cluster around neighborhoods — downgrade to warning
          warnings.push(`Activities ${i} and ${i + 1} are similar: "${prevAct.title}" followed by "${act.title}" - consider adding variety`);
        } else {
          errors.push(`Activities ${i} and ${i + 1} are too similar: "${prevAct.title}" followed by "${act.title}" - AVOID duplicate concepts back-to-back`);
        }
      }

      // HARD GUARD: back-to-back culinary classes/workshops (even if titles differ)
      const prevType = getExperienceType(prevAct);
      const currType = getExperienceType(act);
      if (prevType === 'culinary_class' && currType === 'culinary_class') {
        errors.push(`Back-to-back culinary classes are not allowed: "${prevAct.title}" followed by "${act.title}"`);
      }
      
      // Check for same meal type back-to-back (e.g., two breakfast spots, two dinner restaurants)
      const specificMealCategories = ['breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'];
      const currMealType = specificMealCategories.find(m => currTitle.includes(m) || (act.category || '').toLowerCase().includes(m));
      const prevMealType = specificMealCategories.find(m => prevTitle.includes(m) || (prevAct.category || '').toLowerCase().includes(m));
      const currIsGenericDining = !currMealType && (act.category || '').toLowerCase().includes('dining');
      const prevIsGenericDining = !prevMealType && (prevAct.category || '').toLowerCase().includes('dining');

      if (!currIsTransportLike && !prevIsTransportLike && currMealType && prevMealType && currMealType === prevMealType) {
        errors.push(`Activities ${i} and ${i + 1} are both "${currMealType}" meals - NEVER schedule two ${currMealType} spots back-to-back`);
      } else if (!currIsTransportLike && !prevIsTransportLike && currIsGenericDining && prevIsGenericDining) {
        warnings.push(`Activities ${i} and ${i + 1} are both dining entries - consider more variety`);
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
    // Logistical/downtime patterns are excluded from duplicate checks entirely
    const LOGISTICAL_PATTERNS = /\b(free time|relax|reset|freshen|check.?in|check.?out|transfer|transit|break|settle|unpack|pack|depart|arrival|airport|taxi|uber|rideshare|metro|bus|train)\b/i;

    for (const act of day.activities) {
      const actConcept = extractConcept(normalizeText(act.title || ''));
      const actType = getExperienceType(act);
      const actTitle = (act.title || '').toLowerCase();
      
      // Skip logistics/dining/accommodation - those can repeat (transfers, check-ins, meals, etc.)
      if (actType === 'transport' || actType === 'accommodation' || actType === 'dining') {
        continue;
      }
      
      // Skip logistical/downtime activities from trip-wide duplicate checks
      if (LOGISTICAL_PATTERNS.test(actTitle)) {
        continue;
      }

      // Trip-wide concept similarity:
      // In Smart Finish mode, ALL duplicates are warnings only — we're building fresh from user research
      // In normal mode, culinary_class and wine_tasting are hard errors; everything else is a warning
      for (const prevConcept of previousConcepts) {
        if (conceptSimilarity(actConcept, prevConcept)) {
          // Skip dedup for recurring events (US Open, festivals, etc.)
          if (isRecurringEvent(act, [])) {
            continue;
          }
          if (!isSmartFinish && (actType === 'culinary_class' || actType === 'wine_tasting')) {
            errors.push(`TRIP-WIDE DUPLICATE: "${act.title}" is too similar to an activity from a previous day.`);
          } else {
            warnings.push(`Trip-wide similarity: "${act.title}" resembles a previous day's activity. Consider more variety.`);
          }
          break;
        }
      }
      
      // Culinary classes/workshops: ONCE per trip (warning-only in Smart Finish)
      if (actType === 'culinary_class' && (previousExperienceTypes['culinary_class'] || 0) >= 1) {
        if (isSmartFinish) {
          warnings.push(`Trip already has a culinary class — consider variety.`);
        } else {
          errors.push(`TRIP-WIDE LIMIT: A culinary class/workshop was already scheduled on a previous day. Only ONE culinary class/workshop is allowed per ENTIRE TRIP.`);
        }
      }
      
      // Wine tastings: ONCE per trip (warning-only in Smart Finish)
      if (actType === 'wine_tasting' && (previousExperienceTypes['wine_tasting'] || 0) >= 1) {
        if (isSmartFinish) {
          warnings.push(`Trip already has a wine tasting — consider variety.`);
        } else {
          errors.push(`TRIP-WIDE LIMIT: A wine tasting was already scheduled on a previous day. Only ONE wine tasting is allowed per ENTIRE TRIP.`);
        }
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

    // Enforce sequence: checkout must occur before airport transfer / departure transport
    const checkoutAct = day.activities?.find(a => {
      const t = (a.title || '').toLowerCase();
      return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
    });
    const airportAct = day.activities?.find(a => {
      const t = (a.title || '').toLowerCase();
      const isAirportish = t.includes('airport') || t.includes('departure transfer');
      const isTransportish = (a.category === 'transport') || t.includes('transfer') || t.includes('departure');
      return isAirportish && isTransportish;
    });

    const checkoutMins = checkoutAct?.startTime ? parseTimeToMinutes(checkoutAct.startTime) : null;
    const airportMins = airportAct?.startTime ? parseTimeToMinutes(airportAct.startTime) : null;
    if (checkoutMins !== null && airportMins !== null && checkoutMins > airportMins) {
      errors.push('Departure day sequence violation: Hotel checkout must occur before airport transfer.');
    }

    if (!hasCheckout) {
      errors.push('Last day MUST include hotel checkout activity');
    }
    if (!hasDeparture) {
      errors.push('Last day MUST end with departure/airport transfer activity');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * POST-VALIDATION: Strip duplicate activities from a day.
 * Uses similarity logic to actually REMOVE duplicates instead of just logging errors.
 * Keeps the first occurrence, removes subsequent ones.
 */
function deduplicateActivities(day: StrictDay): { day: StrictDay; removed: string[] } {
  if (!day.activities || day.activities.length <= 1) {
    return { day, removed: [] };
  }

  const removed: string[] = [];
  const kept: StrictActivity[] = [];
  const seenConcepts = new Set<string>();
  const seenLocations = new Set<string>();
  const seenTitles = new Set<string>();

  const normalizeText = (input: string): string => {
    return (input || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const extractConcept = (title: string): string => {
    const conceptPart = normalizeText(title).split(/\s+at\s+|\s+with\s+|\s+@\s+|\s+in\s+/i)[0];
    return conceptPart
      .replace(/\b(class|tour|experience|visit|workshop|session|lesson|masterclass)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const repeatableCategories = ['transport', 'accommodation', 'downtime', 'free_time'];

  for (const act of day.activities) {
    const category = (act.category || '').toLowerCase();

    // Always keep logistics/transport/accommodation — these naturally repeat
    if (repeatableCategories.includes(category)) {
      kept.push(act);
      continue;
    }

    const concept = extractConcept(act.title || '');
    const locationKey = normalizeText(act.location?.name || '') + '|' + normalizeText(act.location?.address || '');
    const normalTitle = normalizeText(act.title || '');

    // Check 1: Exact same normalized title — duplicate regardless of location
    if (normalTitle.length > 5 && seenTitles.has(normalTitle)) {
      removed.push(act.title || 'untitled');
      continue;
    }

    // Check 2: Same concept at same location — hard duplicate
    if (concept.length > 3 && seenConcepts.has(concept) && locationKey.length > 3 && seenLocations.has(locationKey)) {
      removed.push(act.title || 'untitled');
      continue;
    }

    // Track for future comparisons
    if (normalTitle.length > 5) seenTitles.add(normalTitle);
    if (concept.length > 3) seenConcepts.add(concept);
    if (locationKey.length > 3) seenLocations.add(locationKey);

    kept.push(act);
  }

  if (removed.length > 0) {
    return { day: { ...day, activities: kept }, removed };
  }

  return { day, removed: [] };
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
    '10. **ACTIVITY TITLE NAMING — CRITICAL**: The "title" field MUST be the venue or experience name ONLY. NEVER append the category, type, or a repeated word. Examples of WRONG titles: "Barton Springs Pool Pool", "Zilker Botanical Garden Garden", "Franklin Barbecue Barbecue", "Cosmic Coffee Coffee & Beer", "Record shopping shopping". CORRECT titles: "Barton Springs Pool", "Zilker Botanical Garden", "Franklin Barbecue", "Cosmic Coffee + Beer Garden". If the place name already contains the activity type (e.g., "Pool", "Garden", "Barbecue", "Coffee"), do NOT add it again.',
    '11. **DINING TITLE — CRITICAL**: For ALL dining/restaurant activities (category: "dining"), the "title" MUST be the restaurant or cafe name. NEVER use the neighborhood, district, or area as the title. Put the neighborhood in the "neighborhood" field instead. WRONG: { title: "Gaslamp Quarter", description: "Juniper & Ivy" }. WRONG: { title: "La Jolla", description: "The Taco Stand fish tacos" }. WRONG: { title: "Balboa Park", description: "The Prado restaurant" }. RIGHT: { title: "Juniper & Ivy", neighborhood: "Gaslamp Quarter" }. RIGHT: { title: "The Taco Stand", description: "fish tacos", neighborhood: "La Jolla" }. RIGHT: { title: "The Prado", neighborhood: "Balboa Park" }.',
    isFirstDay ? '12. **DAY 1 ARRIVAL STRUCTURE — CRITICAL**: Day 1 MUST begin with THREE SEPARATE activity blocks (NEVER combine them into one): (a) "Arrival at Airport" (category: transport), (b) "Airport Transfer to Hotel" (category: transport), (c) "Hotel Check-in" (category: accommodation). Each MUST be its own entry with its own startTime/endTime. NEVER create a single "Arrive and check in" block.' : '',
    isLastDay && context.totalDays > 1 ? '12. LAST DAY MUST end with: Checkout → Transfer → Departure' : '',
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
This is a GROUP TRIP. For EVERY activity, you MUST include a "suggestedFor" field with the user ID of the traveler whose preferences most influenced that choice.

Travelers in this group:
${context.collaboratorTravelers.map(t => `  - "${t.userId}" (${t.name})`).join('\n')}

Rules:
- When an activity appeals to BOTH/ALL travelers' profiles equally (e.g. iconic landmarks, shared interests), use COMMA-SEPARATED user IDs: "id1,id2"
- Use a single collaborator's ID when the activity clearly matches ONLY their preferences
- Use the primary planner's ID ("${context.userId}") ONLY when it specifically matches their profile, NOT as a default
- EVERY activity MUST have a suggestedFor value — no exceptions
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
          multiCityPrompt += `\n🏨 ACCOMMODATION in ${dayDestination}: ${dayCity.hotelName}${hotelArea ? ` (${hotelArea})` : ''}.`;
          multiCityPrompt += `\n   ⚠️ Start each day from this hotel area and plan return in the evening.`;
          
          if (dayCity.isFirstDayInCity && !dayCity.isTransitionDay) {
            // Very first city, first day — arrival logistics
            multiCityPrompt += `\n   📍 ARRIVAL DAY: Traveler arrives and needs to get to the hotel. Include transit to ${dayCity.hotelName}, check-in (~30-60 min to settle in), THEN afternoon/evening activities near the hotel area.`;
          } else if (dayCity.isFirstDayInCity && dayCity.isTransitionDay) {
            // Transition day — handled by transition prompt, but add hotel check-in note
            multiCityPrompt += `\n   📍 CHECK-IN DAY: After arriving in ${dayDestination}, traveler checks into ${dayCity.hotelName}. Allow time for check-in and settling before activities.`;
          }
          
          if (dayCity.isLastDayInCity) {
            multiCityPrompt += `\n   📍 CHECKOUT DAY: Traveler checks out of ${dayCity.hotelName} (typically by 11:00 AM). Plan morning around checkout — breakfast at/near hotel, pack and check out, then activities before departing.`;
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
Include a mix of: 3 dining slots (breakfast/lunch/dinner), transit between major moves, core exploration/activity slots, and an evening activity where appropriate.
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
- If you are unsure whether a venue is open on ${dayOfWeekName}, set closedRisk: true and suggest an alternative.
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
      // ARRIVAL DAY SEQUENCE FIX: Ensure airport → transfer → hotel check-in order
      // ==========================================================================
      if (isFirstDay && generatedDay.activities.length > 1) {
        const arrivalKeywords = ['arrival at airport', 'arrive at airport', 'airport arrival', 'land at', 'arrive in'];
        const transferKeywords = ['airport transfer', 'transfer to hotel', 'rideshare to', 'taxi to hotel', 'shuttle to', 'uber to', 'lyft to'];
        const checkinKeywords = ['check-in', 'check in', 'checkin'];

        const arrivalIdx = generatedDay.activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return arrivalKeywords.some(kw => t.includes(kw)) ||
            (a.category === 'transport' && t.includes('airport') && !t.includes('transfer'));
        });
        const transferIdx = generatedDay.activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return transferKeywords.some(kw => t.includes(kw)) ||
            (a.category === 'transport' && t.includes('transfer') && t.includes('hotel'));
        });
        const checkinIdx = generatedDay.activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return checkinKeywords.some(kw => t.includes(kw)) || 
            (a.category === 'accommodation' && (t.includes('hotel') || t.includes('settle')));
        });

        // If check-in comes before arrival or transfer, reorder
        if (checkinIdx >= 0 && arrivalIdx >= 0 && checkinIdx < arrivalIdx) {
          console.log(`[Stage 2] FIXING: Hotel check-in (idx ${checkinIdx}) before airport arrival (idx ${arrivalIdx}) — reordering`);

          // Collect the arrival-sequence activities
          const seqItems: Array<{ act: any; type: string }> = [];
          if (arrivalIdx >= 0) seqItems.push({ act: generatedDay.activities[arrivalIdx], type: 'arrival' });
          if (transferIdx >= 0) seqItems.push({ act: generatedDay.activities[transferIdx], type: 'transfer' });
          if (checkinIdx >= 0) seqItems.push({ act: generatedDay.activities[checkinIdx], type: 'checkin' });

          // Remove them (reverse order to preserve indices)
          const indicesToRemove = [arrivalIdx, transferIdx, checkinIdx].filter(i => i >= 0).sort((a, b) => b - a);
          for (const idx of indicesToRemove) {
            generatedDay.activities.splice(idx, 1);
          }

          // Parse flight arrival time, default 9:00 AM
          let flightArrivalMins = 540;
          try {
            // Try to extract from flightHotelContext
            const arrivalMatch = flightHotelContext.match(/(?:arrives?|arrival|landing)[^\d]*(\d{1,2}):(\d{2})/i);
            if (arrivalMatch) {
              flightArrivalMins = parseInt(arrivalMatch[1]) * 60 + parseInt(arrivalMatch[2]);
            }
          } catch { /* use default */ }

          const formatTimeMins = (mins: number) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          };

          // Assign sequential times
          const orderMap: Record<string, number> = { arrival: 0, transfer: 1, checkin: 2 };
          const timings: Record<string, { start: number; duration: number }> = {
            arrival: { start: flightArrivalMins, duration: 30 },
            transfer: { start: flightArrivalMins + 30, duration: 60 },
            checkin: { start: flightArrivalMins + 90, duration: 30 },
          };

          for (const item of seqItems) {
            const t = timings[item.type];
            if (t) {
              item.act.startTime = formatTimeMins(t.start);
              item.act.endTime = formatTimeMins(t.start + t.duration);
            }
          }

          // Sort by order and prepend
          seqItems.sort((a, b) => (orderMap[a.type] || 0) - (orderMap[b.type] || 0));
          generatedDay.activities = [...seqItems.map(s => s.act), ...generatedDay.activities];
        }
      }

      // ==========================================================================
      // MINIMUM REAL ACTIVITY COUNT VALIDATION
      // Reject days with only logistics (transport/accommodation/downtime)
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
        const minimumRealActivities = isLastDay ? 1 : 2;
        if (realActivities.length < minimumRealActivities) {
          console.warn(`[Stage 2] Day ${dayNumber} has only ${realActivities.length} real activities (minimum: ${minimumRealActivities})`);
        }
      }

      // ==========================================================================
      // USER PREFERENCE VALIDATION (logging + warnings)
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
            if (!dayHasThis) {
              console.warn(`[Stage 2] WARNING: User requested "${activity}" but Day ${dayNumber} has no matching activities`);
            }
          }
        }

        // Check for "light dining" preference violations
        const wantsLightDining = userNotes.includes('light dinner') || userNotes.includes('light meal') || userNotes.includes('casual dinner');
        if (wantsLightDining) {
          for (const act of generatedDay.activities) {
            const isDining = ((act as any).category || '').toLowerCase() === 'dining';
            const cost = (act as any).cost?.amount || 0;
            if (isDining && cost > 50) {
              console.warn(`[Stage 2] WARNING: User requested light dinner but got "${(act as any).title}" at $${cost}`);
            }
          }
        }
      }

      const validation = validateGeneratedDay(generatedDay, dayNumber, isFirstDay, isLastDay, context.totalDays, previousDays, !!context.isSmartFinish);

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
    let computedEndDate: string | undefined;
    try {
      const daysArray = frontendReadyData?.days || frontendReadyData?.itinerary?.days;
      if (Array.isArray(daysArray) && daysArray.length > 0 && tripId) {
        // Fetch the trip start_date to compute end
        const { data: tripRow } = await supabase
          .from('trips')
          .select('start_date')
          .eq('id', tripId)
          .single();
        if (tripRow?.start_date) {
          const [y, m, d] = tripRow.start_date.split('-').map(Number);
          const endD = new Date(y, m - 1, d + daysArray.length - 1);
          computedEndDate = endD.toISOString().split('T')[0];
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
          const costPerPerson = typeof rawCost === 'number' ? rawCost : (rawCost.amount || 0);

          // Skip truly free items
          if (costPerPerson <= 0) continue;

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

          costRows.push({
            trip_id: tripId,
            activity_id: act.id,
            day_number: day.dayNumber || 1,
            cost_per_person_usd: Math.min(costPerPerson, 2000), // safety cap
            num_travelers: context.travelers || 1,
            category: mappedCategory,
            source: 'reference',
            confidence: 'medium',
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
      
      const allowedServiceRoleActions = ['generate-trip-day', 'generate-day', 'regenerate-day'];
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
        const { data: collabRows } = await supabase
          .from('trip_collaborators')
          .select('user_id')
          .eq('trip_id', tripId)
          .eq('include_preferences', true);

        const allUserIds = [userId, ...(collabRows || []).map((c: any) => c.user_id)].filter(Boolean);
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, display_name, handle')
          .in('id', allUserIds);

        const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));

        context.collaboratorTravelers = allUserIds.map(uid => ({
          userId: uid!,
          name: profileMap.get(uid!) || 'Traveler',
        }));
        console.log(`[Stage 1.2] Attribution travelers: ${context.collaboratorTravelers.map(t => `${t.name}(${t.userId.slice(0,8)})`).join(', ')}`);

        // =======================================================================
        // STAGE 1.2.1: ARCHETYPE-LEVEL GROUP BLENDING
        // Load each companion's Travel DNA, run blendGroupArchetypes(), inject prompt
        // =======================================================================
        console.log("[Stage 1.2.1] Loading companion archetypes for group blending...");
        try {
          // Load companion DNA profiles
          const companionUserIds = (collabRows || []).map((c: any) => c.user_id).filter(Boolean);
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
            });
          }

          if (travelers.length > 1) {
            // Run archetype-level blending (day assignments, conflicts, split activities)
            const blendResult = await blendGroupArchetypes(travelers, context.totalDays, context.destination);
            groupBlendingPromptSection = blendResult.promptSection;
            console.log(`[Stage 1.2.1] ✓ Group archetype blending complete: ${travelers.length} travelers, ${blendResult.conflicts.length} conflicts, ${blendResult.splitOpportunities.length} split opportunities`);

            // Build blended trait scores snapshot (owner 50%, companions split remaining 50%)
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
            };

            const companionTraitsList = companionUserIds
              .map((uid: string) => companionTraitScoresMap.get(uid))
              .filter(Boolean) as Record<string, number>[];

            const ownerWeight = 0.5;
            const companionWeight = companionTraitsList.length > 0 ? 0.5 / companionTraitsList.length : 0;
            
            const blendedTraits: Record<string, number> = {};
            const traitKeys = ['pace', 'budget', 'social', 'planning', 'comfort', 'authenticity', 'adventure', 'cultural'];
            for (const key of traitKeys) {
              const ownerVal = ownerTraitsNormalized[key] || 0;
              const companionSum = companionTraitsList.reduce((sum, ct) => sum + (ct[key] || 0) * companionWeight, 0);
              blendedTraits[key] = Math.round(ownerVal * ownerWeight + companionSum);
            }

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
        transformation: 0  // Not in unified profile, use default
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
        const mustDoAnalysis = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust);
        
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
      // NOTE: generationHierarchy includes destination essentials, archetype behavioral rules, budget guardrails (Phase 2 Fix)
      // Phase 2 Fix: Removed unifiedDNAContext - all traveler data now comes from generationHierarchy via unified profile
      const preferenceContext = userConstraintPrompt + '\n\n' + flightDetailsPrompt + '\n\n' + generationHierarchy + '\n\n' + interestOverridePrompt + '\n\n' + tripVibePrompt + '\n\n' + tripTypePrompt + '\n\n' + skipListPrompt + '\n\n' + dietaryEnforcementPrompt + '\n\n' + rawPreferenceContext + enrichedPreferenceContext + flightHotelResult.context + (context.flightIntelligencePrompt ? '\n\n' + context.flightIntelligencePrompt : '') + tripLearningsContext + recentlyUsedContext + localEventsContext + hiddenGemsContext + voyancePicksContext + coldStartContext + forcedSlotsPrompt + scheduleConstraintsPrompt + explainabilityPrompt + truthAnchorPrompt + groupReconciliationPrompt + groupBlendingPromptSection + geographicPrompt + userResearchPrompt + mustHavesPrompt + preBookedPrompt;

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
            const arrivalEnd = minutesToHHMM(startMin + 30);
            const transferStart = minutesToHHMM(startMin + 45);
            const transferDuration = 45; // default transfer duration
            const transferEnd = minutesToHHMM(startMin + 45 + transferDuration);
            const checkInStart = minutesToHHMM(startMin + 45 + transferDuration + 15);
            const checkInEnd = minutesToHHMM(startMin + 45 + transferDuration + 45);
            
            const hotelN = flightHotelResult?.hotelName || 'Hotel';
            const hotelA = flightHotelResult?.hotelAddress || '';
            const airportN = 'Airport';
            
            console.log(`[Stage 2.55] Splitting combined arrival block: "${combined.title}" into 3 activities`);
            
            const splitActivities = [
              {
                ...combined,
                title: `Arrival at ${airportN}`,
                description: 'Clear customs/immigration and collect luggage',
                startTime: combined.startTime,
                endTime: arrivalEnd,
                category: 'transport',
                type: 'transport',
                location: { name: airportN },
              },
              {
                ...combined,
                id: `${combined.id}-transfer`,
                title: `Airport Transfer to ${hotelN}`,
                description: `Take a taxi or private transfer from ${airportN} to ${hotelN}`,
                startTime: transferStart,
                endTime: transferEnd,
                category: 'transport',
                type: 'transport',
                location: { name: hotelN, address: hotelA },
              },
              {
                ...combined,
                id: `${combined.id}-checkin`,
                title: 'Hotel Check-in',
                description: 'Check in, freshen up, and get oriented to the area',
                startTime: checkInStart,
                endTime: checkInEnd,
                category: 'accommodation',
                type: 'accommodation',
                location: { name: hotelN, address: hotelA },
              },
            ];
            
            day1.activities.splice(combinedIdx, 1, ...splitActivities);
            aiResult.days[0] = day1;
            console.log(`[Stage 2.55] ✓ Split into: Arrival (${combined.startTime}-${arrivalEnd}), Transfer (${transferStart}-${transferEnd}), Check-in (${checkInStart}-${checkInEnd})`);
          }
        }
      }

      // =======================================================================
      // STAGE 2.6: Personalization Validation (Phase 3)
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
      
      // For now, log warnings but don't reject - we're gathering data on AI compliance
      // TODO: Enable rejection after baseline is established
      // if (!validationResult.isValid) {
      //   console.error("[Stage 2.6] VALIDATION FAILED - would trigger regeneration");
      // }

      // =======================================================================
      // STAGE 2.7: Transit Gap Enforcement
      // Shift activity start times forward when consecutive activities have
      // insufficient buffer (< 15 min gap). This catches cases where the AI
      // ignored the buffer constraints from the personalization enforcer.
      // =======================================================================
      const MIN_GAP_MINUTES = 15;
      let gapFixCount = 0;
      
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
          
          // Compute current activity's end time
          const startMins = parseT(current.startTime);
          if (startMins === null) continue;
          
          // Parse duration
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
          
          if (gap < MIN_GAP_MINUTES) {
            const newStart = endMins + MIN_GAP_MINUTES;
            const oldTime = next.startTime;
            next.startTime = fmtT(newStart);
            // Also update endTime if it exists
            if (next.endTime) {
              const nextDur = (parseT(next.endTime) || (newStart + 60)) - (parseT(oldTime) || newStart);
              next.endTime = fmtT(newStart + Math.max(nextDur, 30));
            }
            gapFixCount++;
            console.log(`[Stage 2.7] Day ${day.dayNumber}: Shifted "${next.title || next.name}" from ${oldTime} → ${next.startTime} (gap was ${gap} min)`);
          }
        }
      }
      
      if (gapFixCount > 0) {
        console.log(`[Stage 2.7] Fixed ${gapFixCount} insufficient transit gaps across all days`);
      }

      // =====================================================================
      // STAGE 2.8: Must-Do Validation (logging only — mirrors dietary check)
      // =====================================================================
      if (context.mustDoActivities && context.mustDoActivities.trim()) {
        try {
          const forceAllMust = !!context.isSmartFinish || !!context.smartFinishRequested;
          const mustDoCheck = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust);
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
      // Detect activities scheduled outside operating hours and attempt to fix
      // =======================================================================
      if (context.startDate) {
        const hoursViolations = validateOpeningHours(enrichedDays, context.startDate);
        if (hoursViolations.length > 0) {
          console.warn(`[Stage 4.5] ⚠️ ${hoursViolations.length} opening hours conflict(s) detected — attempting auto-fix:`);
          
          let fixedCount = 0;
          
          for (const violation of hoursViolations) {
            const day = enrichedDays[violation.dayNumber - 1];
            if (!day) continue;
            const activity = day.activities.find((a: StrictActivity) => a.id === violation.activityId);
            if (!activity) continue;
            
            // Try to auto-fix: adjust startTime based on venue hours
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
                // If venue is CLOSED on this day, we can't fix — mark as closedRisk
                if (entryLower.includes('closed') || entryLower.includes('fermé') || entryLower.includes('cerrado') || entryLower.includes('chiuso')) {
                  (activity as any).closedRisk = true;
                  (activity as any).closedRiskReason = `${dayName}: Venue is closed. Consider visiting on another day.`;
                  console.warn(`  - Day ${violation.dayNumber}: "${violation.activityTitle}" — CLOSED on ${dayName}, cannot auto-fix`);
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
                      // Activity duration doesn't fit in opening window — can't fix
                      (activity as any).closedRisk = true;
                      (activity as any).closedRiskReason = `${dayName}: Open ${Math.floor(venueOpenMins / 60).toString().padStart(2, '0')}:${(venueOpenMins % 60).toString().padStart(2, '0')}–${Math.floor(venueCloseMins / 60).toString().padStart(2, '0')}:${(venueCloseMins % 60).toString().padStart(2, '0')}, activity duration (${duration}min) doesn't fit.`;
                      console.warn(`  - Day ${violation.dayNumber}: "${violation.activityTitle}" — duration ${duration}min doesn't fit in venue hours, cannot auto-fix`);
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
            
            // Couldn't auto-fix — tag with warning
            (activity as any).closedRisk = true;
            (activity as any).closedRiskReason = violation.reason;
            console.warn(`  - Day ${violation.dayNumber}: "${violation.activityTitle}" — ${violation.reason} (could not auto-fix)`);
          }
          
          if (fixedCount > 0) {
            console.log(`[Stage 4.5] ✓ Auto-fixed ${fixedCount}/${hoursViolations.length} operating hours conflicts`);
          }
        } else {
          console.log("[Stage 4.5] ✓ No opening hours conflicts detected");
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
        pacing: paramPacing, isFirstTimeVisitor: paramIsFirstTimeVisitor } = params;
      
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


      // =======================================================================
      // TRANSITION DAY RESOLVER: Determine if this day is a transition day
      // Uses explicit params from frontend, or resolves from trip_cities DB
      // =======================================================================
      let resolvedIsTransitionDay = !!paramIsTransitionDay;
      let resolvedTransitionFrom = paramTransitionFrom || '';
      let resolvedTransitionTo = paramTransitionTo || '';
      let resolvedTransportMode = paramTransitionMode || '';
      let resolvedTransportDetails: any = null;
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
        const mustDoAnalysis = parseMustDoInput(mustDoActivities, destination, forceAllMust);
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
            const blockedTimeLines = mustDoEventItems.map(ev => {
              const { blockedStart, blockedEnd } = getBlockedTimeRange(ev);
              return `⏰ BLOCKED TIME for "${ev.priority.title}": ${blockedStart}–${blockedEnd}. Do NOT schedule ANY activities in this window.`;
            }).join('\n');
            mustDoPrompt = `\n## 🚨 USER'S MUST-DO VENUES FOR DAY ${dayNumber} (MANDATORY)\n\nThe traveler has PERSONALLY RESEARCHED these venues. You MUST include them:\n${dayItems.map(item => `- ${item.priority.title} (${item.priority.priority})${item.priority.activityType === 'all_day_event' ? ' [ALL-DAY EVENT — plan the ENTIRE day around this]' : item.priority.activityType === 'half_day_event' ? ' [HALF-DAY EVENT — dedicate morning or afternoon to this]' : ''}`).join('\n')}\n${blockedTimeLines ? '\n' + blockedTimeLines + '\n' : ''}\nRULES:\n- Include ALL listed venues by name in this day's itinerary\n- For ALL-DAY events, the entire day should revolve around this event\n- Any activity overlapping a BLOCKED TIME window is a HARD FAILURE\n- Only add AI recommendations to fill remaining slots OUTSIDE blocked windows\n`;
          } else {
            // No items specifically for this day, but include unschedulable ones as suggestions
            const unscheduledItems = scheduled.unschedulable || [];
            if (unscheduledItems.length > 0) {
              mustDoPrompt = `\n## User's Researched Venues (try to include if appropriate)\n${unscheduledItems.map(u => `- ${u.priority.title} (${u.priority.priority})`).join('\n')}\n`;
            }
          }
          console.log(`[generate-day] Must-do activities parsed: ${mustDoAnalysis.length} items, ${dayItems.length} for day ${dayNumber}, ${mustDoEventItems.length} events`);
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
          const detectedFromNotes = parseMustDoInput(additionalNotes, destination, false);
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

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at Airport" 
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"
   - ⚠️ This MUST be its own activity block — do NOT merge with transfer or check-in

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

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at Airport"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"
   - ⚠️ This MUST be its own activity block — do NOT merge with transfer or check-in

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

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at Airport"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - ⚠️ This MUST be its own activity block — do NOT merge with transfer or check-in

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

      // ==========================================================================
      // TRANSPORT PREFERENCES: Fetch from DB + merge with request body
      // ==========================================================================
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
        // ===== FULL EXPLORATION DAY: Comprehensive hour-by-hour plan =====
        // This is where most days land — the detailed structure prompt
        const hotelNameForDay = flightContext.hotelName || '';
        const hotelNeighborhood = flightContext.hotelAddress || '';
        
        timingInstructions = `
FULL EXPLORATION DAY — HOUR-BY-HOUR TRAVEL PLAN (NOT a suggestion list):

This day must be a COMPLETE itinerary from morning to night. Every hour accounted for.

REQUIRED DAY STRUCTURE:
1. BREAKFAST (category: "dining") — Near hotel, real restaurant name, ~price, walking distance
2. TRANSIT between every pair of consecutive activities (category: "transport")
   - Include mode (${resolvedTransportModes.length > 0 ? resolvedTransportModes.join('/') : 'walk/taxi/metro/bus'}), duration, cost, route details
   - 10+ minute walks or any paid transit = separate activity entry
3. MORNING ACTIVITIES — At least 1 paid + 1 free activity
4. LUNCH (category: "dining") — Restaurant near previous location, ~price, 1 alternative in tips
5. AFTERNOON ACTIVITIES — At least 1-2 paid + 1 free activity  
6. HOTEL RETURN (if dinner venue is far) — "Freshen up" with category "accommodation"
7. DINNER (category: "dining") — Restaurant, price range, dress code, reservation needed?, 1 alternative in tips
8. EVENING/NIGHTLIFE — Bar, jazz club, night market, show, rooftop, dessert spot (at least 1 suggestion)
9. RETURN TO HOTEL — With transport mode and time
10. NEXT MORNING PREVIEW — In the tips of the LAST activity: "Tomorrow: Wake [time]. Breakfast at [place] ([distance], ~[price])."

MEAL RULES:
- 3 meals per full day (breakfast, lunch, dinner) — NO EXCEPTIONS
- Each meal = real restaurant name + approximate price + distance from previous stop
- Each lunch and dinner must include 1 alternative option in the "tips" field

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
        { pace: traitScores.pace, budget: traitScores.budget },
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
      
      // Get archetype context for activity limits and other settings
      const archetypeContext = getFullArchetypeContext(
        primaryArchetype, 
        resolvedDestination, 
        effectiveBudgetTier, 
        { pace: traitScores.pace, budget: traitScores.budget }
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
      if (tripId) {
        const { data: collabRows } = await supabase
          .from('trip_collaborators')
          .select('user_id')
          .eq('trip_id', tripId)
          .eq('include_preferences', true);

        if (collabRows && collabRows.length > 0) {
          const allUserIds = [userId, ...collabRows.map((c: any) => c.user_id)].filter(Boolean);
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
This is a GROUP TRIP. For EVERY activity, you MUST include a "suggestedFor" field with the user ID of the traveler whose preferences most influenced that choice.

Travelers in this group:
${travelerList}

Rules:
- When an activity appeals to BOTH/ALL travelers' profiles equally (e.g. iconic landmarks, shared interests), use COMMA-SEPARATED user IDs: "id1,id2"
- Use a single collaborator's ID when the activity clearly matches ONLY their preferences
- Use the primary planner's ID ("${userId}") ONLY when it specifically matches their profile, NOT as a default
- EVERY activity MUST have a suggestedFor value — no exceptions
`;
          console.log(`[generate-day] Attribution prompt injected for ${allUserIds.length} travelers`);
        }
      }

      const systemPrompt = `You are an expert travel planner creating a COMPLETE hour-by-hour travel plan — not a suggestion list.

${generationHierarchy}

${tripTypePrompt}

${transportPreferencePrompt}

${timingInstructions}
${lockedSlotsInstruction}

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
- Include 3 MEALS per full day: breakfast, lunch, dinner — each a real named restaurant with price
- Each lunch and dinner recommendation should include 1 ALTERNATIVE option in its "tips" field
- ONLY recommend restaurants and dining spots with 4+ star ratings - no low-quality or poorly-reviewed venues
- Every activity MUST have a "title" field (the display name)
- All times MUST be in 24-hour HH:MM format
- ACTIVITY COUNT: This includes meals, transit, and evening activities. Fill the day completely.
- Include at least 1 EVENING/NIGHTLIFE activity after dinner (bar, show, night market, jazz, rooftop, dessert spot)
- Include PRACTICAL TIPS inline: booking requirements, queue advice, dress codes, closure days, best times
- The LAST activity's tips field must include a NEXT MORNING PREVIEW: "Tomorrow: Wake [time]. Breakfast at [place] ([distance], ~[price])."
- For full exploration days: minimum 3 paid activities + 2 free activities + 3 meals + evening option
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

      const isFullDay = !isFirstDay && !isLastDay;
      const userPrompt = `Generate Day ${dayNumber} of ${totalDays} in ${resolvedDestination}${resolvedCountry ? `, ${resolvedCountry}` : ''}.

Date: ${date}
Travelers: ${travelers}
Budget: ${effectiveBudgetTier}${actualDailyBudgetPerPerson != null ? ` (~$${actualDailyBudgetPerPerson}/day per person)
⚠️ HARD BUDGET CAP: The user has set a real budget of ~$${Math.round(actualDailyBudgetPerPerson * (travelers || 1))}/day total ($${actualDailyBudgetPerPerson}/person) for activities.
${actualDailyBudgetPerPerson < 10 ? `🚨 EXTREMELY TIGHT BUDGET: Do your best — prioritize FREE activities (parks, temples, markets, viewpoints, walking tours). For meals, suggest cheapest realistic options (street food, convenience stores). Do NOT invent fake low prices — use real local costs. Include a "budget_note" field with an honest 1-sentence note about budget feasibility.` : actualDailyBudgetPerPerson < 30 ? `⚡ TIGHT BUDGET: Lean heavily on free attractions, street food, self-guided exploration. Limit paid activities to 1-2/day. Use realistic local prices.` : `Stay within this cap. Balance expensive activities with free alternatives.`}` : ''}
ARCHETYPE: ${primaryArchetype}
${isFullDay ? `DAY TYPE: Full exploration day — generate a COMPLETE hour-by-hour plan with 3 meals, transit between every stop, evening activity, and next-morning preview.` : `SIGHTSEEING ACTIVITY COUNT: ${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} (adjust for arrival/departure constraints)`}
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
${preferenceContext}
${tripIntentsContext}
${mustDoPrompt}
${additionalNotesPrompt}
${mustHavesConstraintPrompt}
${preBookedCommitmentsPrompt}
${previousDayActivities?.length ? `\nAvoid repeating these specific venues/activities (be creative and pick DIFFERENT ones): ${previousDayActivities.join(', ')}` : ''}

CRITICAL REMINDERS:
1. ${isFullDay ? 'This is a FULL DAY: breakfast + 3 paid activities + 2 free activities + lunch + dinner + transit between all stops + evening activity + next morning preview. Fill EVERY hour.' : `${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} scheduled sightseeing activities for this ${isFirstDay ? 'arrival' : 'departure'} day.`}
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
        // =======================================================================
        if (date) {
          const dayDate = new Date(date);
          const dayOfWeek = dayDate.getDay();
          const { isVenueOpenOnDay } = await import('./truth-anchors.ts');
          
          for (const act of normalizedActivities) {
            if (!act.openingHours || act.openingHours.length === 0) continue;
            const skipCats = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
            if (skipCats.includes(act.category?.toLowerCase() || '')) continue;
            
            const result = isVenueOpenOnDay(act.openingHours, dayOfWeek, act.startTime);
            if (!result.isOpen) {
              console.warn(`[generate-day] ⚠️ "${act.title}" may be closed: ${result.reason}`);
              (act as any).closedRisk = true;
              (act as any).closedRiskReason = result.reason;
            }
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
            const dayMustDos = parseMustDoInput(mustDoActivities, destination, forceAllMust)
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

      // unlocked_day_count is managed exclusively by the client:
      //   - TripDetail.tsx handleGenerationComplete (initial set after generation)
      //   - useUnlockDay.ts (per-day increment)
      // Do NOT set it here — doing so creates a race condition with the client's write.
      // See src/lib/voyanceFlowController.ts computeUnlockedDayCount() for the canonical logic.
      const updatePayload: Record<string, any> = {
        itinerary_data: itinerary,
        itinerary_status: 'ready',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('trips')
        .update(updatePayload)
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

    // ==========================================================================
    // ACTION: repair-trip-costs - Fix corrupted/missing activity_costs for a trip
    // ==========================================================================
    if (action === 'repair-trip-costs') {
      const { tripId } = params;
      const userId = authResult.userId;

      if (!tripId) {
        return new Response(
          JSON.stringify({ error: "tripId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify trip access
      const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, false);
      if (!tripAccessResult.allowed) {
        return new Response(
          JSON.stringify({ error: tripAccessResult.reason || "Trip not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[repair-trip-costs] Starting repair for trip ${tripId}, user ${userId}`);

      // Fetch trip data
      const { data: tripData, error: tripErr } = await supabase
        .from("trips")
        .select("id, destination, travelers, itinerary_data")
        .eq("id", tripId)
        .single();

      if (tripErr || !tripData) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const itData = tripData.itinerary_data as any;
      const days = itData?.days || itData?.itinerary?.days || [];
      if (!days.length) {
        return new Response(
          JSON.stringify({ message: "No itinerary data to repair", repaired: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Load cost references
      const { data: allRefs } = await supabase.from("cost_reference").select("*");
      const refMap = new Map<string, any>();
      if (allRefs) {
        for (const r of allRefs) {
          const cityLower = (r.destination_city || "").toLowerCase();
          const exactKey = `${cityLower}|${r.category}|${r.subcategory || ""}`;
          refMap.set(exactKey, r);
          const fallbackKey = `${cityLower}|${r.category}|`;
          if (!refMap.has(fallbackKey)) refMap.set(fallbackKey, r);
        }
      }

      // Category/subcategory maps (inline for this action)
      const catMap: Record<string, string> = {
        sightseeing: "activity", cultural: "activity", adventure: "activity",
        relaxation: "activity", entertainment: "activity", dining: "dining",
        food: "dining", restaurant: "dining", cafe: "dining", transport: "transport",
        transportation: "transport", transit: "transport", nightlife: "nightlife",
        bar: "nightlife", shopping: "shopping",
      };
      const transportKw: Record<string, string[]> = {
        taxi: ["taxi", "cab", "uber", "grab", "lyft", "ride", "private car"],
        airport_transfer: ["airport transfer", "airport shuttle"],
        metro: ["metro", "subway", "mrt", "mtr", "underground"],
        bus: ["bus", "shuttle bus", "city bus"],
        train: ["train", "rail", "shinkansen"],
        ferry: ["ferry", "boat", "water taxi", "star ferry", "junk boat"],
      };
      const diningKw: Record<string, string[]> = {
        street_food: ["street food", "hawker", "night market food", "dai pai dong"],
        cafe: ["cafe", "café", "coffee", "bakery"],
        casual_dining: ["noodle", "ramen", "dim sum", "dumpling", "pho"],
        fine_dining: ["fine dining", "michelin", "omakase", "tasting menu"],
      };

      function normCat(raw?: string): string {
        if (!raw) return "activity";
        return catMap[raw.toLowerCase().trim()] || raw.toLowerCase().trim();
      }

      function inferSub(title: string, cat: string): string | null {
        const t = (title || "").toLowerCase();
        if (cat === "transport") {
          for (const [sub, kws] of Object.entries(transportKw)) {
            if (kws.some(kw => t.includes(kw))) return sub;
          }
        }
        if (cat === "dining") {
          for (const [sub, kws] of Object.entries(diningKw)) {
            if (kws.some(kw => t.includes(kw))) return sub;
          }
        }
        return null;
      }

      const destination = (tripData.destination || "").toLowerCase();
      const numTravelers = tripData.travelers || 1;
      const rows: any[] = [];
      let corrected = 0;

      for (const day of days) {
        const dayNum = day.dayNumber || day.day_number || 1;
        for (const activity of (day.activities || [])) {
          if (!activity.id) continue;
          // Skip non-UUID activity IDs (AI sometimes generates string IDs like "act_1", "transport-arrive-1")
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(activity.id)) {
            console.warn(`[repair-trip-costs] Skipping non-UUID activity_id: "${activity.id}"`);
            continue;
          }
          const category = normCat(activity.category || activity.type);
          if (category === "accommodation") continue;

          const title = activity.title || activity.name || "";
          const subcategory = inferSub(title, category);
          let costPerPerson = typeof activity.estimatedCost === "number" ? activity.estimatedCost
            : typeof activity.estimated_cost === "number" ? activity.estimated_cost
            : typeof activity.cost === "number" ? activity.cost
            : (activity.cost && typeof activity.cost === "object") ? (activity.cost.amount || 0)
            : 0;

          // Find reference
          let ref: any = null;
          if (subcategory) {
            ref = refMap.get(`${destination}|${category}|${subcategory}`);
          }
          if (!ref) {
            ref = refMap.get(`${destination}|${category}|`);
          }

          let source = "repair";
          let wasCorrected = false;

          if (ref) {
            const maxAllowed = ref.cost_high_usd * 3;
            if (costPerPerson > maxAllowed || costPerPerson < 0) {
              costPerPerson = ref.cost_mid_usd;
              source = "auto_corrected";
              wasCorrected = true;
            } else if (costPerPerson === 0) {
              costPerPerson = ref.cost_mid_usd;
              source = "reference_fallback";
            }
          } else if (costPerPerson < 0) {
            costPerPerson = 0;
            source = "auto_corrected";
            wasCorrected = true;
          }

          if (wasCorrected) corrected++;

          rows.push({
            trip_id: tripId,
            activity_id: activity.id,
            day_number: dayNum,
            cost_per_person_usd: Math.round(costPerPerson * 100) / 100,
            num_travelers: numTravelers,
            category,
            source,
            confidence: ref ? "medium" : "low",
            cost_reference_id: ref?.id || null,
            notes: wasCorrected ? `[Repair auto-corrected${subcategory ? `, ${subcategory}` : ""}]` : null,
          });
        }
      }

      let inserted = 0;
      if (rows.length > 0) {
        const { data: upserted, error: upsertErr } = await supabase
          .from("activity_costs")
          .upsert(rows, { onConflict: "trip_id,activity_id" })
          .select("id");

        if (upsertErr) {
          console.error(`[repair-trip-costs] Upsert error:`, upsertErr);
          return new Response(
            JSON.stringify({ error: upsertErr.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        inserted = upserted?.length || 0;
      }

      console.log(`[repair-trip-costs] Done: ${inserted} rows upserted, ${corrected} corrected`);

      return new Response(
        JSON.stringify({ success: true, repaired: inserted, corrected, totalActivities: rows.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, isMultiCity, creditsCharged, requestedDays, resumeFromDay } = params;
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

      // Calculate total days — for multi-city, prefer sum of nights from trip_cities
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      let totalDays = Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // For multi-city trips, override totalDays with sum of city nights to prevent
      // date-arithmetic mismatches from producing extra/missing days
      if (isMultiCity) {
        try {
          const { data: tripCitiesForCount } = await supabase
            .from('trip_cities')
            .select('nights, days_total')
            .eq('trip_id', tripId);
          if (tripCitiesForCount && tripCitiesForCount.length > 0) {
            // days_total now stores inclusive day count; fall back to nights+1 for legacy rows
            const sumDays = tripCitiesForCount.reduce((sum: number, c: any) => {
              const dt = (c as any).days_total;
              const n = (c as any).nights;
              // If days_total is set, trust it (already inclusive after fix).
              // Otherwise derive from nights + 1.
              return sum + (dt || ((n || 1) + 1));
            }, 0);
            if (sumDays > 0 && sumDays !== totalDays) {
              console.log(`[generate-trip] Multi-city totalDays corrected: date-based=${totalDays}, city-days-sum=${sumDays}`);
              totalDays = sumDays;
            }
          }
        } catch (e) {
          console.warn('[generate-trip] Could not query trip_cities for totalDays correction:', e);
        }
      }

      // Set status to generating + store metadata
      // CRITICAL: Clear itinerary_data.days when starting fresh (not resuming)
      // to prevent duplicate days from a previous failed/partial generation
      const { data: currentTrip } = await supabase.from('trips').select('metadata, itinerary_data').eq('id', tripId).single();
      const existingMeta = (currentTrip?.metadata as Record<string, unknown>) || {};
      const isResume = resumeFromDay && resumeFromDay > 1;
      
      const updatePayload: Record<string, unknown> = {
        itinerary_status: 'generating',
        metadata: {
          ...existingMeta,
          generation_started_at: new Date().toISOString(),
          generation_total_days: totalDays,
          generation_completed_days: isResume ? (resumeFromDay - 1) : 0,
          generation_error: null,
          generation_heartbeat: new Date().toISOString(),
        },
      };
      
      // If starting fresh (not resume), clear existing days to prevent duplicates
      if (!isResume) {
        const existingItData = (currentTrip?.itinerary_data as Record<string, unknown>) || {};
        updatePayload.itinerary_data = { ...existingItData, days: [], status: 'generating' };
        console.log(`[generate-trip] Clearing existing itinerary_data.days for fresh generation`);
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
          if (response.ok || response.status < 500) break;
          console.error(`[generate-trip] Initial chain attempt ${attempt}/${maxRetries} failed: ${response.status}`);
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
      const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, userId, isMultiCity, creditsCharged, requestedDays, dayNumber, totalDays } = params;

      if (!tripId || !dayNumber || !totalDays) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for day generation", code: "INVALID_INPUT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[generate-trip-day] Starting day ${dayNumber}/${totalDays} for trip ${tripId}`);

      // Guard: check trip is still in "generating" state (user might have cancelled)
      const { data: tripCheck } = await supabase.from('trips').select('itinerary_status, metadata, itinerary_data').eq('id', tripId).single();
      if (!tripCheck || tripCheck.itinerary_status === 'cancelled' || tripCheck.itinerary_status === 'ready') {
        console.log(`[generate-trip-day] Trip ${tripId} status is ${tripCheck?.itinerary_status}, stopping chain`);
        return new Response(
          JSON.stringify({ status: tripCheck?.itinerary_status || 'cancelled', dayNumber }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Resolve multi-city mapping
      let dayCityMap: Array<{ cityName: string; country?: string; isTransitionDay: boolean; transitionFrom?: string; transitionTo?: string; transportType?: string }> | null = null;
      if (isMultiCity) {
        try {
          const { data: tripCities } = await supabase
            .from('trip_cities')
            .select('city_name, country, city_order, nights, days_total, transition_day_mode, transport_type')
            .eq('trip_id', tripId)
            .order('city_order', { ascending: true });

          if (tripCities && tripCities.length > 1) {
            const map: typeof dayCityMap = [];
            for (const city of tripCities) {
              const cityNights = (city as any).nights || (city as any).days_total || 1;
              for (let n = 0; n < cityNights; n++) {
                const isTransition = n === 0 && city.city_order > 0 && (city as any).transition_day_mode !== 'skip';
                const prevCity = city.city_order > 0 ? tripCities.find(c => c.city_order === city.city_order - 1) : null;
                map.push({
                  cityName: city.city_name || destination,
                  country: (city as any).country || destinationCountry,
                  isTransitionDay: isTransition,
                  transitionFrom: isTransition ? prevCity?.city_name : undefined,
                  transitionTo: isTransition ? city.city_name : undefined,
                  transportType: isTransition ? (city.transport_type || undefined) : undefined,
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
      const partialItinerary = {
        days: updatedDays,
        status: dayNumber >= totalDays ? 'ready' : 'generating',
        generatedAt: new Date().toISOString(),
      };

      // Progressive unlock: update unlocked_day_count = max(current, dayNumber)
      const { data: metaTrip } = await supabase.from('trips').select('metadata, unlocked_day_count').eq('id', tripId).single();
      const meta = (metaTrip?.metadata as Record<string, unknown>) || {};
      const currentUnlocked = (metaTrip as any)?.unlocked_day_count ?? 0;
      const newUnlocked = Math.max(currentUnlocked, dayNumber);

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
          },
        }).eq('id', tripId);

        console.log(`[generate-trip-day] ✅ Trip ${tripId} generation complete: ${totalDays} days`);

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
            if (response.ok || response.status < 500) {
              chainSuccess = true;
              break;
            }
            console.error(`[generate-trip-day] Chain attempt ${attempt}/${maxRetries} failed: ${response.status}`);
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
