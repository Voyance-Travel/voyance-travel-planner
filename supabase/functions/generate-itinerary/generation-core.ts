/**
 * Shared generation infrastructure — extracted from index.ts (Phase 3).
 *
 * Contains: prepareContext, generateSingleDayWithRetry, generateItineraryAI,
 * earlySaveItinerary, generateTripOverview, triggerNextJourneyLeg, finalSaveItinerary.
 */

import { trackCost } from "../_shared/cost-tracker.ts";

import type {
  MultiCityDayInfo,
  GenerationContext,
  StrictActivity,
  StrictDay,
  TravelAdvisory,
  LocalEventInfo,
  TripOverview,
  EnrichedItinerary,
  DirectTripData,
} from './generation-types.ts';

import {
  calculateDays,
  formatDate,
  timeToMinutes,
  calculateDuration,
  getCategoryIcon,
  normalizeVenueName,
  extractRestaurantVenueName,
  haversineDistanceKm,
} from './generation-utils.ts';

import {
  sanitizeGeneratedDay,
  sanitizeOptionFields,
  sanitizeDateFields,
  normalizeDurationString,
  ALWAYS_FREE_VENUE_PATTERNS,
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
  buildAllConstraints,
  buildArchetypeConstraintsBlock,
  buildBudgetConstraints,
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
  getMatchingAttractions,
  getOrGenerateArchetypeGuide,
  buildMatchedAttractionsPrompt,
  buildArchetypeGuidePrompt,
  EXPERIENCE_CATEGORIES,
  getMaxActivities,
  isSpaOK,
  isMichelinOK,
  needsUnscheduledTime,
  getFullArchetypeContext,
  buildFullPromptGuidance,
  buildFullPromptGuidanceAsync,
} from './archetype-data.ts';

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
  type ReconciliationStrategy,
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
  type OpeningHoursViolation,
} from './truth-anchors.ts';

import {
  generateExplanation,
  validateExplanation,
  buildExplainabilityPrompt,
  type ExplainabilityContext,
  type Explanation,
} from './explainability.ts';

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
  type ActivityWithLocation,
} from './geographic-coherence.ts';

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
  type DayConstraints,
} from './prompt-library.ts';

import {
  deriveMealPolicy,
  buildMealRequirementsPrompt,
  type MealPolicy,
  type MealPolicyInput,
  type RequiredMeal,
} from './meal-policy.ts';

import {
  buildDietaryEnforcementPrompt,
  expandDietaryAvoidList,
  checkDietaryViolations,
  getMaxDietarySeverity,
  type DietaryViolation,
} from './dietary-rules.ts';

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

import {
  buildDestinationEssentialsPrompt,
  buildDestinationEssentialsPromptWithDB,
  getDestinationIntelligence,
  hasCuratedEssentials,
} from './destination-essentials.ts';

import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
} from './flight-hotel-context.ts';

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

import type { PreBookedCommitment } from './pre-booked-commitments.ts';


