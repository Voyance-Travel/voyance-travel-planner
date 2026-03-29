/**
 * Action handler for generate-day / regenerate-day.
 * 
 * Extracted from index.ts for maintainability.
 * Contains all single-day generation logic with flight/hotel awareness.
 */

import { corsHeaders, verifyTripAccess } from './action-types.ts';
import type {
  StrictActivity,
  StrictDay,
  ValidationContext,
} from './generation-types.ts';
import {
  validateItineraryPersonalization,
  buildValidationContext,
} from './generation-types.ts';
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
import {
  enrichActivityWithRetry,
  enrichItinerary,
} from './venue-enrichment.ts';
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
  deriveBudgetIntent,
  buildBudgetConstraintsBlock,
  formatGenerationRules,
  type BudgetIntent,
} from './budget-constraints.ts';
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
  type DietaryViolation
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
  getFullArchetypeContext,
  buildFullPromptGuidance,
  buildFullPromptGuidanceAsync,
  getMaxActivities,
  isSpaOK,
  isMichelinOK,
  needsUnscheduledTime,
  buildAllConstraints,
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
} from './archetype-data.ts';
import {
  buildTripTypePromptSection,
  getTripTypeModifier,
  getTripTypeInteraction,
} from './trip-type-modifiers.ts';
import {
  loadTravelerProfile,
  type TravelerProfile as UnifiedTravelerProfile,
  type TraitScores as UnifiedTraitScores,
  type BudgetTier,
} from './profile-loader.ts';
import {
  buildDestinationEssentialsPrompt,
  buildDestinationEssentialsPromptWithDB,
  getDestinationIntelligence,
  hasCuratedEssentials,
} from './destination-essentials.ts';
import {
  getUserPreferences,
  getLearnedPreferences,
  buildPreferenceContext,
} from './preference-context.ts';
import { GenerationTimer } from './generation-timer.ts';
import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
  getFlightHotelContext,
} from './flight-hotel-context.ts';
import {
  validateGeneratedDay,
  filterChainRestaurants,
  enforceRequiredMealsFinalGuard,
  type StrictDayMinimal,
} from './day-validation.ts';
import { compileDayFacts } from './pipeline/compile-day-facts.ts';
import { compileDaySchema } from './pipeline/compile-day-schema.ts';
import type { LockedActivity } from './pipeline/types.ts';
import { validateDay, type ValidateDayInput } from './pipeline/validate-day.ts';
import { repairDay, type RepairDayInput } from './pipeline/repair-day.ts';

