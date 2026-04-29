/**
 * ACTION: save-itinerary
 * Saves itinerary data with ownership verification and no-shrink guard.
 */

import { type ActionContext, okJson, errorJson } from './action-types.ts';
import { deriveMealPolicy, type RequiredMeal } from './meal-policy.ts';
import { enforceRequiredMealsFinalGuard, detectMealSlots } from './day-validation.ts';

/** After a leg finishes generating, check if there's a queued next leg and kick it off. */
export async function triggerNextJourneyLeg(supabase: any, tripId: string): Promise<void> {
  try {
    const { data: currentTrip } = await supabase
      .from('trips')
      .select('journey_id, journey_order')
      .eq('id', tripId)
      .single();

    if (!currentTrip?.journey_id || !currentTrip?.journey_order) {
      return;
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
          creditsCharged: 0,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`[triggerNextJourneyLeg] Non-2xx response for leg ${nextLeg.id}: ${res.status} — ${errorBody}`);
        const { data: legMeta } = await supabase.from('trips').select('metadata').eq('id', nextLeg.id).single();
        const existingMeta = (legMeta?.metadata as Record<string, unknown>) || {};
        await supabase.from('trips').update({
          itinerary_status: 'queued',
          metadata: { ...existingMeta, chain_error: `Backend returned ${res.status}`, chain_error_at: new Date().toISOString() },
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
        metadata: { ...existingMeta, chain_error: String(fetchErr), chain_error_at: new Date().toISOString() },
      }).eq('id', nextLeg.id);
    }
  } catch (err) {
    console.error('[triggerNextJourneyLeg] Error:', err);
  }
}

// ── HELPERS ───────────────────────────────────────────────────────
/** Derive a date string from trip start_date + dayNumber offset */
function deriveDateFromStartDate(startDate: string, dayNumber: number): string {
  const d = new Date(startDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dayNumber - 1);
  return d.toISOString().split('T')[0];
}

/** Parse "HH:MM" to minutes since midnight for sorting */
function parseTimeToMinutes(t?: string): number {
  if (!t) return 0;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

/**
 * Normalize all days: ensure dayNumber, date, sort activities by time.
 * This is the single canonical normalization that runs BEFORE persistence.
 */
function normalizeDays(days: any[], tripStartDate: string | null): any[] {
  return days.map((day: any, idx: number) => {
    const dayNumber = idx + 1;
    // Derive date from start_date if missing or blank
    let date = day.date;
    if (!date && tripStartDate) {
      date = deriveDateFromStartDate(tripStartDate, dayNumber);
    }
    // Sort activities by startTime/start_time/time
    let activities = Array.isArray(day.activities) ? [...day.activities] : [];
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || a.start_time || a.time);
      const tb = parseTimeToMinutes(b.startTime || b.start_time || b.time);
      return ta - tb;
    });
    return { ...day, dayNumber, date, activities };
  });
}

