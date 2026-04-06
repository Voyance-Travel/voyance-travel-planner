/**
 * Pipeline Phase 4: Compile Prompt
 *
 * Extracts ~930 lines of prompt assembly from action-generate-day.ts into a
 * single async function. Handles:
 *   - Preference loading & trip intents
 *   - Must-do parsing & scheduling
 *   - Interest categories, generation rules, pacing, visitor type
 *   - Pre-booked commitments & must-haves checklist
 *   - Additional notes / trip purpose injection
 *   - Schema compilation (calls compile-day-schema internally)
 *   - Timing instructions & meal policy derivation
 *   - Traveler profile & archetype guidance (unified loader)
 *   - Generation context (dietary, jet lag, weather, blending, etc.)
 *   - Budget resolution (trip-level + per-city override)
 *   - Voyance Picks
 *   - Collaborator attribution
 *   - System prompt & user prompt assembly
 *
 * Returns CompiledPrompt with the two prompt strings plus all metadata
 * needed by downstream post-processing stages.
 */

import { compileDaySchema } from './compile-day-schema.ts';
import type { CompiledFacts, LockedActivity } from './types.ts';

// External module imports (same as action-generate-day used)
import {
  getUserPreferences,
  getLearnedPreferences,
  buildPreferenceContext,
} from '../preference-context.ts';
import {
  parseMustDoInput,
  scheduleMustDos,
  buildMustHavesConstraintPrompt,
  getBlockedTimeRange,
  type ScheduledMustDo,
} from '../must-do-priorities.ts';
import { formatGenerationRules } from '../budget-constraints.ts';
import {
  analyzePreBookedCommitments,
  type PreBookedCommitment,
} from '../pre-booked-commitments.ts';
import {
  deriveMealPolicy,
  buildMealRequirementsPrompt,
  type MealPolicy,
  type MealPolicyInput,
} from '../meal-policy.ts';
import {
  buildTransitionDayPrompt,
} from '../prompt-library.ts';
import {
  loadTravelerProfile,
  type TravelerProfile as UnifiedTravelerProfile,
} from '../profile-loader.ts';
import {
  getFullArchetypeContext,
  buildFullPromptGuidanceAsync,
  getArchetypeDefinition,
} from '../archetype-data.ts';
import {
  buildTripTypePromptSection,
} from '../trip-type-modifiers.ts';
import {
  getDestinationId,
  extractRestaurantVenueName,
} from '../generation-utils.ts';
import {
  normalizeTo24h,
} from '../flight-hotel-context.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;

  // Side-effects consumed by downstream post-processing
  mustDoEventItems: ScheduledMustDo[];
  dayMealPolicy: MealPolicy | null;
  allUserIdsForAttribution: string[];
  actualDailyBudgetPerPerson: number | null;
  profile: UnifiedTravelerProfile;
  effectiveBudgetTier: string;
  isSmartFinish: boolean;
  smartFinishRequested: boolean;
  metadata: Record<string, unknown> | null;
  mustDoActivitiesRaw: string;
  preferenceContext: string;

  // Schema outputs (updated by compileDaySchema)
  dayConstraints: string;
  flightContext: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