export async function handleGenerateDay(
  supabase: any,
  userId: string,
  params: Record<string, any>
): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Extract params BUT NOT userId from request body
  const { tripId, dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities, keepActivities, currentActivities,
    isMultiCity: paramIsMultiCity, isTransitionDay: paramIsTransitionDay, transitionFrom: paramTransitionFrom, transitionTo: paramTransitionTo, transitionMode: paramTransitionMode,
    mustDoActivities: paramMustDoActivities, interestCategories: paramInterestCategories, generationRules: paramGenerationRules,
    pacing: paramPacing, isFirstTimeVisitor: paramIsFirstTimeVisitor,
    hotelOverride: paramHotelOverride, isFirstDayInCity: paramIsFirstDayInCity, isLastDayInCity: paramIsLastDayInCity,
    restaurantPool: paramRestaurantPool, usedRestaurants: paramUsedRestaurants, generationLogId: paramGenerationLogId } = params;
  
  // userId comes from the function parameter (authenticated user ID)
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

  // ── PERFORMANCE TIMER (inner phase tracking) ──
  let innerTimer: GenerationTimer | null = null;
  if (paramGenerationLogId) {
    try {
      innerTimer = new GenerationTimer(tripId || '', supabase);
      await innerTimer.resume(paramGenerationLogId, destination || '', totalDays || 1, travelers || 1);
      // Write initial progress so the UI knows this day is actively being worked on
      await innerTimer.updateProgress(`day_${dayNumber}_context_loading`, 5 + Math.round(((dayNumber - 1) / Math.max(1, totalDays || 1)) * 90));
    } catch (e) {
      console.warn('[generate-day] Timer resume failed (non-blocking):', e);
      innerTimer = null;
    }
  }



  // ═══════════════════════════════════════════════════════════════════════
  // COMPILED FACTS: Transition context, locked activities, flight/hotel,
  // transport preferences — extracted to pipeline/compile-day-facts.ts
  // ═══════════════════════════════════════════════════════════════════════
  const facts = await compileDayFacts(supabase, userId, params);
  const {
    resolvedIsTransitionDay, resolvedTransitionFrom, resolvedTransitionTo,
    resolvedTransportMode, resolvedTransportDetails,
    resolvedNextLegTransport, resolvedNextLegCity, resolvedNextLegTransportDetails,
    resolvedHotelOverride, resolvedIsMultiCity, resolvedIsLastDayInCity,
    resolvedDestination, resolvedCountry,
    lockedActivities, lockedSlotsInstruction,
    isFirstDay, isLastDay,
    transportPreferencePrompt, resolvedTransportModes,
    arrivalAirportDisplay, airportTransferMinutes,
  } = facts;
  let flightContext = facts.flightContext;

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
      const startDate = preferences?.startDate || params.date?.split('T')[0] || '';
      const endDate = preferences?.endDate || '';
      const commitmentAnalysis = analyzePreBookedCommitments(preBookedList, startDate, endDate);
      // For per-day generation, only include commitments relevant to this day's date
      const dayDate = params.date?.split('T')[0] || '';
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

  // Flight/hotel context is now resolved in compileDayFacts above

  // ═══════════════════════════════════════════════════════════════════════
  // COMPILED SCHEMA: Day mode classification & constraints
  // Extracted to pipeline/compile-day-schema.ts
  // ═══════════════════════════════════════════════════════════════════════
  const schema = compileDaySchema({
    isFirstDay, isLastDay, dayNumber: dayNumber || 1, totalDays: totalDays || 1,
    destination: resolvedDestination || destination || '',
    flightContext,
    resolvedIsLastDayInCity, resolvedIsMultiCity,
    resolvedNextLegTransport, resolvedNextLegCity, resolvedNextLegTransportDetails,
    resolvedHotelOverride, resolvedIsTransitionDay,
    paramIsFirstDayInCity: !!paramIsFirstDayInCity,
    paramIsTransitionDay: !!paramIsTransitionDay,
    mustDoEventItems,
    arrivalAirportDisplay, airportTransferMinutes,
  });
  flightContext = schema.flightContext;
  const dayConstraints = schema.dayConstraints;


  // Transport preferences are now resolved in compileDayFacts above

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
    dayMealPolicy = deriveMealPolicy(dayMealInput);
    const mealRequirementsBlock = buildMealRequirementsPrompt(dayMealPolicy);
    
    console.log(`[generate-day] Day ${dayNumber} meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}], usableHours=${dayMealPolicy.usableHours}`);
    
    timingInstructions = `
${dayMealPolicy.isFullExplorationDay ? 'FULL EXPLORATION DAY' : dayMealPolicy.dayMode.replace(/_/g, ' ').toUpperCase()} — HOUR-BY-HOUR TRAVEL PLAN (NOT a suggestion list):

This day must be a COMPLETE itinerary from morning to night. Every hour accounted for.

REQUIRED DAY STRUCTURE:
${dayMealPolicy.requiredMeals.includes('breakfast') ? `1. BREAKFAST (category: "dining") — At the hotel's own restaurant (preferred) or a real café nearby. NEVER at a DIFFERENT hotel's restaurant. Use the hotel name: ${flightContext.hotelName || '[your hotel]'}. ~price, walking distance` : ''}
2. TRANSIT between every pair of consecutive activities (category: "transport")
   - Include mode (${resolvedTransportModes.length > 0 ? resolvedTransportModes.join('/') : 'walk/taxi/metro/bus'}), duration, cost, route details
   - 10+ minute walks or any paid transit = separate activity entry
3. MORNING ACTIVITIES — At least 1 paid + 1 free activity
${dayMealPolicy.requiredMeals.includes('lunch') ? '4. LUNCH (category: "dining") — Restaurant near previous location, ~price, 1 alternative in tips' : ''}
5. AFTERNOON ACTIVITIES — At least 1-2 paid + 1 free activity  
6. HOTEL RETURN (REQUIRED if dinner is far from hotel) — "Freshen up at [EXACT Hotel Name]" with category "accommodation", duration 30-60 min. This MUST be a separate activity card, not just a transport entry.
${dayMealPolicy.requiredMeals.includes('dinner') ? '7. DINNER (category: "dining") — Restaurant, price range, dress code, reservation needed?, 1 alternative in tips' : ''}
8. EVENING/NIGHTLIFE — Bar, jazz club, night market, show, rooftop, dessert spot (at least 1 suggestion). Use category: "dining" for bars, lounges, and cocktail venues. Use category: "activity" for shows, clubs, and entertainment. NEVER use "wellness", "nightlife", or "relaxation" as a category for bars/lounges.
9. RETURN TO HOTEL (REQUIRED as LAST activity) — "Return to [EXACT Hotel Name]" with category "accommodation". This is the FINAL card of every day. MUST appear after ALL other activities including nightlife. Include transport mode in a preceding transport activity.
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
- TRANSPORT PRICING — BE SPECIFIC BY MODE:
  • Walking: estimatedCost.amount = 0 (always free)
  • Subway/Metro/Bus/Tram: Use the actual local fare (e.g., NYC subway = $2.90, London Tube = £2.80, Paris Métro = €2.15). DO NOT default to $30.
  • Train/Commuter Rail: Use realistic ticket price for the specific route
  • Taxi/Rideshare: Estimate based on distance and city rates (typically $10-40 depending on distance)
  • Ferry: Use the actual fare for the specific route
  • The title MUST include the mode: "Travel to [place] via [mode]" (e.g., "Travel to US Open via 7 Train", "Taxi to hotel")
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
// CAP to last 40 items to prevent prompt bloat on day 8+
const MAX_AVOID_LIST = 40;
const capped = nonRecurring.slice(-MAX_AVOID_LIST);
const omitted = nonRecurring.length - capped.length;
result += `\nAvoid repeating these specific venues/activities (be creative and pick DIFFERENT ones): ${capped.join(', ')}`;
if (omitted > 0) {
  result += `\n(Plus ${omitted} more from earlier days — avoid ALL previously visited venues, not just the ones listed above.)`;
}
  }
  if (recurring.length > 0) {
result += `\nTHESE ARE MULTI-DAY EVENTS the traveler is attending across multiple days — YOU MUST CREATE A FULL ATTENDANCE ACTIVITY CARD for each (not just transit): ${recurring.join(', ')}`;
  }
  return result;
})()}

${(() => {
  // RESTAURANT POOL INJECTION: If a pre-generated pool is available, inject it
  // so the AI picks from real restaurants instead of inventing generic ones
  if (!paramRestaurantPool || !Array.isArray(paramRestaurantPool) || paramRestaurantPool.length === 0) return '';

  // Filter out already-used restaurants
  const usedSet = new Set((paramUsedRestaurants || []).map((n: string) => n.toLowerCase()));
  const available = paramRestaurantPool.filter((r: any) => !usedSet.has((r.name || '').toLowerCase()));

  if (available.length === 0) return '';

  const breakfastSpots = available.filter((r: any) => r.mealType === 'breakfast').slice(0, 8);
  const lunchSpots = available.filter((r: any) => r.mealType === 'lunch').slice(0, 8);
  const dinnerSpots = available.filter((r: any) => r.mealType === 'dinner').slice(0, 8);
  const anySpots = available.filter((r: any) => r.mealType === 'any').slice(0, 6);

  let poolPrompt = `
${'='.repeat(70)}
🍽️ RESTAURANT POOL — PICK FROM THIS LIST (DO NOT INVENT RESTAURANTS)
${'='.repeat(70)}
For ALL meals today, you MUST pick a restaurant from this pre-verified list.
Do NOT make up restaurant names. Do NOT use generic names like "local restaurant" or "dinner spot".
Each restaurant below is REAL and highly rated (4.5+ stars).

