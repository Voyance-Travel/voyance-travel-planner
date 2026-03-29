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
} from './flight-hotel-context.ts';
import {
  validateGeneratedDay,
  filterChainRestaurants,
  enforceRequiredMealsFinalGuard,
  type StrictDayMinimal,
} from './day-validation.ts';
import { compileDayFacts } from './pipeline/compile-day-facts.ts';
import type { LockedActivity } from './pipeline/types.ts';
import { validateDay, type ValidateDayInput } from './pipeline/validate-day.ts';
import { repairDay, type RepairDayInput } from './pipeline/repair-day.ts';
import { compilePrompt } from './pipeline/compile-prompt.ts';

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

        // --- VALIDATE ---
        const validationInput: ValidateDayInput = {
          day: currentDayMinimal,
          dayNumber,
          isFirstDay,
          isLastDay,
          totalDays,
          hasHotel: !!(flightContext as any).hotelName,
          hotelName: (flightContext as any).hotelName || paramHotelName || undefined,
          arrivalTime24: flightContext.arrivalTime24,
          returnDepartureTime24: flightContext.returnDepartureTime24
            || (flightContext.returnDepartureTime ? normalizeTo24h(flightContext.returnDepartureTime) : undefined)
            || undefined,
          requiredMeals: dayMealPolicy?.requiredMeals || [],
          previousDays: previousDaysForPipeline,
          avoidList: pipelineAvoidList,
          dietaryRestrictions: pipelineDietaryRestrictions,
          mustDoActivities: mustDoList,
        };

        const validationResults = validateDay(validationInput);

        const errorCount = validationResults.filter(r => r.severity === 'error' || r.severity === 'critical').length;
        const warningCount = validationResults.filter(r => r.severity === 'warning').length;
        if (validationResults.length > 0) {
          console.log(`[pipeline] Day ${dayNumber} validation: ${validationResults.length} issues (${errorCount} errors, ${warningCount} warnings)`);
        } else {
          console.log(`[pipeline] Day ${dayNumber} validation: all checks passed`);
        }

        // --- Pre-resolve multi-city hotel for repair guarantees ---
        let resolvedRepairHotelName = (flightContext as any).hotelName || paramHotelName || undefined;
        let resolvedRepairHotelAddr = (flightContext as any).hotelAddress || '';
        if (tripId && resolvedIsMultiCity && (!resolvedRepairHotelName || resolvedRepairHotelName === 'Hotel')) {
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
                    if (cityHotel?.name) resolvedRepairHotelName = cityHotel.name;
                    if (cityHotel?.address) resolvedRepairHotelAddr = cityHotel.address;
                    break;
                  }
                }
                if (dc >= dayNumber) break;
              }
            }
          } catch (e) {
            console.warn('[pipeline] Could not resolve multi-city hotel for repair:', e);
          }
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
          hasHotel: validationInput.hasHotel,
          lockedActivities: lockedActivities as any[],
          restaurantPool: paramRestaurantPool || undefined,
          usedRestaurants: paramUsedRestaurants || undefined,
          // New fields for post-gen guarantees (Part B)
          isTransitionDay: resolvedIsTransitionDay,
          isMultiCity: resolvedIsMultiCity,
          isLastDayInCity: resolvedIsLastDayInCity,
          resolvedDestination: resolvedDestination || destination,
          nextLegTransport: resolvedNextLegTransport,
          hotelOverride: resolvedHotelOverride ? { name: resolvedHotelOverride.name, address: resolvedHotelOverride.address } : undefined,
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
          const itineraryDayId = dayRow.id;
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
            created_by_action: paramAction === 'regenerate-day' ? 'regenerate' : 'generate',
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

      // Chain restaurant filtering is now handled by pipeline/validate-day + repair-day

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
