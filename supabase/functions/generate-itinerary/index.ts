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
import { handleGenerateDay } from './action-generate-day.ts';
import type { ActionContext } from './action-types.ts';
import { GenerationTimer } from './generation-timer.ts';

// =============================================================================
// SHARED TYPES — Imported from generation-types.ts (single source of truth)
// =============================================================================
import type {
  MultiCityDayInfo,
  GenerationContext,
  StrictActivity,
  StrictDay,
  TravelAdvisory,
  LocalEventInfo,
  TripOverview,
  EnrichedItinerary,
  EnrichmentStats,
  ValidationViolation,
  ValidationWarning,
  ValidationResult,
  ValidationContext,
  VenueVerification,
  CachedVenue,
  DirectTripData,
} from './generation-types.ts';

// =============================================================================
// SHARED UTILITIES — Imported from generation-utils.ts
// =============================================================================
import {
  calculateDays,
  formatDate,
  timeToMinutes,
  calculateDuration,
  getCategoryIcon,
  normalizeVenueName,
  haversineDistanceKm,
  getDestinationId,
  getAirportTransferMinutes,
  getAirportTransferFare,
} from './generation-utils.ts';

// =============================================================================
// VENUE ENRICHMENT PIPELINE — Imported from venue-enrichment.ts
// =============================================================================
import {
  checkVenueCache,
  cacheVerifiedVenue,
  getDestinationCenter,
  verifyVenueWithGooglePlaces,
  verifyVenueWithDualAI,
  fetchActivityImage,
  isBookableActivity,
  searchViatorForActivity,
  enrichActivity,
  enrichActivityWithRetry,
  enrichItinerary,
} from './venue-enrichment.ts';

