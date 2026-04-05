/**
 * ACTION: generate-trip-day — Generate a SINGLE day, then self-chain to next
 * 
 * Each invocation is its own short-lived function call (~60-90s max).
 * The chain continues server-side even if the user closes their browser.
 * 
 * Extracted from index.ts to prevent scope-leaking bugs.
 */

import { corsHeaders } from './action-types.ts';
import { GenerationTimer } from './generation-timer.ts';
import { deriveMealPolicy, type RequiredMeal } from './meal-policy.ts';
import { enforceRequiredMealsFinalGuard, detectMealSlots } from './day-validation.ts';
import { sanitizeGeneratedDay, stripPhantomHotelActivities, sanitizeAITextField } from './sanitization.ts';
import { StageLogger } from './pipeline/stage-logger.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/**
 * Trigger generation of the next journey leg after this one completes.
 */
async function triggerNextJourneyLeg(supabase: any, tripId: string): Promise<void> {
  try {
    const { data: currentTrip } = await supabase
      .from('trips')
      .select('journey_id, journey_order')
      .eq('id', tripId)
      .single();

    if (!currentTrip?.journey_id || !currentTrip?.journey_order) {
      return; // Not a journey leg
    }

    const nextOrder = currentTrip.journey_order + 1;

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
        const { data: legMeta } = await supabase.from('trips').select('metadata').eq('id', nextLeg.id).single();
        const existingMeta = (legMeta?.metadata as Record<string, unknown>) || {};
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
      const { data: legMeta } = await supabase.from('trips').select('metadata').eq('id', nextLeg.id).single();
      const existingMeta = (legMeta?.metadata as Record<string, unknown>) || {};
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
    console.error(`[triggerNextJourneyLeg] Error:`, err);
  }
}

