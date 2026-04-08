/**
 * Action handler for generate-day / regenerate-day.
 * 
 * Extracted from index.ts for maintainability.
 * Contains all single-day generation logic with flight/hotel awareness.
 */

import { corsHeaders, verifyTripAccess } from './action-types.ts';
import type {
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
  sanitizeDateString,
  sanitizeOptionFields,
  sanitizeAITextField,
  sanitizeGeneratedDay,
  sanitizeDateFields,
  normalizeDurationString,
  stripPhantomHotelActivities,
  enforceMichelinPriceFloor,
  enforceBarNightcapPriceCap,
  enforceCasualVenuePriceCap,
  enforceVenueTypePriceCap,
} from './sanitization.ts';
import {
  EXCHANGE_RATES_TO_USD,
  convertToUSD,
  normalizeCostToUSD,
  deriveIntelligenceFields,
  isRecurringEvent,
} from './currency-utils.ts';
import {
  getBlockedTimeRange,
  parseMustDoInput,
  validateMustDosInItinerary,
  type ScheduledMustDo,
} from './must-do-priorities.ts';
import { GenerationTimer } from './generation-timer.ts';
import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
  getFlightHotelContext,
  enforceArrivalTiming,
  enforceDepartureTiming,
} from './flight-hotel-context.ts';
import {
  validateGeneratedDay,
  filterChainRestaurants,
  enforceRequiredMealsFinalGuard,
  detectMealSlots,
  type StrictDayMinimal,
} from './day-validation.ts';
import { compileDayFacts } from './pipeline/compile-day-facts.ts';
import type { LockedActivity } from './pipeline/types.ts';
import { validateDay, type ValidateDayInput } from './pipeline/validate-day.ts';
import { repairDay, type RepairDayInput } from './pipeline/repair-day.ts';
import { compilePrompt } from './pipeline/compile-prompt.ts';
import { persistDay } from './pipeline/persist-day.ts';
import { callAI, AICallError } from './pipeline/ai-call.ts';
import { enrichAndValidateHours } from './pipeline/enrich-day.ts';

// =============================================================================
// FALLBACK RESTAURANT DATABASE — Rich city-aware venue pool for placeholder replacement
// =============================================================================