// =============================================================================
// EXTRACTED MODULES — Reduce bundle size for deploy
// =============================================================================
import {
  sanitizeDateString,
  sanitizeOptionFields,
  sanitizeAITextField,
  sanitizeGeneratedDay,
  sanitizeDateFields,
  normalizeDurationString,
  stripPhantomHotelActivities,
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

// Types (MultiCityDayInfo, GenerationContext, StrictActivity, StrictDay, TravelAdvisory,
// LocalEventInfo, TripOverview, EnrichedItinerary) moved to ./generation-types.ts

// currency-utils, intelligence fields, and isRecurringEvent moved to ./currency-utils.ts


// validateItineraryPersonalization + buildValidationContext moved to ./generation-types.ts


// getDestinationId moved to ./generation-utils.ts


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

// getAirportTransferFare, getAirportTransferMinutes moved to ./generation-utils.ts


// getFlightHotelContext moved to ./flight-hotel-context.ts

// getLearnedPreferences and getBehavioralEnrichment moved to ./preference-context.ts

// getUserPreferences, getTravelDNAV2, getTraitOverrides moved to ./preference-context.ts

// calculateDays, formatDate, timeToMinutes, calculateDuration, getCategoryIcon moved to ./generation-utils.ts


// =============================================================================
// STAGE 1: CONTEXT PREPARATION
// =============================================================================

// DirectTripData moved to ./generation-types.ts


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
          // Normalize hotel list: always work with an array
          const hotelList: any[] = Array.isArray(rawHotel) ? rawHotel : (rawHotel ? [rawHotel] : []);
          
          for (let n = 0; n < nights; n++) {
            const isTransition = n === 0 && i > 0;
            const isSameCountry = isTransition && tripCities[i - 1].country === city.country;
            const defaultTransport = isSameCountry ? 'train' : 'flight';
            const resolvedTransport = isTransition
              ? (city.transport_type || tripCities[i - 1].transport_type || defaultTransport)
              : undefined;

            // Date-aware hotel resolution for split-stay within a single city
            const dayDate = new Date(context.startDate);
            dayDate.setDate(dayDate.getDate() + dayMap.length);
            const dateStr = dayDate.toISOString().split('T')[0];

            let cityHotel: any = null;
            if (hotelList.length > 1) {
              // Try to match by date range (checkInDate/checkOutDate on each hotel)
              cityHotel = hotelList.find((h: any) => {
                const cin = h.checkInDate || h.check_in_date || context.startDate;
                const cout = h.checkOutDate || h.check_out_date;
                return cin && cout && dateStr >= cin && dateStr < cout;
              });
              // Fix A: If no hotel matched by date (dates missing), infer by evenly splitting nights
              if (!cityHotel) {
                const daysPerHotel = Math.max(1, Math.floor(nights / hotelList.length));
                const hotelIndex = Math.min(Math.floor(n / daysPerHotel), hotelList.length - 1);
                cityHotel = hotelList[hotelIndex];
                console.log(`[Stage 1] Split-stay date inference: day ${n} of ${nights} in ${city.city_name} → hotel[${hotelIndex}] "${cityHotel?.name}"`);
              }
            } else {
              cityHotel = hotelList[0] || null;
            }

            const hotelName = cityHotel?.name as string | undefined;
            const hotelAddress = cityHotel?.address as string | undefined;
            const hotelNeighborhood = (cityHotel?.neighborhood as string) || hotelAddress;
            const hotelCheckIn = (cityHotel?.checkIn || cityHotel?.checkInTime || cityHotel?.check_in) as string | undefined;
            const hotelCheckOut = (cityHotel?.checkOut || cityHotel?.checkOutTime || cityHotel?.check_out) as string | undefined;

            // Detect hotel change within same city (split-stay)
            const prevEntry = dayMap.length > 0 ? dayMap[dayMap.length - 1] : null;
            const isHotelChange = !!(prevEntry && prevEntry.hotelName && hotelName && prevEntry.hotelName !== hotelName && prevEntry.cityName === city.city_name);
            const previousHotelName = isHotelChange ? prevEntry!.hotelName : undefined;

            // Capture next-leg transport details on last day in city for departure prompt
            let nextLegTransport: string | undefined;
            let nextLegCity: string | undefined;
            let nextLegTransportDetails: Record<string, any> | undefined;
            if (n === nights - 1) {
              const nextCity = tripCities.find((c: any) => c.city_order === city.city_order + 1);
              if (nextCity) {
                const isSameCountryNext = nextCity.country === city.country;
                nextLegTransport = (nextCity as any).transport_type || (isSameCountryNext ? 'train' : 'flight');
                nextLegCity = nextCity.city_name || '';
                if ((nextCity as any).transport_details) {
                  const rawTd = (nextCity as any).transport_details;
                  nextLegTransportDetails = { ...rawTd };
                  if (rawTd.operator && !rawTd.carrier) nextLegTransportDetails!.carrier = rawTd.operator;
                  if (!rawTd.duration && rawTd.inTransitDuration) nextLegTransportDetails!.duration = rawTd.inTransitDuration;
                  if (nextLegTransport === 'car') {
                    if (rawTd.pickupLocation && !rawTd.departureStation) nextLegTransportDetails!.departureStation = rawTd.pickupLocation;
                    if (rawTd.rentalCompany && !rawTd.carrier) nextLegTransportDetails!.carrier = rawTd.rentalCompany;
                  }
                }
              }
            }

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
              isFirstDayInCity: n === 0 || isHotelChange,
              isLastDayInCity: n === nights - 1,
              isHotelChange,
              previousHotelName,
              nextLegTransport,
              nextLegCity,
              nextLegTransportDetails,
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
  sanitizeActivityTitles,
  detectMealSlots,
  enforceRequiredMealsFinalGuard,
  isChainRestaurant,
  filterChainRestaurants,
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
    
    // Per-day hotel override: use multi-city dayMap hotel when available (fixes wrong-hotel bug)
    const dayCity0 = context.multiCityDayMap?.[dayNumber - 1];
    const effectiveHotelData = (dayCity0?.hotelName)
      ? { hasHotel: true, hotelName: dayCity0.hotelName, hotelAddress: dayCity0.hotelAddress, hotelNeighborhood: dayCity0.hotelNeighborhood, checkInTime: dayCity0.hotelCheckIn || '15:00', checkOutTime: dayCity0.hotelCheckOut || '11:00' }
      : (context.hotelData || { hasHotel: false } as any);
    
    const { personaPrompt, dayConstraints } = buildDayPrompt(
      flightData,
      effectiveHotelData,
      context.travelerDNA,
      tripCtx,
      dayNumber,
      dayCity0?.isLastDayInCity ? {
        isLastDayInCity: true,
        nextLegTransport: dayCity0.nextLegTransport,
        nextLegCity: dayCity0.nextLegCity,
        nextLegTransportDetails: dayCity0.nextLegTransportDetails,
      } : undefined
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
    isFirstDay ? `12. **DAY 1 ARRIVAL STRUCTURE — CRITICAL**: Day 1 MUST begin with hotel arrival as the FIRST activity (category: accommodation). Travelers arrive with bags — getting to the hotel is the #1 priority. If no flight time is given, assume a morning arrival (10:00 AM luggage drop). The hotel standard check-in time is ${effectiveHotelData?.checkInTime || '15:00'}. If the traveler arrives BEFORE ${effectiveHotelData?.checkInTime || '15:00'}, title it "Luggage Drop & Early Exploration" and note "Early check-in subject to availability (standard check-in: ${effectiveHotelData?.checkInTime || '15:00'})" in the description. If arriving AT or AFTER ${effectiveHotelData?.checkInTime || '15:00'}, title it "Hotel Check-in & Refresh". Do NOT include "Arrival at Airport", "Arrival and Baggage Claim", or "Airport Transfer to Hotel" — arrival logistics are handled by a separate UI component.` : '',
    isLastDay && context.totalDays > 1 ? '12. LAST DAY MUST end with: Checkout → Transfer → Departure' : '',
    '13. **HOTEL FIDELITY — CRITICAL**: If a specific hotel name and address are provided in the accommodation section, you MUST use that EXACT hotel name for ALL accommodation activities (check-in, return to hotel, freshen up, checkout, etc.). Do NOT invent, substitute, or suggest a different hotel. The user has already booked their accommodation.',
    '14. **NO KEYWORD STUFFING**: Activity titles must be concise (max 8 words). NEVER pad titles with synonym lists of location types (e.g., "borough town place locale district quarter sector area"). Use the specific venue or activity name only.',
    '15. **ALL REAL VENUE NAMES — CRITICAL**: ALL activities must use REAL, SPECIFIC venue names — not generic descriptions. This applies to ALL categories (wellness, cafés, nightlife, shopping, etc.), not just dining. WRONG: "Boutique Wellness in Omotesando". WRONG: "a kissaten". WRONG: "Local Spa". RIGHT: "Omotesando Koffee". RIGHT: "Kayabacho Sabō". RIGHT: "HIGASHIYA GINZA".',
    !isFirstDay ? '16. **NO CHECK-IN ON NON-ARRIVAL DAYS**: On days after Day 1 (or after the first day at a new hotel), do NOT title accommodation activities as "Check-in at [Hotel]". Use "Return to [Hotel]" or "Freshen up at [Hotel]" instead. "Check-in" implies arrival — use it only on the day the traveler first arrives at that hotel.' : '',
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
            const nextLegTransport = dayCity.nextLegTransport || nextDayInfo?.transportType || 'flight';
            const nextLegCity = dayCity.nextLegCity || nextDayInfo?.cityName || 'the next destination';
            const isNonFlightFullGen = nextLegTransport !== 'flight';
            const transportLabelFullGen = nextLegTransport.toUpperCase();
            multiCityPrompt += `\n   📍 CHECKOUT & DEPARTURE DAY: Traveler checks out of ${dayCity.hotelName} (typically by 11:00 AM). The traveler departs TODAY by ${transportLabelFullGen} to ${nextLegCity}. Plan morning around checkout — breakfast at/near hotel, pack and check out, then transfer to ${isNonFlightFullGen ? transportLabelFullGen.toLowerCase() + ' station' : 'airport'} and depart.`;
            if (isNonFlightFullGen) {
              multiCityPrompt += `\n   ⚠️ DO NOT mention airports, flights, or "Transfer to Airport". The next leg is by ${transportLabelFullGen}.`;
              multiCityPrompt += `\n   ⚠️ IGNORE any flight departure data in the system prompt. This is NOT a flight departure day. Plan checkout → transfer to ${transportLabelFullGen.toLowerCase()} station → departure by ${transportLabelFullGen}.`;
              // Inject real transport schedule if available
              const nextTd = dayCity.nextLegTransportDetails || nextDayInfo?.nextLegTransportDetails;
              if (nextTd?.departureTime) {
                multiCityPrompt += `\n   🚆 CONFIRMED ${transportLabelFullGen} SCHEDULE: Departs ${nextTd.departureTime}${nextTd.departureStation ? ` from ${nextTd.departureStation}` : ''}${nextTd.carrier ? ` (${nextTd.carrier})` : ''}. Plan checkout and transfer backwards from this time.`;
              }
            }
          }
          
          // Hotel change within same city (split-stay)
          if ((dayCity as any).isHotelChange && (dayCity as any).previousHotelName) {
            const prevHotel = (dayCity as any).previousHotelName;
            multiCityPrompt += `\n   📍 HOTEL CHANGE: Traveler checks out of "${prevHotel}" and checks into "${dayCity.hotelName}".`;
            multiCityPrompt += `\n   Plan checkout from "${prevHotel}" in the morning (by ${checkOutTime}), then check-in at "${dayCity.hotelName}" (from ${checkInTime}), then afternoon/evening activities.`;
            multiCityPrompt += `\n   Include BOTH a checkout activity for "${prevHotel}" AND a check-in activity for "${dayCity.hotelName}".`;
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
        generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(toolCall.function.arguments))), dayNumber, dayDestination) as StrictDay;
      } else if (message?.content) {
        // Fallback: AI returned content instead of tool call
        console.log("[Stage 2] AI returned content instead of tool_call, attempting to parse...");
        try {
          const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
          const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(jsonMatch[0]))), dayNumber, dayDestination) as StrictDay;
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

        // Clamp end-of-day accommodation cards to realistic duration
        const accomTitle = (normalizedAct.title || '').toLowerCase();
        const isReturnToHotel = normalizedAct.category?.toLowerCase() === 'accommodation' &&
          (accomTitle.includes('return to') || accomTitle.includes('freshen up') || 
           accomTitle.includes('rest at') || accomTitle.includes('back to') ||
           accomTitle.includes('wind down') || accomTitle.includes('settle in'));

        if (isReturnToHotel && normalizedAct.durationMinutes > 60) {
          const clampedDuration = 15;
          const origDuration = normalizedAct.durationMinutes;
          normalizedAct.durationMinutes = clampedDuration;
          if (normalizedAct.startTime) {
            const startMins = parseTimeToMinutes(normalizedAct.startTime);
            if (startMins !== null) {
              normalizedAct.endTime = minutesToHHMM(startMins + clampedDuration);
            }
          }
          normalizedAct.duration = '15 min';
          console.log(`[Duration fix] Clamped "${normalizedAct.title}" from ${origDuration}min to ${clampedDuration}min`);
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

      // ==========================================================================
      // PHANTOM HOTEL STRIPPING: Remove fabricated hotel activities when no hotel booked
      // ==========================================================================
      {
        const hasHotel = !!(dayCity?.hotelName || context.hotelData?.hotelName);
        if (!hasHotel) {
          stripPhantomHotelActivities(generatedDay, false);
        }
      }





      // from Return to Hotel descriptions that reference non-existent next-day plans
      // ==========================================================================
      {
        const hotelName = dayCity?.hotelName || context.hotelData?.hotelName || 'your hotel';
        for (const act of generatedDay.activities) {
          const cat = (act.category || '').toLowerCase();
          const title = (act.title || '').toLowerCase();
          const isReturnAccom = cat === 'accommodation' &&
            (title.includes('return to') || title.includes('freshen up') || title.includes('back to') || title.includes('settle in'));
          if (isReturnAccom && act.description && /tomorrow/i.test(act.description)) {
            console.log(`[Forward-ref fix] Stripping hallucinated tomorrow reference from "${act.title}": "${act.description}"`);
            act.description = `Time at ${hotelName} to rest and refresh.`;
          }
        }
      }

      // ==========================================================================
      // GENERIC TITLE VALIDATOR: Flag and clean placeholder business names
      // ==========================================================================
      {
        const INDEFINITE_ARTICLE_START = /^(a|an)\s+[a-z]/i;
        const VAGUE_TITLE_KEYWORDS = /\b(or high.end|or similar|boutique wellness|local spa|nearby caf[eé])\b/i;
        for (const act of generatedDay.activities) {
          const title = (act.title || '').trim();
          if (INDEFINITE_ARTICLE_START.test(title) || VAGUE_TITLE_KEYWORDS.test(title)) {
            act.title = sanitizeAITextField(title);
            console.log(`[Generic title warning] "${title}" may be a placeholder — cleaned to "${act.title}"`);
          }
        }
      }

      // Post-processing: Rename "Check-in at X" to "Return to X" on non-arrival days
      const effectiveIsFirstDay = context.isFirstDayInCity !== undefined ? context.isFirstDayInCity : isFirstDay;
      if (!effectiveIsFirstDay) {
        for (const act of generatedDay.activities) {
          const title = (act.title || '').toLowerCase();
          const cat = (act.category || '').toLowerCase();
          if ((cat === 'accommodation' || cat === 'stay' || title.includes('check-in') || title.includes('check in'))
              && !title.includes('checkout') && !title.includes('check-out') && !title.includes('check out')) {
            const checkInMatch = act.title?.match(/check[- ]?in\s+(at|to|—|–|-|@)\s+/i);
            if (checkInMatch) {
              const hotelPart = act.title!.slice(checkInMatch.index! + checkInMatch[0].length);
              act.title = `Return to ${hotelPart}`;
              if (act.location?.name) {
                act.location.name = act.title;
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
          const locName = (a.location?.name || '').toLowerCase();
          const desc = (a.description || '').toLowerCase();
          const isAirportRef =
            t.includes('airport') ||
            t.includes('taxi to airport') ||
            t.includes('transfer to airport') ||
            t.includes('departure transfer to airport') ||
            t.includes('flight departure') ||
            t.includes('head to airport') ||
            (a.category === 'transport' && (locName.includes('airport') || locName.includes('aeroporto') || locName.includes('aéroport')));
          const descAirportRef = a.category === 'transport' && desc.includes('airport');
          return !isAirportRef && !descAirportRef;
        });
        const removed = beforeCount - generatedDay.activities.length;
        if (removed > 0) {
          console.log(`[Stage 2] Day ${dayNumber}: Stripped ${removed} airport activities (next leg is ${nextLegTransport}, not flight)`);
        }
      }

      // ==========================================================================
      // MULTI-CITY DEPARTURE DAY: Dedup checkout activities
      // ==========================================================================
      if (isLastDayInCity) {
        const checkoutActivities = (generatedDay.activities || []).filter((a: any) => {
          const t = (a.title || '').toLowerCase();
          return t.includes('checkout') || t.includes('check-out') || t.includes('check out') ||
                 t.includes('departure preparation');
        });
        if (checkoutActivities.length > 1) {
          const keepId = checkoutActivities.find((a: any) => a.category === 'accommodation')?.id 
                         || checkoutActivities[0].id;
          const removeIds = new Set(checkoutActivities.filter((a: any) => a.id !== keepId).map((a: any) => a.id));
          generatedDay.activities = generatedDay.activities.filter((a: any) => !removeIds.has(a.id));
          console.log(`[Stage 2] Day ${dayNumber}: Deduped ${removeIds.size} duplicate checkout activities`);
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
        const isMultiCityDepartureDay = isLastDayInCity && !isLastDay;
        const minimumRealActivities = isLastDay ? 1 : (isMultiCityDepartureDay ? 1 : (isFirstDay ? 3 : 5));
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
      // USER PREFERENCE VALIDATION — scoped to explicit user preferences only
      // ==========================================================================
      {
        // IMPORTANT: Only check against explicit user preference fields (interests,
        // focus, avoid), NOT the full preferenceContext which includes venue names,
        // research notes, and activity titles that would cause false positives.
        const explicitInterests = (context.userConstraints || [])
          .filter((c: any) => c?.type === 'preference' || c?.type === 'focus' || c?.type === 'interest')
          .map((c: any) => (c?.value || c?.text || '').toLowerCase())
          .join(' ');
        const coreInterests = (context.travelerDNA?.interests || []).map((i: string) => i.toLowerCase()).join(' ');
        const userPreferenceText = `${explicitInterests} ${coreInterests}`.trim();

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

        // Skip this check entirely for Smart Finish — user's venues are already
        // hard-anchored as must-do activities, so the generation includes them naturally.
        if (!context.isSmartFinish && userPreferenceText.length > 0) {
          for (const [activity, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
            if (userPreferenceText.includes(activity)) {
              const dayHasThis = keywords.some(kw => allActivityText.includes(kw));
              if (!dayHasThis && !isLastDay) {
                // Downgrade to warning — the trip as a whole should include the activity,
                // but demanding it on every single day causes infinite retry loops.
                console.warn(`[Stage 2] User preference includes "${activity}" but Day ${dayNumber} has no matching activities — logged as warning`);
                validation.warnings.push(
                  `User preference includes "${activity}" but Day ${dayNumber} has no matching activities. Consider including one if it fits the day's flow.`
                );
                // Do NOT set validation.isValid = false — this is advisory only
              }
            }
          }
        }

        // Check for "light dining" preference violations
        const wantsLightDining = userPreferenceText.includes('light dinner') || userPreferenceText.includes('light meal') || userPreferenceText.includes('casual dinner') || userPreferenceText.includes('simple dinner') || userPreferenceText.includes('quick bite');
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
        const wantsBudget = userPreferenceText.includes('budget') || userPreferenceText.includes('cheap') || userPreferenceText.includes('affordable') || userPreferenceText.includes('save money') || userPreferenceText.includes('low cost');
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

      // ==========================================================================
      // MUST-DO ENFORCEMENT: Check that must-dos assigned to this day are present
      // ==========================================================================
      if (context.mustDoActivities && context.mustDoActivities.trim()) {
        try {
          const forceAllMust = !!context.isSmartFinish || !!context.smartFinishRequested;
          const parsedMustDos = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust, context.startDate, context.totalDays);
          if (parsedMustDos.length > 0) {
            const mustDoSchedule = scheduleMustDos(parsedMustDos, context.totalDays);
            // Filter to must-dos assigned to THIS day
            const thisDayMustDos = mustDoSchedule.scheduled
              .filter(s => s.assignedDay === dayNumber && s.priority.priority !== 'nice')
              .map(s => s.priority);

            if (thisDayMustDos.length > 0) {
              const dayForValidation = [{
                dayNumber,
                activities: (generatedDay.activities || []).map((a: any) => ({ title: a.title || a.name || '', description: a.description || '' })),
              }];
              const mustDoResult = validateMustDosInItinerary(dayForValidation, thisDayMustDos, context.destination);
              if (!mustDoResult.allPresent && mustDoResult.missing.length > 0) {
                const missingNames = mustDoResult.missing.map(m => `"${m.activityName}"`).join(', ');
                console.warn(`[Stage 2] Day ${dayNumber}: MISSING must-do activities: ${missingNames} — triggering retry`);
                validation.errors.push(
                  `CRITICAL: The user's NON-NEGOTIABLE must-do activities are MISSING from Day ${dayNumber}: ${missingNames}. You MUST include these activities by name. The user explicitly requested them — failing to include them is unacceptable.`
                );
                validation.isValid = false;
              }
            }
          }
        } catch (mustDoCheckErr) {
          console.warn(`[Stage 2] Day ${dayNumber} must-do check error (non-blocking):`, mustDoCheckErr);
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
        // POST-VALIDATION: Strip trip-wide duplicates on last-attempt acceptance
        if (isLastAttempt && validation.errors.length > 0) {
          const duplicateTitles: string[] = [];
          for (const err of validation.errors) {
            const titleMatch = err.match(/(?:TRIP-WIDE DUPLICATE|CONCEPT SIMILARITY):\s*"([^"]+)"/i);
            if (titleMatch) duplicateTitles.push(titleMatch[1].toLowerCase());
          }
          if (duplicateTitles.length > 0) {
            const beforeCount = generatedDay.activities.length;
            generatedDay.activities = generatedDay.activities.filter(a => {
              const title = (a.title || '').toLowerCase();
              return !duplicateTitles.some(dt => title.includes(dt) || dt.includes(title));
            });
            const removedCount = beforeCount - generatedDay.activities.length;
            if (removedCount > 0) {
              console.log(`[Stage 2] Stripped ${removedCount} trip-wide duplicate(s) on last attempt for Day ${dayNumber}`);
            }
          }
        }

        // POST-VALIDATION: Strip any duplicate activities that slipped through
        // Pass requiredMeals so dedup won't remove the sole provider of a required meal
        const { day: dedupedDay, removed: removedDupes } = deduplicateActivities(generatedDay, dayMealPolicy.requiredMeals);
        if (removedDupes.length > 0) {
          console.warn(`[Stage 2] Day ${dayNumber}: Removed ${removedDupes.length} duplicate(s): ${removedDupes.join(', ')}`);
          generatedDay = dedupedDay;
        }

        // POST-VALIDATION: Strip keyword-stuffed activity titles
        generatedDay = sanitizeActivityTitles(generatedDay);

        // POST-VALIDATION: Strip chain restaurants from dining activities
        {
          const { filtered: chainFiltered, removedChains } = filterChainRestaurants(generatedDay.activities || []);
          if (removedChains.length > 0) {
            console.warn(`[Stage 2] Day ${dayNumber}: 🚫 Chain filter removed ${removedChains.length} chain(s): ${removedChains.join(', ')}`);
            generatedDay.activities = chainFiltered;
          }
        }

        // ====================================================================
        // MEAL FINAL GUARD — shared helper, single source of truth
        // Runs AFTER all post-processing (dedup, etc.) to guarantee meals
        // ====================================================================
        const mealGuardResult = enforceRequiredMealsFinalGuard(
          generatedDay.activities || [],
          dayMealPolicy.requiredMeals,
          dayNumber,
          context.destination || 'the destination',
          context.currency || 'USD',
          dayMealPolicy.dayMode,
        );
        if (!mealGuardResult.alreadyCompliant) {
          // If NOT the last attempt, treat meal guard firing as a retry trigger
          // instead of silently accepting placeholders
          if (!isLastAttempt) {
            const missingList = mealGuardResult.injectedMeals.map(m => m.toUpperCase()).join(', ');
            console.warn(`[Stage 2] Day ${dayNumber}: Meal guard detected missing [${missingList}] — triggering retry instead of accepting placeholders`);
            // Add specific meal-missing errors to trigger a focused retry
            lastValidation = {
              isValid: false,
              errors: [
                `🚨 MISSING MEALS: Your response is missing ${missingList} dining activities. You MUST include a REAL, NAMED restaurant for each of: ${missingList}. Generic names like "Local Café" or "Breakfast spot" are NOT acceptable. Include the actual restaurant name, category="dining", and the meal type keyword in the title.`
              ],
              warnings: [],
            };
            lastError = new Error(`Meal guard fired: missing [${missingList}]`);
            console.log(`[Stage 2] Day ${dayNumber} missing meals [${missingList}], retrying (attempt ${attempt + 1})...`);
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
            continue;
          }
          // Last attempt — accept the guard fallbacks
          generatedDay.activities = mealGuardResult.activities as any;
          console.warn(`[Stage 2] Day ${dayNumber}: FINAL ATTEMPT — Meal guard injected [${mealGuardResult.injectedMeals.join(', ')}] (destination-aware fallbacks)`);
        } else {
          console.log(`[Stage 2] Day ${dayNumber}: Meal guard passed — all required meals present`);
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

  // ── Post-batch dedup pass (concept-similarity) ──────────────────
  // Within a parallel batch, days can't see each other's activities,
  // so duplicates may appear. Use concept similarity to catch renamed
  // versions of the same attraction (e.g. "Stroll Imperial Palace East Gardens"
  // vs "Imperial Palace East Gardens Exploration").
  const DEDUP_STRIP_VERBS = /\b(guided|visit|explore|discover|tour|walk|stroll|head|go|return|morning|afternoon|evening|a|an|the|to|of|at|in|on|and|with|for|exploration|adventure)\b/g;
  const dedupConceptSimilarity = (a: string, b: string): boolean => {
    if (!a || !b || a.length < 5 || b.length < 5) return false;
    if (a === b) return true;
    const mealKeywords = ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'cafe', 'dessert', 'snack', 'food', 'eat', 'meal', 'drinks', 'cocktail', 'bar'];
    const aHasMeal = mealKeywords.some(kw => a.includes(kw));
    const bHasMeal = mealKeywords.some(kw => b.includes(kw));
    if (aHasMeal !== bHasMeal) return false;
    if (a.includes(b) || b.includes(a)) return true;
    const aVenue = a.replace(DEDUP_STRIP_VERBS, '').replace(/\s+/g, ' ').trim();
    const bVenue = b.replace(DEDUP_STRIP_VERBS, '').replace(/\s+/g, ' ').trim();
    if (aVenue.length > 5 && bVenue.length > 5 && (aVenue.includes(bVenue) || bVenue.includes(aVenue))) return true;
    const aWords = new Set(a.split(/\s+/));
    const bWords = new Set(b.split(/\s+/));
    const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 3);
    const minLen = Math.min(aWords.size, bWords.size);
    return minLen > 0 && intersection.length / minLen > 0.6;
  };

  const seenConcepts: Array<{ concept: string; dayNum: number }> = [];
  let dedupCount = 0;
  for (const day of days) {
    const indicesToRemove: number[] = [];
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i];
      const key = (act.title || act.name || '').toLowerCase().trim();
      if (!key) continue;
      // Skip logistics/accommodation — duplicates are expected (hotel check-in, etc.)
      const cat = (act.category || '').toLowerCase();
      if (['transport', 'transportation', 'accommodation', 'transfer', 'logistics'].includes(cat)) continue;

      const match = seenConcepts.find(s => s.dayNum !== day.dayNumber && dedupConceptSimilarity(key, s.concept));
      if (match) {
        // Remove the later occurrence instead of renaming
        console.log(`[Stage 2] Cross-batch dedup: removed "${act.title}" from Day ${day.dayNumber} (similar to "${match.concept}" on Day ${match.dayNum})`);
        indicesToRemove.push(i);
        dedupCount++;
      } else {
        seenConcepts.push({ concept: key, dayNum: day.dayNumber });
      }
    }
    // Remove in reverse order to preserve indices
    for (let r = indicesToRemove.length - 1; r >= 0; r--) {
      day.activities.splice(indicesToRemove[r], 1);
    }
  }
  if (dedupCount > 0) {
    console.log(`[Stage 2] Post-batch dedup: removed ${dedupCount} concept-similar duplicate activities`);
  }

  // Post-generation category normalizer — fix invalid or mismatched categories
  const VALID_CATEGORIES = new Set([
    'sightseeing', 'dining', 'cultural', 'shopping',
    'relaxation', 'transport', 'accommodation', 'activity'
  ]);
  const BAR_KEYWORDS = /\b(bar|lounge|cocktail|nightcap|pub|drinks?|wine\s*bar|rooftop\s*bar|izakaya|sake|whisky|bourbon|speakeasy|taproom)\b/i;
  const DINING_KEYWORDS = /\b(restaurant|cafe|coffee|bistro|brasserie|eatery|brunch|breakfast|lunch|dinner|ramen|sushi|food)\b/i;
  const WELLNESS_KEYWORDS = /\b(spa|massage|onsen|bath|meditation|yoga|wellness)\b/i;

  for (const day of days) {
    for (const act of day.activities || []) {
      const cat = (act.category || '').toLowerCase();
      const titleDesc = `${act.title || ''} ${act.description || ''}`;

      if (!VALID_CATEGORIES.has(cat)) {
        // Invalid category — remap based on content
        if (BAR_KEYWORDS.test(titleDesc) || DINING_KEYWORDS.test(titleDesc)) {
          console.log(`[Category fix] "${act.title}": "${cat}" → "dining"`);
          act.category = 'dining';
        } else if (WELLNESS_KEYWORDS.test(titleDesc)) {
          console.log(`[Category fix] "${act.title}": "${cat}" → "relaxation"`);
          act.category = 'relaxation';
        } else {
          console.log(`[Category fix] "${act.title}": "${cat}" → "activity"`);
          act.category = 'activity';
        }
      }
      // Also catch valid-but-wrong: "relaxation" used for bars
      else if (cat === 'relaxation' && BAR_KEYWORDS.test(titleDesc)) {
        console.log(`[Category fix] "${act.title}": relaxation → dining (bar/lounge)`);
        act.category = 'dining';
      }
    }
  }

  // Post-generation: fix breakfast at wrong hotel
  const HOTEL_BRAND_KEYWORDS = /\b(hotel|palace|hyatt|marriott|hilton|ritz|aman|mandarin|peninsula|shangri|intercontinental|westin|sheraton|conrad|waldorf|st\.?\s*regis|four\s*seasons|park\s*hyatt|andaz|w\s+hotel|rosewood|fairmont|langham|sofitel|oberoi|raffles|banyan\s*tree|capella|edition)\b/i;
  const primaryHotelName = context.hotelData?.hotelName || context.multiCityDayMap?.[0]?.hotelName;
  if (primaryHotelName) {
    const hotelNameLower = primaryHotelName.toLowerCase();
    // Extract last 2 significant words for matching (e.g. "Four Seasons Hotel Tokyo at Otemachi" → "at otemachi")
    const hotelNameParts = hotelNameLower.split(/\s+/).filter(w => w.length > 1);
    const hotelMatchFragment = hotelNameParts.slice(-2).join(' ');
    
    for (const day of days) {
      // For multi-city trips, use per-day hotel if available
      const dayCity = context.multiCityDayMap?.[day.dayNumber - 1];
      const dayHotelName = dayCity?.hotelName || primaryHotelName;
      const dayHotelLower = dayHotelName.toLowerCase();
      const dayHotelParts = dayHotelLower.split(/\s+/).filter((w: string) => w.length > 1);
      const dayHotelMatch = dayHotelParts.slice(-2).join(' ');
      
      for (const act of day.activities || []) {
        const title = (act.title || '').toLowerCase();
        const isBreakfast = title.includes('breakfast') && 
          (act.category || '').toLowerCase() === 'dining';
        if (!isBreakfast) continue;
        
        const mentionsOtherHotel = HOTEL_BRAND_KEYWORDS.test(title) && 
          !title.includes(dayHotelMatch);
        
        if (mentionsOtherHotel) {
          const oldTitle = act.title;
          act.title = `Breakfast at ${dayHotelName}`;
          act.description = `Start the morning at your hotel's restaurant.`;
          if (act.location) act.location.name = dayHotelName;
          console.log(`[Breakfast fix] Changed "${oldTitle}" → "${act.title}"`);
        }
      }
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
// STAGE 4: ENRICHMENT — moved to ./venue-enrichment.ts
// (VenueVerification, CachedVenue, normalizeVenueName, checkVenueCache,
//  cacheVerifiedVenue, verifyVenueWithDualAI, verifyVenueWithGooglePlaces,
//  getDestinationCenter, destinationCenterCache, fetchActivityImage,
//  isBookableActivity, searchViatorForActivity, enrichActivity,
//  EnrichmentStats, enrichActivityWithRetry, enrichItinerary)
// =============================================================================


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
                  status: 'placeholder',
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
    // PHASE 4: Write activity_costs rows — TABLE-DRIVEN from cost_reference
    // The AI does NOT set costs. All costs come from the cost_reference table.
    // =========================================================================
    try {
      const allDays = enrichedData.days || [];
      const costRows: Array<Record<string, unknown>> = [];
      const destinationCity = (context.destination || '').split(',')[0].trim();

      // Load cost_reference for this destination + global fallbacks
      const { data: allRefs } = await supabase
        .from('cost_reference')
        .select('*')
        .or(`destination_city.ilike.${destinationCity},destination_city.eq._global`);

      // Build lookup map: city|category|subcategory → ref row (city-specific wins over _global)
      const refMap = new Map<string, any>();
      if (allRefs) {
        // Insert globals first, then city-specific (so city overrides global)
        const sorted = [...allRefs].sort((a, b) =>
          (a.destination_city === '_global' ? 0 : 1) - (b.destination_city === '_global' ? 0 : 1)
        );
        for (const r of sorted) {
          const prefix = r.destination_city === '_global' ? '_global' : destinationCity.toLowerCase();
          if (r.subcategory) {
            refMap.set(`${prefix}|${r.category}|${r.subcategory}`, r);
            // Also set without prefix for global fallback
            if (r.destination_city === '_global') {
              refMap.set(`_fb|${r.category}|${r.subcategory}`, r);
            }
          }
          // Category-only fallback (first match wins per city)
          const catKey = `${prefix}|${r.category}|`;
          if (!refMap.has(catKey)) refMap.set(catKey, r);
          if (r.destination_city === '_global') {
            const fbCatKey = `_fb|${r.category}|`;
            if (!refMap.has(fbCatKey)) refMap.set(fbCatKey, r);
          }
        }
      }

      // Subcategory inference from title keywords
      const transportKw: Record<string, string[]> = {
        taxi: ['taxi', 'cab', 'uber', 'grab', 'lyft', 'ride', 'private car', 'rideshare'],
        airport_transfer: ['airport transfer', 'airport shuttle', 'airport bus', 'airport express'],
        metro: ['metro', 'subway', 'mrt', 'mtr', 'underground'],
        bus: ['bus', 'shuttle bus', 'city bus'],
        train: ['train', 'rail', 'shinkansen'],
        ferry: ['ferry', 'boat', 'water taxi', 'star ferry', 'junk boat'],
      };
      const diningKw: Record<string, string[]> = {
        street_food: ['street food', 'hawker', 'night market food', 'dai pai dong', 'food stall'],
        cafe: ['cafe', 'café', 'coffee', 'bakery'],
        breakfast: ['breakfast', 'morning meal'],
        lunch: ['lunch', 'brunch'],
        dinner: ['dinner', 'supper'],
        ramen: ['ramen', 'noodle shop'],
        fine_dining: ['fine dining', 'michelin', 'omakase', 'tasting menu'],
      };

      function inferSubcategory(title: string, category: string): string | null {
        const t = title.toLowerCase();
        if (category === 'transport') {
          for (const [sub, kws] of Object.entries(transportKw)) {
            if (kws.some(kw => t.includes(kw))) return sub;
          }
        }
        if (category === 'dining') {
          for (const [sub, kws] of Object.entries(diningKw)) {
            if (kws.some(kw => t.includes(kw))) return sub;
          }
        }
        if (category === 'activity') {
          if (t.includes('museum')) return 'museum';
          if (t.includes('temple') || t.includes('shrine')) return 'temple';
          if (t.includes('tour')) return 'tour';
        }
        return null;
      }

      // Budget tier determines which column to pick from cost_reference
      const budgetTier = (context.budgetTier || 'moderate').toLowerCase();

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

      for (const day of allDays) {
        for (const act of (day.activities || [])) {
          const cat = (act.category || 'activity').toLowerCase();
          if (['downtime', 'free_time', 'accommodation'].includes(cat)) continue;

          const mappedCategory = categoryMap[cat] || 'activity';
          const titleLower = ((act as any).title || '').toLowerCase();

          // Skip walks — they're always free
          const isWalk = ['walk', 'walking', 'stroll'].includes(cat) ||
            ['walk to', 'walk through', 'stroll', 'evening walk', 'neighborhood walk'].some(kw => titleLower.includes(kw));
          if (isWalk) {
            costRows.push({
              trip_id: tripId,
              activity_id: act.id,
              day_number: day.dayNumber || 1,
              cost_per_person_usd: 0,
              num_travelers: context.travelers || 1,
              category: mappedCategory,
              source: 'reference',
              confidence: 'high',
            });
            continue;
          }

          // Look up cost_reference: try city+category+subcategory, then city+category, then global
          const subcategory = inferSubcategory(titleLower, mappedCategory);
          const cityKey = destinationCity.toLowerCase();
          let ref: any = null;

          if (subcategory) {
            ref = refMap.get(`${cityKey}|${mappedCategory}|${subcategory}`);
          }
          if (!ref) {
            ref = refMap.get(`${cityKey}|${mappedCategory}|`);
          }
          if (!ref && subcategory) {
            ref = refMap.get(`_fb|${mappedCategory}|${subcategory}`);
          }
          if (!ref) {
            ref = refMap.get(`_fb|${mappedCategory}|`);
          }

          let costPerPerson: number;
          let costRefId: string | null = null;
          let source = 'reference';
          let confidence = 'medium';

          if (ref) {
            costRefId = ref.id;
            switch (budgetTier) {
              case 'budget': case 'saver': costPerPerson = Number(ref.cost_low_usd); break;
              case 'moderate': case 'comfort': costPerPerson = Number(ref.cost_mid_usd); break;
              case 'premium': case 'luxury': costPerPerson = Number(ref.cost_high_usd); break;
              default: costPerPerson = Number(ref.cost_mid_usd);
            }
            confidence = ref.confidence || 'medium';
          } else {
            // No reference at all — use conservative hardcoded defaults
            const defaults: Record<string, number> = {
              dining: 20, transport: 10, activity: 15, nightlife: 15, shopping: 15,
            };
            costPerPerson = defaults[mappedCategory] || 15;
            source = 'fallback';
            confidence = 'low';
            console.log(`[Phase 4] No cost_reference for "${(act as any).title}" (${mappedCategory}/${subcategory || 'none'}), using fallback $${costPerPerson}`);
          }

          // Round to nearest $5 for cleaner display (except small amounts < $5)
          if (costPerPerson >= 5) {
            costPerPerson = Math.round(costPerPerson / 5) * 5;
          }

          costRows.push({
            trip_id: tripId,
            activity_id: act.id,
            day_number: day.dayNumber || 1,
            cost_per_person_usd: Math.min(costPerPerson, 2000),
            num_travelers: context.travelers || 1,
            category: mappedCategory,
            source,
            confidence,
            cost_reference_id: costRefId,
          });
        }
      }

      // ─── POST-GENERATION BUDGET VALIDATION ───
      // If the user set a real budget, scale down reference costs that overshoot it
      // Round scaled values to nearest $5 to avoid "random-looking" numbers
      if (costRows.length > 0 && context.actualDailyBudgetPerPerson != null && context.actualDailyBudgetPerPerson > 0) {
        const budgetCap = context.actualDailyBudgetPerPerson;
        const tolerance = 1.2;

        const dayGroups = new Map<number, typeof costRows>();
        for (const row of costRows) {
          const dayNum = row.day_number as number;
          if (!dayGroups.has(dayNum)) dayGroups.set(dayNum, []);
          dayGroups.get(dayNum)!.push(row);
        }

        for (const [dayNum, rows] of dayGroups) {
          const dayTotal = rows.reduce((sum, r) => sum + (r.cost_per_person_usd as number), 0);

          if (dayTotal > budgetCap * tolerance) {
            const scaleFactor = (budgetCap * 1.1) / dayTotal;
            console.log(`[Budget Validation] Day ${dayNum}: $${dayTotal.toFixed(0)}/pp exceeds cap $${budgetCap.toFixed(0)}/pp. Scaling by ${scaleFactor.toFixed(2)}`);
            for (const row of rows) {
              const original = row.cost_per_person_usd as number;
              let scaled = original * scaleFactor;
              // Round to nearest $5 (minimum $1 for non-zero items)
              if (scaled >= 5) {
                scaled = Math.round(scaled / 5) * 5;
              } else if (scaled > 0) {
                scaled = Math.max(1, Math.round(scaled));
              }
              (row as any).cost_per_person_usd = scaled;
              (row as any).notes = `[Budget-scaled from $${original.toFixed(0)}]`;
            }
          }
        }
      }

      if (costRows.length > 0) {
        await supabase.from('activity_costs').delete().eq('trip_id', tripId);
        const { error: costErr } = await supabase.from('activity_costs').insert(costRows);
        if (costErr) {
          console.warn('[Stage 6] activity_costs insert error (non-blocking):', costErr.message);
        } else {
          console.log(`[Stage 6] Wrote ${costRows.length} activity_costs rows (table-driven)`);
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
        travelerCount: context.travelers || 1,
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
          'wine': 'At least 1 wine experience per city (vineyard tour, wine tasting, wine bar, sommelier-led experience). In wine regions (Tuscany, Sicily/Etna, Bordeaux, Napa, Mendoza, etc.) this should be a HIGHLIGHT activity, not a footnote.',
          'wine & spirits': 'At least 1 wine/spirits experience per city (vineyard, distillery, tasting room, cocktail masterclass)',
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
            const firstStartMin_56 = parseTimeToMinutes(firstActivity_56?.startTime || '10:00') || (10 * 60);
            const checkInStartMin_56 = Math.max(9 * 60, firstStartMin_56 - 45);
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
      // STAGE 2.57: Enforce check-in-first ordering on arrival days
      // If check-in exists but isn't the earliest activity, shift pre-check-in
      // activities to after check-in ends.
      // =======================================================================
      if (aiResult.days.length > 0) {
        const isCheckInActivity = (a: any) => {
          const t = (a.title || '').toLowerCase();
          const cat = (a.category || '').toLowerCase();
          return cat === 'accommodation' && (
            t.includes('check-in') || t.includes('check in') ||
            t.includes('checkin') || t.includes('settle in') ||
            t.includes('refresh') || t.includes('hotel')
          );
        };

        // Determine which day indices are arrival days (Day 1 + first day in each new city)
        const arrivalDayIndices = new Set<number>([0]);
        if (context.multiCityDayMap && aiResult.days.length > 1) {
          let prevDest = '';
          for (let dIdx = 0; dIdx < aiResult.days.length; dIdx++) {
            const dest = context.multiCityDayMap[dIdx]?.destination || '';
            if (dest && dest !== prevDest && prevDest !== '') {
              arrivalDayIndices.add(dIdx);
            }
            prevDest = dest;
          }
        }

        for (const dIdx of arrivalDayIndices) {
          const day = aiResult.days[dIdx];
          if (!day?.activities || day.activities.length < 2) continue;

          const checkInIdx = day.activities.findIndex((a: any) => isCheckInActivity(a));
          if (checkInIdx < 0) continue; // no check-in to enforce

          const checkIn = day.activities[checkInIdx];
          const checkInStartMin = parseTimeToMinutes(checkIn.startTime);
          const checkInEndMin = parseTimeToMinutes(checkIn.endTime) || (checkInStartMin + 30);

          // Find activities scheduled before check-in
          const preCheckInActivities: any[] = [];
          const postCheckInActivities: any[] = [];

          for (let i = 0; i < day.activities.length; i++) {
            if (i === checkInIdx) continue;
            const actStart = parseTimeToMinutes(day.activities[i].startTime);
            if (actStart < checkInStartMin) {
              preCheckInActivities.push(day.activities[i]);
            } else {
              postCheckInActivities.push(day.activities[i]);
            }
          }

          if (preCheckInActivities.length === 0) continue; // check-in is already first

          // Shift pre-check-in activities to after check-in ends
          let cursor = checkInEndMin + 15; // 15-min buffer after check-in
          // Sort pre-check-in by their original start time to preserve relative order
          preCheckInActivities.sort((a: any, b: any) =>
            (parseTimeToMinutes(a.startTime) || 0) - (parseTimeToMinutes(b.startTime) || 0)
          );

          for (const act of preCheckInActivities) {
            const origStart = parseTimeToMinutes(act.startTime) || 0;
            const origEnd = parseTimeToMinutes(act.endTime) || (origStart + 60);
            const duration = origEnd - origStart;
            act.startTime = minutesToHHMM(cursor);
            act.endTime = minutesToHHMM(cursor + duration);
            cursor += duration + 15; // 15-min gap between shifted activities
          }

          // Rebuild: check-in first, then shifted activities, then original post-check-in activities
          // Sort everything after check-in by start time
          const allAfter = [...preCheckInActivities, ...postCheckInActivities];
          allAfter.sort((a: any, b: any) =>
            (parseTimeToMinutes(a.startTime) || 0) - (parseTimeToMinutes(b.startTime) || 0)
          );
          
          // Mini overlap resolution: ensure shifted activities don't overlap existing ones
          for (let k = 0; k < allAfter.length - 1; k++) {
            const curEnd = parseTimeToMinutes(allAfter[k].endTime) || 0;
            const nextStart = parseTimeToMinutes(allAfter[k + 1].startTime) || 0;
            if (curEnd > nextStart) {
              const nextDuration = (parseTimeToMinutes(allAfter[k + 1].endTime) || (nextStart + 60)) - nextStart;
              const newStart = curEnd + 15;
              allAfter[k + 1].startTime = minutesToHHMM(newStart);
              allAfter[k + 1].endTime = minutesToHHMM(newStart + nextDuration);
              console.log(`[Stage 2.57] Resolved overlap: pushed "${allAfter[k + 1].title || allAfter[k + 1].name}" to ${minutesToHHMM(newStart)}`);
            }
          }
          
          day.activities = [checkIn, ...allAfter];
          aiResult.days[dIdx] = day;

          console.log(`[Stage 2.57] ✓ Day ${dIdx + 1}: Shifted ${preCheckInActivities.length} pre-check-in activities to after check-in (${checkIn.startTime}-${checkIn.endTime})`);
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
      const MIN_OVERLAP_GAP = scheduleConstraints?.bufferMinutesBetweenActivities || 15;
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
      // STAGE 2.75: Check-in Time Consistency
      // Relabel early arrivals as "Luggage Drop" when before hotel check-in
      // =====================================================================
      try {
        const hotelCheckInTime275 = context.hotelData?.checkInTime || '15:00';
        const checkInMins275 = parseTimeToMinutes(hotelCheckInTime275);
        if (checkInMins275 > 0 && aiResult.days.length > 0) {
          const day1 = aiResult.days[0];
          const checkinAct = day1.activities?.find((a: any) =>
            (a.category || '').toLowerCase() === 'accommodation' &&
            /(check.?in|luggage drop)/i.test(a.title || '')
          );
          if (checkinAct) {
            const actStart275 = parseTimeToMinutes(checkinAct.startTime || '');
            if (actStart275 > 0 && actStart275 < checkInMins275) {
              if (!/(luggage|bag|drop)/i.test(checkinAct.title || '')) {
                checkinAct.title = (checkinAct.title || '').replace(/check.?in/i, 'Luggage Drop') || 'Luggage Drop & Early Check-in';
                console.log(`[Stage 2.75] Relabeled Day 1 check-in to "${checkinAct.title}" (arrives ${checkinAct.startTime} before check-in ${hotelCheckInTime275})`);
              }
              if (!checkinAct.description?.includes('early check-in')) {
                checkinAct.description = (checkinAct.description || '') +
                  ` Early check-in subject to availability (standard check-in: ${hotelCheckInTime275}).`;
              }
            }
          }
        }
      } catch (e275) {
        console.warn(`[Stage 2.75] Check-in relabel error:`, e275);
      }

      // =====================================================================
      // STAGE 2.8: Must-Do Validation + Injection Safety Net
      // =====================================================================
      if (context.mustDoActivities && context.mustDoActivities.trim()) {
        try {
          const forceAllMust = !!context.isSmartFinish || !!context.smartFinishRequested;
          const mustDoCheck = parseMustDoInput(context.mustDoActivities, context.destination, forceAllMust, context.startDate, context.totalDays);
          if (mustDoCheck.length > 0) {
            const itineraryForValidation = aiResult.days.map((d: any) => ({
              dayNumber: d.dayNumber,
              activities: (d.activities || []).map((a: any) => ({ title: a.title || a.name || '', description: a.description || '' })),
            }));
            const validation = validateMustDosInItinerary(itineraryForValidation, mustDoCheck, context.destination);

            if (!validation.allPresent && validation.missing.length > 0) {
              console.warn(`[Stage 2.8] ⚠️ MISSING must-do activities — injecting safety-net placeholders:`);

              // Get schedule assignments for injection targeting
              const mustDoSchedule = scheduleMustDos(mustDoCheck, context.totalDays);
              const scheduledMap = new Map<string, number>();
              for (const s of mustDoSchedule.scheduled) {
                scheduledMap.set(s.priority.id, s.assignedDay);
              }

              for (const m of validation.missing) {
                const targetDay = scheduledMap.get(m.id) || m.preferredDay || Math.ceil(context.totalDays / 2);
                const dayObj = aiResult.days.find((d: any) => d.dayNumber === targetDay) || aiResult.days[aiResult.days.length - 1];

                if (!dayObj) continue;

                // Determine injection time based on preferredTime
                let injectionTime = '14:00';
                let injectionEndTime = '16:00';
                if (m.preferredTime === 'morning') { injectionTime = '10:00'; injectionEndTime = '12:00'; }
                else if (m.preferredTime === 'evening') { injectionTime = '18:00'; injectionEndTime = '20:00'; }

                const injectedActivity = {
                  id: `injected_${m.id}_${Date.now()}`,
                  title: m.activityName,
                  name: m.activityName,
                  description: m.userDescription || `You mentioned "${m.activityName}" — we've added it to your day. Tap to customize details.`,
                  startTime: injectionTime,
                  endTime: injectionEndTime,
                  duration: `${Math.round((m.estimatedDuration || 120) / 60)} hours`,
                  category: m.requiresBooking ? 'attraction' : 'experience',
                  source: 'must_do_injection',
                  cost: { amount: 0, currency: 'USD' },
                  location: { address: '', neighborhood: m.location || '' },
                  notes: `You mentioned "${m.activityName}" — we've added it to your day. Tap to customize details.`,
                };

                dayObj.activities.push(injectedActivity);

                // Re-sort chronologically
                dayObj.activities.sort((a: any, b: any) => {
                  const parseMin = (t?: string) => {
                    if (!t) return 0;
                    const match = t.match(/(\d{1,2}):(\d{2})/);
                    return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
                  };
                  return parseMin(a.startTime) - parseMin(b.startTime);
                });

                console.warn(`  🔧 Injected "${m.activityName}" into Day ${dayObj.dayNumber} at ${injectionTime}`);
              }

              console.log(`[Stage 2.8] Injected ${validation.missing.length} must-do placeholder(s) as safety net`);
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
                    // Hard-constraint check: ensure shifted time doesn't squeeze against checkout/departure
                    // But ONLY treat checkout as hard stop if day has a flight departure
                    // (no-flight days deliberately schedule farewell activities AFTER checkout)
                    const dayHasFlightDeparture = day.activities.some((a: StrictActivity) => {
                      const tLower = (a.title || a.name || '').toLowerCase();
                      const cLower = (a.category || '').toLowerCase();
                      return cLower === 'transport' && (tLower.includes('airport') || tLower.includes('flight'));
                    });
                    
                    const hardStopAct = day.activities.find((a: StrictActivity) => {
                      const catLower = (a.category || '').toLowerCase();
                      const titleLower = (a.title || a.name || '').toLowerCase();
                      const isCheckout = catLower === 'accommodation' && (titleLower.includes('check') || titleLower.includes('checkout'));
                      if (isCheckout && !dayHasFlightDeparture) return false;
                      return isCheckout
                        || (catLower === 'transport' && (titleLower.includes('depart') || titleLower.includes('airport') || titleLower.includes('flight') || titleLower.includes('train')));
                    });
                    if (hardStopAct && hardStopAct.startTime) {
                      const hardStopMins = parseInt(hardStopAct.startTime.split(':')[0]) * 60 + parseInt(hardStopAct.startTime.split(':')[1]);
                      const estimatedEnd = newStartMins + duration + 20; // 20min transit buffer
                      if (estimatedEnd > hardStopMins) {
                        // Shifted activity would squeeze past checkout/departure — REMOVE instead
                        day.activities = day.activities.filter((a: StrictActivity) => a.id !== violation.activityId);
                        removedCount++;
                        console.log(`  ✗ Day ${violation.dayNumber}: "${violation.activityTitle}" — REMOVED (shifted time ${newStartMins}min + ${duration}min + transit exceeds hard stop at ${hardStopMins}min)`);
                        continue;
                      }
                    }
                    
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
            // But first: suppress for nightlife/entertainment categories with implausible morning-only hours
            const actCatLower = (activity.category || '').toLowerCase();
            const nightlifeCategories = ['nightlife', 'entertainment', 'bar', 'jazz', 'club', 'music', 'live music', 'concert'];
            const isNightlifeCategory = nightlifeCategories.some(c => actCatLower.includes(c));
            const reasonLooksImplausible = violation.reason && /Open\s+\d{2}:\d{2}[–\-]\d{2}:\d{2}/.test(violation.reason) && 
              (() => {
                const closeMatch = violation.reason.match(/Open\s+\d{2}:\d{2}[–\-](\d{2}):(\d{2})/);
                if (closeMatch) {
                  const closeMins = parseInt(closeMatch[1]) * 60 + parseInt(closeMatch[2]);
                  return closeMins <= 720; // closes before noon
                }
                return false;
              })();
            
            if (isNightlifeCategory && reasonLooksImplausible) {
              console.log(`  ⊘ Day ${violation.dayNumber}: "${violation.activityTitle}" — suppressed implausible hours warning for ${actCatLower} venue`);
            } else {
              (activity as any).closedRisk = true;
              (activity as any).closedRiskReason = violation.reason;
              console.warn(`  - Day ${violation.dayNumber}: "${violation.activityTitle}" — ${violation.reason} (uncertain, tagged as warning)`);
            }
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

            if (!curCoords?.lat || !curCoords?.lng || !nextCoords?.lat || !nextCoords?.lng) {
              // No coordinates — enforce a minimum buffer as fallback
              const FALLBACK_BUFFER = 15;
              const curEndMinsNoCoord = parseTimeToMinutes(current.endTime || current.startTime || '');
              const nextStartMinsNoCoord = parseTimeToMinutes(next.startTime || '');
              if (curEndMinsNoCoord > 0 && nextStartMinsNoCoord > 0) {
                const gapNoCoord = nextStartMinsNoCoord - curEndMinsNoCoord;
                if (gapNoCoord < FALLBACK_BUFFER && gapNoCoord >= 0) {
                  const deficit = FALLBACK_BUFFER - gapNoCoord;
                  for (let j = i + 1; j < day.activities.length; j++) {
                    const sM = parseTimeToMinutes(day.activities[j].startTime || '');
                    const eM = parseTimeToMinutes(day.activities[j].endTime || '');
                    if (sM > 0) {
                      const sH = Math.floor((sM + deficit) / 60);
                      const sMn = (sM + deficit) % 60;
                      day.activities[j].startTime = `${String(sH).padStart(2,'0')}:${String(sMn).padStart(2,'0')}`;
                    }
                    if (eM > 0) {
                      const eH = Math.floor((eM + deficit) / 60);
                      const eMn = (eM + deficit) % 60;
                      day.activities[j].endTime = `${String(eH).padStart(2,'0')}:${String(eMn).padStart(2,'0')}`;
                    }
                  }
                  bufferFixCount++;
                  console.log(`[Stage 4.6] Day ${day.dayNumber}: No-coord fallback buffer for "${next.title || next.name}" — shifted +${deficit}min`);
                }
              }
              continue;
            }

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
              // Check if cascade would hit a hard-stop activity (checkout/departure)
              // Checkout is only a hard stop if the day has a flight departure
              const dayHasFlightDep46 = day.activities.some((a: any) => {
                const tL = (a.title || a.name || '').toLowerCase();
                const cL = (a.category || '').toLowerCase();
                return cL === 'transport' && (tL.includes('airport') || tL.includes('flight'));
              });
              
              let hitHardStop = false;
              for (let j = i + 1; j < day.activities.length; j++) {
                const act = day.activities[j];
                const catLower = (act.category || '').toLowerCase();
                const titleLower = (act.title || act.name || '').toLowerCase();
                const isCheckout = catLower === 'accommodation' && (titleLower.includes('check') || titleLower.includes('checkout'));
                const isTransportHardStop = catLower === 'transport' && (titleLower.includes('depart') || titleLower.includes('airport') || titleLower.includes('flight') || titleLower.includes('train'));
                const isHardStop = (isCheckout && dayHasFlightDep46) || isTransportHardStop;
                if (isHardStop) {
                  // Before removing, check if current is a must-do — if so, truncate instead
                  const isMustDo = (current as any).isMustDo || (current as any).mustDo || (current as any).is_must_do;
                  if (isMustDo) {
                    const actStartMins = parseTimeToMinutes(act.startTime || '') ?? 1440;
                    const curStartMins = parseTimeToMinutes(current.startTime || '') ?? 0;
                    const availableMins = actStartMins - curStartMins - requiredBuffer;
                    if (availableMins >= 20) {
                      const newEndMins = curStartMins + availableMins;
                      current.endTime = `${Math.floor(newEndMins / 60).toString().padStart(2, '0')}:${(newEndMins % 60).toString().padStart(2, '0')}`;
                      console.log(`[Stage 4.6] Day ${day.dayNumber}: truncated must-do "${current.title}" to ${availableMins}min to fit before hard-stop "${act.title}"`);
                      hitHardStop = true;
                      bufferFixCount++;
                      break;
                    }
                  }
                  // Don't cascade into checkout/departure — remove the activity causing the overflow instead
                  console.log(`[Stage 4.6] Day ${day.dayNumber}: cascade would shift hard-stop "${act.title}" — removing "${current.title}" instead`);
                  day.activities.splice(i, 1);
                  i--; // re-check from same index
                  hitHardStop = true;
                  bufferFixCount++;
                  break;
                }
              }
              if (!hitHardStop) {
                // Safe to cascade-shift all subsequent activities forward
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

      // =======================================================================
      // STAGE 4.92: Post-enrichment geographic reorder
      // Re-run geographic validation now that activities have verified GPS coords.
      // Stage 3.5 ran pre-enrichment when most activities lacked coordinates.
      // =======================================================================
      try {
        const { isTimeFixed } = await import('./auto-route-optimizer.ts');
        let reorderCount = 0;
        for (let dayIdx = 0; dayIdx < enrichedDays.length; dayIdx++) {
          const day = enrichedDays[dayIdx];
          if (!day.activities || day.activities.length < 3) continue;

          const activitiesWithLocation = day.activities.map((act: any) => ({
            id: act.id,
            title: act.title || act.name || '',
            coordinates: act.location?.coordinates,
            neighborhood: act.location?.address?.split(',')[0],
            isLocked: isTimeFixed(act),
            category: act.category,
          }));

          const dayAnchor = determineDayAnchor(activitiesWithLocation, undefined, hotelNeighborhood, cityZones);
          const validation = validateDayGeography(activitiesWithLocation, dayAnchor, travelConstraints, cityZones);

          if (!validation.isValid && validation.violations?.some((v: any) => v.type === 'backtracking' || v.type === 'long_hop')) {
            const reordered = reorderActivitiesOptimally(activitiesWithLocation, dayAnchor);
            const reorderedIds = reordered.map((a: any) => a.id);
            // Preserve original time slots, just reorder activities
            const originalTimes = day.activities.map((a: any) => ({ startTime: a.startTime, endTime: a.endTime }));
            day.activities = [...day.activities].sort((a: any, b: any) => {
              const aIdx = reorderedIds.indexOf(a.id);
              const bIdx = reorderedIds.indexOf(b.id);
              return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });
            // Reassign original time slots to reordered activities
            day.activities.forEach((act: any, i: number) => {
              if (originalTimes[i]) {
                act.startTime = originalTimes[i].startTime;
                act.endTime = originalTimes[i].endTime;
              }
            });
            reorderCount++;
            console.log(`[Stage 4.92] Reordered Day ${dayIdx + 1} activities by geographic proximity (score: ${validation.score})`);
          }
        }
        console.log(`[Stage 4.92] ✓ Post-enrichment geographic reorder: ${reorderCount} days reordered`);
      } catch (geoErr) {
        console.warn('[Stage 4.92] Post-enrichment geographic reorder failed (non-blocking):', geoErr);
      }

      // =======================================================================
      // STAGE 4.93: Name-location cross-check
      // Detect when AI-generated title contains a neighborhood that contradicts
      // the verified Google Places address. E.g. "Ginza Toyoda" at Kagurazaka.
      // =======================================================================
      try {
        const KNOWN_NEIGHBORHOODS = ['ginza','shibuya','shinjuku','asakusa','roppongi',
          'omotesando','ebisu','akihabara','ueno','ikebukuro','sumida','kagurazaka','otemachi',
          'nihonbashi','meguro','daikanyama','nakameguro','azabu','akasaka','harajuku',
          'tsukiji','odaiba','shimokitazawa','yanaka','nezu','sendagi','roppongi','minato',
          'chiyoda','taito','setagaya','nakano','koenji','kichijoji','marunouchi',
          'montmartre','marais','saint-germain','bastille','belleville','pigalle','oberkampf',
          'trastevere','monti','testaccio','prati','esquilino','aventino',
          'soho','shoreditch','mayfair','camden','brixton','notting hill','chelsea',
          'el born','gracia','eixample','raval','barceloneta','gothic quarter',
          'tribeca','williamsburg','dumbo','greenpoint','bushwick','astoria'];
        let nameFixCount = 0;
        for (const day of enrichedDays) {
          for (const act of day.activities as any[]) {
            if (!act.verified?.placeId || !act.location?.address) continue;
            const title = (act.title || '').toLowerCase();
            const address = (act.location.address || '').toLowerCase();
            const titleNeighborhood = KNOWN_NEIGHBORHOODS.find(n => title.includes(n));
            const addressNeighborhood = KNOWN_NEIGHBORHOODS.find(n => address.includes(n));
            if (titleNeighborhood && addressNeighborhood && titleNeighborhood !== addressNeighborhood) {
              const re = new RegExp(`\\b${titleNeighborhood}\\b`, 'gi');
              const oldTitle = act.title;
              act.title = (act.title || '').replace(re, addressNeighborhood.charAt(0).toUpperCase() + addressNeighborhood.slice(1));
              nameFixCount++;
              console.log(`[Stage 4.93] Fixed name-location mismatch: "${oldTitle}" → "${act.title}" (address is in ${addressNeighborhood}, not ${titleNeighborhood})`);
            }
          }
        }
        console.log(`[Stage 4.93] ✓ Name-location cross-check: ${nameFixCount} mismatches fixed`);
      } catch (nameErr) {
        console.warn('[Stage 4.93] Name-location cross-check failed (non-blocking):', nameErr);
      }

      // =======================================================================
      // STAGE 4.95: Transport title consistency
      // Sync transport card destinations with the next non-transport activity's
      // verified location name. Prevents "Metro to Omotesando" → Roppongi.
      // =======================================================================
      try {
        let transportFixCount = 0;
        for (const day of enrichedDays) {
          for (let i = 0; i < day.activities.length; i++) {
            const act = day.activities[i] as any;
            const cat = (act.category || '').toLowerCase();
            if (cat !== 'transport' && cat !== 'transportation' && cat !== 'transit') continue;

            // Find next non-transport activity
            let nextAct: any = null;
            for (let j = i + 1; j < day.activities.length; j++) {
              const nc = ((day.activities[j] as any).category || '').toLowerCase();
              if (nc !== 'transport' && nc !== 'transportation' && nc !== 'transit') {
                nextAct = day.activities[j];
                break;
              }
            }
            if (!nextAct) continue;

            const nextLocationName = nextAct.location?.name || nextAct.title || '';
            if (!nextLocationName) continue;

            // Extract transport mode from current title
            const modeMatch = (act.title || '').match(/^(taxi|metro|walk|train|bus|ferry|uber|rideshare|drive|subway)\s+to\b/i)
              || (act.title || '').match(/^travel\s+to\s+.+\s+via\s+(.+)$/i);

            if (modeMatch) {
              const mode = modeMatch[1] || 'Travel';
              const oldTitle = act.title;
              act.title = `${mode.charAt(0).toUpperCase() + mode.slice(1)} to ${nextLocationName}`;
              if (oldTitle !== act.title) transportFixCount++;
            } else if ((act.title || '').toLowerCase().startsWith('travel to')) {
              const oldTitle = act.title;
              // Check transportation.method for a real mode
              const methodRaw = (act.transportation?.method || '').toLowerCase();
              const knownModes = ['taxi','metro','walk','walking','train','bus','ferry','uber','subway','tram','rideshare','drive','driving'];
              const modeLabel = knownModes.includes(methodRaw)
                ? methodRaw.charAt(0).toUpperCase() + methodRaw.slice(1)
                : null;
              act.title = modeLabel
                ? `${modeLabel} to ${nextLocationName}`
                : `Travel to ${nextLocationName}`;
              if (oldTitle !== act.title) transportFixCount++;
            }

            // Sync transport card's location to destination
            act.location = { ...act.location, name: nextLocationName, address: nextAct.location?.address || act.location?.address || '' };
            if (nextAct.location?.coordinates) {
              act.location.coordinates = nextAct.location.coordinates;
            }

            // Normalize duration format on transport cards
            if (act.transportation?.duration) {
              act.transportation.duration = normalizeDurationString(act.transportation.duration) || act.transportation.duration;
            }
            if (act.duration && typeof act.duration === 'string') {
              act.duration = normalizeDurationString(act.duration) || act.duration;
            }
          }
        }
        console.log(`[Stage 4.95] ✓ Transport title consistency: ${transportFixCount} transport cards synced`);
      } catch (transportErr) {
        console.warn('[Stage 4.95] Transport title consistency failed (non-blocking):', transportErr);
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
      return handleGenerateDay(supabase, authResult.userId, params);
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
    // ACTION: generate-trip — Delegated to extracted action handler
    // ==========================================================================
    if (action === 'generate-trip') {
      return handleGenerateTrip(supabase, authResult.userId, params);
    }

    // ==========================================================================
    // ACTION: generate-trip-day — Delegated to extracted action handler
    // ==========================================================================
    if (action === 'generate-trip-day') {
      return handleGenerateTripDay(supabase, authResult.userId, params);
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