export async function compilePrompt(
  supabase: any,
  userId: string,
  LOVABLE_API_KEY: string,
  params: Record<string, any>,
  facts: CompiledFacts,
): Promise<CompiledPrompt> {
  const {
    tripId, dayNumber, totalDays, destination, date, travelers,
    tripType, budgetTier, preferences, previousDayActivities,
    currentActivities,
    isTransitionDay: paramIsTransitionDay,
    mustDoActivities: paramMustDoActivities,
    interestCategories: paramInterestCategories,
    generationRules: paramGenerationRules,
    pacing: paramPacing,
    isFirstTimeVisitor: paramIsFirstTimeVisitor,
    isFirstDayInCity: paramIsFirstDayInCity,
    restaurantPool: paramRestaurantPool,
    usedRestaurants: paramUsedRestaurants,
    hotelOverride: paramHotelOverride,
  } = params;

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

  // ═══════════════════════════════════════════════════════════════════════
  // PREFERENCE CONTEXT
  // ═══════════════════════════════════════════════════════════════════════
  const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
  const userPrefs = userId ? await getUserPreferences(supabase, userId) : null;
  const preferenceContext = buildPreferenceContext(insights, userPrefs);

  // ═══════════════════════════════════════════════════════════════════════
  // TRIP INTENTS
  // ═══════════════════════════════════════════════════════════════════════
  let tripIntentsContext = '';
  if (tripId) {
    const { data: intents } = await supabase
      .from('trip_intents')
      .select('intent_type, intent_value')
      .eq('trip_id', tripId)
      .eq('active', true);
    if (intents && intents.length > 0) {
      const formatted = intents.map((i: any) => `${i.intent_type}: ${i.intent_value}`).join(', ');
      tripIntentsContext = `\nTrip-specific requests from user: ${formatted}`;
      console.log(`[compile-prompt] Loaded ${intents.length} trip intents`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MUST-DO PARSING & SCHEDULING
  // ═══════════════════════════════════════════════════════════════════════
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

  const mustDoActivitiesRaw = requestMustDoText || (() => {
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

  if (mustDoActivitiesRaw.trim()) {
    const forceAllMust = !!isSmartFinish || !!smartFinishRequested;
    const mustDoAnalysis = parseMustDoInput(mustDoActivitiesRaw, destination, forceAllMust, preferences?.startDate || date?.split('T')[0], totalDays);
    if (mustDoAnalysis.length > 0) {
      const scheduled = scheduleMustDos(mustDoAnalysis, totalDays);
      const dayItems = scheduled.scheduled.filter((s: any) => s.assignedDay === dayNumber);
      mustDoEventItems = dayItems.filter((s: any) =>
        s.priority.activityType === 'all_day_event' || s.priority.activityType === 'half_day_event'
      );
      if (dayItems.length > 0) {
        const blockedTimeLines = mustDoEventItems.map((ev: any) => {
          const { blockedStart, blockedEnd } = getBlockedTimeRange(ev);
          return `⏰ "${ev.priority.title}" — BLOCKED TIME: ${blockedStart}–${blockedEnd}
  YOU MUST CREATE AN ACTIVITY ENTRY for "${ev.priority.title}" with startTime: "${blockedStart}", endTime: "${blockedEnd}".
  This MUST appear as a real activity card in the JSON output. Do NOT schedule any OTHER activities in this window.`;
        }).join('\n');
        mustDoPrompt = `\n## 🚨 USER'S MUST-DO VENUES FOR DAY ${dayNumber} (MANDATORY)\n\nThe traveler has PERSONALLY RESEARCHED these venues. You MUST include them:\n${dayItems.map((item: any) => `- ${item.priority.title} (${item.priority.priority})${item.priority.activityType === 'all_day_event' ? ' [ALL-DAY EVENT — YOU MUST generate an activity card for this event]' : item.priority.activityType === 'half_day_event' ? ' [HALF-DAY EVENT — YOU MUST generate an activity card for this event]' : ''}`).join('\n')}\n${blockedTimeLines ? '\n' + blockedTimeLines + '\n' : ''}\nRULES:\n- EVERY must-do venue listed above MUST appear as its own activity entry in the JSON output\n- For ALL-DAY events: CREATE the event as an activity card, then do NOT schedule OTHER activities during its time window\n- For HALF-DAY events: CREATE the event as an activity card, then fill the OTHER half of the day\n- Any OTHER activity overlapping a BLOCKED TIME window is a HARD FAILURE\n- Only add AI recommendations to fill remaining slots OUTSIDE blocked windows\n- CRITICAL DEDUP RULE: Do NOT generate a SEPARATE activity that is the same TYPE as a must-do. For example, if the user has "Comedy Show" as a must-do, do NOT also add your own "Stand-Up Comedy" or "Comedy Night" activity. The user's must-do IS the comedy show — you just need to create the card for it with a proper venue, not add a second one.\n- When creating the activity card for a must-do, use a PROPERLY FORMATTED title with a specific venue name (e.g., "Comedy Show at Comedy Cellar" not just the raw user text).\n`;
      } else {
        const unscheduledItems = scheduled.unschedulable || [];
        if (unscheduledItems.length > 0) {
          mustDoPrompt = `\n## User's Researched Venues (try to include if appropriate)\n${unscheduledItems.map((u: any) => `- ${u.priority.title} (${u.priority.priority})`).join('\n')}\n`;
        }
      }
      console.log(`[compile-prompt] Must-do: ${mustDoAnalysis.length} total, Day ${dayNumber}: ${dayItems.length} assigned, ${mustDoEventItems.length} events`);

      // Global must-do context
      const otherDayItems = scheduled.scheduled.filter((s: any) => s.assignedDay !== dayNumber);
      if (otherDayItems.length > 0) {
        mustDoPrompt += '\n\n📋 OTHER DAYS HAVE THESE COMMITTED ACTIVITIES (for your awareness — do NOT schedule these today):\n';
        for (const other of otherDayItems) {
          mustDoPrompt += `- Day ${other.assignedDay}: ${other.priority.title} (${other.priority.activityType})\n`;
        }
        mustDoPrompt += 'Keep today\'s schedule compatible with the overall trip plan.\n';
      }
    } else {
      mustDoPrompt = `\n## 🚨 USER'S RESEARCHED RESTAURANTS & VENUES (MANDATORY)\n\nThe traveler has researched these specific venues. Include as many as possible in the itinerary:\n"${mustDoActivitiesRaw.trim()}"\n`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTEREST CATEGORIES + GENERATION RULES + PACING
  // ═══════════════════════════════════════════════════════════════════════
  if (interestCategories.length > 0) {
    const categoryLabels: Record<string, string> = {
      history: 'History & Museums', food: 'Food & Dining', shopping: 'Shopping',
      nature: 'Parks & Nature', culture: 'Arts & Culture', nightlife: 'Nightlife',
    };
    const labels = interestCategories.map((c: string) => categoryLabels[c] || c).join(', ');
    mustDoPrompt += `\n## USER INTERESTS\nThe user is especially interested in: ${labels}. Weight recommendations toward these categories.\n`;
  }

  if (genRules.length > 0) {
    mustDoPrompt += formatGenerationRules(genRules);
  }

  mustDoPrompt += `\n## VISITOR TYPE\n${effectiveIsFirstTimeVisitor ? 'Traveler is a FIRST-TIME visitor. Prioritize iconic landmarks and essential highlights for this city.' : 'Traveler is a RETURNING visitor. Prioritize hidden gems, local favorites, and deeper neighborhood exploration over tourist staples.'}\n`;

  const pacingGuidance: Record<string, string> = {
    relaxed: 'PACING = RELAXED: Fewer activities with generous downtime and slower transitions.',
    balanced: 'PACING = BALANCED: Normal day density with a healthy mix of activities and breathing room.',
    packed: 'PACING = PACKED: Maximize meaningful activities while keeping sequencing realistic.',
  };
  mustDoPrompt += `\n## PACING\n${pacingGuidance[(effectivePacing || 'balanced').toLowerCase()] || pacingGuidance.balanced}\n`;

  // ═══════════════════════════════════════════════════════════════════════
  // MUST-HAVES + PRE-BOOKED COMMITMENTS
  // ═══════════════════════════════════════════════════════════════════════
  let mustHavesConstraintPrompt = '';
  let preBookedCommitmentsPrompt = '';
  if (tripId) {
    const metadataForConstraints = (tripId && mustDoPrompt !== undefined)
      ? (await supabase.from('trips').select('metadata').eq('id', tripId).single()).data?.metadata as Record<string, unknown> | null
      : null;

    const mustHavesList = (metadataForConstraints?.mustHaves as Array<{ label: string; notes?: string }>) || [];
    if (mustHavesList.length > 0) {
      mustHavesConstraintPrompt = buildMustHavesConstraintPrompt(mustHavesList, totalDays);
    }

    const preBookedList = (metadataForConstraints?.preBookedCommitments as PreBookedCommitment[]) || [];
    if (preBookedList.length > 0) {
      const startDate = preferences?.startDate || params.date?.split('T')[0] || '';
      const endDate = preferences?.endDate || '';
      const commitmentAnalysis = analyzePreBookedCommitments(preBookedList, startDate, endDate);
      const dayDate = params.date?.split('T')[0] || '';
      const dayAvail = commitmentAnalysis.dayBlocks.get(dayDate);
      if (dayAvail && dayAvail.blockedPeriods.length > 0) {
        preBookedCommitmentsPrompt = `\n## 📅 PRE-BOOKED COMMITMENTS FOR THIS DAY (NON-NEGOTIABLE)\n\nThe traveler has FIXED commitments today. You MUST schedule around them:\n${dayAvail.blockedPeriods.map((b: any) => `- "${b.commitment.title}" from ${b.startTime} to ${b.endTime}${b.commitment.location ? ` at ${b.commitment.location}` : ''} [${b.commitment.category}]`).join('\n')}\n\nAvailable time slots:\n${dayAvail.availableSlots.map((s: any) => `- ${s.startTime} to ${s.endTime} (${s.durationMinutes} min, ${s.period})`).join('\n')}\n\nRULES:\n- Do NOT schedule any activity during the blocked periods above\n- Include the pre-booked event AS an activity in the itinerary (category: "${dayAvail.blockedPeriods[0]?.commitment.category || 'event'}")\n- Plan activities ONLY in the available time slots\n`;
      } else if (commitmentAnalysis.promptSection) {
        preBookedCommitmentsPrompt = `\n## 📅 Pre-Booked Commitments (other days)\nThe traveler has pre-booked events on other days. No fixed events today — plan freely.\n`;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADDITIONAL NOTES / TRIP PURPOSE
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

    if (!mustDoPrompt.trim()) {
      const detectedFromNotes = parseMustDoInput(additionalNotes, destination, false, preferences?.startDate || date?.split('T')[0], totalDays);
      const eventItems = detectedFromNotes.filter((p: any) => p.activityType === 'all_day_event' || p.activityType === 'half_day_event');
      if (eventItems.length > 0) {
        const scheduled = scheduleMustDos(eventItems, totalDays);
        const dayItems = scheduled.scheduled.filter((s: any) => s.assignedDay === dayNumber);
        if (dayItems.length > 0) {
          mustDoPrompt = `\n## 🚨 EVENT DETECTED FROM TRIP PURPOSE (MANDATORY)\n\nThe traveler's trip purpose includes a specific event. You MUST plan this day around it:\n${dayItems.map((item: any) => `- ${item.priority.title} (${item.priority.priority})${item.priority.activityType === 'all_day_event' ? ' [ALL-DAY EVENT — plan the ENTIRE day around this]' : ' [HALF-DAY EVENT]'}`).join('\n')}\n\nRULES:\n- This event is the PRIMARY purpose of the trip\n- Plan the entire day around this event\n- Supporting activities (meals, transport) should complement the event\n`;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPILED SCHEMA: Day mode classification & constraints
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

  // ═══════════════════════════════════════════════════════════════════════
  // TIMING INSTRUCTIONS + MEAL POLICY
  // ═══════════════════════════════════════════════════════════════════════
  let timingInstructions = '';
  let dayMealPolicy: MealPolicy | null = null;
  if (isFirstDay && dayConstraints) {
    dayMealPolicy = deriveMealPolicy({
      dayNumber, totalDays, isFirstDay: true, isLastDay: dayNumber === totalDays,
      arrivalTime24: flightContext.arrivalTime24 || undefined,
      earliestAvailable: flightContext.earliestFirstActivityTime || undefined,
    });
    console.log(`[compile-prompt] Day ${dayNumber} (arrival) meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}]`);
    timingInstructions = `
CRITICAL ARRIVAL DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

${buildMealRequirementsPrompt(dayMealPolicy)}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
  } else if (isLastDay && dayConstraints) {
    dayMealPolicy = deriveMealPolicy({
      dayNumber, totalDays, isFirstDay: false, isLastDay: true,
      departureTime24: flightContext.returnDepartureTime24 || flightContext.returnDepartureTime || undefined,
      latestAvailable: flightContext.latestLastActivityTime || undefined,
    });
    console.log(`[compile-prompt] Day ${dayNumber} (departure) meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}]`);
    timingInstructions = `
CRITICAL DEPARTURE DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

${buildMealRequirementsPrompt(dayMealPolicy)}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
  } else {
    const hotelNameForDay = flightContext.hotelName || '';
    const hotelNeighborhood = flightContext.hotelAddress || '';

    // On hotel-change days, breakfast should reference the PREVIOUS hotel
    // (the traveler hasn't checked out yet in the morning)
    const breakfastHotelName = (facts.resolvedIsHotelChange && facts.resolvedPreviousHotelName)
      ? facts.resolvedPreviousHotelName
      : flightContext.hotelName;

    const dayMealInput: MealPolicyInput = {
      dayNumber,
      totalDays,
      isFirstDay: false,
      isLastDay: false,
      isTransitionDay: resolvedIsTransitionDay,
      hasFullDayEvent: !!((metadata?.userConstraints as any[]) || []).find(
        (c: any) => c.type === 'full_day_event' && (c.day === dayNumber || !c.day)
      ),
      earliestAvailable: undefined,
      latestAvailable: undefined,
      lockedHours: (() => {
        const constraints = (metadata?.userConstraints as any[]) || [];
        let locked = 0;
        for (const c of constraints as any[]) {
          if (c.type === 'time_block' && c.day === dayNumber && c.time) locked += 2;
          if (c.type === 'full_day_event' && (c.day === dayNumber || !c.day)) locked += 12;
        }
        return locked;
      })(),
    };
    dayMealPolicy = deriveMealPolicy(dayMealInput);
    const mealRequirementsBlock = buildMealRequirementsPrompt(dayMealPolicy);
    console.log(`[compile-prompt] Day ${dayNumber} meal policy: mode=${dayMealPolicy.dayMode}, meals=[${dayMealPolicy.requiredMeals.join(',')}], usableHours=${dayMealPolicy.usableHours}`);

    timingInstructions = `
${dayMealPolicy.isFullExplorationDay ? 'FULL EXPLORATION DAY' : dayMealPolicy.dayMode.replace(/_/g, ' ').toUpperCase()} — HOUR-BY-HOUR TRAVEL PLAN (NOT a suggestion list):

This day must be a COMPLETE itinerary from morning to night. Every hour accounted for.

REQUIRED DAY STRUCTURE:
${dayMealPolicy.requiredMeals.includes('breakfast') ? (breakfastHotelName ? `1. BREAKFAST (category: "dining") — At the hotel's own restaurant (preferred) or a real café nearby. NEVER at a DIFFERENT hotel's restaurant. Use the hotel name: ${breakfastHotelName}. ~price, walking distance${facts.resolvedIsHotelChange && facts.resolvedPreviousHotelName ? `\n   ⚠️ HOTEL CHANGE DAY: You are still at ${facts.resolvedPreviousHotelName} in the morning. Breakfast MUST be at ${facts.resolvedPreviousHotelName} or nearby — NOT at ${flightContext.hotelName}, which you haven't checked into yet. The correct sequence is: Breakfast at ${facts.resolvedPreviousHotelName} → Checkout → Travel → Check-in at ${flightContext.hotelName}.\n   🚫 GEOGRAPHIC CONSTRAINT: ALL morning activities (breakfast, coffee, any stops BEFORE checkout) must be located near ${facts.resolvedPreviousHotelName}${facts.resolvedPreviousHotelAddress ? ` (${facts.resolvedPreviousHotelAddress})` : ''}. Do NOT place any morning activity at or near ${flightContext.hotelName}. The traveler physically cannot be at the new hotel until after checkout and transfer.` : ''}` : '1. BREAKFAST (category: "dining") — At a well-reviewed local café or bakery. Do NOT reference any hotel. ~price, walking distance') : ''}
2. TRANSIT between every pair of consecutive activities (category: "transport")
   - Include mode (${resolvedTransportModes.length > 0 ? resolvedTransportModes.join('/') : 'walk/taxi/metro/bus'}), duration, cost, route details
   - 10+ minute walks or any paid transit = separate activity entry
3. MORNING ACTIVITIES — At least 1 paid + 1 free activity
${dayMealPolicy.requiredMeals.includes('lunch') ? '4. LUNCH (category: "dining") — Restaurant near previous location, ~price, 1 alternative in tips' : ''}
5. AFTERNOON ACTIVITIES — At least 1-2 paid + 1 free activity  
${flightContext.hotelName ? `6. HOTEL RETURN (REQUIRED) — "Freshen up at [EXACT Hotel Name]" with category "accommodation", duration 30 min. Every full day MUST include a hotel return between afternoon activities and dinner. This MUST be a separate activity card with dedicated time, not just a transport entry. Include a preceding transport card to get back to the hotel.` : ''}
${dayMealPolicy.requiredMeals.includes('dinner') ? '7. DINNER (category: "dining") — Restaurant, price range, dress code, reservation needed?, 1 alternative in tips' : ''}
8. EVENING/NIGHTLIFE — Bar, jazz club, night market, show, rooftop, dessert spot (at least 1 suggestion). Use category: "dining" for bars, lounges, and cocktail venues. Use category: "activity" for shows, clubs, and entertainment. NEVER use "wellness", "nightlife", or "relaxation" as a category for bars/lounges.
${flightContext.hotelName ? `9. RETURN TO HOTEL (REQUIRED as LAST activity) — "Return to [EXACT Hotel Name]" with category "accommodation". This is the FINAL card of every day. MUST appear after ALL other activities including nightlife. Include transport mode in a preceding transport activity.` : ''}
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

RESTAURANT UNIQUENESS — ABSOLUTE REQUIREMENT:
- EVERY restaurant across the ENTIRE trip must be UNIQUE. No restaurant name may appear on more than one day.
- This includes breakfast, lunch, dinner, cocktails, and nightcaps.
- You are given a list of already-used restaurants. You MUST NOT use ANY restaurant from that list.
- Even if an already-used restaurant seems like a perfect fit, choose a DIFFERENT one instead.
- For breakfast: every city has dozens of breakfast spots. NEVER repeat a breakfast venue.
- CHECK your output: if any restaurant name matches one in the used list, REPLACE it before responding.
${hotelNameForDay ? `\nHOTEL: ${hotelNameForDay}${hotelNeighborhood ? ` (${hotelNeighborhood})` : ''}\nStart and end the day near the hotel when practical.${facts.resolvedIsHotelChange && facts.resolvedPreviousHotelName ? `\n\n${'='.repeat(70)}\n🏨 HOTEL CHANGE DAY — MANDATORY SEQUENCE\n${'='.repeat(70)}\nToday the traveler switches from "${facts.resolvedPreviousHotelName}" to "${hotelNameForDay}".\nThe REQUIRED chronological order is:\n  1. Wake up at ${facts.resolvedPreviousHotelName}\n  2. Breakfast at/near ${facts.resolvedPreviousHotelName}${facts.resolvedPreviousHotelAddress ? ` (${facts.resolvedPreviousHotelAddress})` : ''}\n  3. Checkout from ${facts.resolvedPreviousHotelName} (category: "accommodation")\n  4. Transport/transfer to ${hotelNameForDay}\n  5. Check-in at ${hotelNameForDay} (category: "accommodation")\n  6. Afternoon/evening activities near ${hotelNameForDay}\n  7. Return to ${hotelNameForDay}\n\n🚫 NOTHING at or near ${hotelNameForDay} may appear BEFORE the check-in activity.\n   Morning activities MUST be geographically near ${facts.resolvedPreviousHotelName}.\n   The new hotel (${hotelNameForDay}) is only the "active" hotel AFTER check-in.\n${'='.repeat(70)}` : ''}` : '\n⚠️ NO HOTEL BOOKED: Do NOT reference any hotel in the itinerary. No hotel check-in, check-out, return to hotel, breakfast at hotel, or taxi to hotel. All meals should be at local restaurants or cafés.'}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSITION DAY OVERRIDE
  // ═══════════════════════════════════════════════════════════════════════
  if (resolvedIsTransitionDay && resolvedTransitionFrom && resolvedTransitionTo) {
    console.log(`[compile-prompt] 🚆 TRANSITION DAY: ${resolvedTransitionFrom} → ${resolvedTransitionTo} via ${resolvedTransportMode}`);
    const transitionDayPromptBlock = buildTransitionDayPrompt({
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
    timingInstructions = `
CRITICAL TRANSITION DAY INSTRUCTIONS — THIS IS A TRAVEL DAY, NOT AN EXPLORATION DAY:
${transitionDayPromptBlock}

FAILURE TO INCLUDE INTER-CITY TRAVEL IS UNACCEPTABLE. NO TELEPORTING.`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UNIFIED PROFILE LOADER
  // ═══════════════════════════════════════════════════════════════════════
  const profile = await loadTravelerProfile(supabase, userId, tripId, destination);
  const primaryArchetype = profile.archetype;
  const traitScores = profile.traitScores;
  console.log(`[compile-prompt] Profile: archetype=${primaryArchetype} (${profile.archetypeSource}), completeness=${profile.dataCompleteness}%`);
  if (profile.warnings.length > 0) {
    console.warn(`[compile-prompt] Profile warnings: ${profile.warnings.join(', ')}`);
  }

  const effectiveBudgetTier = profile.budgetTier || budgetTier || 'moderate';

  // ═══════════════════════════════════════════════════════════════════════
  // GENERATION CONTEXT (enrichment prompts from generate-trip)
  // ═══════════════════════════════════════════════════════════════════════
  let generationContextPrompts = '';
  let blendedTraitScores: Record<string, number> | null = null;
  let blendedDnaSnapshot: { travelers: Array<{ archetype: string }> } | null = null;
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

      if (gc.blendedTraitScores && typeof gc.blendedTraitScores === 'object') {
        blendedTraitScores = gc.blendedTraitScores as Record<string, number>;
        console.log(`[compile-prompt] ✓ BLENDED traits: pace=${blendedTraitScores.pace}, budget=${blendedTraitScores.budget}`);
      }

      if (gc.blendedDnaSnapshot && typeof gc.blendedDnaSnapshot === 'object') {
        blendedDnaSnapshot = gc.blendedDnaSnapshot as any;
        gcTravelerCount = (blendedDnaSnapshot?.travelers || []).length;
      }

      if (promptParts.length > 0) {
        generationContextPrompts = promptParts.join('\n\n');
        console.log(`[compile-prompt] Injected ${promptParts.length} enrichment prompts from generation_context`);
      }
    } catch (gcErr) {
      console.warn('[compile-prompt] Failed to read generation_context (non-blocking):', gcErr);
    }

    // Stale context detection
    if (gcTravelerCount > 0) {
      try {
        const [{ count: collabCount }, { count: memberCount }] = await Promise.all([
          supabase.from('trip_collaborators').select('*', { count: 'exact', head: true }).eq('trip_id', tripId).eq('include_preferences', true),
          supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', tripId),
        ]);
        const currentTravelerCount = 1 + (collabCount || 0) + (memberCount || 0);
        if (Math.abs(currentTravelerCount - gcTravelerCount) >= 1) {
          console.warn(`[compile-prompt] ⚠️ STALE CONTEXT: gc has ${gcTravelerCount} travelers, current ~${currentTravelerCount}`);
        }
      } catch (staleErr) {
        console.warn('[compile-prompt] Stale context check failed (non-blocking):', staleErr);
      }
    }
  }

  const effectiveTraitScores = blendedTraitScores
    ? { pace: blendedTraitScores.pace ?? traitScores.pace, budget: blendedTraitScores.budget ?? traitScores.budget }
    : { pace: traitScores.pace, budget: traitScores.budget };

  // ═══════════════════════════════════════════════════════════════════════
  // BUDGET RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════
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
        console.log(`[compile-prompt] Budget: $${tripBudgetData.budget_total_cents / 100} total → $${actualDailyBudgetPerPerson}/day/person`);

        // Per-city override
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
              console.log(`[compile-prompt] Per-city budget override for "${resolvedDestination}": $${actualDailyBudgetPerPerson}/day/person`);
            }
          } catch (e) {
            console.warn('[compile-prompt] Per-city budget fetch failed:', e);
          }
        }
      }
    } catch (e) {
      console.warn('[compile-prompt] Budget fetch failed:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ARCHETYPE GUIDANCE
  // ═══════════════════════════════════════════════════════════════════════
  const destinationId = await getDestinationId(supabase, resolvedDestination);
  const generationHierarchy = await buildFullPromptGuidanceAsync(
    supabase, primaryArchetype, resolvedDestination, destinationId,
    effectiveBudgetTier, effectiveTraitScores, LOVABLE_API_KEY
  );
  console.log(`[compile-prompt] Full guidance: ${generationHierarchy.length} chars`);

  let celebrationDay: number | undefined;
  if (tripId) {
    const { data: tripMeta } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
    celebrationDay = tripMeta?.metadata?.celebrationDay;
  }

  const tripTypePrompt = buildTripTypePromptSection(tripType, primaryArchetype, totalDays, celebrationDay);

  // Group avoid-list intersection
  let groupAvoidOverride: string[] | null = null;
  if (blendedDnaSnapshot && blendedDnaSnapshot.travelers.length > 1) {
    try {
      const allAvoidLists = blendedDnaSnapshot.travelers.map((t: any) => {
        const def = getArchetypeDefinition(t.archetype);
        return new Set(def.avoid.map((a: string) => a.toLowerCase()));
      });
      groupAvoidOverride = [...allAvoidLists[0]].filter((item: string) =>
        allAvoidLists.every((avoidSet: Set<string>) => avoidSet.has(item))
      );
    } catch (avoidErr) {
      console.warn('[compile-prompt] Group avoid-list intersection failed:', avoidErr);
    }
  }

  const archetypeContext = getFullArchetypeContext(primaryArchetype, resolvedDestination, effectiveBudgetTier, effectiveTraitScores);
  const maxActivitiesFromArchetype = archetypeContext.definition.dayStructure.maxScheduledActivities;
  const minActivitiesFromArchetype = archetypeContext.definition.dayStructure.minScheduledActivities
    || Math.max(3, Math.ceil(maxActivitiesFromArchetype * 0.6));

  // ═══════════════════════════════════════════════════════════════════════
  // VOYANCE PICKS
  // ═══════════════════════════════════════════════════════════════════════
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
      console.log(`[compile-prompt] Injecting ${vpRows.length} Voyance Picks`);
    }
  } catch (e) {
    console.warn('[compile-prompt] Voyance Picks fetch failed:', e);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COLLABORATOR ATTRIBUTION
  // ═══════════════════════════════════════════════════════════════════════
  let collaboratorAttributionPrompt = '';
  let allUserIdsForAttribution: string[] = [];
  if (tripId) {
    const [{ data: collabRows }, { data: memberRows }] = await Promise.all([
      supabase.from('trip_collaborators').select('user_id').eq('trip_id', tripId).eq('include_preferences', true),
      supabase.from('trip_members').select('user_id').eq('trip_id', tripId).not('user_id', 'is', null),
    ]);

    const participantIds = new Set<string>();
    (collabRows || []).forEach((c: any) => { if (c.user_id) participantIds.add(c.user_id); });
    (memberRows || []).forEach((m: any) => { if (m.user_id) participantIds.add(m.user_id); });
    participantIds.delete(userId);

    if (participantIds.size > 0) {
      const allUserIds = [userId, ...Array.from(participantIds)].filter(Boolean);
      allUserIdsForAttribution = allUserIds;
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, display_name, handle')
        .in('id', allUserIds);

      const profileMap = new Map((profileRows || []).map((p: any) => [p.id, p.display_name || p.handle || 'Guest']));
      const travelerList = allUserIds.map((uid: string) => `  - "${uid}" (${profileMap.get(uid!) || 'Traveler'})`).join('\n');

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
      console.log(`[compile-prompt] Attribution prompt for ${allUserIds.length} travelers`);
    }
  }

  // Group avoid-list relaxation prompt
  let groupAvoidPrompt = '';
  if (groupAvoidOverride && blendedDnaSnapshot && blendedDnaSnapshot.travelers.length > 1) {
    const ownerDef = getArchetypeDefinition(primaryArchetype);
    const ownerAvoidSet = new Set(ownerDef.avoid.map((a: string) => a.toLowerCase()));
    const relaxedItems = [...ownerAvoidSet].filter((item: string) => !groupAvoidOverride!.includes(item));
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
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SYSTEM PROMPT ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════════
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
- RESTAURANT PRICING — USE REALISTIC PRICES:
  • Michelin 3-star / destination restaurants: minimum €180/pp
  • Michelin 2-star restaurants: minimum €120/pp
  • Michelin 1-star / high-end tasting menus: minimum €80/pp
  • Well-known fine dining (non-starred): minimum €60/pp
  • Famous seafood restaurants (e.g., cervejaria, marisqueira): minimum €40/pp
  • Mid-range sit-down restaurants: €20-50/pp
  • Casual dining and cafés: €10-30/pp
  • Fast casual, bakeries, pastéis: €5-15/pp
  When in doubt, price HIGHER. Underpricing makes the itinerary unreliable. Use the actual price a real diner would pay at that specific restaurant.
- Include meals as specified by the day's meal policy (see timing instructions above) — each a real named restaurant with price
- Each lunch and dinner recommendation should include 1 ALTERNATIVE option in its "tips" field
- ONLY recommend restaurants and dining spots with 4+ star ratings - no low-quality or poorly-reviewed venues

RESTAURANT NAMING RULES — CRITICAL:
- Every dining activity MUST include a SPECIFIC, REAL restaurant name. Never use generic placeholders like "a local spot", "a nearby café", "a local restaurant", "a bistro", "a nice place", "a charming spot", "the destination", or similar vague descriptions. ANY title matching "Meal at a/an/the [descriptor]" is BANNED.
- The title MUST contain the actual restaurant name (e.g., "Breakfast at Pastéis de Belém", "Dinner at Cervejaria Ramiro"), NOT a description like "Breakfast at a local spot".
- The location.name field MUST be the restaurant's actual name — NEVER "the destination", "a local spot", or any generic placeholder.
- If you cannot think of another unique restaurant for a meal, use the hotel restaurant or a well-known local chain café — NEVER fall back to a generic placeholder.
- For Lisbon, consider: Pastéis de Belém, Café A Brasileira, Copenhagen Coffee Lab, Dear Breakfast, Heim Café, Nicolau Lisboa, Fábrica Coffee Roasters, Landeau Chocolate, Time Out Market vendors.
- Parks, gardens, plazas, squares, viewpoints, miradouros, riverside walks, and neighborhood strolls are FREE (€0). Do NOT assign any price to these.
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
Always use the full destination city name in all text. Never write "the" as a placeholder where the city name should go. For example, write "in the heart of Lisbon" not "in the heart of the". Write "A Goodbye to Lisbon" not "A Goodbye to the".
CRITICAL: Always use the ACTUAL city name in descriptions. Never use placeholder text like "the city" or generic references. Write "Lisbon" (or whatever the destination is) every time you reference the destination city. Do not use "the" as a substitute for the city name.

DAY TITLE RULES:
- Day titles must be complete, grammatically correct phrases under 60 characters.
- Every article (the, a, an) must be followed by a noun or adjective+noun, never directly by a preposition.
- BAD: "Arrival in Lisbon, the of Seven Hills" — GOOD: "Arrival in Lisbon, the City of Seven Hills"
- BAD: "A Journey to of Discovery" — GOOD: "A Journey of Royal Discovery"

TEXT QUALITY — NO META-COMMENTARY:
Never include parenthetical notes, internal reasoning, scheduling logic, or explanations of why an activity was chosen in any user-visible text field (title, description, tips, voyanceInsight, whyThisFits). All text must read as polished travel copy written for the end user. Do not include "(Note: ...)", "(Scheduled as ...)", "(Adjusted for ...)", "(Reflecting ...)", or any similar meta-commentary.

OPERATIONAL NOTES — NEVER INCLUDE:
Never include operational notes about checking hours, confirming availability, or verifying opening times in any description text. Never use generic database descriptor phrases like "Popular with locals", "A local favorite", "Hidden gem", "Must-visit", or "Highly recommended" as restaurant or activity descriptions. Every description must be a specific, unique sentence describing what makes this particular venue special. All descriptions should read as confident, polished travel recommendations.
Never include any Voyance branding, attribution, or "thank you" messages in activity descriptions, titles, or any user-visible text. No text should reference "Voyance" in any way.

CRITICAL GEOGRAPHIC RULE: Every restaurant and venue MUST be physically located within the trip destination city or its immediate metro area. Do not suggest restaurants from other cities or regions, even if they are famous. For example, for a Lisbon trip, only suggest restaurants actually located in the Lisbon metropolitan area — not restaurants in the Algarve, Porto, or other regions.
`;

  // ═══════════════════════════════════════════════════════════════════════
  // USER PROMPT ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════════
  const isFullDay = dayMealPolicy?.isFullExplorationDay ?? (!isFirstDay && !isLastDay);

  // Import isRecurringEvent for previous day activity classification
  const { isRecurringEvent } = await import('../currency-utils.ts');

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
- Do NOT include "Return to Hotel" entries at the START of any day.
- Do NOT include any activities between 12:00 AM and 6:00 AM unless they are specifically planned late-night activities from the CURRENT day.
- Day 1 should begin with arrival or the first morning activity (typically 8:00-9:00 AM), never with midnight hotel entries.

${preferenceContext}
${tripIntentsContext}
${mustDoPrompt}
${additionalNotesPrompt}
${mustHavesConstraintPrompt}
${preBookedCommitmentsPrompt}
${(() => {
  if (!previousDayActivities?.length) return '';
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
  if (!paramRestaurantPool || !Array.isArray(paramRestaurantPool) || paramRestaurantPool.length === 0) return '';
  // Use the imported extractRestaurantVenueName for consistent identity matching
  const usedNormalized = new Set((paramUsedRestaurants || []).map((n: string) => extractRestaurantVenueName(n)));
  const available = paramRestaurantPool.filter((r: any) => !usedNormalized.has(extractRestaurantVenueName(r.name || '')));
  if (available.length === 0) return '';

  // Show larger candidate sets — longer trips need more visible options
  const perMealLimit = Math.max(8, Math.min(16, Math.ceil(available.length / 4)));
  const breakfastSpots = available.filter((r: any) => r.mealType === 'breakfast').slice(0, perMealLimit);
  const lunchSpots = available.filter((r: any) => r.mealType === 'lunch').slice(0, perMealLimit);
  const dinnerSpots = available.filter((r: any) => r.mealType === 'dinner').slice(0, perMealLimit);
  const anySpots = available.filter((r: any) => r.mealType === 'any').slice(0, Math.ceil(perMealLimit * 0.75));

  let poolPrompt = `
${'='.repeat(70)}
🍽️ RESTAURANT POOL — PICK FROM THIS LIST (DO NOT INVENT RESTAURANTS)
${'='.repeat(70)}
For ALL meals today, you MUST pick a restaurant from this pre-verified list.
Do NOT make up restaurant names. Do NOT use generic names like "local restaurant" or "dinner spot".
Each restaurant below is REAL and highly rated (4.5+ stars).
CRITICAL: Do NOT pick the same restaurant for multiple meals. Each meal MUST use a DIFFERENT venue.

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

  const usedList = paramUsedRestaurants || [];
  if (usedList.length > 0) {
poolPrompt += `⛔ ALREADY USED ON PREVIOUS DAYS (DO NOT PICK THESE):\n`;
poolPrompt += usedList.map((name: string) => `  • ${name}`).join('\n');
poolPrompt += `\nPick DIFFERENT restaurants — variety is essential. Do NOT repeat any restaurant from this blocklist.\n`;
  }

  console.log(`[compile-prompt] Restaurant pool: ${available.length} available (${breakfastSpots.length}B/${lunchSpots.length}L/${dinnerSpots.length}D), blocklist: ${(usedList || []).length}`);
  return poolPrompt;
})()}

${(() => {
  if (paramRestaurantPool && Array.isArray(paramRestaurantPool) && paramRestaurantPool.length > 0) return '';
  const usedList = paramUsedRestaurants || [];
  if (usedList.length === 0) return '';
  return `⛔ RESTAURANT VARIETY RULE — DO NOT USE THESE (already used on previous days):\n${usedList.map((name: string) => `  • ${name}`).join('\n')}\nPick DIFFERENT restaurants for every meal. Variety is essential.\n`;
})()}

${(() => {
  const usedList = paramUsedRestaurants || [];
  if (usedList.length === 0) return '';
  return `🚫 HARD RESTAURANT BLOCKLIST — ZERO TOLERANCE:\nThese restaurants were ALREADY used on previous days. Do NOT use ANY of them again, not even under a slightly different name:\n${usedList.join(', ')}\nEvery breakfast, lunch, and dinner MUST be at a DIFFERENT restaurant than all previous days. No exceptions.`;
})()}

${(() => {
  if (!isLastDay) return '';
  const usedList = paramUsedRestaurants || [];
  if (usedList.length === 0) return '';
  return `🛫 DEPARTURE DAY RESTAURANT RULES — THIS IS THE FINAL DAY:
The traveler has already eaten at these restaurants on prior days: ${usedList.join(', ')}
You MUST choose restaurants that are NOT in the above list.
For the departure day lunch specifically, here are SAFE options that are unlikely to have been used:
  • Ponto Final (Cacilhas, across the river)
  • Café de São Bento (steakhouse near Rato)
  • O Velho Eurico (traditional Alfama)
  • Mercado da Ribeira / Time Out Market (food hall)
  • Solar dos Presuntos (traditional Portuguese)
  • A Cevicheria (Príncipe Real)
  • Tasca do Chico (Alfama fado restaurant)
  • Cervejaria Trindade (historic beer hall)
If your first restaurant choice matches ANY name in the used list above, REPLACE it immediately with one from the safe options list.
DO NOT use generic placeholders like "a bistro" or "a café" — always use a specific real restaurant name.`;
})()}

CRITICAL REMINDERS:
1. ${isFullDay ? `This is a FULL DAY: ${dayMealPolicy?.requiredMeals?.join(' + ') ?? 'breakfast + lunch + dinner'} + 3 paid activities + 2 free activities + transit between all stops + evening activity + next morning preview. Fill EVERY hour.` : dayMealPolicy && !isFirstDay && !isLastDay ? `This is a ${dayMealPolicy.dayMode.replace(/_/g, ' ')} day. Required meals: ${dayMealPolicy.requiredMeals.length > 0 ? dayMealPolicy.requiredMeals.join(', ') : 'none'}. Do NOT add extra meals beyond what the meal policy specifies.` : `${minActivitiesFromArchetype}-${maxActivitiesFromArchetype} scheduled sightseeing activities for this ${isFirstDay ? 'arrival' : 'departure'} day.`}
2. Check the archetype's avoid list. If it says "no spa", there are ZERO spa activities.
3. Check the budget constraints. If value-focused, no €100+ experiences.
4. ${primaryArchetype === 'flexible_wanderer' || primaryArchetype === 'slow_traveler' || (traitScores.pace || 0) <= -3 ? 'Include at least one 2+ hour UNSCHEDULED block labeled "Free time to explore [neighborhood]"' : 'Follow the pacing guidelines for this archetype'}
5. ${isFullDay ? 'TRANSIT: Include a transport entry (category: "transport") between EVERY pair of consecutive activities. Include mode, duration, and REALISTIC cost per mode (subway ~$2-5, taxi ~$15-40, walking = $0). Do NOT use a flat cost for all transit.' : ''}
6. ${isFullDay ? 'PRICES: Every meal, every ticket, every taxi must have a price. estimatedCost.amount = 0 for free activities. No blanks.' : ''}
7. NEVER repeat a restaurant across different days. Each day MUST use completely different restaurants for every meal. Variety is essential — travelers do not want to eat at the same place twice.
8. For BREAKFAST specifically: NEVER repeat the same breakfast venue on consecutive days. ${destination || 'This destination'} has hundreds of excellent breakfast spots — there is NO reason to repeat any restaurant. If you find yourself choosing a restaurant from the blocklist above, STOP and pick a completely different one.

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

  // ═══════════════════════════════════════════════════════════════════════
  // LOG
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[compile-prompt] System prompt: ${systemPrompt.length} chars, User prompt: ${userPrompt.length} chars`);

  return {
    systemPrompt,
    userPrompt,
    mustDoEventItems,
    dayMealPolicy,
    allUserIdsForAttribution,
    actualDailyBudgetPerPerson,
    profile,
    effectiveBudgetTier,
    isSmartFinish,
    smartFinishRequested,
    metadata,
    mustDoActivitiesRaw,
    preferenceContext,
    dayConstraints,
    flightContext,
  };
}