// Placeholder detection and restaurant fallback logic extracted to fix-placeholders.ts
// Imported via universal-quality-pass.ts orchestrator

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
    restaurantPool: paramRestaurantPool, usedRestaurants: paramUsedRestaurants, generationLogId: paramGenerationLogId,
    hotelName: paramHotelName, action: paramAction } = params;
  
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

  // Debug: log incoming usedRestaurants for cross-day dedup tracing
  console.log(`[generate-day] Generating day ${dayNumber}/${totalDays}. usedRestaurants (${(paramUsedRestaurants || []).length}):`, JSON.stringify(paramUsedRestaurants || []));


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

  // ═══════════════════════════════════════════════════════════════════════
  // COMPILED PROMPT: Preferences, trip intents, must-dos, timing, profile,
  // archetype guidance, Voyance Picks, attribution, system + user prompt.
  // Extracted to pipeline/compile-prompt.ts (Phase 4)
  // ═══════════════════════════════════════════════════════════════════════
  const prompt = await compilePrompt(supabase, userId, LOVABLE_API_KEY, params, facts);
  const {
    systemPrompt, userPrompt,
    mustDoEventItems, dayMealPolicy,
    allUserIdsForAttribution,
    actualDailyBudgetPerPerson,
    profile, effectiveBudgetTier,
    isSmartFinish, smartFinishRequested,
    metadata, mustDoActivitiesRaw: mustDoActivities,
    preferenceContext, dayConstraints,
  } = prompt;
  flightContext = prompt.flightContext;

  // ── DIAGNOSTICS TRACKING ──
  const _diagTimers = { aiCallStart: 0, aiCallEnd: 0, enrichStart: 0, enrichEnd: 0 };

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // AI CALL: Extracted to pipeline/ai-call.ts (Phase 6)
    // ═══════════════════════════════════════════════════════════════════════
    if (innerTimer) innerTimer.startPhase(`ai_call_day_${dayNumber}`);
    _diagTimers.aiCallStart = Date.now();
    let aiResult;
    try {
      aiResult = await callAI({
        systemPrompt,
        userPrompt,
        apiKey: LOVABLE_API_KEY,
        dayNumber,
      });
    } catch (err) {
      if (err instanceof AICallError) {
        return new Response(
          JSON.stringify({ error: err.userMessage }),
          { status: err.statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }
    _diagTimers.aiCallEnd = Date.now();
    const { data } = aiResult;

    // Record AI phase timing, token usage, and model
    if (innerTimer) {
      innerTimer.endPhase(`ai_call_day_${dayNumber}`);
      try {
        innerTimer.addTokenUsage(
          aiResult.usage?.prompt_tokens || 0,
          aiResult.usage?.completion_tokens || 0,
          aiResult.model,
        );
      } catch (_e) { /* non-blocking */ }
      const aiDonePct = 5 + Math.round(((dayNumber - 0.3) / Math.max(1, totalDays || 1)) * 90);
      await innerTimer.updateProgress(`day_${dayNumber}_ai_complete`, aiDonePct);
      innerTimer.startPhase(`parse_response_day_${dayNumber}`);
    }

    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    let generatedDay;
    if (toolCall?.function?.arguments) {
      // Standard tool call response
      generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(toolCall.function.arguments))), dayNumber, resolvedDestination, paramUsedRestaurants);
    } else if (message?.content) {
      // Fallback: AI returned content instead of tool call
      console.log("[generate-day] AI returned content instead of tool_call, attempting to parse...");
      try {
        // Try to extract JSON from the content
        const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(jsonMatch[0]))), dayNumber, resolvedDestination, paramUsedRestaurants);
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

    // Phantom hotel stripping — only strip fabricated specific hotel names.
    // Generic placeholders ("Your Hotel", "Check-in at hotel") are preserved.
    // Broad hotel detection: selected hotel, accommodation notes, metadata, or existing accom activities
    const hasHotelForStripping = !!(flightContext as any).hotelName ||
      !!(flightContext as any).hotelAddress ||
      !!paramHotelName ||
      !!(params.hotelOverride?.name) ||
      generatedDay.activities?.some((a: any) => {
        const cat = (a.category || '').toLowerCase();
        return cat === 'accommodation';
      });
    if (!hasHotelForStripping) {
      const { stripPhantomHotelActivities } = await import('./sanitization.ts');
      generatedDay = stripPhantomHotelActivities(generatedDay, false);
    }

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
      
      // Normalize times: ensure 24h format (AI may return "1:20 PM" or ambiguous "1:20")
      const normalizedStartTime = act.startTime ? (normalizeTo24h(act.startTime) || act.startTime) : undefined;
      const normalizedEndTime = act.endTime ? (normalizeTo24h(act.endTime) || act.endTime) : undefined;

      const normalized = {
        ...act,
        id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
        title: normalizedTitle,
        name: normalizedTitle, // Keep both for compatibility
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        cost: normalizedCost,
        costBasis: costBasis, // per_person | flat | per_room
        location: normalizedLocation,
        durationMinutes: normalizedStartTime && normalizedEndTime ? calculateDuration(normalizedStartTime, normalizedEndTime) : 60,
        categoryIcon: getCategoryIcon(act.category || 'activity'),
        isLocked: false, // New activities are unlocked by default
      };
      // Derive intelligence fields if AI didn't set them
      deriveIntelligenceFields(normalized);
      return normalized;
    });

    // =========================================================================
    // HALLUCINATION FILTER — remove known fake restaurants and dining with bogus addresses
    // =========================================================================
    {
      const BLOCKED_RESTAURANT_NAMES = [
        // Known European hallucinations
        'trattoria del corso', 'café lumière', 'cafe lumiere',
        'ristorante della piazza', 'la belle époque bistro',
        'ristorante la luna', 'osteria del porto', 'osteria della sera',
        'taverna centrale', 'taverna nocturna', 'palazzo del gusto',
        'casa del gusto', 'casa nostra', 'cucina del mercato',
        'ristorante vecchia', 'tavola calda', 'cantina verde',
        'enoteca del corso', 'bar luminoso', 'bar centrale',
        'table du quartier', 'bistrot du marché',
        // Known Asian/Latin/African hallucinations
        'sakura house', 'golden dragon', 'jade palace', 'riad des épices',
        'el rincón', 'la esquina', 'mercado central restaurant',
        'the local kitchen', 'the hidden gem', 'the secret garden',
        'authentic taste', 'local flavors', 'traditional house',
      ];
      // Universal pattern-based detection: catch AI-generated generic names
      const GENERIC_RESTAURANT_PATTERNS = [
        /^the .+ (restaurant|kitchen|cafe|bistro|bar|grill|house|place|spot|table|corner)$/i,
        /^(restaurant|cafe|bistro|bar) (de |du |del |della |des |di )/i,
        /^(local|traditional|authentic|hidden|secret|cozy|charming|quaint) /i,
      ];
      const FAKE_ADDRESS_PATTERNS = [
        /the destination/i, /your destination/i, /the city/i,
        /the restaurant/i, /the venue/i, /city center/i, /downtown/i,
        /^[a-z\s'-]+,?\s*[a-z\s'-]*$/i,
      ];
      const beforeFilter = normalizedActivities.length;
      normalizedActivities = normalizedActivities.filter((act: any) => {
        const cat = (act.category || '').toLowerCase();
        if (cat !== 'dining' && cat !== 'restaurant' && cat !== 'food') return true;
        const name = (act.venueName || act.title || '').toLowerCase().trim();
        for (const blocked of BLOCKED_RESTAURANT_NAMES) {
          if (name.includes(blocked)) {
            console.log(`[HALLUCINATION FILTER] Removed blocked restaurant: ${name}`);
            return false;
          }
        }
        // Pattern-based generic name detection
        for (const pattern of GENERIC_RESTAURANT_PATTERNS) {
          if (pattern.test(name)) {
            console.log(`[HALLUCINATION FILTER] Removed generic-pattern restaurant: ${name}`);
            return false;
          }
        }
        const rawHAddr = act.address || act.location;
        const address = (typeof rawHAddr === 'string' ? rawHAddr : (rawHAddr && typeof rawHAddr === 'object' ? (String(rawHAddr.address || rawHAddr.name || '')) : '')).trim();
        if (!address || address.length < 10) {
          console.log(`[HALLUCINATION FILTER] Removed restaurant with no real address: ${name} (address: "${address}")`);
          return false;
        }
        for (const pattern of FAKE_ADDRESS_PATTERNS) {
          if (pattern.test(address)) {
            console.log(`[HALLUCINATION FILTER] Removed restaurant with placeholder address: ${name} (address: "${address}")`);
            return false;
          }
        }
        return true;
      });
      if (normalizedActivities.length < beforeFilter) {
        console.log(`[HALLUCINATION FILTER] Day ${dayNumber}: removed ${beforeFilter - normalizedActivities.length} fake restaurants`);
      }
    }

    // ── FILLER ACTIVITY FILTER ──
    {
      const FILLER_TITLE_PATTERNS = [
        /end of day reflection/i,
        /reflection in.*district/i,
        /central.*district.*arrival/i,
        /rest and reflect/i,
        /final.*moment.*reflection/i,
        /evening.*reflection/i,
        /day.*reflection/i,
        /quiet.*reflection.*at/i,
      ];
      const STREET_INDICATOR = /\d+\s+\w|rue|avenue|boulevard|place|quai|passage|street|road|via|piazza|platz|strasse|calle/i;
      const CITY_ONLY = /^[a-z\s\-']+,?\s*(france|italy|germany|japan|spain|uk|usa|england|portugal|greece|turkey|morocco|thailand|mexico|canada|australia)?$/i;

      const beforeFiller = normalizedActivities.length;
      normalizedActivities = normalizedActivities.filter((act: any) => {
        const title = (act.title || '').trim();
        const rawAddr = act.address || act.location;
        const address = (typeof rawAddr === 'string' ? rawAddr : (rawAddr && typeof rawAddr === 'object' ? (rawAddr.address || rawAddr.name || '') : '')).trim();
        const price = act.cost?.amount || act.estimatedCost?.amount || act.price || 0;

        for (const pattern of FILLER_TITLE_PATTERNS) {
          if (pattern.test(title)) {
            console.log(`[FILLER FILTER] Removed filler activity: "${title}"`);
            return false;
          }
        }

        if (price > 0 && address) {
          const hasStreet = STREET_INDICATOR.test(address);
          const isCityOnly = CITY_ONLY.test(address);
          if (isCityOnly || (!hasStreet && address.length < 30)) {
            console.log(`[FILLER FILTER] Removed paid activity with no real address: "${title}" at "${address}" (price: ${price})`);
            return false;
          }
        }

        return true;
      });
      if (normalizedActivities.length < beforeFiller) {
        console.log(`[FILLER FILTER] Day ${dayNumber}: removed ${beforeFiller - normalizedActivities.length} filler activities`);
      }
    }

    // =========================================================================
    // SHARED FLIGHT TIMING — hoisted so all post-processing blocks can access
    // =========================================================================
    const _arrivalTime24 = (flightContext as any)?.arrivalTime24 as string | undefined;
    const _departureTime24 = (flightContext as any)?.returnDepartureTime24 as string | undefined;

    // Extract departure transport type from rawFlightSelection
    const _rawFlight = (flightContext as any)?.rawFlightSelection as Record<string, any> | undefined;
    const _departureTransportType: string | undefined = isLastDay && _rawFlight
      ? (_rawFlight.return?.type as string
        || _rawFlight.returnTransportType as string
        || (Array.isArray(_rawFlight.legs) && _rawFlight.legs.length > 0
          ? (() => {
              const lastLeg = _rawFlight.legs[_rawFlight.legs.length - 1];
              const depLeg = _rawFlight.legs.find((l: any) => l.isDestinationDeparture) || lastLeg;
              if (depLeg?.type) return depLeg.type as string;
              if (/train|tgv|eurostar|thalys|ice|rail/i.test(depLeg?.flightNumber || '')) return 'train';
              if (/train|rail/i.test(depLeg?.airline || '')) return 'train';
              return undefined;
            })()
          : undefined)
        || undefined)
      : undefined;

    // =========================================================================
    // UNIVERSAL QUALITY PASS — placeholder fix, timing, pricing, dedup
    // =========================================================================
    {

      const { universalQualityPass } = await import('./universal-quality-pass.ts');
      normalizedActivities = await universalQualityPass(normalizedActivities, {
        city: destination,
        country: destinationCountry || '',
        dnaTier: tripType || 'Explorer',
        dnaArchetype: '',
        dayIndex: dayNumber - 1,
        totalDays: totalDays || 1,
        usedVenueNames: new Set<string>(),
        arrivalTime: isFirstDay ? _arrivalTime24 : undefined,
        departureTime: isLastDay ? _departureTime24 : undefined,
        departureTransportType: _departureTransportType,
        dayTitle: generatedDay?.theme || generatedDay?.title || `Day ${dayNumber}`,
        budgetTier: budgetTier || 'moderate',
        apiKey: LOVABLE_API_KEY,
        lockedActivities: lockedActivities,
        usedRestaurants: paramUsedRestaurants || [],
      });
    }

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

    // NOTE: Minimum duration enforcement and timing overlap resolution are now
    // handled exclusively by pipeline/repair-day.ts to prevent cascading shifts.
    // The 68G inline blocks were removed to fix the AM/PM timing collapse bug.

    // === TITLE CLEANUP: Fix orphaned articles like "The of Light" ===
    if (generatedDay?.title) {
      generatedDay.title = generatedDay.title
        .replace(/\bThe\s+of\s+/g, 'The City of ')
        .replace(/\bA\s+of\s+/g, 'A Day of ')
        .trim();
    }

    // === DUPLICATE HOTEL RETURN REMOVAL ===
    if (normalizedActivities.length >= 2) {
      for (let i = normalizedActivities.length - 2; i >= 0; i--) {
        const curr = normalizedActivities[i] as any;
        const next = normalizedActivities[i + 1] as any;
        const currTitle = (curr.title || '').toLowerCase();
        const nextTitle = (next.title || '').toLowerCase();
        const currIsHotelReturn = currTitle.includes('return to your hotel') || currTitle.includes('return to hotel') || currTitle.includes('back to your hotel');
        const nextIsHotelReturn = nextTitle.includes('return to your hotel') || nextTitle.includes('return to hotel') || nextTitle.includes('back to your hotel');
        if (currIsHotelReturn && nextIsHotelReturn) {
          if ((curr.category || '').toLowerCase() === 'stay') {
            console.log(`[DEDUP] Removed duplicate hotel return: "${next.title}" (${next.category})`);
            normalizedActivities.splice(i + 1, 1);
          } else {
            console.log(`[DEDUP] Removed duplicate hotel return: "${curr.title}" (${curr.category})`);
            normalizedActivities.splice(i, 1);
          }
        }
      }
    }

    // =======================================================================
    // ENRICHMENT + OPENING HOURS: Extracted to pipeline/enrich-day.ts (Phase 6)
    // =======================================================================
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Resolve hotel coordinates for proximity guard (rejects mainland venues in water-bound cities)
    let hotelCoordinates: { lat: number; lng: number } | undefined;
    if (GOOGLE_MAPS_API_KEY) {
      const hotelName = resolvedHotelOverride?.name || paramHotelName || (flightContext as any)?.hotelName;
      const hotelAddress = resolvedHotelOverride?.address || (flightContext as any)?.hotelAddress;
      const hotelQuery = hotelAddress ? `${hotelName} ${hotelAddress}` : (hotelName ? `${hotelName} ${destination}` : null);
      if (hotelQuery) {
        try {
          const { getDestinationCenter } = await import('./venue-enrichment.ts');
          const coords = await getDestinationCenter(hotelQuery, GOOGLE_MAPS_API_KEY);
          if (coords) {
            hotelCoordinates = coords;
            console.log(`[generate-day] Hotel coordinates resolved: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          }
        } catch (e) {
          console.warn(`[generate-day] Hotel geocoding failed (non-blocking):`, e);
        }
      }
    }

    _diagTimers.enrichStart = Date.now();
    normalizedActivities = await enrichAndValidateHours({
      activities: normalizedActivities,
      destination,
      date,
      supabaseUrl,
      supabaseKey,
      googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
      lovableApiKey: LOVABLE_API_KEY,
      hotelCoordinates,
    });
    _diagTimers.enrichEnd = Date.now();

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
    // PIPELINE PHASE 3: VALIDATE + REPAIR
    // Replaces inline trip-wide dedup, personalization, departure sequence,
    // and bookend validators with structured pipeline calls.
    // =======================================================================
    {
      // Sync generatedDay.activities with normalizedActivities before pipeline
      generatedDay.activities = normalizedActivities;

      try {
        // Build previousDays for trip-wide dedup
        let previousDaysForPipeline: StrictDayMinimal[] = [];
        if (tripId) {
          const { data: tripItinData } = await supabase
            .from('trips')
            .select('itinerary_data')
            .eq('id', tripId)
            .single();
          const existingDays = (tripItinData?.itinerary_data as any)?.days || [];
          previousDaysForPipeline = existingDays
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
        }

        // Build the current day in StrictDayMinimal format for validation
        const currentDayMinimal: StrictDayMinimal = {
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

        // Gather avoid list and dietary restrictions from profile
        const pipelineAvoidList = profile?.avoidList || [];
        const pipelineDietaryRestrictions = profile?.dietaryRestrictions || [];
        const mustDoList = (paramMustDoActivities || '').split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);

        // --- Use unified hotel resolution from compile-day-facts (single source of truth) ---
        const resolvedRepairHotelName = resolvedHotelOverride?.name || (flightContext as any).hotelName || paramHotelName || undefined;
        const resolvedRepairHotelAddr = resolvedHotelOverride?.address || (flightContext as any).hotelAddress || '';
        const resolvedIsHotelChange = facts.resolvedIsHotelChange;
        const resolvedPreviousHotelName = facts.resolvedPreviousHotelName;

        // --- VALIDATE ---
        const validationInput: ValidateDayInput = {
          day: currentDayMinimal,
          dayNumber,
          isFirstDay,
          isLastDay,
          totalDays,
          destination: resolvedDestination || destination || undefined,
          hasHotel: !!((flightContext as any).hotelName || paramHotelName || params.hotelOverride?.name),
          hotelName: (flightContext as any).hotelName || paramHotelName || params.hotelOverride?.name || undefined,
          arrivalTime24: flightContext.arrivalTime24 || (isFirstDay ? '09:00' : undefined),
          returnDepartureTime24: flightContext.returnDepartureTime24
            || (flightContext.returnDepartureTime ? normalizeTo24h(flightContext.returnDepartureTime) : undefined)
            || undefined,
          requiredMeals: dayMealPolicy?.requiredMeals || [],
          previousDays: previousDaysForPipeline,
          avoidList: pipelineAvoidList,
          dietaryRestrictions: pipelineDietaryRestrictions,
          mustDoActivities: mustDoList,
          isHotelChange: resolvedIsHotelChange,
          previousHotelName: resolvedPreviousHotelName,
        };

        const validationResults = validateDay(validationInput);

        const errorCount = validationResults.filter(r => r.severity === 'error' || r.severity === 'critical').length;
        const warningCount = validationResults.filter(r => r.severity === 'warning').length;
        if (validationResults.length > 0) {
          console.log(`[pipeline] Day ${dayNumber} validation: ${validationResults.length} issues (${errorCount} errors, ${warningCount} warnings)`);
        } else {
          console.log(`[pipeline] Day ${dayNumber} validation: all checks passed`);
        }

        // --- REPAIR ---
        const repairInput: RepairDayInput = {
          day: currentDayMinimal,
          validationResults,
          dayNumber,
          isFirstDay,
          isLastDay,
          arrivalTime24: validationInput.arrivalTime24,
          returnDepartureTime24: validationInput.returnDepartureTime24,
          hotelName: resolvedRepairHotelName,
          hotelAddress: resolvedRepairHotelAddr,
          hasHotel: true, // Always treat as having hotel — repair will use "Your Hotel" placeholder if none selected
          lockedActivities: lockedActivities as any[],
          restaurantPool: paramRestaurantPool || undefined,
          usedRestaurants: paramUsedRestaurants || undefined,
          // New fields for post-gen guarantees (Part B)
          isTransitionDay: resolvedIsTransitionDay,
          isMultiCity: resolvedIsMultiCity,
          isLastDayInCity: resolvedIsLastDayInCity,
          resolvedDestination: resolvedDestination || destination,
          nextLegTransport: resolvedNextLegTransport,
          nextLegCity: resolvedNextLegCity,
          nextLegTransportDetails: resolvedNextLegTransportDetails,
          arrivalAirport: arrivalAirportDisplay || flightContext.arrivalAirport || undefined,
          airportTransferMinutes: airportTransferMinutes || undefined,
          hotelOverride: resolvedHotelOverride ? { name: resolvedHotelOverride.name, address: resolvedHotelOverride.address } : undefined,
          hotelCoordinates: hotelCoordinates,
          isHotelChange: resolvedIsHotelChange,
          previousHotelName: resolvedPreviousHotelName,
          previousHotelAddress: facts.resolvedPreviousHotelAddress,
        };

        const { day: repairedDay, repairs } = repairDay(repairInput);

        if (repairs.length > 0) {
          console.log(`[pipeline] Day ${dayNumber} repairs: ${repairs.length} fixes applied — ${repairs.map(r => r.action).join(', ')}`);
        }

        // Apply repaired activities back
        generatedDay.activities = repairedDay.activities;
        normalizedActivities = generatedDay.activities;

      } catch (pipelineErr) {
        console.warn('[pipeline] Validate/repair failed (non-blocking):', pipelineErr);
      }
    }

    // =======================================================================
    // POST-REPAIR: Collapse consecutive transport cards (safety net)
    // =======================================================================
    if (normalizedActivities.length >= 2) {
      const transportRe = /^travel\s+to\b|^transit\s+to\b|^transfer\s+to\b|^drive\s+to\b|^ride\s+to\b/i;
      let collapsed = 0;
      for (let i = normalizedActivities.length - 2; i >= 0; i--) {
        const curr = normalizedActivities[i];
        const next = normalizedActivities[i + 1];
        const currCat = (curr.category || curr.type || '').toLowerCase();
        const nextCat = (next.category || next.type || '').toLowerCase();
        const currIsTransport = currCat === 'transport' || currCat === 'travel' || transportRe.test(curr.title || '');
        const nextIsTransport = nextCat === 'transport' || nextCat === 'travel' || transportRe.test(next.title || '');
        if (currIsTransport && nextIsTransport) {
          console.log(`[post-repair] Collapsing consecutive transports: "${curr.title}" + "${next.title}"`);
          normalizedActivities.splice(i, 1);
          collapsed++;
        }
      }
      if (collapsed > 0) {
        generatedDay.activities = normalizedActivities;
        console.log(`[post-repair] Collapsed ${collapsed} consecutive transport card(s)`);
      }
    }

    // =======================================================================
    // PERSIST: Day upsert, activity insert, UUID mapping, version save
    // Extracted to pipeline/persist-day.ts (Phase 5)
    // =======================================================================
    if (tripId) {
      try {
        const persistResult = await persistDay({
          supabase,
          tripId,
          dayNumber,
          date,
          generatedDay,
          normalizedActivities,
          action: paramAction,
          profile,
          resolvedIsTransitionDay,
          resolvedTransitionFrom,
          resolvedTransitionTo,
          resolvedTransportMode,
          resolvedDestination,
        });
        normalizedActivities = persistResult.normalizedActivities;
        generatedDay.activities = normalizedActivities;
      } catch (persistErr) {
        console.error('[generate-day] Persist error:', persistErr);
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

    // Post-gen hotel check-in, checkout, departure sequence, and airport stripping
    // are now handled by pipeline/repair-day.ts (steps 9-12)

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
    let mealGuardResult: { alreadyCompliant: boolean; activities: any[]; injectedMeals: string[] } | null = null;
    let mealsBeforeGuard: string[] = [];
    let mealsAfterGuard: string[] = [];
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
            let { data: venues } = await supabase
              .from('verified_venues')
              .select('name, address, category')
              .ilike('city', `%${destQuery}%`)
              .in('category', ['restaurant', 'dining', 'cafe', 'bar', 'food'])
              .limit(30);
            if ((!venues || venues.length === 0) && destQuery.includes(',')) {
              const cityOnly = destQuery.split(',')[0].trim();
              const broader = await supabase
                .from('verified_venues')
                .select('name, address, category')
                .ilike('city', `%${cityOnly}%`)
                .in('category', ['restaurant', 'dining', 'cafe', 'bar', 'food'])
                .limit(30);
              venues = broader.data;
              if (venues && venues.length > 0) {
                console.log(`[generate-day] Broadened verified_venues query to "${cityOnly}" — found ${venues.length} results`);
              }
            }
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

      // Chain restaurant filtering is now handled by pipeline/validate-day + repair-day

      // Snapshot meals BEFORE guard for accurate diagnostics
      mealsBeforeGuard = detectMealSlots(generatedDay.activities || []);

      // Compute timing window for meal guard
      const _arrTime24 = (flightContext as any)?.arrivalTime24 as string | undefined;
      const _depTime24 = (flightContext as any)?.returnDepartureTime24 as string | undefined;
      const arrMinsForGuard = isFirstDay && _arrTime24 ? (() => { const m = _arrTime24.match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : undefined; })() : undefined;
      const _isTrain = _departureTransportType && /train|rail|eurostar|tgv|thalys/i.test(_departureTransportType);
      const _depBufferMins = _isTrain ? 120 : 180;
      const depMinsForGuard = isLastDay && _depTime24 ? (() => { const m = _depTime24.match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) - _depBufferMins : undefined; })() : undefined;

      mealGuardResult = enforceRequiredMealsFinalGuard(
        generatedDay.activities || [],
        dayMealPolicy.requiredMeals,
        dayNumber,
        resolvedDestination || destination || 'the destination',
        'USD',
        dayMealPolicy.dayMode,
        mealFallbackVenues,
        { earliestTimeMins: arrMinsForGuard, latestTimeMins: depMinsForGuard },
      );
      if (!mealGuardResult.alreadyCompliant) {
        generatedDay.activities = mealGuardResult.activities as any;
        normalizedActivities = generatedDay.activities;
        console.warn(`[generate-day] 🍽️ MEAL GUARD FIRED: Day ${dayNumber} was missing [${mealGuardResult.injectedMeals.join(', ')}] — injected ${mealFallbackVenues.length > 0 ? 'REAL POOL venues' : 'destination-aware fallbacks'} before return`);
      } else {
        console.log(`[generate-day] ✓ Meal guard passed — Day ${dayNumber} has all required meals [${dayMealPolicy.requiredMeals.join(', ')}]`);
      }

      // Snapshot meals AFTER guard
      mealsAfterGuard = detectMealSlots(generatedDay.activities || []);

      // ── TERMINAL CLEANUP: final placeholder + timing scrub ──
      {
        const { terminalCleanup } = await import('./universal-quality-pass.ts');
        const _arrivalForCleanup = isFirstDay ? ((flightContext as any)?.arrivalTime24 as string | undefined) : undefined;
        const _departureForCleanup = isLastDay ? ((flightContext as any)?.returnDepartureTime24 as string | undefined) : undefined;
        terminalCleanup(generatedDay.activities, {
          arrivalTime24: _arrivalForCleanup,
          departureTime24: _departureForCleanup,
          departureTransportType: _departureTransportType,
          city: resolvedDestination || destination,
          dayNumber,
          isFirstDay,
          isLastDay,
        });
        normalizedActivities = generatedDay.activities;
      }

      // ── POST-GUARD CLEANUP: Strip dining with placeholder addresses ──
      normalizedActivities = normalizedActivities.filter((activity: any) => {
        if (activity.category !== 'dining') return true;
        const address = (activity.location?.address || activity.address || '').trim().toLowerCase();
        if (
          address === 'the destination' ||
          address === 'your destination' ||
          address === 'the city' ||
          address === '' ||
          address.length < 8
        ) {
          console.log(`[CLEANUP] Removed dining with placeholder address: "${activity.title}" (address: "${address}")`);
          return false;
        }
        return true;
      });
      generatedDay.activities = normalizedActivities;

      // ── POST-GUARD CLEANUP: Remove activities too close to departure on last day ──
      if (isLastDay && _departureTime24) {
        const depMatch = _departureTime24.match(/(\d{1,2}):(\d{2})/);
        if (depMatch) {
          const depMinutes = parseInt(depMatch[1]) * 60 + parseInt(depMatch[2]);
          const _isTrainDep = _departureTransportType && /train|rail|eurostar|tgv|thalys/i.test(_departureTransportType);
          const bufferMin = _isTrainDep ? 120 : 180;
          const cutoff = depMinutes - bufferMin;

          normalizedActivities = normalizedActivities.filter((activity: any) => {
            const title = (activity.title || '').toLowerCase();
            if (title.includes('checkout') || title.includes('check-out') || title.includes('heading home') || title.includes('departure') || title.includes('transfer to') || title.includes('travel to')) {
              return true;
            }
            const startTime = activity.startTime || activity.start_time || '';
            const startMatch = startTime.match(/(\d{1,2}):(\d{2})/);
            if (!startMatch) return true;
            const startMin = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
            if (startMin >= cutoff) {
              console.log(`[CLEANUP] Removed activity too close to departure: "${activity.title}" at ${startTime} (cutoff: ${Math.floor(cutoff/60)}:${String(cutoff%60).padStart(2,'0')})`);
              return false;
            }
            return true;
          });
          generatedDay.activities = normalizedActivities;
        }
      }
    }

    // End post-processing phase and write progress
    if (innerTimer) {
      innerTimer.endPhase(`post_processing_day_${dayNumber}`);
      const postProcPct = 5 + Math.round((dayNumber / Math.max(1, totalDays || 1)) * 90);
      await innerTimer.updateProgress(`day_${dayNumber}_post_processing_complete`, postProcPct);
    }

    // ── FINAL PRICING GUARD — handled by universalQualityPass earlier ──
    // No-op: pricing caps already enforced during quality pass

    // ── BUILD DIAGNOSTICS ──
    // Use the canonical detectMealSlots for consistent reporting
    const finalMeals = mealsAfterGuard.length > 0 ? mealsAfterGuard : detectMealSlots(generatedDay.activities || []);

    const _diagnostics = {
      aiCallMs: _diagTimers.aiCallEnd - _diagTimers.aiCallStart,
      enrichMs: _diagTimers.enrichEnd - _diagTimers.enrichStart,
      meals: {
        required: dayMealPolicy?.requiredMeals || [],
        found: finalMeals,
        beforeGuard: mealsBeforeGuard,
        guardFired: !!(mealGuardResult && !mealGuardResult.alreadyCompliant),
        injected: mealGuardResult?.injectedMeals || [],
      },
      transport: {
        isTransitionDay: resolvedIsTransitionDay,
        mode: resolvedTransportMode || null,
        hadInterCityTravel: !!(resolvedNextLegTransport && resolvedNextLegTransport !== 'none'),
        fallbackInjected: false,
      },
      llm: {
        model: aiResult?.model || 'unknown',
        promptTokens: aiResult?.usage?.prompt_tokens || 0,
        completionTokens: aiResult?.usage?.completion_tokens || 0,
      },
    };

    return new Response(
      JSON.stringify({
        success: true,
        day: generatedDay,
        dayNumber,
        totalDays,
        usedPersonalization: !!preferenceContext,
        flightAware: !!(flightContext.arrivalTime || flightContext.returnDepartureTime),
        preservedLocked: lockedActivities.length,
        _diagnostics,
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
