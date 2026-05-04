/**
 * ACTION: save-itinerary
 * Saves itinerary data with ownership verification and no-shrink guard.
 */

import { type ActionContext, okJson, errorJson } from './action-types.ts';
import { deriveMealPolicy, type RequiredMeal } from './meal-policy.ts';
import { enforceRequiredMealsFinalGuard, detectMealSlots } from './day-validation.ts';
import { applyAnchorsWin as sharedApplyAnchorsWin } from './anchor-guard.ts';
import { buildDayLedger, type DayLedger } from './day-ledger.ts';
import { ledgerCheck } from './ledger-check.ts';

// Re-export for backwards compatibility (tests + other modules import from this file)
export { applyAnchorsWin } from './anchor-guard.ts';

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

// `applyAnchorsWin` lives in ./anchor-guard.ts and is re-exported at the top
// of this file for backwards compatibility with existing imports/tests.


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
    // Trip-wide blocked-restaurants accumulator (canonical names)
    const { extractRestaurantVenueName: _extractSave } = await import('./generation-utils.ts');
    const saveTripBlocked: string[] = [];
    const _harvestSave = (acts: any[]) => {
      const MEAL_RE_S = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;
      for (const a of acts || []) {
        const cat = (a.category || '').toLowerCase();
        const isDining = cat === 'dining' || cat === 'restaurant' || cat === 'food' || MEAL_RE_S.test(a.title || '');
        if (!isDining) continue;
        for (const src of [a.title, a.name, a.venue_name, a.restaurant?.name, a.location?.name]) {
          if (typeof src === 'string' && src.length > 0) {
            const canon = _extractSave(src);
            if (canon && !saveTripBlocked.includes(canon)) saveTripBlocked.push(canon);
          }
        }
      }
    };

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

      if (policy.requiredMeals.length === 0) {
        _harvestSave(day.activities);
        continue;
      }

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
          { earliestTimeMins: arrMinsLoop, latestTimeMins: depMinsLoop, blockedRestaurants: saveTripBlocked },
        );
        if (!result.alreadyCompliant) {
          itineraryDays[i] = { ...day, activities: result.activities };
          mealGuardInjections += result.injectedMeals.length;
          console.warn(
            `[save-itinerary] 🍽️ MEAL GUARD: Day ${dayNumber} was missing [${result.injectedMeals.join(', ')}] — injected before save`
          );
        }
      }

      // Terminal cleanup ALWAYS runs on first/last days so the post-departure
      // barrier (no strolls/lunches after heading to airport) is enforced even
      // when no meal injection was needed.
      if (isFirstDay || isLastDay) {
        try {
          const { terminalCleanup } = await import('./universal-quality-pass.ts');
          const cityForCleanup = day.city || day.destination || 'the destination';
          terminalCleanup(itineraryDays[i].activities, {
            arrivalTime24: isFirstDay ? savedArrivalTime24 : undefined,
            departureTime24: isLastDay ? savedDepartureTime24 : undefined,
            city: cityForCleanup,
            dayNumber,
            isFirstDay,
            isLastDay,
          });
          itineraryDays[i] = { ...itineraryDays[i], activities: itineraryDays[i].activities };
        } catch (_e) { /* non-blocking */ }
      }

      // Always update trip-wide blocked set after this day so later days
      // never reuse a venue that was just kept or injected.
      _harvestSave(itineraryDays[i].activities);
    }

    if (mealGuardInjections > 0) {
      console.log(`[save-itinerary] Meal guard total: ${mealGuardInjections} meals injected across trip`);
      (itinerary as any).days = itineraryDays;
    }
  }

  // ── STEP 2.5: ANCHORS-WIN FINAL PASS ─────────────────────────────
  // Restore any user-provided anchors that earlier cleanup steps may have
  // dropped, renamed, or moved. User intent always wins over AI cleanup.
  try {
    const tripMeta = (trip as any).metadata as Record<string, unknown> | null;
    const userAnchors = Array.isArray(tripMeta?.userAnchors)
      ? (tripMeta!.userAnchors as Array<Record<string, any>>)
      : [];
    if (userAnchors.length > 0 && itineraryDays.length > 0) {
      const result = sharedApplyAnchorsWin(itineraryDays, userAnchors);
      itineraryDays = result.days;
      (itinerary as any).days = itineraryDays;
      if (result.restored > 0) {
        console.log(`[save-itinerary] Anchors-win: restored ${result.restored} anchor(s), reaffirmed ${result.reaffirmed} before save`);
      }
    }
  } catch (anchorErr) {
    console.warn('[save-itinerary] Anchor restore failed (non-blocking):', anchorErr);
  }

  // ── STEP 2.6: DAY TRUTH LEDGER / DAY BRIEF CHECK ─────────────────
  // Builds a per-day ledger (user intent + prior-day "alreadyDone" + closures
  // + soft fine-tune & assistant intents + forward-state) and:
  //   - removes any AI-inserted activity that violates closures or repeats prior-day items;
  //   - inserts a placeholder for missing 'must' user intents so the user can see them;
  //   - flags vibe-clashes (e.g. two splurge dinners back-to-back).
  // User-locked items are never touched.
  try {
    const tripMeta = (trip as any).metadata as Record<string, unknown> | null;
    const userAnchors = Array.isArray(tripMeta?.userAnchors)
      ? (tripMeta!.userAnchors as Array<Record<string, any>>)
      : [];
    const recordedIntents = Array.isArray((tripMeta as any)?.userIntents)
      ? ((tripMeta as any).userIntents as Array<Record<string, any>>)
      : [];
    const additionalNotes = ((tripMeta as any)?.additionalNotes as string) || '';

    if (itineraryDays.length > 0) {
      // Determine country from trip data (best effort)
      const { data: tripCountryRow } = await supabase
        .from('trips')
        .select('destination, destination_country, start_date, preferences')
        .eq('id', tripId)
        .single();
      const tripCountry = (tripCountryRow as any)?.destination_country || '';
      const tripStartFromDb = (tripCountryRow as any)?.start_date || tripStartDate;
      const prefs = (tripCountryRow as any)?.preferences as Record<string, any> | null;

      // ── STRUCTURED DAY INTENTS (preferred source) ──
      // Read normalized rows from `trip_day_intents` and group by day. Falls
      // back to legacy metadata blobs if the table is empty for this trip.
      let intentsByDay = new Map<number, Array<Record<string, any>>>();
      let tripWideFromTable: string[] = [];
      try {
        const { fetchActiveDayIntents, groupIntentsByDay } = await import('../_shared/day-intents-store.ts');
        const rows = await fetchActiveDayIntents(supabase, tripId);
        const grouped = groupIntentsByDay(rows);
        for (const [dn, list] of grouped.entries()) {
          if (dn === 0) {
            tripWideFromTable = list.map((r) => r.title);
          } else {
            intentsByDay.set(dn, list as Array<Record<string, any>>);
          }
        }
      } catch (e) {
        console.warn('[save-itinerary] day-intents fetch failed (non-blocking):', e);
      }

      // Parse fine-tune notes once for the whole trip (legacy fallback)
      let parsedFineTune: { perDay: Array<Record<string, any>>; tripWide: string[] } = { perDay: [], tripWide: [] };
      try {
        if (additionalNotes.trim()) {
          const { parseFineTuneIntoDailyIntents } = await import('../_shared/parse-fine-tune-intents.ts');
          parsedFineTune = parseFineTuneIntoDailyIntents({
            notes: additionalNotes,
            tripStartDate: tripStartFromDb,
            totalDays: itineraryDays.length,
          });
        }
      } catch (e) {
        console.warn('[save-itinerary] Fine-tune parse failed (non-blocking):', e);
      }

      // Build prior-day activity list once (titles only, with their dayNumber)
      const allActivities: Array<{ title: string; dayNumber: number; category?: string; startTime?: string }> = [];
      for (const d of itineraryDays) {
        const dn = (d.dayNumber as number) || 0;
        if (!dn) continue;
        for (const a of (d.activities || [])) {
          const t = (a.title || a.name || '').trim();
          if (t) allActivities.push({ title: t, dayNumber: dn, category: a.category, startTime: a.startTime });
        }
      }

      const ledgers: DayLedger[] = itineraryDays.map((d: any) => {
        const dn = (d.dayNumber as number) || 0;
        const dayAnchors = userAnchors.filter((a) => Number(a.dayNumber) === dn);

        // Soft intents for THIS day. Prefer the structured `trip_day_intents`
        // rows (one per user-stated wish) when present; fall back to legacy
        // metadata blobs otherwise.
        const extraIntents: Array<{
          title: string;
          startTime?: string;
          endTime?: string;
          kind?: string;
          source?: string;
          priority?: 'must' | 'should';
          raw?: string;
        }> = [];
        const structuredForDay = intentsByDay.get(dn) || [];
        if (structuredForDay.length > 0) {
          for (const r of structuredForDay) {
            if (r.locked) continue; // locked rows already covered by anchors
            extraIntents.push({
              title: r.title,
              startTime: r.start_time || undefined,
              endTime: r.end_time || undefined,
              kind: r.intent_kind || 'activity',
              source: r.source_entry_point || 'system',
              priority: r.priority === 'must' ? 'must' : (r.priority === 'avoid' ? 'must' : 'should'),
              raw: r.raw_text || r.title,
            });
          }
        } else {
          for (const p of parsedFineTune.perDay) {
            if (Number(p.dayNumber) !== dn) continue;
            extraIntents.push({
              title: p.title,
              startTime: p.startTime,
              kind: p.kind,
              source: 'fine_tune',
              priority: p.priority,
              raw: p.raw,
            });
          }
          for (const ri of recordedIntents) {
            if (Number(ri.dayNumber) !== dn) continue;
            if (!ri.title || typeof ri.title !== 'string') continue;
            extraIntents.push({
              title: ri.title,
              startTime: ri.startTime,
              kind: ri.kind || 'activity',
              source: ri.source || 'assistant',
              priority: ri.priority === 'must' ? 'must' : 'should',
              raw: ri.raw || ri.title,
            });
          }
        }

        const priorOnly = allActivities.filter((p) => p.dayNumber < dn);
        const forwardOnly = allActivities.filter((p) => p.dayNumber > dn && p.dayNumber <= dn + 2);

        const userConstraints: Record<string, any> = {};
        const dietary = (prefs as any)?.dietaryRestrictions
          || (prefs as any)?.dietary
          || (tripMeta as any)?.dietaryRestrictions;
        if (Array.isArray(dietary) && dietary.length > 0) userConstraints.dietary = dietary.filter(Boolean);
        else if (typeof dietary === 'string' && dietary.trim()) userConstraints.dietary = [dietary.trim()];
        const mobility = (prefs as any)?.mobility || (tripMeta as any)?.mobility;
        if (mobility && typeof mobility === 'string') userConstraints.mobility = mobility;
        const tripWideMerged = [...tripWideFromTable, ...parsedFineTune.tripWide];
        if (tripWideMerged.length > 0) userConstraints.tripWideNotes = tripWideMerged;

        return buildDayLedger({
          dayNumber: dn,
          date: d.date || (tripStartFromDb ? deriveDateFromStartDate(tripStartFromDb, dn) : ''),
          city: d.city || d.destination || (tripCountryRow as any)?.destination || '',
          country: tripCountry,
          hardFacts: {
            isFirstDay: dn === 1,
            isLastDay: dn === itineraryDays.length,
            isHotelChange: false,
          },
          anchors: dayAnchors,
          priorDayActivities: priorOnly,
          extraIntents,
          forwardActivities: forwardOnly.map((f) => ({
            dayNumber: f.dayNumber,
            title: f.title,
            category: f.category,
            startTime: f.startTime,
          })),
          userConstraints: Object.keys(userConstraints).length > 0 ? userConstraints : undefined,
        });
      });

      const lc = await ledgerCheck(itineraryDays, ledgers, { supabase, tripId });
      if (lc.removed > 0 || lc.inserted > 0 || lc.warnings.length > 0) {
        console.log(`[save-itinerary] 🧭 Day Brief: removed ${lc.removed}, inserted ${lc.inserted} placeholder(s), warnings ${lc.warnings.length}`);
        for (const w of lc.warnings.slice(0, 20)) {
          console.log(`[save-itinerary]   • [day ${w.dayNumber}] ${w.kind}: ${w.detail}`);
        }
        itineraryDays = lc.days;
        (itinerary as any).days = itineraryDays;
      }

      // Attach per-day warnings onto the persisted ledger snapshots so the
      // front-end can surface unresolved/violated user intents.
      const warnByDay = new Map<number, typeof lc.warnings>();
      for (const w of lc.warnings) {
        if (!warnByDay.has(w.dayNumber)) warnByDay.set(w.dayNumber, []);
        warnByDay.get(w.dayNumber)!.push(w);
      }
      for (const led of ledgers) {
        (led as any).warnings = warnByDay.get(led.dayNumber) || [];
      }
      (itinerary as any).dayLedgers = ledgers;

      // ── RECONCILE FULFILLMENT ──
      // Mark active `trip_day_intents` rows as fulfilled when their title now
      // appears in the saved itinerary. Best-effort, non-blocking.
      try {
        const { reconcileFulfillment } = await import('../_shared/day-intents-store.ts');
        const dayPayload = itineraryDays.map((d: any) => ({
          dayNumber: (d.dayNumber as number) || 0,
          activities: (d.activities || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            name: a.name,
          })),
        })).filter((d: any) => d.dayNumber > 0);
        const updated = await reconcileFulfillment(supabase, tripId, dayPayload);
        if (updated > 0) console.log(`[save-itinerary] ✅ Reconciled ${updated} fulfilled day-intent(s)`);
      } catch (rfErr) {
        console.warn('[save-itinerary] reconcileFulfillment failed (non-blocking):', rfErr);
      }

      // ── PRESENTATION GATE ──
      // Trip is "ready to present" iff every must/avoid intent is either
      // fulfilled (matched in the day) OR has had a placeholder restored.
      // `missing_user_intent` warnings (locked items the anchor-guard should
      // have restored but didn't) block readiness.
      try {
        const { fetchActiveDayIntents } = await import('../_shared/day-intents-store.ts');
        const remaining = await fetchActiveDayIntents(supabase, tripId);
        const blockingWarnings = lc.warnings.filter((w) => w.kind === 'missing_user_intent');
        const unresolved = remaining.filter((r) =>
          r.status === 'active'
          && (r.priority === 'must' || r.priority === 'avoid')
          && r.day_number != null
          // 'avoid' rows never "fulfill" — they're satisfied by absence.
          && r.intent_kind !== 'avoid'
          && r.intent_kind !== 'note'
          && r.intent_kind !== 'constraint'
        );
        // Cross-reference: an unresolved row is OK if a placeholder was inserted.
        const placeholderTitles = new Set<string>();
        for (const w of lc.warnings) {
          if (w.kind === 'missing_user_intent_restored') {
            const m = w.detail.match(/"([^"]+)"/);
            if (m) placeholderTitles.add(m[1].toLowerCase());
          }
        }
        const trulyUnresolved = unresolved.filter((r) => !placeholderTitles.has(r.title.toLowerCase()));
        const ready = blockingWarnings.length === 0 && trulyUnresolved.length === 0;
        (itinerary as any).readyForPresentation = ready;
        if (!ready) {
          (itinerary as any).unresolvedIntents = trulyUnresolved.map((r) => ({
            dayNumber: r.day_number,
            title: r.title,
            kind: r.intent_kind,
            priority: r.priority,
            source: r.source_entry_point,
          }));
          console.log(`[save-itinerary] ⚠️ Presentation gate: ${trulyUnresolved.length} unresolved must/avoid intent(s), ${blockingWarnings.length} missing-intent warning(s)`);
        } else {
          console.log('[save-itinerary] ✅ Presentation gate: all user intents resolved');
        }
      } catch (gateErr) {
        console.warn('[save-itinerary] presentation gate failed (non-blocking):', gateErr);
        (itinerary as any).readyForPresentation = true; // fail-open
      }
    }
  } catch (ledgerErr) {
    console.warn('[save-itinerary] Day Brief check failed (non-blocking):', ledgerErr);
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
