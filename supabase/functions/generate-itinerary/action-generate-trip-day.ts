/**
 * ACTION: generate-trip-day — Generate a SINGLE day, then self-chain to next
 * 
 * Each invocation is its own short-lived function call (~60-90s max).
 * The chain continues server-side even if the user closes their browser.
 * 
 * Extracted from index.ts to prevent scope-leaking bugs.
 */

import { corsHeaders } from './action-types.ts';
import { parseTimeToMinutes, enforceArrivalTiming, enforceDepartureTiming } from './flight-hotel-context.ts';
import { GenerationTimer } from './generation-timer.ts';
import { deriveMealPolicy, type RequiredMeal } from './meal-policy.ts';
import { enforceRequiredMealsFinalGuard, detectMealSlots } from './day-validation.ts';
import { sanitizeGeneratedDay, stripPhantomHotelActivities, sanitizeAITextField, enforceMichelinPriceFloor, enforceTicketedAttractionPricing, enforceBarNightcapPriceCap, enforceCasualVenuePriceCap, enforceVenueTypePriceCap, KNOWN_FINE_DINING_STARS, FINE_DINING_MIN_PRICE_BY_STARS } from './sanitization.ts';
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
  if (dayNumber === totalDays) {
    console.log(`DEPARTURE DAY GENERATION: usedRestaurants contains ${usedRestaurants.length} entries:`, JSON.stringify(usedRestaurants));
  }
  // Get the pool for this day's city
  const dayCity = cityInfo?.cityName || destination || '';
  let restaurantPool: any[] = restaurantPoolByCity[dayCity] || [];
  // Also try partial match if exact city not found (including city aliases)
  if (restaurantPool.length === 0 && dayCity) {
    const dayCityLower = dayCity.toLowerCase();
    const POOL_CITY_ALIASES: Record<string, string[]> = {
      'lisbon': ['lisboa', 'lisbonne', 'lissabon'],
      'porto': ['oporto'],
      'barcelona': ['barcelone', 'barcellona'],
    };
    for (const [poolCity, pool] of Object.entries(restaurantPoolByCity)) {
      const poolCityLower = poolCity.toLowerCase();
      if (poolCityLower.includes(dayCityLower) || dayCityLower.includes(poolCityLower)) {
        restaurantPool = pool;
        break;
      }
      // Check aliases: if poolCity matches an alias of dayCityLower or vice versa
      for (const [canonical, aliases] of Object.entries(POOL_CITY_ALIASES)) {
        const allForms = [canonical, ...aliases];
        const poolMatches = allForms.some(f => poolCityLower.includes(f));
        const dayMatches = allForms.some(f => dayCityLower.includes(f));
        if (poolMatches && dayMatches) {
          restaurantPool = pool;
          break;
        }
      }
      if (restaurantPool.length > 0) break;
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

  // Build usedVenues from ALL previous days' venue-bearing fields (not capped)
  // This prevents cross-day attraction/museum duplicates like "Louvre Museum" on Day 2 AND Day 4
  const usedVenues: string[] = [];
  for (const day of existingDays) {
    for (const act of (day?.activities || [])) {
      const cat = (act.category || '').toUpperCase();
      if (['STAY', 'TRANSPORT', 'TRAVEL', 'LOGISTICS', 'FLIGHT', 'ACCOMMODATION'].includes(cat)) continue;
      // Collect from ALL venue-bearing fields for broad coverage
      const locName = (act.location && typeof act.location === 'object' ? String(act.location.name || '') : '').trim();
      const venueName = (act.venue_name || '').trim();
      const titleName = (act.title || '').trim();
      if (locName && locName.length > 3 && !/your hotel/i.test(locName)) usedVenues.push(locName);
      if (venueName && venueName.length > 3 && venueName !== locName && !/your hotel/i.test(venueName)) usedVenues.push(venueName);
      // Also extract venue name from title (e.g. "Morning at Palais-Royal Gardens" → "Palais-Royal Gardens")
      const stripped = titleName
        .replace(/^(?:morning|afternoon|evening|final|early|late|leisurely|scenic|guided)\s+(?:at|in|visit\s+to|stroll\s+(?:at|in|through)|walk\s+(?:at|in|through|around))\s+/i, '')
        .replace(/^(?:visit|explore|discover|stroll|walk|wander|tour|enjoy)\s+(?:at|in|through|around|along)?\s*/i, '')
        .replace(/\s+(?:stroll|walk|tour|visit|exploration)$/i, '')
        .trim();
      if (stripped && stripped.length > 3 && stripped !== locName && stripped !== venueName && !/your hotel/i.test(stripped)) {
        usedVenues.push(stripped);
      }
    }
  }
  if (usedVenues.length > 0) {
    console.log(`[generate-trip-day] usedVenues (${usedVenues.length}): ${usedVenues.slice(0, 10).join(', ')}${usedVenues.length > 10 ? '...' : ''}`);
  }

  // ── WELLNESS LIMITER: gather spa/wellness history from previous days ──
  const WELLNESS_KEYWORDS = /spa|hammam|wellness|massage|hydrotherapy|rejuvenation|thermal|sauna/i;
  const isWellnessActivity = (act: any) => {
    return (act.category || '').toLowerCase() === 'wellness' ||
      (act.category || '').toLowerCase() === 'relaxation' ||
      WELLNESS_KEYWORDS.test(act.title || '') ||
      WELLNESS_KEYWORDS.test(act.description || '');
  };
  const previousWellnessDays: number[] = [];
  for (let i = 0; i < existingDays.length; i++) {
    const day = existingDays[i];
    if (day?.activities?.some((a: any) => isWellnessActivity(a))) {
      previousWellnessDays.push(i + 1); // 1-indexed day number
    }
  }
  const yesterdayHadWellness = previousWellnessDays.includes(dayNumber - 1);
  const wellnessAtLimit = previousWellnessDays.length >= 2;
  let wellnessInstruction = '';
  if (wellnessAtLimit) {
    wellnessInstruction = 'This trip already has 2 spa/wellness activities. Do NOT add any more spa, wellness, massage, hammam, or similar activities.';
  } else if (yesterdayHadWellness) {
    wellnessInstruction = `Yesterday (Day ${dayNumber - 1}) already had a spa/wellness activity. Do NOT add spa or wellness today — never on consecutive days.`;
  } else if (previousWellnessDays.length > 0) {
    wellnessInstruction = `Previous days with spa/wellness: Day ${previousWellnessDays.join(', Day ')}. Maximum 2 allowed for the entire trip.`;
  } else {
    wellnessInstruction = 'No spa/wellness activities yet on this trip. Up to 2 are allowed across the entire trip, never on consecutive days.';
  }
  if (previousWellnessDays.length > 0) {
    console.log(`[generate-trip-day] Wellness history: days [${previousWellnessDays.join(', ')}], limit=${wellnessAtLimit}, yesterday=${yesterdayHadWellness}`);
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
            usedVenues: usedVenues.length > 0 ? usedVenues : undefined,
            wellnessInstruction: wellnessInstruction || undefined,
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

  // ── HALLUCINATION FILTER — remove known fake restaurants and dining with bogus addresses ──
  if (Array.isArray(dayResult?.activities)) {
    const BLOCKED_RESTAURANT_NAMES = [
      'trattoria del corso', 'café lumière', 'cafe lumiere',
      'ristorante della piazza', 'la belle époque bistro',
      'ristorante la luna', 'osteria del porto', 'osteria della sera',
      'taverna centrale', 'taverna nocturna', 'palazzo del gusto',
      'casa del gusto', 'casa nostra', 'cucina del mercato',
      'ristorante vecchia', 'tavola calda', 'cantina verde',
      'enoteca del corso', 'bar luminoso', 'bar centrale',
      'table du quartier',
    ];
    const FAKE_ADDRESS_PATTERNS = [
      /^the destination$/i, /^your destination$/i, /^the city$/i,
      /^paris$/i, /^rome$/i, /^berlin$/i, /^tokyo$/i, /^london$/i,
      /^[a-z\s]+,?\s*(france|italy|germany|japan|spain|uk)?$/i,
    ];
    const beforeFilter = dayResult.activities.length;
    dayResult.activities = dayResult.activities.filter((act: any) => {
      const cat = (act.category || '').toLowerCase();
      if (cat !== 'dining' && cat !== 'restaurant' && cat !== 'food') return true;
      const name = (act.venueName || act.title || '').toLowerCase().trim();
      for (const blocked of BLOCKED_RESTAURANT_NAMES) {
        if (name.includes(blocked)) {
          console.log(`[HALLUCINATION FILTER] Removed blocked restaurant: ${name}`);
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
    if (dayResult.activities.length < beforeFilter) {
      console.log(`[HALLUCINATION FILTER] Day ${dayNumber}: removed ${beforeFilter - dayResult.activities.length} fake restaurants`);
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

    const beforeFiller = dayResult.activities.length;
    dayResult.activities = dayResult.activities.filter((act: any) => {
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
    if (dayResult.activities.length < beforeFiller) {
      console.log(`[FILLER FILTER] Day ${dayNumber}: removed ${beforeFiller - dayResult.activities.length} filler activities`);
    }
  }

  // ── WELLNESS LIMITER: post-generation enforcement ──
  if (wellnessAtLimit || yesterdayHadWellness) {
    const beforeWellness = dayResult.activities.length;
    dayResult.activities = dayResult.activities.filter((a: any) => {
      if (isWellnessActivity(a)) {
        console.log(`[WELLNESS LIMITER] Removed "${a.title}" — ${wellnessAtLimit ? 'trip limit (2) reached' : 'consecutive day with yesterday'}`);
        return false;
      }
      return true;
    });
    if (dayResult.activities.length < beforeWellness) {
      console.log(`[WELLNESS LIMITER] Day ${dayNumber}: removed ${beforeWellness - dayResult.activities.length} wellness activities`);
    }
  }

  // ── DEPARTURE DAY CUTOFF — remove activities too close to departure ──
  if (_isLastDay && savedDepTime24Hoisted && Array.isArray(dayResult?.activities)) {
    const depMatch = savedDepTime24Hoisted.match(/(\d{1,2}):(\d{2})/);
    if (depMatch) {
      const depMinutes = parseInt(depMatch[1]) * 60 + parseInt(depMatch[2]);
      const transportType = (departureTransportType || 'flight').toLowerCase();
      const bufferMin = transportType.includes('train') ? 120 : 180;
      const cutoff = depMinutes - bufferMin;
      const beforeDep = dayResult.activities.length;
      dayResult.activities = dayResult.activities.filter((act: any) => {
        const title = (act.title || '').toLowerCase();
        if (title.includes('checkout') || title.includes('check-out') || title.includes('heading home') || title.includes('departure') || title.includes('transfer to') || title.includes('airport') || title.includes('station')) {
          return true;
        }
        const startMatch = (act.startTime || '').match(/(\d{1,2}):(\d{2})/);
        if (!startMatch) return true;
        const startMin = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
        if (startMin >= cutoff) {
          console.log(`[DEPARTURE CUTOFF] Removed activity too close to departure: "${act.title}" at ${act.startTime} (cutoff: ${Math.floor(cutoff/60)}:${String(cutoff%60).padStart(2,'0')})`);
          return false;
        }
        return true;
      });
      if (dayResult.activities.length < beforeDep) {
        console.log(`[DEPARTURE CUTOFF] Day ${dayNumber}: removed ${beforeDep - dayResult.activities.length} activities after cutoff`);
      }
    }
  }

  // ── CROSS-DAY VENUE DEDUP SAFETY NET — remove non-dining activities that repeat a previous day's venue ──
  if (usedVenues.length > 0 && Array.isArray(dayResult?.activities)) {
    const normalizeVenue = (s: string) => s.toLowerCase().replace(/[''`]/g, "'").replace(/\s+/g, ' ').trim();
    const prevVenuesNorm = usedVenues.map(normalizeVenue);
    const beforeVenueDedup = dayResult.activities.length;
    dayResult.activities = dayResult.activities.filter((act: any) => {
      const cat = (act.category || '').toLowerCase();
      if (cat === 'dining' || cat === 'restaurant' || cat === 'food') return true; // dining has its own dedup
      if (cat === 'accommodation' || cat === 'transport' || cat === 'logistics') return true;
      const vName = normalizeVenue(act.venueName || act.title || '');
      const locName = normalizeVenue(
        typeof act.location === 'object' ? (act.location?.name || '') : ''
      );
      const isDuplicate = prevVenuesNorm.some(prev => {
        if (prev.length < 4) return false;
        return vName.includes(prev) || prev.includes(vName) ||
               (locName && (locName.includes(prev) || prev.includes(locName)));
      });
      if (isDuplicate) {
        console.log(`[VENUE DEDUP FILTER] Removed cross-day duplicate: "${act.title}" (already visited on a previous day)`);
        return false;
      }
      return true;
    });
    if (dayResult.activities.length < beforeVenueDedup) {
      console.log(`[VENUE DEDUP FILTER] Day ${dayNumber}: removed ${beforeVenueDedup - dayResult.activities.length} cross-day duplicate venues`);
    }
  }


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

  // ── SHARED FLIGHT TIMING — hoisted so terminal cleanup can access ──
  const _flightSel = (tripCheck?.flight_selection as Record<string, any>) || {};
  const _nestedDep = _flightSel.departure as Record<string, any> | undefined;
  const _nestedRet = _flightSel.return as Record<string, any> | undefined;
  const _isFirstDay = dayNumber === 1;
  const _isLastDay = dayNumber >= totalDays;

  const { normalizeTo24h: _normalizeTo24h } = await import('./flight-hotel-context.ts');
  const _arrTime24Raw = _isFirstDay
    ? (_flightSel.arrivalTime24
      || _flightSel.arrivalTime
      || _flightSel.outbound?.arrivalTime
      || _nestedDep?.arrival?.time
      || _flightSel.legs?.[0]?.arrival?.time
      || undefined)
    : undefined;
  const savedArrTime24Hoisted = _arrTime24Raw ? _normalizeTo24h(_arrTime24Raw) : undefined;

  const _depTime24Raw = _isLastDay
    ? (_flightSel.returnDepartureTime24
      || _flightSel.returnDepartureTime
      || _nestedRet?.departure?.time
      || _nestedRet?.departureTime
      || (Array.isArray(_flightSel.legs) && _flightSel.legs.length > 0 ? _flightSel.legs[_flightSel.legs.length - 1]?.departure?.time : undefined)
      || undefined)
    : undefined;
  const savedDepTime24Hoisted = _depTime24Raw ? _normalizeTo24h(_depTime24Raw) : undefined;

  // Detect departure transport type (train vs flight) for buffer sizing
  const departureTransportType: string | undefined = _isLastDay
    ? (_nestedRet?.type as string
      || _flightSel.returnTransportType as string
      || (_nestedRet?.flightNumber && /train|tgv|eurostar|thalys|ice|rail/i.test(_nestedRet.flightNumber as string) ? 'train' : undefined)
      || (Array.isArray(_flightSel.legs) && _flightSel.legs.length > 0
        ? (() => {
            const lastLeg = _flightSel.legs[_flightSel.legs.length - 1];
            const depLeg = _flightSel.legs.find((l: any) => l.isDestinationDeparture) || lastLeg;
            if (depLeg?.type) return depLeg.type as string;
            if (/train|tgv|eurostar|thalys|ice|rail/i.test(depLeg?.flightNumber || '')) return 'train';
            if (/train|rail/i.test(depLeg?.airline || '')) return 'train';
            return undefined;
          })()
        : undefined)
      || undefined)
    : undefined;

  // ── PIPELINE VALIDATE + REPAIR (same guarantees as single-day path) ──
  {
    try {
      const { validateDay } = await import('./pipeline/validate-day.ts');
      const { repairDay } = await import('./pipeline/repair-day.ts');
      const { deriveMealPolicy } = await import('./meal-policy.ts');
      const { normalizeTo24h } = await import('./flight-hotel-context.ts');

      const flightSel = _flightSel;
      const isFirstDay = _isFirstDay;
      const isLastDay = _isLastDay;

      // Use hoisted values
      const nestedDep = _nestedDep;
      const nestedRet = _nestedRet;
      const arrTime24Raw = _arrTime24Raw;
      const arrTime24 = savedArrTime24Hoisted;

      const depTime24Raw = _depTime24Raw;
      const depTime24 = savedDepTime24Hoisted;

      if (isFirstDay) console.log(`[generate-trip-day] Day ${dayNumber} arrival time: ${arrTime24 || 'NONE'} (raw: ${arrTime24Raw || 'none found'})`);
      if (isLastDay) console.log(`[generate-trip-day] Day ${dayNumber} departure time: ${depTime24 || 'NONE'} (raw: ${depTime24Raw || 'none found'}) transportType: ${departureTransportType || 'flight'}`);

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
        destination: cityInfo?.cityName || destination,
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

    // ARRIVAL/DEPARTURE timing now handled by universalQualityPass below
  }

  // POST-GENERATION: Enforce cross-day restaurant uniqueness
  if (dayResult?.activities?.length > 0) {
    const { extractRestaurantVenueName, venueMatchesAny, normalizeVenueName } = await import('./generation-utils.ts');
    const usedNorm = new Set(usedRestaurants.map(n => extractRestaurantVenueName(n)));
    const MEAL_RE = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;

    for (let i = 0; i < dayResult.activities.length; i++) {
      const act = dayResult.activities[i];
      const cat = (act.category || '').toLowerCase();
      const typ = (act.type || '').toLowerCase();
      const isDining = cat === 'dining' || typ === 'dining' || MEAL_RE.test(act.title || '');
      if (!isDining) continue;

      // Check ALL venue-bearing fields for fuzzy match
      const venue = extractRestaurantVenueName(act.title || '') ||
                    extractRestaurantVenueName(act.venue_name || '') ||
                    extractRestaurantVenueName(act.restaurant?.name || '') ||
                    extractRestaurantVenueName(act.location?.name || '');
      if (!venue || !venueMatchesAny(venue, usedNorm)) continue;

      // Find a replacement from the pool that hasn't been used
      const replacement = restaurantPool.find(r => {
        const rNorm = extractRestaurantVenueName(r.name || r.title || '');
        return rNorm && !venueMatchesAny(rNorm, usedNorm);
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
        // ZERO-TOLERANCE: No replacement available — but NEVER remove primary meals
        const isPrimaryMeal = /\b(?:breakfast|lunch|dinner|brunch)\b/i.test(act.title || '');
        if (isPrimaryMeal) {
          console.warn(`[generate-trip-day] ⚠️ CROSS-DAY DEDUP: "${act.title}" repeats but is PRIMARY MEAL — KEEPING (duplicate > missing meal)`);
        } else {
          console.warn(`[generate-trip-day] 🚫 CROSS-DAY DEDUP: "${act.title}" repeats with no replacement — REMOVING`);
          dayResult.activities[i] = null; // Mark for removal
        }
      }
    }
    // Filter out nulled (removed) activities
    dayResult.activities = dayResult.activities.filter((a: any) => a !== null);
  }

  // ── UNIVERSAL QUALITY PASS — timing, pricing, non-dining dedup, hotel return ──
  if (dayResult?.activities?.length > 0) {
    const { universalQualityPass } = await import('./universal-quality-pass.ts');
    const usedVenueSet = new Set(usedVenues.map(v => v.toLowerCase()));
    dayResult.activities = await universalQualityPass(dayResult.activities, {
      city: cityInfo?.cityName || destination,
      country: destinationCountry || '',
      dnaTier: tripType || 'Explorer',
      dnaArchetype: '',
      dayIndex: dayNumber - 1,
      totalDays,
      usedVenueNames: usedVenueSet,
      arrivalTime: _isFirstDay ? savedArrTime24Hoisted : undefined,
      departureTime: _isLastDay ? savedDepTime24Hoisted : undefined,
      departureTransportType: _isLastDay ? departureTransportType : undefined,
      dayTitle: dayResult?.theme || dayResult?.title,
      budgetTier: budgetTier || 'moderate',
      apiKey: Deno.env.get("LOVABLE_API_KEY") || undefined,
      lockedActivities: [],
      usedRestaurants: usedRestaurants,
    });
    // Sync usedVenues back from the Set for subsequent days
    for (const v of usedVenueSet) {
      if (!usedVenues.includes(v)) usedVenues.push(v);
    }
  }

  // NOTE: Minimum duration enforcement and timing overlap resolution are now
  // handled exclusively by pipeline/repair-day.ts to prevent cascading shifts.
  // The 68G inline blocks were removed to fix the AM/PM timing collapse bug.

  // === TITLE CLEANUP: Fix orphaned articles like "The of Light" ===
  if (dayResult?.title) {
    // Fix "The of X" → "The City of X", "A Day of X" patterns with missing nouns
    dayResult.title = dayResult.title
      .replace(/\bThe\s+of\s+/g, 'The City of ')
      .replace(/\bA\s+of\s+/g, 'A Day of ')
      .trim();
  }

  // === POST-REPAIR: Collapse consecutive transport cards (safety net) ===
  if (dayResult?.activities?.length >= 2) {
    const transportRe = /^travel\s+to\b|^transit\s+to\b|^transfer\s+to\b|^drive\s+to\b|^ride\s+to\b/i;
    let collapsed = 0;
    for (let i = dayResult.activities.length - 2; i >= 0; i--) {
      const curr = dayResult.activities[i];
      const next = dayResult.activities[i + 1];
      const currCat = (curr.category || curr.type || '').toLowerCase();
      const nextCat = (next.category || next.type || '').toLowerCase();
      const currIsTransport = currCat === 'transport' || currCat === 'travel' || transportRe.test(curr.title || '');
      const nextIsTransport = nextCat === 'transport' || nextCat === 'travel' || transportRe.test(next.title || '');
      if (currIsTransport && nextIsTransport) {
        console.log(`[post-repair] Collapsing consecutive transports: "${curr.title}" + "${next.title}"`);
        dayResult.activities.splice(i, 1);
        collapsed++;
      }
    }
    if (collapsed > 0) {
      console.log(`[post-repair] Collapsed ${collapsed} consecutive transport card(s)`);
    }
  }

  // === DUPLICATE HOTEL RETURN REMOVAL ===
  if (dayResult.activities?.length >= 2) {
    for (let i = dayResult.activities.length - 2; i >= 0; i--) {
      const curr = dayResult.activities[i];
      const next = dayResult.activities[i + 1];
      const currTitle = (curr.title || '').toLowerCase();
      const nextTitle = (next.title || '').toLowerCase();
      const currIsHotelReturn = currTitle.includes('return to your hotel') || currTitle.includes('return to hotel') || currTitle.includes('back to your hotel');
      const nextIsHotelReturn = nextTitle.includes('return to your hotel') || nextTitle.includes('return to hotel') || nextTitle.includes('back to your hotel');
      if (currIsHotelReturn && nextIsHotelReturn) {
        if ((curr.category || '').toLowerCase() === 'stay') {
          console.log(`[DEDUP] Removed duplicate hotel return: "${next.title}" (${next.category})`);
          dayResult.activities.splice(i + 1, 1);
        } else {
          console.log(`[DEDUP] Removed duplicate hotel return: "${curr.title}" (${curr.category})`);
          dayResult.activities.splice(i, 1);
        }
      }
    }
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

  // ── HOTEL ADDRESS CONSISTENCY PASS (trip-wide) ──────────────────
  // After all days are assembled, enforce that every accommodation card
  // for a given hotel uses the same canonical address. Source of truth:
  // hotel_selection data > majority observed address.
  {
    const normalizeHotelKey = (name: string): string =>
      name.toLowerCase()
        .replace(/\b(hotel|resort|suites?|inn|lodge|palace|palácio|boutique|luxury|the|a)\b/gi, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ').trim();

    // Build canonical address map from hotel_selection (highest confidence)
    const canonicalAddresses = new Map<string, string>();
    for (const h of hotelList) {
      if (h?.name && h?.address) {
        canonicalAddresses.set(normalizeHotelKey(h.name), h.address);
      }
    }

    // Also check multi-city hotel selections
    if (dayCityMap) {
      for (const ci of dayCityMap) {
        if (ci.hotelName && ci.hotelAddress) {
          canonicalAddresses.set(normalizeHotelKey(ci.hotelName), ci.hotelAddress);
        }
      }
    }

    const ACCOM_RE = /\b(check.?in|check.?out|checkout|freshen\s*up|return\s+to|luggage\s+drop|settle\s+in|back\s+to)\b/i;

    // Pass 1: If no canonical from hotel_selection, build from majority vote
    const addressCounts = new Map<string, Map<string, number>>();
    for (const day of updatedDays) {
      for (const act of (day.activities || [])) {
        if ((act.category || '').toLowerCase() !== 'accommodation') continue;
        if (!ACCOM_RE.test(act.title || act.name || '')) continue;
        const locName = act.location?.name || '';
        if (!locName) continue;
        const key = normalizeHotelKey(locName);
        if (!key || key.length < 3) continue;
        const addr = act.location?.address || '';
        if (!addr) continue;
        if (!addressCounts.has(key)) addressCounts.set(key, new Map());
        const counts = addressCounts.get(key)!;
        counts.set(addr, (counts.get(addr) || 0) + 1);
      }
    }
    for (const [key, counts] of addressCounts) {
      if (canonicalAddresses.has(key)) continue; // hotel_selection takes precedence
      let bestAddr = '';
      let bestCount = 0;
      for (const [addr, count] of counts) {
        if (count > bestCount) { bestAddr = addr; bestCount = count; }
      }
      if (bestAddr) canonicalAddresses.set(key, bestAddr);
    }

    // Pass 2: Enforce canonical addresses
    let addressFixCount = 0;
    for (const day of updatedDays) {
      for (const act of (day.activities || [])) {
        if ((act.category || '').toLowerCase() !== 'accommodation') continue;
        if (!ACCOM_RE.test(act.title || act.name || '')) continue;
        const locName = act.location?.name || '';
        if (!locName) continue;
        const key = normalizeHotelKey(locName);
        if (!key || key.length < 3) continue;
        const correctAddr = canonicalAddresses.get(key);
        if (!correctAddr) continue;
        const currentAddr = act.location?.address || '';
        if (currentAddr !== correctAddr) {
          console.warn(`HOTEL ADDRESS CONSISTENCY FIX: "${act.title}" (Day ${day.dayNumber}) address "${currentAddr}" → "${correctAddr}"`);
          if (!act.location) act.location = { name: locName, address: correctAddr };
          else act.location.address = correctAddr;
          addressFixCount++;
        }
      }
    }
    if (addressFixCount > 0) {
      console.log(`[generate-trip-day] Hotel address consistency: fixed ${addressFixCount} address(es)`);
    }
  }


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
  // Extract flight times — check all known flight_selection shapes
  const flightSel = (tripCheck?.flight_selection as Record<string, any>) || null;
  const nestedDepSaved = flightSel?.departure as Record<string, any> | undefined;
  const nestedRetSaved = flightSel?.return as Record<string, any> | undefined;
  let savedArrivalTime24: string | undefined =
    flightSel?.arrivalTime24 || flightSel?.arrivalTime || flightSel?.outbound?.arrivalTime
    || nestedDepSaved?.arrival?.time
    || flightSel?.legs?.[0]?.arrival?.time
    || undefined;
  const savedDepartureTime24: string | undefined =
    flightSel?.returnDepartureTime24 || flightSel?.returnDepartureTime
    || nestedRetSaved?.departure?.time || nestedRetSaved?.departureTime
    || (Array.isArray(flightSel?.legs) && flightSel.legs.length > 0 ? flightSel.legs[flightSel.legs.length - 1]?.departure?.time : undefined)
    || undefined;

  // FALLBACK: If arrival time is missing from flight_selection, extract from repair-injected flight card on Day 1
  if (!savedArrivalTime24 && updatedDays.length > 0) {
    const day1 = updatedDays[0];
    const repairFlight = (day1?.activities || []).find((a: any) =>
      a.source === 'repair-arrival-flight' || a.source === 'injected-arrival-flight' ||
      ((a.category || '').toLowerCase() === 'flight' && (a.title || '').toLowerCase().includes('arrival'))
    );
    if (repairFlight) {
      const endTime = repairFlight.endTime || repairFlight.end_time;
      if (endTime) {
        savedArrivalTime24 = endTime;
        console.log(`[generate-trip-day] ✈️ Extracted arrival time ${endTime} from repair-injected flight card`);
      }
    }
  }

  for (let i = 0; i < updatedDays.length; i++) {
    const d = updatedDays[i];
    if (!d?.activities || !Array.isArray(d.activities)) continue;
    const dn = d.dayNumber || (i + 1);
    const isFirstDayLoop = dn === 1;
    const isLastDayLoop = dn === totalDays;
    const policy = deriveMealPolicy({
      dayNumber: dn,
      totalDays,
      isFirstDay: isFirstDayLoop,
      isLastDay: isLastDayLoop,
      arrivalTime24: isFirstDayLoop ? savedArrivalTime24 : undefined,
      departureTime24: isLastDayLoop ? savedDepartureTime24 : undefined,
    });
    if (policy.requiredMeals.length === 0) continue;
    const detected = detectMealSlots(d.activities);
    const missing = policy.requiredMeals.filter((m: RequiredMeal) => !detected.includes(m));

    // Compute timing window
    const arrMinsLoop = isFirstDayLoop && savedArrivalTime24 ? (() => { const m = savedArrivalTime24.match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : undefined; })() : undefined;
    const depMinsLoop = isLastDayLoop && savedDepartureTime24 ? (() => { const m = savedDepartureTime24.match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) - 180 : undefined; })() : undefined;

    if (missing.length > 0) {
      const dest = d.city || cityInfo?.cityName || destination || 'the destination';
      const result = enforceRequiredMealsFinalGuard(d.activities, policy.requiredMeals, dn, dest, 'USD', policy.dayMode, fallbackVenues, { earliestTimeMins: arrMinsLoop, latestTimeMins: depMinsLoop });
      if (!result.alreadyCompliant) {
        updatedDays[i] = { ...d, activities: result.activities };
        console.warn(`[generate-trip-day] 🍽️ MEAL GUARD: Day ${dn} missing [${result.injectedMeals.join(', ')}] — injected before chain save`);
      }
    }

    // Terminal cleanup for each day
    try {
      const { terminalCleanup } = await import('./universal-quality-pass.ts');
      terminalCleanup(updatedDays[i].activities, {
        arrivalTime24: isFirstDayLoop ? savedArrivalTime24 : undefined,
        departureTime24: isLastDayLoop ? savedDepartureTime24 : undefined,
        departureTransportType: isLastDayLoop ? departureTransportType : undefined,
        city: d.city || cityInfo?.cityName || destination,
        dayNumber: dn,
        isFirstDay: isFirstDayLoop,
        isLastDay: isLastDayLoop,
      });
    } catch (_e) { /* non-blocking */ }
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

  // ── CROSS-DAY PRICE CONSISTENCY CHECK ──
  // If same restaurant appears on multiple days, normalize to higher price
  if (updatedDays.length > 1) {
    const restaurantPrices = new Map<string, { price: number; dayIndex: number }>();
    const { extractRestaurantVenueName: extractVenuePrice } = await import('./generation-utils.ts');
    const MEAL_RE_PRICE = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;

    for (let di = 0; di < updatedDays.length; di++) {
      const day = updatedDays[di];
      if (!Array.isArray(day.activities)) continue;
      for (const act of day.activities) {
        const cat = (act.category || '').toLowerCase();
        const isDining = cat === 'dining' || MEAL_RE_PRICE.test(act.title || '');
        if (!isDining) continue;
        const venue = extractVenuePrice(act.title || '') ||
                      extractVenuePrice(act.venue_name || '') ||
                      extractVenuePrice(act.restaurant?.name || '') ||
                      extractVenuePrice(act.location?.name || '');
        if (!venue) continue;
        const price = act.estimatedCost?.amount ?? act.estimated_price_per_person ?? act.price ?? 0;
        if (restaurantPrices.has(venue)) {
          const existing = restaurantPrices.get(venue)!;
          console.warn(`PRICE INCONSISTENCY: "${venue}" is €${existing.price}/pp on Day ${existing.dayIndex + 1} but €${price}/pp on Day ${di + 1}. Using higher price €${Math.max(existing.price, price)}.`);
          const consistentPrice = Math.max(existing.price, price);
          if (act.estimatedCost) act.estimatedCost.amount = consistentPrice;
          if (act.estimated_price_per_person !== undefined) act.estimated_price_per_person = consistentPrice;
          if (act.price !== undefined) act.price = consistentPrice;
        } else {
          restaurantPrices.set(venue, { price, dayIndex: di });
        }
      }
    }
  }

  // ── CROSS-DAY RESTAURANT DEDUP FAILSAFE (with replacement + meal protection) ──
  // Runs on ALL completions (including last day) to catch any duplicates.
  // Instead of blindly removing duplicates, attempts a fallback replacement first.
  if (updatedDays.length > 1) {
    const { extractRestaurantVenueName, venueMatchesAny } = await import('./generation-utils.ts');
    const MEAL_RE_FAILSAFE = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;
    const PRIMARY_MEAL_RE = /\b(?:breakfast|lunch|dinner|brunch)\b/i;
    const allUsedRestaurants = new Set<string>();
    let totalReplaced = 0;
    let totalRemoved = 0;

    // City-aware fallback restaurants for replacement when pool is exhausted
    const FAILSAFE_FALLBACKS: Record<string, Record<string, { name: string; neighborhood: string; address: string }[]>> = {
      'lisbon': {
        breakfast: [
          { name: 'Heim Café', neighborhood: 'Chiado', address: 'R. de Santos-o-Velho 2, Lisbon' },
          { name: 'Copenhagen Coffee Lab', neighborhood: 'Chiado', address: 'R. Nova da Piedade 10, Lisbon' },
          { name: 'Hello Kristof', neighborhood: 'Príncipe Real', address: 'R. do Poço dos Negros 103, Lisbon' },
          { name: 'The Mill', neighborhood: 'Santos', address: 'R. do Poço dos Negros 1, Lisbon' },
          { name: 'Nicolau Lisboa', neighborhood: 'Rossio', address: 'R. de São Nicolau 17, Lisbon' },
          { name: 'Dear Breakfast', neighborhood: 'Estrela', address: 'R. de São Marçal 62, Lisbon' },
        ],
        lunch: [
          { name: 'Ponto Final', neighborhood: 'Cacilhas', address: 'R. do Ginjal 72, Almada' },
          { name: 'O Velho Eurico', neighborhood: 'Alfama', address: 'Largo de São Cristóvão 3, Lisbon' },
          { name: 'A Cevicheria', neighborhood: 'Príncipe Real', address: 'R. Dom Pedro V 129, Lisbon' },
          { name: 'Café de São Bento', neighborhood: 'São Bento', address: 'R. de São Bento 212, Lisbon' },
          { name: 'Mercado da Ribeira', neighborhood: 'Cais do Sodré', address: 'Av. 24 de Julho 49, Lisbon' },
          { name: 'Cervejaria Trindade', neighborhood: 'Bairro Alto', address: 'R. Nova da Trindade 20C, Lisbon' },
          { name: 'Solar dos Presuntos', neighborhood: 'Restauradores', address: 'R. das Portas de Santo Antão 150, Lisbon' },
        ],
        dinner: [
          { name: 'Sacramento do Chiado', neighborhood: 'Chiado', address: 'R. do Sacramento 26, Lisbon' },
          { name: 'Sea Me', neighborhood: 'Chiado', address: 'R. do Loreto 21, Lisbon' },
          { name: 'Mini Bar Teatro', neighborhood: 'Chiado', address: 'R. António Maria Cardoso 58, Lisbon' },
          { name: 'Pharmácia', neighborhood: 'Santa Catarina', address: 'R. Marechal Saldanha 1, Lisbon' },
          { name: 'Tasca do Chico', neighborhood: 'Alfama', address: 'R. dos Remédios 83, Lisbon' },
        ],
      },
      'porto': {
        breakfast: [
          { name: 'Mesa 325', neighborhood: 'Ribeira', address: 'R. de Santa Catarina 325, Porto' },
          { name: 'Combi Coffee Roasters', neighborhood: 'Cedofeita', address: 'R. de Passos Manuel 27, Porto' },
        ],
        lunch: [
          { name: 'Cantinho do Avillez', neighborhood: 'Ribeira', address: 'R. de Mouzinho da Silveira 166, Porto' },
          { name: 'Café Santiago', neighborhood: 'Baixa', address: 'R. de Passos Manuel 226, Porto' },
        ],
        dinner: [
          { name: 'Pedro Lemos', neighborhood: 'Foz', address: 'R. do Padre Luís Cabral 974, Porto' },
          { name: 'Cafeína', neighborhood: 'Foz do Douro', address: 'R. do Padrão 100, Porto' },
        ],
      },
      'barcelona': {
        breakfast: [
          { name: 'Federal Café', neighborhood: 'Gòtic', address: 'Passatge de la Pau 11, Barcelona' },
          { name: 'Flax & Kale', neighborhood: 'Raval', address: 'C/ dels Tallers 74B, Barcelona' },
        ],
        lunch: [
          { name: 'Can Culleretes', neighborhood: 'Gòtic', address: "C/ d'en Quintana 5, Barcelona" },
          { name: 'La Pepita', neighborhood: 'Gràcia', address: 'C/ de Còrsega 343, Barcelona' },
        ],
        dinner: [
          { name: 'Tickets', neighborhood: 'Poble-sec', address: 'Av. del Paral·lel 164, Barcelona' },
          { name: 'Can Paixano', neighborhood: 'Barceloneta', address: 'C/ de la Reina Cristina 7, Barcelona' },
        ],
      },
      'paris': {
        breakfast: [
          { name: 'Café de Flore', neighborhood: 'Saint-Germain', address: '172 Bd Saint-Germain, 75006 Paris' },
          { name: 'Claus Paris', neighborhood: 'Louvre', address: '14 Rue Jean-Jacques Rousseau, 75001 Paris' },
          { name: 'Ob-La-Di', neighborhood: 'Marais', address: '54 Rue de Saintonge, 75003 Paris' },
          { name: 'Holybelly 5', neighborhood: 'Canal Saint-Martin', address: '5 Rue Lucien Sampaix, 75010 Paris' },
          { name: 'Café Kitsuné', neighborhood: 'Palais Royal', address: '2 Rue de Richelieu, 75001 Paris' },
          { name: 'Season', neighborhood: 'Opéra', address: '1 Rue Charles V, 75004 Paris' },
        ],
        lunch: [
          { name: 'Chez Janou', neighborhood: 'Marais', address: '2 Rue Roger Verlomme, 75003 Paris' },
          { name: 'Bouillon Chartier', neighborhood: 'Grands Boulevards', address: '7 Rue du Faubourg Montmartre, 75009 Paris' },
          { name: 'Le Comptoir du Panthéon', neighborhood: 'Latin Quarter', address: '5 Rue Soufflot, 75005 Paris' },
        ],
        dinner: [
          { name: 'Le Bouillon Julien', neighborhood: 'Strasbourg-Saint-Denis', address: '16 Rue du Faubourg Saint-Denis, 75010 Paris' },
          { name: 'Chez L\'Ami Jean', neighborhood: 'Invalides', address: '27 Rue Malar, 75007 Paris' },
          { name: 'Le Baratin', neighborhood: 'Belleville', address: '3 Rue Jouye-Rouve, 75020 Paris' },
        ],
      },
      'berlin': {
        breakfast: [
          { name: 'House of Small Wonder', neighborhood: 'Mitte', address: 'Johannisstraße 20, 10117 Berlin' },
          { name: 'Two and Two', neighborhood: 'Kreuzberg', address: 'Graefestraße 2, 10967 Berlin' },
          { name: 'Father Carpenter', neighborhood: 'Mitte', address: 'Münzstraße 21, 10178 Berlin' },
          { name: 'Café Fleury', neighborhood: 'Mitte', address: 'Weinbergsweg 20, 10119 Berlin' },
          { name: 'Benedict Berlin', neighborhood: 'Charlottenburg', address: 'Uhlandstraße 49, 10719 Berlin' },
        ],
        lunch: [
          { name: 'Monsieur Vuong', neighborhood: 'Mitte', address: 'Alte Schönhauser Str. 46, 10119 Berlin' },
          { name: 'Markthalle Neun', neighborhood: 'Kreuzberg', address: 'Eisenbahnstraße 42/43, 10997 Berlin' },
        ],
        dinner: [
          { name: 'Nobelhart & Schmutzig', neighborhood: 'Kreuzberg', address: 'Friedrichstraße 218, 10969 Berlin' },
          { name: 'Eins44', neighborhood: 'Neukölln', address: 'Elbestraße 28/29, 12045 Berlin' },
        ],
      },
      'rome': {
        breakfast: [
          { name: 'Sciascia Caffè', neighborhood: 'Prati', address: 'Via Fabio Massimo 80, 00192 Roma' },
          { name: 'Roscioli Caffè', neighborhood: 'Centro Storico', address: 'Piazza Benedetto Cairoli 16, 00186 Roma' },
          { name: 'Faro - Luminaries of Coffee', neighborhood: 'Trastevere', address: 'Via Piave 55, 00185 Roma' },
          { name: 'Antico Caffè Greco', neighborhood: 'Spagna', address: 'Via dei Condotti 86, 00187 Roma' },
          { name: 'Bar del Fico', neighborhood: 'Navona', address: 'Piazza del Fico 26, 00186 Roma' },
        ],
        lunch: [
          { name: 'Tonnarello', neighborhood: 'Trastevere', address: 'Via della Paglia 35, 00153 Roma' },
          { name: 'Armando al Pantheon', neighborhood: 'Pantheon', address: 'Salita dei Crescenzi 31, 00186 Roma' },
        ],
        dinner: [
          { name: 'Roscioli', neighborhood: 'Campo de\' Fiori', address: 'Via dei Giubbonari 21, 00186 Roma' },
          { name: 'Da Enzo al 29', neighborhood: 'Trastevere', address: 'Via dei Vascellari 29, 00153 Roma' },
        ],
      },
      'london': {
        breakfast: [
          { name: 'Dishoom King\'s Cross', neighborhood: 'King\'s Cross', address: '5 Stable St, London N1C 4AB' },
          { name: 'The Wolseley', neighborhood: 'Mayfair', address: '160 Piccadilly, London W1J 9EB' },
          { name: 'Caravan Bankside', neighborhood: 'Southwark', address: '30 Great Guildford St, London SE1 0HS' },
          { name: 'Granger & Co', neighborhood: 'Notting Hill', address: '175 Westbourne Grove, London W11 2SB' },
          { name: 'Buns From Home', neighborhood: 'Covent Garden', address: '31 The Market, London WC2E 8RD' },
        ],
        lunch: [
          { name: 'Padella', neighborhood: 'Borough', address: '6 Southwark St, London SE1 1TQ' },
          { name: 'Bao Soho', neighborhood: 'Soho', address: '53 Lexington St, London W1F 9AS' },
        ],
        dinner: [
          { name: 'Brat', neighborhood: 'Shoreditch', address: '4 Redchurch St, London E1 6JL' },
          { name: 'The Palomar', neighborhood: 'Soho', address: '34 Rupert St, London W1D 6DN' },
        ],
      },
    };

    // Detect meal type from title
    function detectMealTypeFromTitle(title: string): 'breakfast' | 'lunch' | 'dinner' {
      const t = (title || '').toLowerCase();
      if (/\bbreakfast\b/.test(t)) return 'breakfast';
      if (/\bdinner\b|\bsupper\b/.test(t)) return 'dinner';
      return 'lunch'; // default for lunch, brunch, tapas, etc.
    }

    // City aliases for matching local-language destination names to fallback keys
    const CITY_ALIASES: Record<string, string[]> = {
      'lisbon': ['lisboa', 'lisbonne', 'lissabon'],
      'porto': ['oporto'],
      'barcelona': ['barcelone', 'barcellona'],
      'paris': ['paris'],
      'berlin': ['berlin'],
      'rome': ['roma', 'rom'],
      'london': ['londres'],
    };

    // Resolve city key for fallback lookup
    const tripDestination = (updatedDays[0]?.destination || updatedDays[0]?.city || destination || '').toLowerCase().trim();
    const cityKey = Object.keys(FAILSAFE_FALLBACKS).find(k => {
      if (tripDestination.includes(k)) return true;
      const aliases = CITY_ALIASES[k] || [];
      return aliases.some(a => tripDestination.includes(a));
    }) || '';
    console.log(`=== CROSS-DAY RESTAURANT DEDUP FAILSAFE ===`);
    console.log(`tripDestination: "${tripDestination}", resolved cityKey: "${cityKey}"`);

    for (let di = 0; di < updatedDays.length; di++) {
      const day = updatedDays[di];
      if (!Array.isArray(day.activities)) continue;

      const beforeCount = day.activities.length;
      day.activities = day.activities.filter((act: any) => {
        const cat = (act.category || '').toLowerCase();
        const typ = (act.type || '').toLowerCase();
        const isDining = cat === 'dining' || typ === 'dining' || MEAL_RE_FAILSAFE.test(act.title || '');
        if (!isDining) return true;

        const venue = extractRestaurantVenueName(act.title || '') ||
                      extractRestaurantVenueName(act.venue_name || '') ||
                      extractRestaurantVenueName(act.restaurant?.name || '') ||
                      extractRestaurantVenueName(act.location?.name || '');
        if (!venue) return true;

        if (venueMatchesAny(venue, allUsedRestaurants)) {
          // DUPLICATE FOUND — attempt replacement instead of removal
          const mealType = detectMealTypeFromTitle(act.title || '');
          const fallbackList = FAILSAFE_FALLBACKS[cityKey]?.[mealType] || [];
          const fallback = fallbackList.find(f => {
            const fNorm = extractRestaurantVenueName(f.name);
            return fNorm && !venueMatchesAny(fNorm, allUsedRestaurants);
          });

          if (fallback) {
            // Replace with fallback
            const mealMatch = (act.title || '').match(/^(Breakfast|Brunch|Lunch|Dinner|Supper|Cocktails|Nightcap)\s+(?:at|:)\s+/i);
            const newTitle = mealMatch ? `${mealMatch[1]} at ${fallback.name}` : `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} at ${fallback.name}`;
            console.warn(`DEDUP REPLACEMENT: Day ${di + 1} — replacing duplicate "${act.title}" with "${fallback.name}"`);
            act.title = newTitle;
            act.name = newTitle;
            if (act.location) {
              act.location.name = fallback.name;
              act.location.address = fallback.address;
            }
            if (act.venue_name) act.venue_name = fallback.name;
            if (act.restaurant) act.restaurant.name = fallback.name;
            allUsedRestaurants.add(extractRestaurantVenueName(fallback.name));
            totalReplaced++;
            return true; // Keep the activity with new venue
          }

          // No fallback available — check if primary meal
          const isPrimaryMeal = PRIMARY_MEAL_RE.test(act.title || '');
          if (isPrimaryMeal) {
            console.warn(`DEDUP FAILSAFE: "${act.title}" on Day ${di + 1} is a PRIMARY MEAL with no fallback — KEEPING duplicate (meal > uniqueness)`);
            return true; // Keep duplicate rather than leave a missing meal
          }

          // Not a primary meal and no fallback — safe to remove
          console.warn(`DEDUP FAILSAFE: "${act.title}" on Day ${di + 1} — no fallback, not primary meal — REMOVING`);
          return false;
        }
        allUsedRestaurants.add(venue);
        return true;
      });
      const removed = beforeCount - day.activities.length;
      if (removed > 0) {
        totalRemoved += removed;
      }
    }
    if (totalReplaced > 0 || totalRemoved > 0) {
      console.log(`DEDUP FAILSAFE SUMMARY: ${totalReplaced} replaced, ${totalRemoved} removed across trip`);
      partialItinerary.days = updatedDays;
    }

    // ── ORPHANED TRAVEL ROUTING CLEANUP ──
    // After dedup, travel routing may reference restaurants no longer in the activity list
    for (let di = 0; di < updatedDays.length; di++) {
      const day = updatedDays[di];
      if (!Array.isArray(day.travelRouting) || day.travelRouting.length === 0) continue;

      const activityVenues = new Set<string>(
        (day.activities || [])
          .map((a: any) => (a.location?.name || a.venue_name || a.restaurant?.name || a.title || '').trim().toLowerCase())
          .filter(Boolean)
      );

      const beforeRouteCount = day.travelRouting.length;
      day.travelRouting = day.travelRouting.filter((route: any) => {
        const routeDest = (route.destination || route.to || route.toName || '').trim().toLowerCase();
        if (!routeDest) return true; // keep routes with no destination info

        // Always keep routes to hotels, airports, stations, and landmarks
        if (/hotel|airport|aeroporto|ritz|ludovice|station|terminal|museum|church|garden|miradouro|castelo|torre|praça|plaza/i.test(routeDest)) {
          return true;
        }

        // Check if any activity venue partially matches this route destination
        for (const venue of activityVenues) {
          if (venue.includes(routeDest) || routeDest.includes(venue)) return true;
        }

        console.warn(`ORPHANED ROUTE CLEANUP: Day ${di + 1} — removing travel route to "${routeDest}" (no matching activity)`);
        return false;
      });

      const routesRemoved = beforeRouteCount - day.travelRouting.length;
      if (routesRemoved > 0) {
        console.log(`ORPHANED ROUTE CLEANUP: Removed ${routesRemoved} orphaned route(s) from Day ${di + 1}`);
      }
    }
  }

  // ── FINAL PRICING GUARD — handled by universalQualityPass per-day above ──
  // No-op: pricing caps already enforced during quality pass

  // ── Michelin inclusion enforcement for Luminary trips ──
  const tripTypeLower = (tripType || '').toLowerCase();
  const isLuminaryTrip = tripTypeLower === 'luminary' || tripTypeLower === 'luxury';

  if (totalDays >= 3) {
    const allActs = updatedDays.flatMap((d: any) => d.activities || []);
    const starKeys = Object.keys(KNOWN_FINE_DINING_STARS || {});

    const michelinDinnerDays = new Set<number>();
    for (let di = 0; di < updatedDays.length; di++) {
      for (const a of (updatedDays[di].activities || [])) {
        const t = (a.title || '').toLowerCase();
        const v = ((a as any).location?.name || (a as any).venue_name || '').toLowerCase();
        const strippedT = t.replace(/^(breakfast|lunch|dinner|brunch|meal)\s*(at|:|-|–)\s*/i, '').trim();
        if (starKeys.some(k => t.includes(k) || v.includes(k) || strippedT.includes(k))) {
          michelinDinnerDays.add(di);
        }
      }
    }

    const michelinCount = michelinDinnerDays.size;
    const requiredCount = isLuminaryTrip ? (totalDays >= 7 ? 3 : totalDays >= 5 ? 2 : 1) : 0;

    if (isLuminaryTrip && michelinCount < requiredCount) {
      console.warn(`[MICHELIN] Only ${michelinCount}/${requiredCount} Michelin dinners generated for Luminary ${totalDays}-day ${destination} trip. AI prompt should have included them.`);
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

    // ── TRIP GENERATION SUMMARY ──
    // This confirms all validators ran and provides a diagnostic snapshot
    {
      const allActivities: any[] = [];
      const allVenueNames = new Set<string>();
      const allRestaurantNames = new Set<string>();
      const categoryBreakdown: Record<string, number> = {};
      const MEAL_RE = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;

      for (const day of (partialItinerary?.days || [])) {
        for (const act of (day?.activities || [])) {
          allActivities.push(act);
          const cat = (act.category || 'other').toLowerCase();
          categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;

          const venue = (act.venue_name || act.location?.name || '').trim().toLowerCase();
          if (venue && venue !== 'your hotel' && !/your hotel/i.test(venue)) {
            allVenueNames.add(venue);
          }
          const isDining = cat === 'dining' || MEAL_RE.test(act.title || '');
          if (isDining && venue) {
            allRestaurantNames.add(venue);
          }
        }
      }

      console.log('=== TRIP GENERATION SUMMARY ===');
      console.log(`City: ${destination}, Days: ${totalDays}, Type: ${tripType || 'vacation'}, Budget: ${budgetTier || 'moderate'}`);
      console.log(`Total activities: ${allActivities.length}, Categories: ${JSON.stringify(categoryBreakdown)}`);
      console.log(`Unique venues: ${allVenueNames.size} — ${[...allVenueNames].slice(0, 15).join(', ')}${allVenueNames.size > 15 ? '...' : ''}`);
      console.log(`Unique restaurants: ${allRestaurantNames.size} — ${[...allRestaurantNames].join(', ')}`);
      console.log(`Validators pipeline: usedVenues(${usedVenues.length}), usedRestaurants(${usedRestaurants.length}), sanitize, repairDay, crossDayDedup, hotelReturn, michelin`);
      console.log('================================');
    }

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

    // ── RUN CANONICAL PRICING REPAIR as the LAST pricing step ──
    // This ensures free-venue overrides are applied to the activity_costs table
    // AFTER all generation and sync steps, preventing phantom pricing.
    try {
      const { handleRepairTripCosts } = await import('./action-repair-costs.ts');
      const repairCtx = { supabase, userId, params: { tripId } };
      const repairResult = await handleRepairTripCosts(repairCtx);
      const repairBody = await repairResult.json().catch(() => null);
      if (repairBody && !repairBody.success) {
        console.error('[generate-trip-day] Post-completion cost repair failed:', repairBody);
      } else {
        console.log(`[generate-trip-day] Post-completion cost repair OK: ${repairBody?.repaired || 0} rows, ${repairBody?.corrected || 0} corrected`);
      }
    } catch (repairErr) {
      console.error('[generate-trip-day] Post-completion cost repair error (non-fatal):', repairErr);
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
    const { extractRestaurantVenueName, venueNamesMatch } = await import('./generation-utils.ts');
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
        if (venueName && !newUsedRestaurants.some(u => venueNamesMatch(extractRestaurantVenueName(u), venueName))) {
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