`;
  if (breakfastSpots.length > 0) {
poolPrompt += `BREAKFAST OPTIONS:\n${breakfastSpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  if (lunchSpots.length > 0) {
poolPrompt += `LUNCH OPTIONS:\n${lunchSpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  if (dinnerSpots.length > 0) {
poolPrompt += `DINNER OPTIONS:\n${dinnerSpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  if (anySpots.length > 0) {
poolPrompt += `FLEXIBLE (any meal):\n${anySpots.map((r: any) => `  • ${r.name} — ${r.cuisine || 'Local cuisine'}, ${r.neighborhood || ''} (${r.priceRange || '$$'})`).join('\n')}\n\n`;
  }
  poolPrompt += `RULE: Pick ONE restaurant per meal from the lists above. Use the EXACT name as shown. Do NOT modify restaurant names.\n\n`;

  // Add explicit blocklist of already-used restaurants
  const usedList = paramUsedRestaurants || [];
  if (usedList.length > 0) {
poolPrompt += `⛔ ALREADY USED ON PREVIOUS DAYS (DO NOT PICK THESE):\n`;
poolPrompt += usedList.map((name: string) => `  • ${name}`).join('\n');
poolPrompt += `\nPick DIFFERENT restaurants — variety is essential. Do NOT repeat any restaurant from this blocklist.\n`;
  }

  console.log(`[generate-day] Injected restaurant pool: ${available.length} available (${breakfastSpots.length}B/${lunchSpots.length}L/${dinnerSpots.length}D/${anySpots.length}any), blocklist: ${usedList.length} used`);
  return poolPrompt;
})()}

${(() => {
  // Even without a pool, inject used-restaurants blocklist so the AI avoids repeats
  if (paramRestaurantPool && Array.isArray(paramRestaurantPool) && paramRestaurantPool.length > 0) return ''; // Already handled above
  const usedList = paramUsedRestaurants || [];
  if (usedList.length === 0) return '';
  return `⛔ RESTAURANT VARIETY RULE — DO NOT USE THESE (already used on previous days):\n${usedList.map((name: string) => `  • ${name}`).join('\n')}\nPick DIFFERENT restaurants for every meal. Variety is essential.\n`;
})()}