export async function handleGenerateTripDay(
  supabase: any,
  userId: string,
  params: Record<string, any>,
): Promise<Response> {
  const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, isMultiCity, creditsCharged, requestedDays, dayNumber, totalDays, generationRunId, isFirstTrip, generationLogId } = params;

  if (!tripId || !dayNumber || !totalDays) {
    return new Response(
      JSON.stringify({ error: "Missing required fields for day generation", code: "INVALID_INPUT" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Create timer early so we can finalize in the catch block
  const timer = new GenerationTimer(tripId, supabase);
  if (generationLogId) {
    try {
      await timer.resume(generationLogId, destination || '', totalDays, travelers || 1);
    } catch (e) {
      console.warn('[generate-trip-day] Timer resume failed (non-blocking):', e);
    }
  }

  try {
    return await _handleGenerateTripDayInner(supabase, userId, params, timer);
  } catch (fatalErr) {
    console.error(`[generate-trip-day] FATAL error on day ${dayNumber}:`, fatalErr);
    timer.addError(`day_${dayNumber}_fatal`, String(fatalErr));

    // CRITICAL: Update trip status so it doesn't stay stuck at 'generating'
    try {
      const { data: currentTripData } = await supabase
        .from('trips').select('metadata').eq('id', tripId).single();
      const currentMeta = (currentTripData?.metadata as Record<string, unknown>) || {};
      await supabase.from('trips').update({
        itinerary_status: 'failed',
        metadata: {
          ...currentMeta,
          chain_broken_at_day: dayNumber,
          chain_error: `Fatal error on day ${dayNumber}: ${String(fatalErr).slice(0, 200)}`,
          generation_completed_days: dayNumber - 1,
          generation_heartbeat: new Date().toISOString(),
          generation_timeout_sentinel: null, // Clear sentinel on explicit failure
        },
      }).eq('id', tripId);
      console.log(`[generate-trip-day] Updated trip ${tripId} to 'failed' after fatal error on day ${dayNumber}`);
    } catch (metaErr) {
      console.error('[generate-trip-day] Failed to update failure metadata:', metaErr);
    }

    await timer.finalize('failed');
    return new Response(
      JSON.stringify({ error: String(fatalErr), status: 'failed', dayNumber }),
      { status: 500, headers: jsonHeaders }
    );
  }
}

async function _handleGenerateTripDayInner(
  supabase: any,
  userId: string,
  params: Record<string, any>,
  timer: GenerationTimer,
): Promise<Response> {
  const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, isMultiCity, creditsCharged, requestedDays, dayNumber, totalDays, generationRunId, isFirstTrip, generationLogId } = params;

  console.log(`[generate-trip-day] Starting day ${dayNumber}/${totalDays} for trip ${tripId} (runId: ${generationRunId || 'none'})`);

  timer.startPhase(`day_${dayNumber}_total`);

  // Guard: check trip is still in "generating" state AND run ID matches
  const { data: tripCheck } = await supabase.from('trips').select('itinerary_status, metadata, itinerary_data, flight_selection, hotel_selection').eq('id', tripId).single();

  // Resolve hotel name from hotel_selection for single-city trips (date-aware for split stays)
  let tripHotelName: string | undefined;
  let tripHotelAddress: string | undefined;
  let hotelList: any[] = [];
  if (tripCheck?.hotel_selection) {
    const hs = tripCheck.hotel_selection as any;
    hotelList = Array.isArray(hs) ? hs : (typeof hs === 'object' && hs?.name ? [hs] : []);

    if (hotelList.length > 1 && startDate) {
      // Split stay: resolve per-day hotel by date matching
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + dayNumber - 1);
      const dayDateStr = dayDate.toISOString().split('T')[0];

      let matched = hotelList.find((h: any) => {
        const cin = h.checkInDate || h.check_in_date;
        const cout = h.checkOutDate || h.check_out_date;
        if (!cin && cout && dayDateStr < cout) return true;
        return cin && cout && dayDateStr >= cin && dayDateStr < cout;
      });
      if (!matched) {
        // Fallback: distribute nights evenly
        const daysPerHotel = Math.max(1, Math.floor(totalDays / hotelList.length));
        const idx = Math.min(Math.floor((dayNumber - 1) / daysPerHotel), hotelList.length - 1);
        matched = hotelList[idx];
        console.log(`[generate-trip-day] Split-stay date inference: day ${dayNumber} → hotel[${idx}] "${matched?.name}"`);
      }
      if (matched?.name) {
        tripHotelName = matched.name;
        tripHotelAddress = matched.address || '';
        console.log(`[generate-trip-day] Split-stay hotel for day ${dayNumber}: "${tripHotelName}" (date: ${dayDateStr})`);
      }
    } else if (hotelList.length === 1 && hotelList[0]?.name) {
      tripHotelName = hotelList[0].name;
      tripHotelAddress = hotelList[0].address || '';
    }
  }

  // Detect split-stay hotel change for single-city trips
  let tripIsHotelChange = false;
  let tripPreviousHotelName: string | undefined;
  let tripPreviousHotelAddress: string | undefined;
  if (hotelList.length > 1 && dayNumber > 1 && startDate) {
    const prevDayDate = new Date(startDate);
    prevDayDate.setDate(prevDayDate.getDate() + dayNumber - 2);
    const prevDateStr = prevDayDate.toISOString().split('T')[0];
    const prevHotel = hotelList.find(h => {
      const cin = h.checkInDate || h.check_in_date;
      const cout = h.checkOutDate || h.check_out_date;
      return cin && cout && prevDateStr >= cin && prevDateStr < cout;
    });
    if (prevHotel?.name && tripHotelName && prevHotel.name !== tripHotelName) {
      tripIsHotelChange = true;
      tripPreviousHotelName = prevHotel.name;
      tripPreviousHotelAddress = prevHotel.address || '';
      console.log(`[generate-trip-day] Split-stay hotel change detected: "${tripPreviousHotelName}" → "${tripHotelName}"`);
    }
  }

  // Resolve hotel coordinates for transit estimation in repair pipeline
  let tripHotelCoordinates: { lat: number; lng: number } | undefined;
  {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const resolvedHotelForCoords = tripHotelName || (tripCheck?.hotel_selection as any)?.name;
    if (GOOGLE_MAPS_API_KEY && resolvedHotelForCoords) {
      try {
        const { getDestinationCenter } = await import('./venue-enrichment.ts');
        const hotelQuery = `${resolvedHotelForCoords}, ${destination}`;
        const coords = await getDestinationCenter(hotelQuery, GOOGLE_MAPS_API_KEY);
        if (coords) {
          tripHotelCoordinates = coords;
          console.log(`[generate-trip-day] Hotel coordinates resolved: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        }
      } catch (e) {
        console.warn('[generate-trip-day] Hotel coordinate resolution failed (non-blocking):', (e as Error).message);
      }
    }
  }
  if (!tripCheck || tripCheck.itinerary_status === 'cancelled') {
    console.log(`[generate-trip-day] Trip ${tripId} status is ${tripCheck?.itinerary_status}, stopping chain`);
    return new Response(
      JSON.stringify({ status: tripCheck?.itinerary_status || 'cancelled', dayNumber }),
      { headers: jsonHeaders }
    );
  }
  
  // STATUS RECOVERY: If frontend prematurely set status to 'ready' but we still have days to generate,
  // reset it back to 'generating'. This prevents the frontend self-heal from killing the chain.
  if (tripCheck.itinerary_status === 'ready' && dayNumber <= totalDays) {
    console.warn(`[generate-trip-day] ⚠️ STATUS RECOVERY: Trip ${tripId} status was prematurely set to 'ready' while generating day ${dayNumber}/${totalDays} — resetting to 'generating'`);
    await supabase.from('trips').update({
      itinerary_status: 'generating',
      updated_at: new Date().toISOString(),
    }).eq('id', tripId);
  }

  // Run ID idempotency guard
  if (generationRunId) {
    const tripMeta = (tripCheck.metadata as Record<string, unknown>) || {};
    const currentRunId = tripMeta.generation_run_id as string | undefined;
    if (currentRunId && currentRunId !== generationRunId) {
      console.log(`[generate-trip-day] Stale run detected: this=${generationRunId}, current=${currentRunId}. Aborting.`);
      return new Response(
        JSON.stringify({ status: 'stale_run', dayNumber, message: 'A newer generation run has started' }),
        { headers: jsonHeaders }
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
            const prevCity = city.city_order > 0 ? tripCities.find((c: any) => c.city_order === city.city_order - 1) : null;
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

  // ── RESTAURANT POOL: Load pre-generated pool from trip metadata ───
  const tripMeta = (tripCheck.metadata as Record<string, unknown>) || {};
  const restaurantPoolByCity: Record<string, any[]> = (tripMeta.restaurant_pool as any) || {};
  const usedRestaurants: string[] = Array.isArray(tripMeta.used_restaurants) ? (tripMeta.used_restaurants as string[]) : [];
  // === RESTAURANT DEDUP DEBUG ===
  console.log('=== RESTAURANT DEDUP DEBUG ===');
  console.log(`Day number: ${dayNumber}`);
  console.log(`usedRestaurants received (${usedRestaurants.length}):`, JSON.stringify(usedRestaurants));
  console.log(`Type: ${typeof tripMeta.used_restaurants}, IsArray: ${Array.isArray(tripMeta.used_restaurants)}`);
  const allRestaurantParams = Object.keys(tripMeta).filter(k => /restaurant|used|block|previous|dining/i.test(k));
  console.log('All restaurant-related metadata keys:', JSON.stringify(allRestaurantParams.map(k => ({ key: k, count: Array.isArray(tripMeta[k]) ? (tripMeta[k] as any[]).length : 'N/A' }))));
  
  // Get the pool for this day's city
  const dayCity = cityInfo?.cityName || destination || '';
  let restaurantPool: any[] = restaurantPoolByCity[dayCity] || [];
  // Also try partial match if exact city not found
  if (restaurantPool.length === 0 && dayCity) {
    for (const [poolCity, pool] of Object.entries(restaurantPoolByCity)) {
      if (poolCity.toLowerCase().includes(dayCity.toLowerCase()) || dayCity.toLowerCase().includes(poolCity.toLowerCase())) {
        restaurantPool = pool;
        break;
      }
    }
  }
  if (restaurantPool.length > 0) {
    console.log(`[generate-trip-day] Restaurant pool for "${dayCity}": ${restaurantPool.length} venues (${usedRestaurants.length} already used)`);
  } else {
    // Log which pool keys exist to help diagnose pool-miss issues
    const poolKeys = Object.keys(restaurantPoolByCity);
    console.warn(`[generate-trip-day] ⚠️ Restaurant pool EMPTY for "${dayCity}" — available pool keys: [${poolKeys.join(', ')}] — meal guard will fall through to verified_venues or generic fallbacks`);
  }

  // CAP previousActivities to last 3 days to prevent prompt bloat on day 8+
  // The full dedup is handled post-generation by day-validation.ts
  const PREV_DAY_WINDOW = 3;
  const recentDays = existingDays.slice(-PREV_DAY_WINDOW);
  const olderDayCount = Math.max(0, existingDays.length - PREV_DAY_WINDOW);
  const previousActivities: string[] = [];
  for (const day of recentDays) {
    if (day?.activities) {
      day.activities.forEach((act: any) => {
        previousActivities.push(act.title || act.name || '');
      });
    }
  }
  if (olderDayCount > 0) {
    console.log(`[generate-trip-day] Capped previousActivities to last ${PREV_DAY_WINDOW} days (${previousActivities.length} items). ${olderDayCount} older day(s) excluded from prompt.`);
  }

  // Update heartbeat AND timeout sentinel before generating
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
        generation_timeout_sentinel: { day: dayNumber, started_at: new Date().toISOString() },
      },
    }).eq('id', tripId);
  }

  // PER-CITY STATUS: Mark city as 'generating' on first day
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

  // ── STAGE LOGGER: track pipeline artifacts for this day ──
  const stageLogger = new StageLogger(supabase, tripId, dayNumber);

  const MAX_RETRIES = 4;
  let dayResult: any = null;
  let lastError: string | null = null;
  let aiCallDurationMs = 0;
  const dayGenStart = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;

      // Adaptive timeout: later days get more time since they have richer context
      const timeoutMs = dayNumber <= 3 ? 120_000 : 180_000;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let resp: Response;
      try {
        resp = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            'apikey': Deno.env.get("SUPABASE_ANON_KEY") || '',
          },
          signal: controller.signal,
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
            hotelOverride: cityInfo?.hotelName ? {
              name: cityInfo.hotelName,
              address: cityInfo.hotelAddress || '',
            } : undefined,
            isFirstDayInCity: cityInfo ? (dayNumber === 1 || dayCityMap![dayNumber - 2]?.cityName !== cityInfo.cityName) : false,
            isLastDayInCity: cityInfo ? (dayNumber === totalDays || (dayCityMap![dayNumber] && dayCityMap![dayNumber].cityName !== cityInfo.cityName)) : false,
            restaurantPool: restaurantPool.length > 0 ? restaurantPool : undefined,
            usedRestaurants: usedRestaurants.length > 0 ? usedRestaurants : undefined,
            generationLogId: generationLogId || timer.getLogId(),
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '(no body)');
        // Classify 502/504 as retryable infrastructure errors
        const isInfraError = resp.status === 502 || resp.status === 504 || resp.status === 503;
        throw new Error(`Day ${dayNumber} HTTP ${resp.status}${isInfraError ? ' (infra)' : ''}: ${errText.slice(0, 200)}`);
      }

      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (!data.day) throw new Error(`No day data returned for day ${dayNumber}`);

      dayResult = data.day;
      // Capture pipeline diagnostics from generate-day response
      (dayResult as any).__diagnostics = data._diagnostics || null;
      aiCallDurationMs = Date.now() - dayGenStart;
      stageLogger.logAIResponse(data.day, aiCallDurationMs);
      timer.endPhase(`day_${dayNumber}_total`);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const timeoutLabel = dayNumber <= 3 ? '120s' : '180s';
      console.warn(`[generate-trip-day] Day ${dayNumber} attempt ${attempt + 1} failed${isAbort ? ` (timeout ${timeoutLabel})` : ''}: ${msg}`);
      lastError = isAbort ? `Day ${dayNumber} timed out after ${timeoutLabel}` : msg;
      if (attempt < MAX_RETRIES) {
        // Longer backoff for infrastructure errors
        const backoffMs = msg.includes('(infra)') || isAbort ? 8000 * (attempt + 1) : 5000 * (attempt + 1);
        await new Promise(r => setTimeout(r, backoffMs));
        
        // SLIM PROMPT RETRY for day 4+ after first failure: reduce previousActivities
        // to last 2 days only to shrink the prompt and avoid AI truncation
        if (dayNumber >= 4 && attempt >= 1 && previousActivities.length > 15) {
          const slimCount = Math.min(15, previousActivities.length);
          const removed = previousActivities.length - slimCount;
          previousActivities.splice(0, removed);
          console.log(`[generate-trip-day] Slim prompt retry: reduced previousActivities to ${slimCount} items (removed ${removed})`);
        }
      }
    }
  }

  if (!dayResult) {
    // This day failed after all retries — but DON'T stop the chain.
    // Record the failure and CONTINUE to the next day so we don't lose the whole trip.
    console.error(`[generate-trip-day] Day ${dayNumber} failed permanently: ${lastError}`);
    
    const { data: failTrip } = await supabase.from('trips').select('metadata, unlocked_day_count').eq('id', tripId).single();
    const failMeta = (failTrip?.metadata as Record<string, unknown>) || {};
    const currentUnlocked = (failTrip as any)?.unlocked_day_count ?? 0;

    // Track failed days in metadata (accumulate, don't overwrite)
    const failedDays: number[] = Array.isArray(failMeta.failed_day_numbers) ? [...(failMeta.failed_day_numbers as number[])] : [];
    if (!failedDays.includes(dayNumber)) failedDays.push(dayNumber);

    // If this is the LAST day and ALL days failed, mark as failed + refund
    const isLastDay = dayNumber >= totalDays;
    const allDaysFailed = isLastDay && failedDays.length >= totalDays;

    if (allDaysFailed) {
      await supabase.from('trips').update({
        itinerary_status: 'failed',
        unlocked_day_count: Math.max(currentUnlocked, existingDays.length),
        metadata: {
          ...failMeta,
          failed_day_numbers: failedDays,
          generation_error: lastError || 'All days failed',
          generation_failed_at: new Date().toISOString(),
          generation_completed_days: existingDays.length,
          generation_total_days: totalDays,
        },
      }).eq('id', tripId);

      // Server-side refund for ALL days
      const totalCharged = creditsCharged || 0;
      if (totalCharged > 0) {
        try {
          await supabase.from('credit_purchases').insert({
            user_id: userId, credit_type: 'refund', amount: totalCharged, remaining: totalCharged,
            source: 'system_refund', stripe_session_id: null,
          });
          await supabase.from('credit_ledger').insert({
            user_id: userId, transaction_type: 'refund', credits_delta: totalCharged, is_free_credit: false,
            action_type: 'refund', trip_id: tripId,
            notes: `Server-side refund: all ${totalDays} days failed. +${totalCharged} credits restored.`,
            metadata: { reason: 'server_generation_all_failed', error: lastError },
          });
          console.log(`[generate-trip-day] Full refund: ${totalCharged} credits (all days failed)`);
        } catch (refundErr) {
          console.error(`[generate-trip-day] Refund failed:`, refundErr);
        }
      }

      return new Response(
        JSON.stringify({ status: 'failed', dayNumber, error: lastError }),
        { headers: jsonHeaders }
      );
    }

    // NOT the last day (or only some days failed) — update metadata and CONTINUE the chain
    await supabase.from('trips').update({
      metadata: {
        ...failMeta,
        failed_day_numbers: failedDays,
        generation_heartbeat: new Date().toISOString(),
        generation_current_day: dayNumber,
        last_day_error: `Day ${dayNumber}: ${lastError}`,
      },
    }).eq('id', tripId);

    if (!isLastDay) {
      console.log(`[generate-trip-day] Day ${dayNumber} failed but continuing chain to day ${dayNumber + 1}`);
      // Fall through to chain logic below — dayResult is null so we skip the save
      // but still chain to the next day
    } else {
      // Last day, some days failed — mark as partial and refund failed days
      const successfulDays = totalDays - failedDays.length;
      await supabase.from('trips').update({
        itinerary_status: existingDays.length > 0 ? 'partial' : 'failed',
        unlocked_day_count: Math.max(currentUnlocked, existingDays.length),
        metadata: {
          ...failMeta,
          failed_day_numbers: failedDays,
          generation_error: `${failedDays.length} day(s) failed: ${failedDays.join(', ')}`,
          generation_failed_at: new Date().toISOString(),
          generation_completed_days: successfulDays,
          generation_total_days: totalDays,
        },
      }).eq('id', tripId);

      const totalCharged = creditsCharged || 0;
      if (totalCharged > 0 && failedDays.length > 0) {
        const effectiveTotalDays = requestedDays || totalDays;
        const creditsPerDay = Math.round(totalCharged / effectiveTotalDays);
        const refundAmount = creditsPerDay * failedDays.length;
        if (refundAmount > 0) {
          try {
            await supabase.from('credit_purchases').insert({
              user_id: userId, credit_type: 'refund', amount: refundAmount, remaining: refundAmount,
              source: 'system_refund', stripe_session_id: null,
            });
            await supabase.from('credit_ledger').insert({
              user_id: userId, transaction_type: 'refund', credits_delta: refundAmount, is_free_credit: false,
              action_type: 'refund', trip_id: tripId,
              notes: `Server-side refund: ${failedDays.length}/${effectiveTotalDays} days failed. +${refundAmount} credits restored.`,
              metadata: { reason: 'server_generation_partial_fail', failedDays },
            });
            console.log(`[generate-trip-day] Partial refund: ${refundAmount} credits for ${failedDays.length} failed days`);
          } catch (refundErr) {
            console.error(`[generate-trip-day] Refund failed:`, refundErr);
          }
        }
      }

      return new Response(
        JSON.stringify({ status: 'partial', dayNumber, failedDays, error: lastError }),
        { headers: jsonHeaders }
      );
    }
  }

  // ── SKIP-TO-CHAIN: If dayResult is null (failed day, chain continuing), skip save and go to chain ──
  if (!dayResult && dayNumber < totalDays) {
    console.log(`[generate-trip-day] Day ${dayNumber} failed, skipping save and chaining to day ${dayNumber + 1}`);
    // Jump directly to chain logic
    const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const chainBody = JSON.stringify({
      action: 'generate-trip-day',
      tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, userId,
      isMultiCity, creditsCharged, requestedDays, dayNumber: dayNumber + 1, totalDays, generationRunId,
      isFirstTrip: isFirstTrip || false,
    });

    const maxChainRetries = 3;
    let chainOk = false;
    for (let attempt = 1; attempt <= maxChainRetries; attempt++) {
      try {
        const response = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: chainBody,
        });
        if (response.ok) { chainOk = true; break; }
        const respText = await response.text().catch(() => '');
        console.error(`[generate-trip-day] Skip-chain attempt ${attempt}/${maxChainRetries} returned ${response.status}: ${respText.slice(0, 200)}`);
        if (response.status >= 400 && response.status < 500) break;
      } catch (err) {
        console.error(`[generate-trip-day] Skip-chain attempt ${attempt}/${maxChainRetries} error:`, err);
      }
      if (attempt < maxChainRetries) await new Promise(r => setTimeout(r, 3000 * attempt));
    }
    if (!chainOk) {
      const { data: cm } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
      const cmeta = (cm?.metadata as Record<string, unknown>) || {};
      await supabase.from('trips').update({
        metadata: { ...cmeta, chain_broken_at_day: dayNumber, chain_error: `Chain to day ${dayNumber + 1} failed after skip-chain retries` },
      }).eq('id', tripId);
    }
    return new Response(
      JSON.stringify({ status: 'day_failed_continuing', dayNumber, totalDays, nextDay: dayNumber + 1 }),
      { headers: jsonHeaders }
    );
  }

  // Day generated successfully — ensure date is always set
  if (!dayResult!.date && startDate) {
    const derived = new Date(startDate);
    derived.setDate(derived.getDate() + dayNumber - 1);
    dayResult!.date = derived.toISOString().split('T')[0];
    console.log(`[generate-trip-day] Derived missing date for day ${dayNumber}: ${dayResult!.date}`);
  }
  dayResult!.dayNumber = dayNumber;

  // ── POST-PROCESSING: sanitize, strip phantoms, fix forward refs, clean generic titles ──
  {
    const preSanitizeCount = Array.isArray(dayResult?.activities) ? dayResult.activities.length : 0;
    console.log(`[generate-trip-day] Day ${dayNumber} pre-sanitize activity count: ${preSanitizeCount}`);

    const resolvedDest = cityInfo?.cityName || destination;
    sanitizeGeneratedDay(dayResult, dayNumber, resolvedDest, usedRestaurants);

    const postSanitizeCount = Array.isArray(dayResult?.activities) ? dayResult.activities.length : 0;
    if (postSanitizeCount < preSanitizeCount) {
      console.warn(`[generate-trip-day] Day ${dayNumber} lost ${preSanitizeCount - postSanitizeCount} activities during sanitization (${preSanitizeCount} → ${postSanitizeCount})`);
    }
    
    // Broad hotel detection: selected hotel, accommodation notes, or existing accommodation activities
    const hasHotel = !!(cityInfo?.hotelName) || !!tripHotelName ||
      dayResult.activities?.some((a: any) => (a.category || '').toLowerCase() === 'accommodation');
    stripPhantomHotelActivities(dayResult, hasHotel);

    const postStripCount = Array.isArray(dayResult?.activities) ? dayResult.activities.length : 0;
    if (postStripCount < postSanitizeCount) {
      console.warn(`[generate-trip-day] Day ${dayNumber} lost ${postSanitizeCount - postStripCount} activities during hotel phantom strip (${postSanitizeCount} → ${postStripCount})`);
    }
    if (postStripCount === 0) {
      console.error(`[generate-trip-day] ⚠️ Day ${dayNumber} has 0 activities after post-processing! Pre-sanitize had ${preSanitizeCount}.`);
    }

    // Forward-ref fix: strip hallucinated tomorrow references from accommodation descriptions
    const hotelName = cityInfo?.hotelName || tripHotelName || 'your hotel';
    for (const act of (dayResult!.activities || [])) {
      const cat = (act.category || '').toLowerCase();
      const title = (act.title || '').toLowerCase();
      const isReturnAccom = cat === 'accommodation' &&
        (title.includes('return to') || title.includes('freshen up') || title.includes('back to') || title.includes('settle in'));
      if (isReturnAccom && act.description && /tomorrow/i.test(act.description)) {
        act.description = `Time at ${hotelName} to rest and refresh.`;
      }
    }

    // Generic title validator: clean placeholder business names
    const INDEFINITE_ARTICLE_START = /^(a|an)\s+[a-z]/i;
    const VAGUE_TITLE_KEYWORDS = /\b(or high.end|or similar|boutique wellness|local spa|nearby caf[eé])\b/i;
    for (const act of (dayResult!.activities || [])) {
      const title = (act.title || '').trim();
      if (INDEFINITE_ARTICLE_START.test(title) || VAGUE_TITLE_KEYWORDS.test(title)) {
        act.title = sanitizeAITextField(title, resolvedDest);
        act.name = act.title;
      }
    }
    // Meal-time coherence: fix meal keywords contradicting time slot
    const MEAL_KW_RE = /\b(breakfast|brunch|lunch|dinner|supper)\b/i;
    const MEAL_RANGES: Record<string, [number, number]> = {
      Breakfast: [360, 659], Lunch: [660, 899], Dinner: [1020, 1379],
    };
    const canonMeal = (kw: string) => {
      const lc = kw.toLowerCase();
      if (lc === 'breakfast' || lc === 'brunch') return 'Breakfast';
      if (lc === 'lunch') return 'Lunch';
      if (lc === 'dinner' || lc === 'supper') return 'Dinner';
      return null;
    };
    const correctMealForTime = (mins: number) => {
      for (const [label, [lo, hi]] of Object.entries(MEAL_RANGES)) {
        if (mins >= lo && mins <= hi) return label;
      }
      return null;
    };
    const parseTimeMins = (t: string): number | null => {
      const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
      return null;
    };
    for (const act of (dayResult!.activities || [])) {
      const m = MEAL_KW_RE.exec(act.title || '');
      if (!m) continue;
      const titleMeal = canonMeal(m[1]);
      if (!titleMeal) continue;
      const mins = parseTimeMins(act.startTime || act.start_time || '');
      if (mins === null || mins === 0) continue;
      const correct = correctMealForTime(mins);
      if (!correct || correct === titleMeal) continue;
      const replacement = m[1][0] === m[1][0].toUpperCase() ? correct : correct.toLowerCase();
      console.log(`[generate-trip-day] MealCoherence: "${act.title}" at ${act.startTime}: ${titleMeal} → ${correct}`);
      act.title = act.title!.slice(0, m.index) + replacement + act.title!.slice(m.index + m[1].length);
      if (act.name) act.name = act.title;
    }

    console.log(`[generate-trip-day] Post-processing complete for day ${dayNumber}`);
  }

  // ── PIPELINE VALIDATE + REPAIR (same guarantees as single-day path) ──
  {
    try {
      const { validateDay } = await import('./pipeline/validate-day.ts');
      const { repairDay } = await import('./pipeline/repair-day.ts');
      const { deriveMealPolicy } = await import('./meal-policy.ts');
      const { normalizeTo24h } = await import('./flight-hotel-context.ts');

      const flightSel = (tripCheck?.flight_selection as Record<string, any>) || {};
      const isFirstDay = dayNumber === 1;
      const isLastDay = dayNumber >= totalDays;

      const arrTime24 = isFirstDay ? (flightSel.arrivalTime24 || flightSel.arrivalTime || flightSel.outbound?.arrivalTime || undefined) : undefined;
      const depTime24Raw = isLastDay ? (flightSel.returnDepartureTime24 || flightSel.returnDepartureTime || flightSel.return?.departureTime || undefined) : undefined;
      const depTime24 = depTime24Raw ? normalizeTo24h(depTime24Raw) : undefined;

      const policy = deriveMealPolicy({
        dayNumber, totalDays, isFirstDay, isLastDay,
        arrivalTime24: arrTime24, departureTime24: depTime24,
      });

      const dayMinimal = {
        dayNumber,
        date: dayResult.date || '',
        title: dayResult.title || '',
        theme: dayResult.theme,
        activities: (dayResult.activities || []).map((a: any) => ({
          id: a.id || '', title: a.title || a.name || '',
          startTime: a.startTime || a.start_time || '', endTime: a.endTime || a.end_time || '',
          category: a.category || 'activity',
          location: a.location || { name: '', address: '' },
          cost: a.cost || { amount: 0, currency: 'USD' },
          description: a.description || '', tags: a.tags || [],
          bookingRequired: a.bookingRequired || false,
          transportation: a.transportation || { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
        })),
      };

      const validationResults = validateDay({
        day: dayMinimal,
        dayNumber, isFirstDay, isLastDay, totalDays,
        hasHotel: true, // Always true — repair uses "Your Hotel" placeholder
        hotelName: cityInfo?.hotelName || tripHotelName || undefined,
        arrivalTime24: arrTime24,
        returnDepartureTime24: depTime24,
        requiredMeals: policy.requiredMeals || [],
        previousDays: existingDays.filter((d: any) => d.dayNumber !== dayNumber).map((d: any) => ({
          dayNumber: d.dayNumber || 0, date: d.date || '', title: d.title || '',
          activities: (d.activities || []).map((a: any) => ({
            id: a.id || '', title: a.title || a.name || '',
            startTime: a.startTime || '', endTime: a.endTime || '',
            category: a.category || 'activity',
            location: a.location || { name: '', address: '' },
            cost: a.cost || { amount: 0, currency: 'USD' },
            description: a.description || '', tags: a.tags || [],
            bookingRequired: false,
            transportation: { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
          })),
        })),
        isHotelChange: cityInfo?.isHotelChange || tripIsHotelChange,
        previousHotelName: (cityInfo as any)?.previousHotelName || tripPreviousHotelName,
      });

      const isLastDayInCity = cityInfo ? (dayNumber === totalDays || (dayCityMap![dayNumber] && dayCityMap![dayNumber].cityName !== cityInfo.cityName)) : false;
      const isTransition = cityInfo?.isTransitionDay || false;

      const { day: repairedDay, repairs } = repairDay({
        day: dayMinimal,
        validationResults,
        dayNumber, isFirstDay, isLastDay,
        arrivalTime24: arrTime24,
        returnDepartureTime24: depTime24,
        hotelName: cityInfo?.hotelName || tripHotelName || undefined,
        hotelAddress: cityInfo?.hotelAddress || tripHotelAddress || '',
        hasHotel: true,
        lockedActivities: [],
        isTransitionDay: isTransition,
        isMultiCity: isMultiCity || false,
        isLastDayInCity,
        resolvedDestination: cityInfo?.cityName || destination,
        hotelOverride: (cityInfo?.hotelName || tripHotelName) ? { name: cityInfo?.hotelName || tripHotelName!, address: cityInfo?.hotelAddress || tripHotelAddress || '' } : undefined,
        isHotelChange: cityInfo?.isHotelChange || tripIsHotelChange,
        previousHotelName: (cityInfo as any)?.previousHotelName || tripPreviousHotelName,
        previousHotelAddress: (cityInfo as any)?.previousHotelAddress || tripPreviousHotelAddress,
        hotelCoordinates: tripHotelCoordinates,
      });

      if (repairs.length > 0) {
        console.log(`[generate-trip-day] Pipeline repairs: ${repairs.length} fixes — ${repairs.map(r => r.action).join(', ')}`);
        dayResult.activities = repairedDay.activities;
      }
    } catch (pipelineErr) {
      console.warn('[generate-trip-day] Pipeline validate/repair failed (non-blocking):', pipelineErr);
    }
  }

  // POST-GENERATION: Enforce cross-day restaurant uniqueness
  if (dayResult?.activities?.length > 0) {
    const { extractRestaurantVenueName } = await import('./generation-utils.ts');
    const usedNorm = new Set(usedRestaurants.map(n => extractRestaurantVenueName(n)));
    const MEAL_RE = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;

    for (let i = 0; i < dayResult.activities.length; i++) {
      const act = dayResult.activities[i];
      const cat = (act.category || '').toLowerCase();
      const typ = (act.type || '').toLowerCase();
      const isDining = cat === 'dining' || typ === 'dining' || MEAL_RE.test(act.title || '');
      if (!isDining) continue;

      const venue = extractRestaurantVenueName(act.title || '') || extractRestaurantVenueName(act.location?.name || '');
      if (!venue || !usedNorm.has(venue)) continue;

      // Find a replacement from the pool that hasn't been used
      const replacement = restaurantPool.find(r => {
        const rNorm = extractRestaurantVenueName(r.name || r.title || '');
        return rNorm && !usedNorm.has(rNorm);
      });

      if (replacement) {
        const replacementName = replacement.name || replacement.title;
        console.warn(`[generate-trip-day] 🔄 CROSS-DAY DEDUP: Replaced "${act.title}" with "${replacementName}"`);
        // Preserve meal prefix if present
        const mealMatch = (act.title || '').match(/^(Breakfast|Brunch|Lunch|Dinner|Supper|Cocktails|Nightcap)\s+(?:at|:)\s+/i);
        act.title = mealMatch ? `${mealMatch[1]} at ${replacementName}` : replacementName;
        act.name = act.title;
        if (act.location) {
          act.location.name = replacementName;
          if (replacement.address) act.location.address = replacement.address;
        }
        if (replacement.coordinates) {
          act.location = { ...act.location, lat: replacement.coordinates.lat, lng: replacement.coordinates.lng };
        }
        usedNorm.add(extractRestaurantVenueName(replacementName));
      } else {
        // ZERO-TOLERANCE: No replacement available — remove the repeated dining activity
        console.warn(`[generate-trip-day] 🚫 CROSS-DAY DEDUP: "${act.title}" repeats with no replacement — REMOVING`);
        dayResult.activities[i] = null; // Mark for removal
      }
    }
    // Filter out nulled (removed) activities
    dayResult.activities = dayResult.activities.filter((a: any) => a !== null);
  }

  // Flush stage logger (non-blocking, non-fatal)
  try {
    await stageLogger.flush();
    console.log(`[generate-trip-day] ${stageLogger.getSummary()}`);
  } catch (logErr) {
    console.warn('[generate-trip-day] StageLogger flush failed (non-fatal):', logErr);
  }

  // Save it
  const filteredExisting = existingDays.filter((d: any) => d?.dayNumber !== dayNumber);
  
  // LAYER 1: HARD VALIDATION — deduplicate by date AND dayNumber
  const candidateDays = [...filteredExisting, dayResult];
  
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
  
  const updatedDays = Array.from(byDate.values())
    .sort((a: any, b: any) => {
      const dateA = a.date ? new Date(a.date).getTime() : (a.dayNumber || 0);
      const dateB = b.date ? new Date(b.date).getTime() : (b.dayNumber || 0);
      return dateA - dateB;
    })
    .map((d: any, idx: number) => ({ ...d, dayNumber: idx + 1 }));
  
  if (updatedDays.length !== candidateDays.length) {
    console.warn(`[generate-trip-day] Day deduplication removed ${candidateDays.length - updatedDays.length} duplicate(s)`);
  }

  // NO-SHRINK GUARD (chain save)
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

  // RUN ID CHECK BEFORE WRITE
  if (generationRunId) {
    const { data: preWriteTrip } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
    const preWriteMeta = (preWriteTrip?.metadata as Record<string, unknown>) || {};
    const currentRunId = preWriteMeta.generation_run_id as string | undefined;
    if (currentRunId && currentRunId !== generationRunId) {
      console.log(`[generate-trip-day] Stale run at write time: this=${generationRunId}, current=${currentRunId}. Aborting write.`);
      return new Response(
        JSON.stringify({ status: 'stale_run', dayNumber, message: 'A newer generation run has started' }),
        { headers: jsonHeaders }
      );
    }
  }

  // ── BUILD MEAL GUARD FALLBACK VENUES ─────────────────────────────
  // PRIORITY 1: Use the pre-generated restaurant pool (real, curated)
  const { extractRestaurantVenueName: extractVenue } = await import('./generation-utils.ts');
  let fallbackVenues: Array<{ name: string; address: string; mealType: string }> = [];
  if (restaurantPool.length > 0) {
    const usedSet = new Set(usedRestaurants.map(n => extractVenue(n)));
    for (const r of restaurantPool) {
      if (!usedSet.has(extractVenue(r.name || ''))) {
        fallbackVenues.push({ name: r.name, address: r.address || r.neighborhood || dayCity, mealType: r.mealType || 'any' });
      }
    }
    if (fallbackVenues.length > 0) {
      console.log(`[generate-trip-day] Meal guard using ${fallbackVenues.length} venues from restaurant pool`);
    }
  }
  // PRIORITY 2: Supplement with verified_venues if pool is thin
  if (fallbackVenues.length < 5) {
    try {
      const destQuery = cityInfo?.cityName || destination || '';
      if (destQuery) {
        // Try exact city match first, then fall back to first word (e.g. "Vienna" from "Vienna, Austria")
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
            console.log(`[generate-trip-day] Broadened verified_venues query to "${cityOnly}" — found ${venues.length} results`);
          }
        }
        if (venues && venues.length > 0) {
          for (const v of venues) {
            const nameLower = (v.name || '').toLowerCase();
            let mealType = 'any';
            if (nameLower.includes('breakfast') || nameLower.includes('brunch') || nameLower.includes('café') || nameLower.includes('cafe') || nameLower.includes('bakery') || nameLower.includes('coffee')) mealType = 'breakfast';
            else if (nameLower.includes('ramen') || nameLower.includes('lunch') || nameLower.includes('noodle') || nameLower.includes('sandwich') || nameLower.includes('deli')) mealType = 'lunch';
            else if (nameLower.includes('dinner') || nameLower.includes('izakaya') || nameLower.includes('steakhouse') || nameLower.includes('bistro') || nameLower.includes('trattoria')) mealType = 'dinner';
            fallbackVenues.push({ name: v.name, address: v.address || destQuery, mealType });
          }
          console.log(`[generate-trip-day] Supplemented with ${venues.length} verified_venues candidates`);
        }
      }
    } catch (e) {
      console.warn('[generate-trip-day] Could not pre-fetch venue candidates:', e);
    }
  }

  // ── MEAL COMPLIANCE GUARD (before save) ──────────────────────────
  // The generate-day action already has a meal guard, but this catches
  // edge cases where post-processing in this file may have altered days.
  // Extract flight times so meal policy respects actual departure/arrival
  const flightSel = (tripCheck?.flight_selection as Record<string, any>) || null;
  const savedArrivalTime24: string | undefined =
    flightSel?.arrivalTime24 || flightSel?.arrivalTime || flightSel?.outbound?.arrivalTime || undefined;
  const savedDepartureTime24: string | undefined =
    flightSel?.returnDepartureTime24 || flightSel?.returnDepartureTime || flightSel?.return?.departureTime || undefined;

  for (let i = 0; i < updatedDays.length; i++) {
    const d = updatedDays[i];
    if (!d?.activities || !Array.isArray(d.activities)) continue;
    const dn = d.dayNumber || (i + 1);
    const policy = deriveMealPolicy({
      dayNumber: dn,
      totalDays,
      isFirstDay: dn === 1,
      isLastDay: dn === totalDays,
      arrivalTime24: dn === 1 ? savedArrivalTime24 : undefined,
      departureTime24: dn === totalDays ? savedDepartureTime24 : undefined,
    });
    if (policy.requiredMeals.length === 0) continue;
    const detected = detectMealSlots(d.activities);
    const missing = policy.requiredMeals.filter((m: RequiredMeal) => !detected.includes(m));
    if (missing.length > 0) {
      const dest = d.city || cityInfo?.cityName || destination || 'the destination';
      const result = enforceRequiredMealsFinalGuard(d.activities, policy.requiredMeals, dn, dest, 'USD', policy.dayMode, fallbackVenues);
      if (!result.alreadyCompliant) {
        updatedDays[i] = { ...d, activities: result.activities };
        console.warn(`[generate-trip-day] 🍽️ MEAL GUARD: Day ${dn} missing [${result.injectedMeals.join(', ')}] — injected before chain save`);
      }
    }
  }

  // ── DATE NORMALIZATION (ensure every day has a date) ─────────────
  if (startDate) {
    for (let i = 0; i < updatedDays.length; i++) {
      if (!updatedDays[i].date) {
        const derived = new Date(startDate);
        derived.setDate(derived.getDate() + (updatedDays[i].dayNumber || i + 1) - 1);
        updatedDays[i].date = derived.toISOString().split('T')[0];
        console.log(`[generate-trip-day] Derived missing date for existing day ${updatedDays[i].dayNumber}: ${updatedDays[i].date}`);
      }
    }
  }

  // STRUCTURAL VALIDATION: Verify the newly generated day has real activities
  const newDayInArray = updatedDays.find((d: any) => d.dayNumber === dayNumber);
  const newDayActivities = Array.isArray(newDayInArray?.activities) ? newDayInArray.activities : [];
  if (newDayActivities.length === 0) {
    console.error(`[generate-trip-day] ⚠️ EMPTY DAY DETECTED: Day ${dayNumber} has 0 activities after generation. Marking as failed.`);
    
    const { data: failTrip } = await supabase.from('trips').select('metadata, unlocked_day_count').eq('id', tripId).single();
    const failMeta = (failTrip?.metadata as Record<string, unknown>) || {};
    
    await supabase.from('trips').update({
      itinerary_status: existingDays.length > 0 ? 'partial' : 'failed',
      metadata: {
        ...failMeta,
        generation_error: `Day ${dayNumber} generated with 0 activities`,
        generation_failed_at: new Date().toISOString(),
        generation_failed_on_day: dayNumber,
        generation_completed_days: existingDays.length,
        generation_total_days: totalDays,
        empty_day_detected: true,
      },
    }).eq('id', tripId);

    return new Response(
      JSON.stringify({ status: 'failed', dayNumber, error: `Day ${dayNumber} generated with 0 activities` }),
      { headers: jsonHeaders }
    );
  }

  // Check ALL days for completeness before marking ready
  // STRICT: ready ONLY when (1) day count matches totalDays, (2) every day has activities, (3) no recorded failed days
  const { data: metaTripPre } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
  const metaPre = (metaTripPre?.metadata as Record<string, unknown>) || {};
  const failedDayNumbers: number[] = Array.isArray(metaPre.failed_day_numbers) ? (metaPre.failed_day_numbers as number[]) : [];
  
  const allDaysHaveActivities = dayNumber >= totalDays
    ? updatedDays.every((d: any) => Array.isArray(d.activities) && d.activities.length > 0)
    : true;
  const dayCountMatches = updatedDays.length >= totalDays;
  const noFailedDays = failedDayNumbers.length === 0;
  
  const isComplete = dayNumber >= totalDays && allDaysHaveActivities && dayCountMatches && noFailedDays;
  const computedStatus = isComplete ? 'ready' : (dayNumber >= totalDays ? 'partial' : 'generating');
  
  if (dayNumber >= totalDays && !isComplete) {
    const issues: string[] = [];
    if (!allDaysHaveActivities) {
      const emptyDayNumbers = updatedDays
        .filter((d: any) => !Array.isArray(d.activities) || d.activities.length === 0)
        .map((d: any) => d.dayNumber);
      issues.push(`shell days: ${emptyDayNumbers.join(', ')}`);
    }
    if (!dayCountMatches) issues.push(`day count ${updatedDays.length} < expected ${totalDays}`);
    if (!noFailedDays) issues.push(`failed days: ${failedDayNumbers.join(', ')}`);
    console.error(`[generate-trip-day] ⚠️ INCOMPLETE at chain end: ${issues.join('; ')}. Marking as partial.`);
  }

  const partialItinerary = {
    days: updatedDays,
    status: computedStatus,
    generatedAt: new Date().toISOString(),
  };

  // Progressive unlock
  const { data: metaTrip } = await supabase.from('trips').select('metadata, unlocked_day_count').eq('id', tripId).single();
  const meta = (metaTrip?.metadata as Record<string, unknown>) || {};
  const currentUnlocked = (metaTrip as any)?.unlocked_day_count ?? 0;
  let newUnlocked = Math.max(currentUnlocked, dayNumber);
  if (isFirstTrip) {
    newUnlocked = Math.min(newUnlocked, 2);
  }

  // LAYER 4: Verify last day exists when generation is complete
  if (dayNumber >= totalDays && startDate && endDate) {
    const lastExpectedDate = endDate;
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
      updatedDays.sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : (a.dayNumber || 0);
        const dateB = b.date ? new Date(b.date).getTime() : (b.dayNumber || 0);
        return dateA - dateB;
      });
      updatedDays.forEach((d: any, idx: number) => { d.dayNumber = idx + 1; });
      partialItinerary.days = updatedDays;
    }
    
    if (updatedDays.length !== totalDays) {
      console.error(`[generate-trip-day] ⚠️ Day count mismatch: got ${updatedDays.length}, expected ${totalDays}`);
    }
  }

  // PER-CITY STATUS: Mark city as 'generated' on last day of each city
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
    // All days complete — but only mark ready if all days have real activities
    const finalStatus = isComplete ? 'ready' : 'partial';
    const emptyDaysList = updatedDays
      .filter((d: any) => !Array.isArray(d.activities) || d.activities.length === 0)
      .map((d: any) => d.dayNumber);

    await supabase.from('trips').update({
      itinerary_data: partialItinerary,
      itinerary_status: finalStatus,
      unlocked_day_count: newUnlocked,
      metadata: {
        ...meta,
        generation_completed_days: isComplete ? totalDays : updatedDays.filter((d: any) => Array.isArray(d.activities) && d.activities.length > 0).length,
        generation_completed_at: new Date().toISOString(),
        generation_heartbeat: new Date().toISOString(),
        generation_total_days: totalDays,
        generation_current_city: null,
        chain_broken_at_day: isComplete ? null : emptyDaysList[0],
        chain_error: isComplete ? null : `Shell days detected: ${emptyDaysList.join(', ')} have 0 activities`,
        empty_days_at_completion: emptyDaysList.length > 0 ? emptyDaysList : null,
      },
    }).eq('id', tripId);

    // Record final day timing with category breakdown and finalize performance log
    const dayGenTotal = Date.now() - dayGenStart;
    const dayCategories: Record<string, number> = {};
    for (const act of (dayResult?.activities || [])) {
      const cat = (act.category || 'other').toLowerCase();
      dayCategories[cat] = (dayCategories[cat] || 0) + 1;
    }
    const diag1 = (dayResult as any)?.__diagnostics || {};
    timer.addDayTiming(
      dayNumber, dayGenTotal, diag1.aiCallMs || 0, diag1.enrichMs || 0,
      dayResult?.activities?.length || 0, dayCategories,
      diag1.meals || undefined, diag1.transport || undefined,
      undefined, diag1.llm || undefined,
    );
    timer.addTokenUsage(diag1.llm?.promptTokens || 0, diag1.llm?.completionTokens || 0, diag1.llm?.model);
    await timer.finalize(isComplete ? 'completed' : 'failed');

    console.log(`[generate-trip-day] ${isComplete ? '✅' : '⚠️'} Trip ${tripId} generation ${isComplete ? 'complete' : 'partial (failed/missing days)'}: ${totalDays} days, status=${finalStatus}`);

    // ── SYNC NORMALIZED TABLES on chain completion ──────────────────
    // This ensures itinerary_days + itinerary_activities stay in sync
    // with the JSON snapshot, preventing "Unplanned" days on reload.
    try {
      const { handleSyncItineraryTables } = await import('./action-sync-tables.ts');
      const syncCtx = { supabase, userId, params: { tripId } };
      const syncResult = await handleSyncItineraryTables(syncCtx);
      const syncBody = await syncResult.json().catch(() => null);
      if (syncBody && !syncBody.success) {
        console.error('[generate-trip-day] Post-completion table sync failed:', syncBody);
      } else {
        console.log(`[generate-trip-day] Post-completion table sync OK:`, syncBody);
      }
    } catch (syncErr) {
      console.error('[generate-trip-day] Post-completion table sync error (non-fatal):', syncErr);
    }

    await triggerNextJourneyLeg(supabase, tripId);

    console.log(`[generate-trip-day] 📤 Returning completion response for trip ${tripId} (day ${dayNumber}/${totalDays}). If client disconnected, data is already saved.`);
    return new Response(
      JSON.stringify({ status: 'complete', dayNumber, totalDays }),
      { headers: jsonHeaders }
    );
  } else {
    // More days remain — save progress and self-chain
    const nextCityName = dayCityMap?.[dayNumber]?.cityName || null;
    // Track used restaurants from this day's dining activities (normalized venue names)
    // Broadened: extract from title, venue_name, restaurant.name, AND location.name
    const { extractRestaurantVenueName } = await import('./generation-utils.ts');
    const newUsedRestaurants = [...usedRestaurants];
    const dayActivities = dayResult?.activities || [];
    const MEAL_RE_EXTRACT = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;
    for (const act of dayActivities) {
      const catLow = (act.category || '').toLowerCase();
      const typLow = (act.type || '').toLowerCase();
      const isDining = catLow === 'dining' || typLow === 'dining' || MEAL_RE_EXTRACT.test(act.title || '');
      if (!isDining) continue;
      // Extract from ALL venue-bearing fields
      const sources = [
        act.title,
        act.venue_name,
        act.restaurant?.name,
        act.location?.name,
      ].filter(Boolean);
      for (const src of sources) {
        const venueName = extractRestaurantVenueName(src);
        if (venueName && !newUsedRestaurants.some(u => extractRestaurantVenueName(u) === venueName)) {
          newUsedRestaurants.push(venueName);
        }
      }
    }
    // === SENDING TO NEXT DAY ===
    console.log('=== SENDING TO NEXT DAY ===');
    console.log(`Sending usedRestaurants (${newUsedRestaurants.length}):`, JSON.stringify(newUsedRestaurants));

    await supabase.from('trips').update({
      itinerary_data: partialItinerary,
      unlocked_day_count: newUnlocked,
      metadata: {
        ...meta,
        generation_completed_days: dayNumber,
        generation_heartbeat: new Date().toISOString(),
        generation_total_days: totalDays,
        generation_current_city: nextCityName,
        used_restaurants: newUsedRestaurants,
        generation_timeout_sentinel: null, // Clear sentinel on success
      },
    }).eq('id', tripId);

    // Record day timing with category breakdown
    const dayGenTotal = Date.now() - dayGenStart;
    const dayCats: Record<string, number> = {};
    for (const act of (dayResult?.activities || [])) {
      const cat = (act.category || 'other').toLowerCase();
      dayCats[cat] = (dayCats[cat] || 0) + 1;
    }
    const diag2 = (dayResult as any)?.__diagnostics || {};
    timer.addDayTiming(
      dayNumber, dayGenTotal, diag2.aiCallMs || 0, diag2.enrichMs || 0,
      dayResult?.activities?.length || 0, dayCats,
      diag2.meals || undefined, diag2.transport || undefined,
      undefined, diag2.llm || undefined,
    );
    timer.addTokenUsage(diag2.llm?.promptTokens || 0, diag2.llm?.completionTokens || 0, diag2.llm?.model);
    const progressPct = 5 + Math.round((dayNumber / totalDays) * 90);
    await timer.updateProgress(`Day ${dayNumber}/${totalDays} complete`, progressPct);

    console.log(`[generate-trip-day] Day ${dayNumber}/${totalDays} complete, chaining to day ${dayNumber + 1}`);

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
      generationLogId: generationLogId || timer.getLogId(),
    });

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

      try {
        const { data: currentTripData } = await supabase
          .from('trips')
          .select('metadata')
          .eq('id', tripId)
          .single();

        const currentMeta = (currentTripData?.metadata as Record<string, unknown>) || {};

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

    console.log(`[generate-trip-day] 📤 Returning chain response for day ${dayNumber}/${totalDays}. Data saved, next day chained. If client disconnected, generation continues server-side.`);
    return new Response(
      JSON.stringify({ status: 'day_complete', dayNumber, totalDays, nextDay: dayNumber + 1 }),
      { headers: jsonHeaders }
    );
  }
}