export async function prepareContext(supabase: any, tripId: string, userId?: string, directTripData?: DirectTripData, requestSmartFinishMode?: boolean): Promise<GenerationContext | null> {
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

  // Load restaurant pool from metadata (pre-generated by action-generate-trip.ts)
  const restaurantPoolByCity = (trip.metadata?.restaurant_pool as Record<string, any[]>) || {};
  const allPoolVenues: any[] = [];
  for (const venues of Object.values(restaurantPoolByCity)) {
    if (Array.isArray(venues)) allPoolVenues.push(...venues);
  }
  if (allPoolVenues.length > 0) {
    context.restaurantPool = allPoolVenues;
    console.log(`[Stage 1] Restaurant pool loaded: ${allPoolVenues.length} venues from metadata`);
  } else {
    console.warn(`[Stage 1] ⚠️ No restaurant pool in metadata — meal guard will use generic fallbacks`);
  }

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
                const cin = h.checkInDate || h.check_in_date;
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



// Generate a single day with retry logic
export async function generateSingleDayWithRetry(
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
    isFirstDay ? `12. **DAY 1 ARRIVAL STRUCTURE — CRITICAL**: Day 1 MUST begin with hotel arrival as the FIRST activity (category: accommodation). Travelers arrive with bags — getting to the hotel is the #1 priority. If no flight time is given, assume a morning arrival (10:00 AM luggage drop). The hotel standard check-in time is ${effectiveHotelData?.checkInTime || '15:00'}. If the traveler arrives BEFORE ${effectiveHotelData?.checkInTime || '15:00'}, title it "Luggage Drop at {HotelName}" and note "Early check-in subject to availability (standard check-in: ${effectiveHotelData?.checkInTime || '15:00'})" in the description. If arriving AT or AFTER ${effectiveHotelData?.checkInTime || '15:00'}, title it "Check-in at {HotelName}". Do NOT include "Arrival at Airport", "Arrival and Baggage Claim", or "Airport Transfer to Hotel" — arrival logistics are handled by a separate UI component.` : '',
    isLastDay && context.totalDays > 1 ? '12. LAST DAY MUST end with: Checkout → Transfer → Departure' : '',
    '13. **HOTEL FIDELITY — CRITICAL**: If a specific hotel name and address are provided in the accommodation section, you MUST use that EXACT hotel name for ALL accommodation activities (check-in, return to hotel, freshen up, checkout, etc.). Do NOT invent, substitute, or suggest a different hotel. The user has already booked their accommodation.',
    '14. **NO KEYWORD STUFFING**: Activity titles must be concise (max 8 words). NEVER pad titles with synonym lists of location types (e.g., "borough town place locale district quarter sector area"). Use the specific venue or activity name only.',
    '15. **ALL REAL VENUE NAMES — CRITICAL**: ALL activities must use REAL, SPECIFIC venue names — not generic descriptions. This applies to ALL categories (wellness, cafés, nightlife, shopping, etc.), not just dining. WRONG: "Boutique Wellness in Omotesando". WRONG: "a kissaten". WRONG: "Local Spa". RIGHT: "Omotesando Koffee". RIGHT: "Kayabacho Sabō". RIGHT: "HIGASHIYA GINZA".',
    !isFirstDay ? '16. **NO CHECK-IN ON NON-ARRIVAL DAYS**: On days after Day 1 (or after the first day at a new hotel), do NOT title accommodation activities as "Check-in at [Hotel]". Use "Return to [Hotel]" or "Freshen up at [Hotel]" instead. "Check-in" implies arrival — use it only on the day the traveler first arrives at that hotel.' : '',
    '17. **NO TAG SUFFIXES IN TITLES**: Activity titles must NOT end with hyphenated mood/category tags. WRONG: "Evening Walk maternal-retreat", "Museum Visit culture-deep-dive", "Dinner romantic-evening". RIGHT: "Evening Walk through Chiado", "National Museum of Ancient Art", "Dinner at Alma". Titles must read as natural language, not as a label with a tag appended.',
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
        // Only strip fabricated hotel names; generic placeholders are preserved
        const hasHotel = !!(dayCity?.hotelName || context.hotelData?.hotelName);
        stripPhantomHotelActivities(generatedDay, hasHotel);
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

        // MEAL-TIME COHERENCE: Fix meal keywords that contradict the time slot
        // e.g., "Lunch" at 19:10 should become "Dinner"
        const MEAL_KW_RE = /\b(breakfast|brunch|lunch|dinner|supper)\b/i;
        const MEAL_RANGES: Record<string, [number, number]> = {
          Breakfast: [360, 659], Lunch: [660, 899], Dinner: [1020, 1379],
        };
        function canonMeal(kw: string): string | null {
          const lc = kw.toLowerCase();
          if (lc === 'breakfast' || lc === 'brunch') return 'Breakfast';
          if (lc === 'lunch') return 'Lunch';
          if (lc === 'dinner' || lc === 'supper') return 'Dinner';
          return null;
        }
        function correctMealForTime(mins: number): string | null {
          for (const [label, [lo, hi]] of Object.entries(MEAL_RANGES)) {
            if (mins >= lo && mins <= hi) return label;
          }
          return null;
        }
        for (const act of generatedDay.activities) {
          const m = MEAL_KW_RE.exec(act.title || '');
          if (!m) continue;
          const titleMeal = canonMeal(m[1]);
          if (!titleMeal) continue;
          const mins = parseTimeToMinutes(act.startTime || '');
          if (mins === null || mins === 0) continue;
          const correct = correctMealForTime(mins);
          if (!correct || correct === titleMeal) continue;
          const replacement = m[1][0] === m[1][0].toUpperCase() ? correct : correct.toLowerCase();
          console.log(`[Stage 2] MealCoherence: "${act.title}" at ${act.startTime}: ${titleMeal} → ${correct}`);
          act.title = act.title!.slice(0, m.index) + replacement + act.title!.slice(m.index + m[1].length);
          if (act.name) act.name = act.title;
        }

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
              const isDupe = duplicateTitles.some(dt => title.includes(dt) || dt.includes(title));
              if (!isDupe) return true;
              // Never strip primary meals — a duplicate restaurant is better than a missing meal
              if (/\b(?:breakfast|lunch|dinner|brunch)\b/i.test(a.title || '')) {
                console.warn(`[Stage 2] Keeping duplicate primary meal "${a.title}" — meal > uniqueness`);
                return true;
              }
              return false;
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
        // Compute timing window so the meal guard respects flight arrival/departure
        const _arrivalTime24ForGuard = isFirstDay ? context.flightData?.arrivalTime24 : undefined;
        const _departureTime24ForGuard = isLastDay ? (context.flightData?.departureTime24 || context.flightData?.returnDepartureTime24) : undefined;
        const _parseGuardMins = (t?: string) => {
          if (!t) return undefined;
          const m = t.match(/(\d{1,2}):(\d{2})/);
          return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : undefined;
        };
        const mealGuardEarliestMins = _arrivalTime24ForGuard ? _parseGuardMins(_arrivalTime24ForGuard) : undefined;
        const mealGuardLatestMins = _departureTime24ForGuard ? (() => { const m = _parseGuardMins(_departureTime24ForGuard); return m ? m - 180 : undefined; })() : undefined;

        const mealGuardResult = enforceRequiredMealsFinalGuard(
          generatedDay.activities || [],
          dayMealPolicy.requiredMeals,
          dayNumber,
          context.destination || 'the destination',
          context.currency || 'USD',
          dayMealPolicy.dayMode,
          // Pass restaurant pool as fallback venues so the guard uses REAL restaurants
          (context as any).restaurantPool
            ? ((context as any).restaurantPool as any[]).map((r: any) => ({
                name: r.name,
                address: r.neighborhood || r.address || context.destination || '',
                mealType: r.mealType || 'any',
              }))
            : [],
          { earliestTimeMins: mealGuardEarliestMins, latestTimeMins: mealGuardLatestMins },
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
export async function generateItineraryAI(
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
  const seenLocations = new Map<string, { dayNum: number }>();
  const seenDiningVenues = new Map<string, { dayNum: number }>();
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

        // Location-based dedup: catch same venue with different title phrasing
        const locName = ((act as any).location?.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        if (locName.length > 5) {
          const locMatch = seenLocations.get(locName);
          if (locMatch && locMatch.dayNum !== day.dayNumber) {
            console.log(`[Stage 2] Cross-batch location dedup: removed "${act.title}" from Day ${day.dayNumber} (same venue "${locName}" on Day ${locMatch.dayNum})`);
            indicesToRemove.push(i);
            dedupCount++;
          } else if (!locMatch) {
            seenLocations.set(locName, { dayNum: day.dayNumber });
          }
        }
      }

      // Dining-specific dedup: use extractRestaurantVenueName to catch "Dinner at X" vs "X Tasting Menu"
      if (!indicesToRemove.includes(i) && (cat === 'dining' || cat.includes('dining'))) {
        const venueFromTitle = extractRestaurantVenueName(act.title || '');
        const venueFromLoc = extractRestaurantVenueName((act as any).location?.name || '');

        for (const venue of [venueFromTitle, venueFromLoc]) {
          if (venue.length <= 2) continue;
          const diningMatch = seenDiningVenues.get(venue);
          if (diningMatch && diningMatch.dayNum !== day.dayNumber) {
            console.log(`[Stage 2] Cross-batch dining dedup: removed "${act.title}" from Day ${day.dayNumber} (same restaurant "${venue}" on Day ${diningMatch.dayNum})`);
            indicesToRemove.push(i);
            dedupCount++;
            break;
          } else if (!diningMatch) {
            seenDiningVenues.set(venue, { dayNum: day.dayNumber });
          }
        }
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
export async function earlySaveItinerary(supabase: any, tripId: string, days: StrictDay[]): Promise<boolean> {
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

export function generateTripOverview(
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
export async function triggerNextJourneyLeg(supabase: any, tripId: string): Promise<void> {
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

export async function finalSaveItinerary(
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

          // Check Tier 1 free venues — uses shared ALWAYS_FREE_VENUE_PATTERNS
          const allActivityText = [
            (act as any).title || '',
            (act as any).description || '',
            (act as any).venue_name || '',
            (act as any).place_name || '',
            (act as any).location?.name || '',
            (act as any).address || '',
            (act as any).restaurant?.name || '',
          ].join(' ');

          const isPaidExp = (act as any).booking_required ||
            /\b(tour|guided|ticket|admission|entry|botanical|bot[âa]nico)\b/i.test(allActivityText);

          if (ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test(allActivityText)) && !isPaidExp) {
            console.log(`[Phase 4] FREE VENUE CHECK: "${(act as any).title}" — zeroing cost`);
            costRows.push({
              trip_id: tripId,
              activity_id: act.id,
              day_number: day.dayNumber || 1,
              cost_per_person_usd: 0,
              num_travelers: context.travelers || 1,
              category: mappedCategory,
              source: 'free_venue',
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