CRITICAL REMINDERS:
1. ${isFullDay ? `This is a FULL DAY: ${dayMealPolicy?.requiredMeals?.join(' + ') ?? 'breakfast + lunch + dinner'} + 3 paid activities + 2 free activities + transit between all stops + evening activity + next morning preview. Fill EVERY hour.` : dayMealPolicy && !isFirstDay && !isLastDay ? `This is a ${dayMealPolicy.dayMode.replace(/_/g, ' ')} day. Required meals: ${dayMealPolicy.requiredMeals.length > 0 ? dayMealPolicy.requiredMeals.join(', ') : 'none'}. Do NOT add extra meals beyond what the meal policy specifies.` : `${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} scheduled sightseeing activities for this ${isFirstDay ? 'arrival' : 'departure'} day.`}
2. Check the archetype's avoid list. If it says "no spa", there are ZERO spa activities.
3. Check the budget constraints. If value-focused, no €100+ experiences.
4. ${primaryArchetype === 'flexible_wanderer' || primaryArchetype === 'slow_traveler' || (traitScores.pace || 0) <= -3 ? 'Include at least one 2+ hour UNSCHEDULED block labeled "Free time to explore [neighborhood]"' : 'Follow the pacing guidelines for this archetype'}
5. ${isFullDay ? 'TRANSIT: Include a transport entry (category: "transport") between EVERY pair of consecutive activities. Include mode, duration, and REALISTIC cost per mode (subway ~$2-5, taxi ~$15-40, walking = $0). Do NOT use a flat cost for all transit.' : ''}
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
    if (innerTimer) innerTimer.startPhase(`ai_call_day_${dayNumber}`);
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

    // Record AI phase timing, token usage, and model
    if (innerTimer) {
      innerTimer.endPhase(`ai_call_day_${dayNumber}`);
      try {
        const usage = data.usage;
        const modelUsed = data.model || 'unknown';
        if (usage) {
          innerTimer.addTokenUsage(usage.prompt_tokens || 0, usage.completion_tokens || 0, modelUsed);
        } else {
          innerTimer.addTokenUsage(0, 0, modelUsed);
        }
      } catch (_e) { /* non-blocking */ }
      // Write progress after AI call completes — this is the longest phase
      const aiDonePct = 5 + Math.round(((dayNumber - 0.3) / Math.max(1, totalDays || 1)) * 90);
      await innerTimer.updateProgress(`day_${dayNumber}_ai_complete`, aiDonePct);
      innerTimer.startPhase(`parse_response_day_${dayNumber}`);
    }

    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    let generatedDay;
    if (toolCall?.function?.arguments) {
      // Standard tool call response
      generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(toolCall.function.arguments))), dayNumber, resolvedDestination);
    } else if (message?.content) {
      // Fallback: AI returned content instead of tool call
      console.log("[generate-day] AI returned content instead of tool_call, attempting to parse...");
      try {
        // Try to extract JSON from the content
        const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(jsonMatch[0]))), dayNumber, resolvedDestination);
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

    // End parse phase, start post-processing
    if (innerTimer) {
      innerTimer.endPhase(`parse_response_day_${dayNumber}`);
      innerTimer.startPhase(`post_processing_day_${dayNumber}`);
    }

    // Note: lockedActivities were already loaded BEFORE the AI call (see line ~4452-4565)
    // This ensures AI knows to skip those time slots, saving money and guaranteeing locks work

    // Phantom hotel stripping is now handled by pipeline/validate-day + repair-day

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

    // Pre-arrival filtering and locked activity merge are now handled by pipeline/repair-day

    if (lockedActivities.length > 0) {
      // Remove any generated activities that conflict with locked activity times
      for (const locked of lockedActivities) {
        const lockedStart = parseTimeToMinutes(locked.startTime);
        const lockedEnd = parseTimeToMinutes(locked.endTime);
        
        if (lockedStart !== null && lockedEnd !== null) {
          normalizedActivities = normalizedActivities.filter((act: { startTime?: string; endTime?: string }) => {
            const actStart = parseTimeToMinutes(act.startTime || '00:00');
            const actEnd = parseTimeToMinutes(act.endTime || '23:59');
            if (actStart === null || actEnd === null) return true;
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
          if (genTitle.includes(lockedTitle) || lockedTitle.includes(genTitle)) return false;
          const keywords = lockedTitle.replace(/\b(the|a|an|at|in|on|for|and|or|to|of)\b/g, '').split(/\s+/).filter((w: string) => w.length > 2);
          if (keywords.length > 0) {
            const matchCount = keywords.filter((kw: string) => genTitle.includes(kw)).length;
            if (matchCount >= Math.ceil(keywords.length * 0.5) && matchCount >= 1) return false;
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
            // Time conflict only → try shifting into venue's open window (same logic as Stage 4.5)
            const DAY_NAMES_SD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayNameSD = DAY_NAMES_SD[dayOfWeek];
            const dayEntrySD = act.openingHours.find((h: string) => h.toLowerCase().startsWith(dayNameSD.toLowerCase()));
            let didFix = false;

            if (dayEntrySD && act.startTime) {
              const entryLowerSD = dayEntrySD.toLowerCase();
              // Parse opening time
              let venueOpenMins = -1;
              let venueCloseMins = -1;
              const timeMatchSD = entryLowerSD.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
              if (timeMatchSD) {
                let oh = parseInt(timeMatchSD[1]);
                const om = parseInt(timeMatchSD[2]);
                const op = timeMatchSD[3]?.toUpperCase();
                if (op === 'PM' && oh !== 12) oh += 12;
                if (op === 'AM' && oh === 12) oh = 0;
                venueOpenMins = oh * 60 + om;
              }
              const closeMatchSD = entryLowerSD.match(/[–\-−to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
              if (closeMatchSD) {
                let ch = parseInt(closeMatchSD[1]);
                const cm = parseInt(closeMatchSD[2]);
                const cp = closeMatchSD[3]?.toUpperCase();
                if (cp === 'PM' && ch !== 12) ch += 12;
                if (cp === 'AM' && ch === 12) ch = 0;
                venueCloseMins = ch * 60 + cm;
                if (venueCloseMins === 0) venueCloseMins = 1440;
              }

              if (venueOpenMins >= 0 && venueCloseMins > 0) {
                const oldMinsSD = parseInt(act.startTime.split(':')[0]) * 60 + parseInt(act.startTime.split(':')[1]);
                const durationSD = act.endTime
                  ? (parseInt(act.endTime.split(':')[0]) * 60 + parseInt(act.endTime.split(':')[1])) - oldMinsSD
                  : 60;
                let newStartMinsSD = -1;

                if (oldMinsSD < venueOpenMins) {
                  newStartMinsSD = venueOpenMins + 10;
                } else if (oldMinsSD >= venueCloseMins || (oldMinsSD + durationSD) > venueCloseMins) {
                  const latestStartSD = venueCloseMins - durationSD - 15;
                  if (latestStartSD >= venueOpenMins + 10) {
                    newStartMinsSD = latestStartSD;
                  } else {
                    // Duration doesn't fit → remove
                    console.log(`[generate-day] ✗ "${act.title}" — REMOVED (duration ${durationSD}min doesn't fit in venue hours)`);
                    activitiesToRemove.push(act.id);
                    didFix = true;
                  }
                }

                if (!didFix && newStartMinsSD >= 0 && newStartMinsSD !== oldMinsSD) {
                  // Hard-constraint check: don't shift if it squeezes against checkout/departure
                  // Only treat checkout as hard stop if day has a flight departure
                  const dayHasFlightDepSD = normalizedActivities.some((fa: any) => {
                    const ftL = (fa.title || fa.name || '').toLowerCase();
                    const fcL = (fa.category || '').toLowerCase();
                    return fcL === 'transport' && (ftL.includes('airport') || ftL.includes('flight'));
                  });
                  
                  const hardStopActSD = normalizedActivities.find((ha: any) => {
                    const hCat = (ha.category || '').toLowerCase();
                    const hTitle = (ha.title || ha.name || '').toLowerCase();
                    const isCheckoutSD = hCat === 'accommodation' && (hTitle.includes('check') || hTitle.includes('checkout'));
                    if (isCheckoutSD && !dayHasFlightDepSD) return false;
                    return isCheckoutSD
                      || (hCat === 'transport' && (hTitle.includes('depart') || hTitle.includes('airport') || hTitle.includes('flight') || hTitle.includes('train')));
                  });
                  if (hardStopActSD && hardStopActSD.startTime) {
                    const hardStopMinsSD = parseInt(hardStopActSD.startTime.split(':')[0]) * 60 + parseInt(hardStopActSD.startTime.split(':')[1]);
                    const estimatedEndSD = newStartMinsSD + durationSD + 20;
                    if (estimatedEndSD > hardStopMinsSD) {
                      console.log(`[generate-day] ✗ "${act.title}" — REMOVED (shifted time would exceed hard stop at ${hardStopMinsSD}min)`);
                      activitiesToRemove.push(act.id);
                      didFix = true;
                    }
                  }
                  
                  if (!didFix && newStartMinsSD >= 0 && newStartMinsSD !== oldMinsSD) {
                    const newST = `${Math.floor(newStartMinsSD / 60).toString().padStart(2, '0')}:${(newStartMinsSD % 60).toString().padStart(2, '0')}`;
                    const newEndMinsSD = newStartMinsSD + durationSD;
                    act.startTime = newST;
                    if (act.endTime) {
                      act.endTime = `${Math.floor(newEndMinsSD / 60).toString().padStart(2, '0')}:${(newEndMinsSD % 60).toString().padStart(2, '0')}`;
                    }
                    console.log(`[generate-day] ✓ "${act.title}" shifted to ${newST} (venue hours: ${Math.floor(venueOpenMins / 60).toString().padStart(2, '0')}:${(venueOpenMins % 60).toString().padStart(2, '0')}–${Math.floor(venueCloseMins / 60).toString().padStart(2, '0')}:${(venueCloseMins % 60).toString().padStart(2, '0')})`);
                    didFix = true;
                  }
                }
              }
            }

            if (!didFix) {
              // Couldn't parse hours → fall back to warning tag
              console.warn(`[generate-day] ⚠️ "${act.title}" time conflict (unparseable hours): ${result.reason}`);
              (act as any).closedRisk = true;
              (act as any).closedRiskReason = result.reason;
            }
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
            mustDoList,
            dayMealPolicy?.requiredMeals
          );

          if (dayValidation.errors.length > 0) {
            console.warn(`[generate-day] Trip-wide validation errors for Day ${dayNumber}:`, dayValidation.errors);

            // Strip duplicates found by validation instead of full retry
            // Remove activities flagged as TRIP-WIDE DUPLICATE or CONCEPT SIMILARITY
            // For MEAL REPEAT: try to swap from pool first, only keep duplicate as last resort
            const duplicateTitles: string[] = [];
            const mealRepeatTitles: string[] = [];
            for (const err of dayValidation.errors) {
              const mealMatch = err.match(/MEAL REPEAT:\s*"([^"]+)"/i);
              if (mealMatch) {
                mealRepeatTitles.push(mealMatch[1]);
                continue;
              }
              const titleMatch = err.match(/(?:TRIP-WIDE DUPLICATE|CONCEPT SIMILARITY):\s*"([^"]+)"/i);
              if (titleMatch) {
                duplicateTitles.push(titleMatch[1].toLowerCase());
              }
            }

            // MEAL REPEAT: swap duplicates from pool instead of keeping them
            if (mealRepeatTitles.length > 0) {
              const poolAvailable = (paramRestaurantPool || []) as any[];
              const usedSetLocal = new Set((paramUsedRestaurants || []).map((n: string) => n.toLowerCase()));
              // Also mark all restaurants in current day as used
              for (const act of generatedDay.activities) {
                if ((act.category || '').toLowerCase() === 'dining') {
                  usedSetLocal.add((act.title || '').toLowerCase());
                }
              }

              for (const repeatTitle of mealRepeatTitles) {
                const repeatLower = repeatTitle.toLowerCase();
                // Find the duplicate activity in this day
                const dupeIdx = generatedDay.activities.findIndex((act: any) =>
                  (act.title || '').toLowerCase().includes(repeatLower) || repeatLower.includes((act.title || '').toLowerCase())
                );
                if (dupeIdx === -1) continue;
                const dupeAct = generatedDay.activities[dupeIdx];
                if (dupeAct.isLocked) continue;

                // Determine meal type from the activity
                const startHour = parseInt((dupeAct.startTime || '12:00').split(':')[0], 10);
                const mealType = startHour < 11 ? 'breakfast' : startHour < 15 ? 'lunch' : 'dinner';

                // Find unused pool restaurant for this meal type
                const replacement = poolAvailable.find((r: any) => {
                  const rName = (r.name || '').toLowerCase();
                  if (usedSetLocal.has(rName)) return false;
                  return r.mealType === mealType || r.mealType === 'any';
                });

                if (replacement) {
                  console.log(`[generate-day] 🔄 Swapping duplicate dining "${dupeAct.title}" → "${replacement.name}" (pool-dedup-swap)`);
                  generatedDay.activities[dupeIdx] = {
                    ...dupeAct,
                    title: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} at ${replacement.name}`,
                    description: `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}. ${replacement.priceRange || '$$'}.`,
                    location: { name: replacement.name, address: replacement.address || '', neighborhood: replacement.neighborhood || '' },
                    source: 'pool-dedup-swap',
                  };
                  usedSetLocal.add(replacement.name.toLowerCase());
                } else {
                  console.log(`[generate-day] ⚠️ No pool replacement for duplicate "${dupeAct.title}" — keeping (real restaurant > placeholder)`);
                }
              }
              normalizedActivities = generatedDay.activities;
            }

            // Strip non-dining duplicates
            if (duplicateTitles.length > 0) {
              const beforeCount = generatedDay.activities.length;
              generatedDay.activities = generatedDay.activities.filter((act: any) => {
                const actTitle = (act.title || '').toLowerCase();
                const actCategory = (act.category || '').toLowerCase();
                const isDupe = duplicateTitles.some(dt => actTitle.includes(dt) || dt.includes(actTitle));
                if (isDupe) {
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
    // DEPARTURE DAY SEQUENCE VALIDATOR
    // Enforces correct ordering: Breakfast → Checkout → Transport → Security → Flight
    // Must run BEFORE the bookend validator to prevent nonsensical injections
    // =======================================================================
    if (isLastDay && generatedDay.activities?.length > 1) {
      try {
        const depFlight24 = flightContext.returnDepartureTime24
          || (flightContext.returnDepartureTime ? normalizeTo24h(flightContext.returnDepartureTime) : null)
          || null;

        const dvHotelName = (() => {
          const accomAct = generatedDay.activities?.find((a: any) =>
            (a.category || '').toLowerCase() === 'accommodation' &&
            !(a.title || '').toLowerCase().includes('checkout') &&
            !(a.title || '').toLowerCase().includes('check-out')
          );
          if (accomAct) return accomAct.location?.name || accomAct.title?.replace(/^(Return to |Freshen up at |Check.?in at )/i, '') || null;
          return flightContext.hotelName || null;
        })();

        let dvFixCount = 0;

        // --- Classify activities ---
        type DvRole = 'breakfast' | 'checkout' | 'airport-transport' | 'airport-security' | 'flight' | 'other';
        const dvClassify = (a: any): DvRole => {
          const t = (a.title || '').toLowerCase();
          const cat = (a.category || '').toLowerCase();
          const tags = (a.tags || []).map((tg: string) => tg.toLowerCase());
          const loc = (a.location?.name || '').toLowerCase();

          // Flight
          if (cat === 'flight' || t.includes('flight departure') || t.includes('departure flight') ||
              (t.includes('\u2192') && cat === 'transport' && (t.includes('home') || tags.includes('flight')))) {
            return 'flight';
          }
          // Airport security / departure check-in
          if (t.includes('airport departure') || t.includes('airport security') ||
              t.includes('security and boarding') || t.includes('check-in at airport') ||
              t.includes('departure and security') || (t.includes('security') && loc.includes('airport'))) {
            return 'airport-security';
          }
          // Airport transport
          if ((cat === 'transport' || cat === 'transit') &&
              (t.includes('airport') || (t.includes('transfer to') && loc.includes('airport')) ||
               loc.includes('airport') || t.includes('head to airport') || t.includes('taxi to airport'))) {
            return 'airport-transport';
          }
          // Checkout
          if (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) {
            return 'checkout';
          }
          // Breakfast
          if ((cat === 'dining' || cat === 'restaurant' || cat === 'food') &&
              (t.includes('breakfast') || t.includes('morning meal') || tags.includes('breakfast'))) {
            return 'breakfast';
          }
          return 'other';
        };

        const dvRoles = generatedDay.activities.map((a: any) => ({ act: a, role: dvClassify(a) }));

        const breakfastItems = dvRoles.filter((r: any) => r.role === 'breakfast');
        const checkoutItems = dvRoles.filter((r: any) => r.role === 'checkout');
        const airportTransportItems = dvRoles.filter((r: any) => r.role === 'airport-transport');
        const airportSecurityItems = dvRoles.filter((r: any) => r.role === 'airport-security');
        const flightItems = dvRoles.filter((r: any) => r.role === 'flight');

        // --- R1: Breakfast before checkout ---
        if (breakfastItems.length > 0 && checkoutItems.length > 0) {
          const bIdx = generatedDay.activities.indexOf(breakfastItems[0].act);
          const cIdx = generatedDay.activities.indexOf(checkoutItems[0].act);
          if (bIdx > cIdx) {
            const [breakfast] = generatedDay.activities.splice(bIdx, 1);
            const newCIdx = generatedDay.activities.indexOf(checkoutItems[0].act);
            generatedDay.activities.splice(newCIdx, 0, breakfast);

            const checkoutStart = parseTimeToMinutes(checkoutItems[0].act.startTime) ?? 480;
            const breakfastStart = checkoutStart - 60;
            breakfast.startTime = minutesToHHMM(Math.max(breakfastStart, 360));
            breakfast.endTime = minutesToHHMM(Math.max(breakfastStart, 360) + 45);
            checkoutItems[0].act.startTime = breakfast.endTime;
            checkoutItems[0].act.endTime = addMinutesToHHMM(breakfast.endTime, 15);

            console.log(`[departure-validator] \ud83d\udd04 Moved breakfast before checkout on Day ${dayNumber}`);
            dvFixCount++;
          }
        }

        // --- R6: Breakfast location — override if not near hotel ---
        if (breakfastItems.length > 0 && dvHotelName) {
          const bAct = breakfastItems[0].act;
          const bLoc = (bAct.location?.name || '').toLowerCase();
          const hotelLower = dvHotelName.toLowerCase();
          const isNearHotel = bLoc.includes(hotelLower) || bLoc.includes('hotel') ||
            bLoc.includes('lobby') || hotelLower.includes(bLoc);
          if (!isNearHotel && bLoc.length > 0) {
            console.log(`[departure-validator] \ud83d\udd04 Overriding breakfast location "${bAct.location?.name}" \u2192 "near ${dvHotelName}"`);
            bAct.location = { name: `Near ${dvHotelName}`, address: bAct.location?.address || '' };
            bAct.description = (bAct.description || '').replace(/at .+?(?:\.|$)/, `near ${dvHotelName}.`);
            dvFixCount++;
          }
        }

        // --- R4: Single airport transport, remove nonsensical ones ---
        if (airportTransportItems.length > 1) {
          const toKeep = airportTransportItems[airportTransportItems.length - 1].act;
          for (const item of airportTransportItems) {
            if (item.act !== toKeep) {
              const idx = generatedDay.activities.indexOf(item.act);
              if (idx !== -1) {
                console.log(`[departure-validator] \ud83d\uddd1\ufe0f Removed duplicate airport transport "${item.act.title}"`);
                generatedDay.activities.splice(idx, 1);
                dvFixCount++;
              }
            }
          }
        }
        // Remove nonsensical walk-to-airport transports
        for (let i = generatedDay.activities.length - 1; i >= 0; i--) {
          const a = generatedDay.activities[i];
          const t = (a.title || '').toLowerCase();
          const cat = (a.category || '').toLowerCase();
          if ((cat === 'transport' || cat === 'transit') && t.includes('walk') &&
              (t.includes('airport') || (a.location?.name || '').toLowerCase().includes('airport'))) {
            const dur = a.durationMinutes || 0;
            if (dur <= 15 || t.includes('walk to')) {
              console.log(`[departure-validator] \ud83d\uddd1\ufe0f Removed nonsensical transport "${a.title}"`);
              generatedDay.activities.splice(i, 1);
              dvFixCount++;
            }
          }
        }

        // --- R2: Airport security immediately before flight ---
        if (airportSecurityItems.length > 0 && flightItems.length > 0) {
          const secAct = airportSecurityItems[0].act;
          const flightAct = flightItems[0].act;
          const secIdx = generatedDay.activities.indexOf(secAct);
          const flightIdx = generatedDay.activities.indexOf(flightAct);
          if (secIdx !== -1 && flightIdx !== -1 && secIdx !== flightIdx - 1) {
            generatedDay.activities.splice(secIdx, 1);
            const newFlightIdx = generatedDay.activities.indexOf(flightAct);
            generatedDay.activities.splice(newFlightIdx, 0, secAct);
            console.log(`[departure-validator] \ud83d\udd04 Moved airport security to pre-flight position`);
            dvFixCount++;
          }
        }

        // --- R3: No activities after airport security except flight/transport ---
        if (airportSecurityItems.length > 0) {
          const secAct = airportSecurityItems[0].act;
          const secIdx = generatedDay.activities.indexOf(secAct);
          if (secIdx !== -1) {
            const afterSecurity = generatedDay.activities.slice(secIdx + 1);
            const misplaced = afterSecurity.filter((a: any) => {
              const role = dvClassify(a);
              return role !== 'flight' && role !== 'airport-transport' && role !== 'airport-security';
            });
            for (const mis of misplaced) {
              const misIdx = generatedDay.activities.indexOf(mis);
              if (misIdx !== -1) {
                generatedDay.activities.splice(misIdx, 1);
                const atIdx = generatedDay.activities.findIndex((a: any) => dvClassify(a) === 'airport-transport');
                const insertAt = atIdx !== -1 ? atIdx : (generatedDay.activities.indexOf(checkoutItems[0]?.act) ?? 0);
                generatedDay.activities.splice(Math.max(0, insertAt), 0, mis);
                console.log(`[departure-validator] \ud83d\udd04 Moved "${mis.title}" before airport transport (was after security)`);
                dvFixCount++;
              }
            }
          }
        }

        // --- R5: Time window enforcement ---
        if (depFlight24 && checkoutItems.length > 0) {
          const depMins = parseTimeToMinutes(depFlight24) ?? null;
          if (depMins !== null) {
            const airportBuffer = 150; // 2.5h international default
            const arriveAirportBy = depMins - airportBuffer;

            const transportCard = generatedDay.activities.find((a: any) => dvClassify(a) === 'airport-transport');
            const transportDuration = transportCard?.durationMinutes || 45;

            const latestCheckoutMins = arriveAirportBy - transportDuration - 30;

            const cIdx = generatedDay.activities.indexOf(checkoutItems[0].act);
            const tIdx = transportCard ? generatedDay.activities.indexOf(transportCard) : -1;

            if (cIdx !== -1 && tIdx !== -1 && tIdx > cIdx + 1) {
              const between = generatedDay.activities.slice(cIdx + 1, tIdx);
              let currentTime = parseTimeToMinutes(checkoutItems[0].act.endTime) ?? latestCheckoutMins;

              for (let j = between.length - 1; j >= 0; j--) {
                const act = between[j];
                const actDur = act.durationMinutes || 60;
                if (currentTime + actDur > arriveAirportBy - transportDuration) {
                  const idx = generatedDay.activities.indexOf(act);
                  if (idx !== -1) {
                    console.log(`[departure-validator] \ud83d\uddd1\ufe0f Removed "${act.title}" \u2014 doesn't fit departure window`);
                    generatedDay.activities.splice(idx, 1);
                    dvFixCount++;
                  }
                } else {
                  currentTime += actDur + 15;
                }
              }
            }

            // Re-anchor checkout if too late
            const checkoutMins = parseTimeToMinutes(checkoutItems[0].act.startTime) ?? 0;
            if (checkoutMins > latestCheckoutMins) {
              checkoutItems[0].act.startTime = minutesToHHMM(Math.max(latestCheckoutMins, 360));
              checkoutItems[0].act.endTime = addMinutesToHHMM(checkoutItems[0].act.startTime, 15);
              console.log(`[departure-validator] \ud83d\udd04 Re-anchored checkout to ${checkoutItems[0].act.startTime} for departure window`);
              dvFixCount++;

              if (breakfastItems.length > 0) {
                const newCheckoutMins = parseTimeToMinutes(checkoutItems[0].act.startTime) ?? 480;
                breakfastItems[0].act.startTime = minutesToHHMM(Math.max(newCheckoutMins - 60, 360));
                breakfastItems[0].act.endTime = minutesToHHMM(Math.max(newCheckoutMins - 15, 405));
                console.log(`[departure-validator] \ud83d\udd04 Re-anchored breakfast to ${breakfastItems[0].act.startTime}`);
              }
            }
          }
        }

        // Re-sort by startTime after all fixes
        if (dvFixCount > 0) {
          generatedDay.activities.sort((a: any, b: any) => {
            const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
            const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
            return ta - tb;
          });
          normalizedActivities = generatedDay.activities;
          console.log(`[departure-validator] \u2713 Day ${dayNumber} departure sequence validated (${dvFixCount} fixes applied)`);
        } else {
          console.log(`[departure-validator] \u2713 Day ${dayNumber} departure sequence OK \u2014 no fixes needed`);
        }
      } catch (dvErr) {
        console.warn('[departure-validator] Non-blocking error:', dvErr);
      }
    }

    // =======================================================================
    // TRANSPORT & HOTEL BOOKEND VALIDATOR
    // Ensures consistent Activity → Transport → Activity pattern
    // and that hotel returns/arrivals always have visible cards
    // =======================================================================
    try {
      const bookendHotelName = (() => {
        const accomAct = generatedDay.activities?.find((a: any) => 
          (a.category || '').toLowerCase() === 'accommodation' && 
          !(a.title || '').toLowerCase().includes('checkout') &&
          !(a.title || '').toLowerCase().includes('check-out')
        );
        if (accomAct) return accomAct.location?.name || accomAct.title?.replace(/^(Return to |Freshen up at |Check.?in at )/i, '') || null;
        return paramHotelName || null;
      })();

      if (bookendHotelName && generatedDay.activities?.length > 0) {
        const bActs = generatedDay.activities;
        const bIsTransport = (a: any) => (a.category || '').toLowerCase() === 'transport';
        const bIsAccom = (a: any) => (a.category || '').toLowerCase() === 'accommodation';
        const bIsHotelRelated = (a: any) => {
          const t = (a.title || '').toLowerCase();
          const l = (a.location?.name || '').toLowerCase();
          const hn = bookendHotelName.toLowerCase();
          return t.includes(hn) || l.includes(hn) || t.includes('hotel') || t.includes('return to') || t.includes('freshen up');
        };
        const bOffset = (ts: string, min: number): string => {
          if (!ts) return '';
          const p = ts.split(':');
          if (p.length < 2) return ts;
          const tot = parseInt(p[0], 10) * 60 + parseInt(p[1], 10) + min;
          return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
        };
        const bAccomCard = (label: string, st: string, dur: number) => ({
          id: `bookend-${label.replace(/\s/g, '-').toLowerCase()}-${dayNumber}-${Date.now()}`,
          title: `${label} ${bookendHotelName}`,
          category: 'accommodation',
          description: `Time at ${bookendHotelName} to rest and refresh.`,
          startTime: st, endTime: bOffset(st, dur), durationMinutes: dur,
          location: { name: bookendHotelName, address: '' },
          cost: { amount: 0, currency: 'USD' }, isLocked: false,
          tags: ['hotel', 'rest'], source: 'bookend-validator',
        });
        const bTransCard = (from: string, to: string, st: string) => ({
          id: `transport-gap-${dayNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: `Travel to ${to}`, category: 'transport',
          description: `Transit from ${from} to ${to}.`,
          startTime: st, endTime: bOffset(st, 15), durationMinutes: 15,
          location: { name: to, address: '' },
          cost: { amount: 0, currency: 'USD' }, isLocked: false,
          tags: ['transport'], transportation: { method: 'walking', duration: '15 min' },
          source: 'bookend-validator',
        });

        // 1. Mid-day hotel transports without accommodation card
        for (let i = 0; i < bActs.length - 1; i++) {
          if (bIsTransport(bActs[i]) && bIsHotelRelated(bActs[i]) && !bIsAccom(bActs[i + 1])) {
            const card = bAccomCard('Freshen up at', bActs[i].endTime || bOffset(bActs[i].startTime || '14:00', 15), 30);
            bActs.splice(i + 1, 0, card);
            console.log(`[bookend-validator] 🏨 Injected "Freshen up at ${bookendHotelName}" after transport on Day ${dayNumber}`);
          }
        }

        // 2. End-of-day hotel return
        const bVisible = bActs.filter((a: any) => !bIsTransport(a));
        const bLast = bVisible[bVisible.length - 1];
        if (bLast && !bIsAccom(bLast)) {
          const et = bLast.endTime || '22:00';
          bActs.push(bTransCard(bLast.location?.name || bLast.title || 'venue', bookendHotelName, et));
          bActs.push(bAccomCard('Return to', bOffset(et, 20), 15));
          console.log(`[bookend-validator] 🏨 Injected "Return to ${bookendHotelName}" at end of Day ${dayNumber}`);
        }

        // 3. Ensure transport between every pair of visible activities at different locations
        const bRebuilt: any[] = [];
        for (let i = 0; i < bActs.length; i++) {
          bRebuilt.push(bActs[i]);
          if (i < bActs.length - 1) {
            const curr = bActs[i], next = bActs[i + 1];
            if (bIsTransport(curr) || bIsTransport(next)) continue;
            const cLoc = (curr.location?.name || curr.title || '').toLowerCase();
            const nLoc = (next.location?.name || next.title || '').toLowerCase();
            if (cLoc && nLoc && cLoc !== nLoc) {
              bRebuilt.push(bTransCard(curr.location?.name || curr.title, next.location?.name || next.title, curr.endTime || ''));
              console.log(`[bookend-validator] 🚕 Injected transit gap: "${curr.title}" → "${next.title}" on Day ${dayNumber}`);
            }
          }
        }
        generatedDay.activities = bRebuilt;
        normalizedActivities = bRebuilt;
        console.log(`[bookend-validator] ✓ Day ${dayNumber} bookend validation complete (${bRebuilt.length} activities)`);
      }
    } catch (bookendErr) {
      console.warn('[bookend-validator] Non-blocking error:', bookendErr);
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
    const needsCheckoutGuarantee = isLastDay || (resolvedIsLastDayInCity && !resolvedIsTransitionDay);

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
        let checkoutHotelName = resolvedHotelOverride?.name || flightContext.hotelName || 'Hotel';
        let checkoutHotelAddress = resolvedHotelOverride?.address || flightContext.hotelAddress || '';

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
    if (resolvedIsLastDayInCity && !isLastDay && resolvedNextLegTransport && resolvedNextLegTransport !== 'flight') {
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

    // ====================================================================
    // MEAL FINAL GUARD — Last line of defense for generate-day path
    // Runs AFTER all post-processing (dedup, personalization strip,
    // opening hours removal, route optimization, etc.)
    // Now pre-fetches real venues from verified_venues table so fallbacks
    // use REAL restaurant names instead of generic "dinner spot" text.
    // ====================================================================
    if (dayMealPolicy && dayMealPolicy.requiredMeals.length > 0) {
      // Build meal fallback venues from restaurant pool first, then verified_venues
      let mealFallbackVenues: Array<{ name: string; address: string; mealType: string }> = [];
      
      // PRIORITY 1: Use the pre-generated restaurant pool (real, curated restaurants)
      if (paramRestaurantPool && Array.isArray(paramRestaurantPool) && paramRestaurantPool.length > 0) {
        const usedSet = new Set((paramUsedRestaurants || []).map((n: string) => n.toLowerCase()));
        for (const r of paramRestaurantPool) {
          if (!usedSet.has((r.name || '').toLowerCase())) {
            mealFallbackVenues.push({
              name: r.name,
              address: r.address || r.neighborhood || (resolvedDestination || destination || ''),
              mealType: r.mealType || 'any',
            });
          }
        }
        if (mealFallbackVenues.length > 0) {
          console.log(`[generate-day] Meal guard using ${mealFallbackVenues.length} venues from restaurant pool`);
        }
      }
      
      // PRIORITY 2: Fallback to verified_venues if pool is empty
      if (mealFallbackVenues.length < 5) {
        try {
          const destQuery = resolvedDestination || destination || '';
          if (destQuery && supabase) {
            const { data: venues } = await supabase
              .from('verified_venues')
              .select('name, address, category')
              .ilike('city', `%${destQuery}%`)
              .in('category', ['restaurant', 'dining', 'cafe', 'bar', 'food'])
              .limit(30);
            if (venues && venues.length > 0) {
              for (const v of venues) {
                const nameLower = (v.name || '').toLowerCase();
                let mealType = 'any';
                if (nameLower.includes('breakfast') || nameLower.includes('brunch') || nameLower.includes('café') || nameLower.includes('cafe') || nameLower.includes('bakery')) mealType = 'breakfast';
                else if (nameLower.includes('ramen') || nameLower.includes('lunch') || nameLower.includes('noodle') || nameLower.includes('sandwich')) mealType = 'lunch';
                else if (nameLower.includes('dinner') || nameLower.includes('izakaya') || nameLower.includes('steakhouse') || nameLower.includes('bistro')) mealType = 'dinner';
                mealFallbackVenues.push({ name: v.name, address: v.address || destQuery, mealType });
              }
              console.log(`[generate-day] Supplemented with ${venues.length} verified_venues candidates`);
            }
          }
        } catch (e) {
          console.warn('[generate-day] Could not pre-fetch venue candidates:', e);
        }
      }

      // Strip chain restaurants before meal guard runs
      {
        const { filtered: chainFiltered, removedChains } = filterChainRestaurants(generatedDay.activities || []);
        if (removedChains.length > 0) {
          console.warn(`[generate-day] 🚫 Chain filter removed ${removedChains.length} chain(s) from Day ${dayNumber}: ${removedChains.join(', ')}`);
          generatedDay.activities = chainFiltered;
          normalizedActivities = generatedDay.activities;
        }
      }

      const mealGuardResult = enforceRequiredMealsFinalGuard(
        generatedDay.activities || [],
        dayMealPolicy.requiredMeals,
        dayNumber,
        resolvedDestination || destination || 'the destination',
        'USD',
        dayMealPolicy.dayMode,
        mealFallbackVenues,
      );
      if (!mealGuardResult.alreadyCompliant) {
        generatedDay.activities = mealGuardResult.activities as any;
        normalizedActivities = generatedDay.activities;
        console.warn(`[generate-day] 🍽️ MEAL GUARD FIRED: Day ${dayNumber} was missing [${mealGuardResult.injectedMeals.join(', ')}] — injected ${mealFallbackVenues.length > 0 ? 'REAL POOL venues' : 'destination-aware fallbacks'} before return`);
      } else {
        console.log(`[generate-day] ✓ Meal guard passed — Day ${dayNumber} has all required meals [${dayMealPolicy.requiredMeals.join(', ')}]`);
      }
    }

    // End post-processing phase and write progress
    if (innerTimer) {
      innerTimer.endPhase(`post_processing_day_${dayNumber}`);
      const postProcPct = 5 + Math.round((dayNumber / Math.max(1, totalDays || 1)) * 90);
      await innerTimer.updateProgress(`day_${dayNumber}_post_processing_complete`, postProcPct);
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
