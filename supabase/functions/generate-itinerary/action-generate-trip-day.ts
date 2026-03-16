/**
 * ACTION: generate-trip-day — Generate a SINGLE day, then self-chain to next
 * 
 * Each invocation is its own short-lived function call (~60-90s max).
 * The chain continues server-side even if the user closes their browser.
 * 
 * Extracted from index.ts to prevent scope-leaking bugs.
 */

import { corsHeaders } from './action-types.ts';
import { deriveMealPolicy, type RequiredMeal } from './meal-policy.ts';
import { enforceRequiredMealsFinalGuard, detectMealSlots } from './day-validation.ts';

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
  const { tripId, destination, destinationCountry, startDate, endDate, travelers, tripType, budgetTier, isMultiCity, creditsCharged, requestedDays, dayNumber, totalDays, generationRunId, isFirstTrip } = params;

  if (!tripId || !dayNumber || !totalDays) {
    return new Response(
      JSON.stringify({ error: "Missing required fields for day generation", code: "INVALID_INPUT" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  console.log(`[generate-trip-day] Starting day ${dayNumber}/${totalDays} for trip ${tripId} (runId: ${generationRunId || 'none'})`);

  // Guard: check trip is still in "generating" state AND run ID matches
  const { data: tripCheck } = await supabase.from('trips').select('itinerary_status, metadata, itinerary_data').eq('id', tripId).single();
  if (!tripCheck || tripCheck.itinerary_status === 'cancelled' || tripCheck.itinerary_status === 'ready') {
    console.log(`[generate-trip-day] Trip ${tripId} status is ${tripCheck?.itinerary_status}, stopping chain`);
    return new Response(
      JSON.stringify({ status: tripCheck?.itinerary_status || 'cancelled', dayNumber }),
      { headers: jsonHeaders }
    );
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
  const previousActivities: string[] = [];
  for (const day of existingDays) {
    if (day?.activities) {
      day.activities.forEach((act: any) => {
        previousActivities.push(act.title || act.name || '');
      });
    }
  }

  // Update heartbeat before generating
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

  const MAX_RETRIES = 4;
  let dayResult: any = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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
      break;
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
    // This day failed after all retries
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
      { headers: jsonHeaders }
    );
  }

  // Day generated successfully — save it
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

  // ── MEAL COMPLIANCE GUARD (before save) ──────────────────────────
  // The generate-day action already has a meal guard, but this catches
  // edge cases where post-processing in this file may have altered days.
  for (let i = 0; i < updatedDays.length; i++) {
    const d = updatedDays[i];
    if (!d?.activities || !Array.isArray(d.activities)) continue;
    const dn = d.dayNumber || (i + 1);
    const policy = deriveMealPolicy({
      dayNumber: dn,
      totalDays,
      isFirstDay: dn === 1,
      isLastDay: dn === totalDays,
    });
    if (policy.requiredMeals.length === 0) continue;
    const detected = detectMealSlots(d.activities);
    const missing = policy.requiredMeals.filter((m: RequiredMeal) => !detected.includes(m));
    if (missing.length > 0) {
      const dest = d.city || cityInfo?.cityName || destination || 'the destination';
      const result = enforceRequiredMealsFinalGuard(d.activities, policy.requiredMeals, dn, dest, 'USD', policy.dayMode);
      if (!result.alreadyCompliant) {
        updatedDays[i] = { ...d, activities: result.activities };
        console.warn(`[generate-trip-day] 🍽️ MEAL GUARD: Day ${dn} missing [${result.injectedMeals.join(', ')}] — injected before chain save`);
      }
    }
  }

  const partialItinerary = {
    days: updatedDays,
    status: dayNumber >= totalDays ? 'ready' : 'generating',
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
    // All days complete
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

    await triggerNextJourneyLeg(supabase, tripId);

    return new Response(
      JSON.stringify({ status: 'complete', dayNumber, totalDays }),
      { headers: jsonHeaders }
    );
  } else {
    // More days remain — save progress and self-chain
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

    return new Response(
      JSON.stringify({ status: 'day_complete', dayNumber, totalDays, nextDay: dayNumber + 1 }),
      { headers: jsonHeaders }
    );
  }
}