export async function handleSaveItinerary(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId, itinerary } = params;

  // Verify trip access
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id, start_date, end_date, flight_selection, metadata')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return errorJson("Trip not found", 404);
  }

  const isOwner = trip.user_id === userId;
  const { data: collab } = await supabase
    .from('trip_collaborators')
    .select('id, permission')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  
  const hasEditPermission = collab && (collab.permission === 'edit' || collab.permission === 'admin');
  
  if (!isOwner && !hasEditPermission) {
    console.error(`[save-itinerary] Unauthorized save attempt by ${userId} for trip ${tripId}`);
    return errorJson("Access denied. You don't have permission to modify this trip.", 403);
  }

  const tripStartDate: string | null = trip.start_date || null;

  // ── NO-SHRINK GUARD ──────────────────────────────────────────────
  const allowShrink = params.allowShrink === true;
  const incomingDays: unknown[] = Array.isArray((itinerary as any)?.days) ? (itinerary as any).days : [];
  const incomingCount = incomingDays.length;

  const { data: currentTrip } = await supabase
    .from('trips')
    .select('itinerary_data')
    .eq('id', tripId)
    .single();
  const existingJsonDays: unknown[] = Array.isArray((currentTrip?.itinerary_data as any)?.days)
    ? (currentTrip!.itinerary_data as any).days
    : [];

  const { count: existingTableRows } = await supabase
    .from('itinerary_days')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId);

  const canonicalExisting = Math.max(existingJsonDays.length, existingTableRows || 0);

  if (!allowShrink && incomingCount > 0 && canonicalExisting > 0 && incomingCount < canonicalExisting) {
    console.warn(
      `[save-itinerary] 🛡️ SHRINK BLOCKED: tripId=${tripId}, ` +
      `incoming=${incomingCount}, canonical=${canonicalExisting} ` +
      `(json=${existingJsonDays.length}, table=${existingTableRows || 0}). ` +
      `Returning success without writing to prevent data loss.`
    );
    return okJson({ success: true, shrinkBlocked: true, incomingCount, canonicalExisting });
  }

  // ── STEP 1: NORMALIZE DAYS ─────────────────────────────────────
  // Ensure dayNumber, date (derived from start_date), activity sort order
  let itineraryDays: any[] = Array.isArray((itinerary as any)?.days) ? (itinerary as any).days : [];
  if (itineraryDays.length > 0) {
    itineraryDays = normalizeDays(itineraryDays, tripStartDate);
    (itinerary as any).days = itineraryDays;
  }

  const totalDays = itineraryDays.length;

  // Validate: reject if any day still has no date after normalization
  const daysWithoutDate = itineraryDays.filter((d: any) => !d.date);
  if (daysWithoutDate.length > 0 && tripStartDate) {
    console.error(`[save-itinerary] ❌ ${daysWithoutDate.length} days still have no date after normalization — this should not happen`);
  }

  // ── STEP 2: MEAL COMPLIANCE GUARD ─────────────────────────────
  let mealGuardInjections = 0;

  // Extract flight times so meal policy respects actual departure/arrival
  const flightSel = trip?.flight_selection as Record<string, any> | null;
  let savedArrivalTime24: string | undefined =
    flightSel?.arrivalTime24 || flightSel?.arrivalTime || flightSel?.outbound?.arrivalTime || undefined;
  let savedDepartureTime24: string | undefined =
    flightSel?.returnDepartureTime24 || flightSel?.returnDepartureTime || flightSel?.return?.departureTime || undefined;

  // FALLBACK: If arrival time is missing from flight_selection, extract from repair-injected flight card on Day 1
  if (!savedArrivalTime24 && itineraryDays.length > 0) {
    const day1 = itineraryDays[0];
    const repairFlight = (day1?.activities || []).find((a: any) =>
      a.source === 'repair-arrival-flight' || a.source === 'injected-arrival-flight' ||
      ((a.category || '').toLowerCase() === 'flight' && (a.title || '').toLowerCase().includes('arrival'))
    );
    if (repairFlight) {
      const endTime = repairFlight.endTime || repairFlight.end_time;
      if (endTime) {
        savedArrivalTime24 = endTime;
        console.log(`[save-itinerary] ✈️ Extracted arrival time ${endTime} from repair-injected flight card`);
      }
    }
  }

  if (totalDays > 0) {
    for (let i = 0; i < itineraryDays.length; i++) {
      const day = itineraryDays[i];
      if (!day?.activities || !Array.isArray(day.activities)) continue;

      const dayNumber = day.dayNumber || (i + 1);
      const isFirstDay = dayNumber === 1;
      const isLastDay = dayNumber === totalDays;

      const policy = deriveMealPolicy({
        dayNumber,
        totalDays,
        isFirstDay,
        isLastDay,
        arrivalTime24: isFirstDay ? savedArrivalTime24 : undefined,
        departureTime24: isLastDay ? savedDepartureTime24 : undefined,
      });

      if (policy.requiredMeals.length === 0) continue;

      const detected = detectMealSlots(day.activities);
      const missing = policy.requiredMeals.filter((m: RequiredMeal) => !detected.includes(m));

      if (missing.length > 0) {
        const destination = day.city || day.destination || 'the destination';
        // Compute timing window
        const arrMinsLoop = isFirstDay && savedArrivalTime24 ? (() => { const m = savedArrivalTime24.match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : undefined; })() : undefined;
        const depMinsLoop = isLastDay && savedDepartureTime24 ? (() => { const m = savedDepartureTime24.match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) - 180 : undefined; })() : undefined;

        // Try to load real venue fallbacks from verified_venues for this city
        let saveFallbackVenues: Array<{ name: string; address: string; mealType: string }> = [];
        try {
          if (destination && destination !== 'the destination') {
            const { data: venues } = await supabase
              .from('verified_venues')
              .select('name, address, category')
              .ilike('city', `%${destination.split(',')[0].trim()}%`)
              .in('category', ['restaurant', 'dining', 'cafe', 'bar', 'food'])
              .limit(20);
            if (venues && venues.length > 0) {
              for (const v of venues) {
                saveFallbackVenues.push({ name: v.name, address: v.address || destination, mealType: 'any' });
              }
            }
          }
        } catch (_e) { /* non-blocking */ }
        const result = enforceRequiredMealsFinalGuard(
          day.activities,
          policy.requiredMeals,
          dayNumber,
          destination,
          'USD',
          policy.dayMode,
          saveFallbackVenues,
          { earliestTimeMins: arrMinsLoop, latestTimeMins: depMinsLoop },
        );
        if (!result.alreadyCompliant) {
          itineraryDays[i] = { ...day, activities: result.activities };
          mealGuardInjections += result.injectedMeals.length;
          console.warn(
            `[save-itinerary] 🍽️ MEAL GUARD: Day ${dayNumber} was missing [${result.injectedMeals.join(', ')}] — injected before save`
          );
        }

        // Terminal cleanup for this day
        try {
          const { terminalCleanup } = await import('./universal-quality-pass.ts');
          terminalCleanup(itineraryDays[i].activities, {
            arrivalTime24: isFirstDay ? savedArrivalTime24 : undefined,
            departureTime24: isLastDay ? savedDepartureTime24 : undefined,
            city: destination,
            dayNumber,
            isFirstDay,
            isLastDay,
          });
        } catch (_e) { /* non-blocking */ }
      }
    }

    if (mealGuardInjections > 0) {
      console.log(`[save-itinerary] Meal guard total: ${mealGuardInjections} meals injected across trip`);
      (itinerary as any).days = itineraryDays;
    }
  }

  // ── STEP 3: PERSIST TO trips.itinerary_data ─────────────────────
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
    return errorJson("Failed to save itinerary", 500);
  }

  // ── STEP 4: SYNC TO NORMALIZED TABLES ──────────────────────────
  // Keep itinerary_days + itinerary_activities in sync with JSON snapshot
  try {
    const syncCtx: ActionContext = { supabase, userId, params: { tripId } };
    const { handleSyncItineraryTables } = await import('./action-sync-tables.ts');
    const syncResult = await handleSyncItineraryTables(syncCtx);
    const syncBody = await syncResult.json().catch(() => null);
    if (syncBody && !syncBody.success) {
      console.error('[save-itinerary] Table sync failed:', syncBody);
    } else {
      console.log(`[save-itinerary] Table sync complete:`, syncBody);
    }
  } catch (syncErr) {
    // Non-fatal: JSON snapshot is the source of truth
    console.error('[save-itinerary] Table sync error (non-fatal):', syncErr);
  }

  // Trigger next journey leg if applicable
  await triggerNextJourneyLeg(supabase, tripId);

  return okJson({ success: true, normalized: true, mealGuardInjections });
}
