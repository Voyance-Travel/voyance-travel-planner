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
import { preserveLedgerCosts } from './_shared/preserve-ledger-costs.ts';
import { stripPreDawnHotelReturns } from '../_shared/predawn-hotel-strip.ts';
import { normalizePredawnCascade } from '../_shared/predawn-cascade-normalize.ts';
import { clampAllBookends } from '../_shared/clamp-bookend.ts';
import { validateItineraryForPersist } from '../_shared/validate-itinerary-for-persist.ts';
import { appendGenerationTrace } from '../_shared/generation-trace.ts';
import { validateDayThemes } from '../_shared/output-consistency.ts';
import { scrubActivity, addOps, formatOps, EMPTY_OPS, type ScrubOps } from '../_shared/scrub-activity.ts';
import { buildDayScheduleSummary } from '../_shared/prompt-leak-scrub.ts';
import { ensureDayDiningDescriptions } from '../_shared/dining-description-backfill.ts';
import { pruneNonLogisticsAfterCheckout, pruneNonLogisticsAfterAirportTransfer } from '../_shared/post-checkout-prune.ts';
import { stripHotelReturnLoop } from '../_shared/strip-hotel-return-loop.ts';
import { enforceFreshenUpPosition } from '../_shared/freshen-up-position.ts';
import { fillMissingStartTimes, assignFloatingMealTimes, dayChronoKey, pruneOrphanLateNightlifeBookend } from '../_shared/timing-cascade.ts';

// Re-export for backwards compatibility (tests + other modules import from this file)
export { applyAnchorsWin } from './anchor-guard.ts';

/** Compact per-day activity + dining count snapshot for erosion-pattern observability. */
const countDays = (days: any[]) =>
  (Array.isArray(days) ? days : []).map((d: any, i: number) => {
    const acts = Array.isArray(d?.activities) ? d.activities : [];
    const dining = acts.filter((a: any) =>
      /dining|food|restaurant/i.test(String(a?.category || ''))
    ).length;
    return `day${i + 1}=${acts.length}(dining:${dining})`;
  }).join(' ');

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

const TRUE_HOTEL_RETURN_RE = /\b(?:return\s+to|back\s+to|head\s+back\s+to|wind\s+down\s+at|retire\s+to|end\s+of\s+day\s+at)\b/i;
const MIDDAY_ACCOM_RE = /\b(?:freshen[-\s]?up|luggage\s+drop|bag\s+drop|settle\s+in|check[-\s]?in|drop\s+(?:bags|luggage))\b/i;
const BOOKEND_SOURCE_RE = /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i;

function isProtectedActivity(a: any): boolean {
  if (!a) return false;
  if (a.locked === true || a.is_locked === true || a.isLocked === true) return true;
  if (a.lock_state === 'locked') return true;
  return ['user', 'manual', 'extracted', 'pinned'].includes(String(a.source || '').toLowerCase());
}

function isHotelReturnBookendActivity(a: any): boolean {
  if (!a) return false;
  const title = String(a.title || a.name || '');
  const cat = String(a.category || '').toUpperCase();
  const source = String(a.source || '').toLowerCase();
  const tags = Array.isArray(a.tags) ? a.tags.map((t: any) => String(t).toLowerCase()) : [];
  if (MIDDAY_ACCOM_RE.test(title)) return false;
  if (BOOKEND_SOURCE_RE.test(source) || tags.some((t: string) => BOOKEND_SOURCE_RE.test(t))) return true;
  return (cat === 'STAY' || cat === 'ACCOMMODATION') && TRUE_HOTEL_RETURN_RE.test(title);
}

function dedupeHotelReturnBookends(activities: any[], dayNumber: number): any[] {
  if (!Array.isArray(activities) || activities.length < 2) return activities;
  const rows = activities
    .map((activity, index) => ({ activity, index }))
    .filter(({ activity }) => isHotelReturnBookendActivity(activity));
  if (rows.length < 2) return activities;
  const protectedIndexes = new Set(rows.filter(({ activity }) => isProtectedActivity(activity)).map(({ index }) => index));
  const keepGeneratedIndex = protectedIndexes.size > 0
    ? -1
    : rows.reduce((best, row) => {
        const rowKey = dayChronoKey(row.activity?.startTime || row.activity?.start_time || row.activity?.time);
        const bestKey = dayChronoKey(best.activity?.startTime || best.activity?.start_time || best.activity?.time);
        return rowKey >= bestKey ? row : best;
      }).index;
  const out = activities.filter((activity, index) => {
    if (!isHotelReturnBookendActivity(activity)) return true;
    if (protectedIndexes.has(index)) return true;
    return index === keepGeneratedIndex;
  });
  if (out.length !== activities.length) {
    console.warn(`[SAVE_BOOKEND_DEDUPE] day=${dayNumber} removed=${activities.length - out.length}`);
  }
  return out;
}

/**
 * Normalize all days: ensure dayNumber, date, sort activities by time.
 * This is the single canonical normalization that runs BEFORE persistence.
 */
export function normalizeDays(days: any[], tripStartDate: string | null, destination?: string): any[] {
  return days.map((day: any, idx: number) => {
    const dayNumber = idx + 1;
    let date = day.date;
    if (!date && tripStartDate) {
      date = deriveDateFromStartDate(tripStartDate, dayNumber);
    }
    let activities = Array.isArray(day.activities) ? [...day.activities] : [];
    // Fill missing startTime from endTime − duration BEFORE sort so chronology is coherent.
    fillMissingStartTimes(activities, { dayNumber, path: 'save-itinerary' });
    // Anchor floating meal cards (no time/end/duration) to canonical slots, or drop dupes.
    assignFloatingMealTimes(activities, { dayNumber, path: 'save-itinerary' });
    // Wrap-aware sort — keeps a 00:55 late-nightlife hotel-return bookend at
    // the chronological tail instead of jumping to the top of the day.
    activities.sort((a: any, b: any) => {
      const ta = dayChronoKey(a.startTime || a.start_time || a.time);
      const tb = dayChronoKey(b.startTime || b.start_time || b.time);
      return ta - tb;
    });
    // One-shot self-heal: pre-existing trips may have been persisted with the
    // bookend re-ordered to index 0 by the prior raw-minute sort. If a
    // wrap-window bookend somehow still sits at the head, move it to the tail.
    {
      const isLegacyHeadBookend = (a: any): boolean => {
        if (!a) return false;
        const t = parseTimeToMinutes(a.startTime || a.start_time || a.time);
        if (t >= 6 * 60) return false; // not in wrap window
        const src = String(a.source || '').toLowerCase();
        if (src === 'bookend-readtime' || src === 'bookend-overnight' || src === 'late_nightlife_bookend') return true;
        const tags: string[] = Array.isArray(a.tags) ? a.tags.map((x: any) => String(x).toLowerCase()) : [];
        if (tags.some(x => x === 'bookend-readtime' || x === 'bookend-overnight' || x === 'late_nightlife_bookend')) return true;
        const title = String(a.title || a.name || '');
        return /^Return to\b/i.test(title);
      };
      if (activities.length > 1 && isLegacyHeadBookend(activities[0])) {
        const head = activities.shift();
        activities.push(head);
        console.log(`[BOOKEND_REORDER] day=${dayNumber} moved tail src="${(head as any)?.source || 'inferred'}" path=save-itinerary`);
        console.log(`[BOOKEND_TRACE] day=${dayNumber} site=save action=reordered source=${(head as any)?.source || 'inferred'} reason=legacy_head_bookend`);
      }
    }
    // Pre-dawn cascade heal — shifts the leading [00:00, 05:00) block of
    // non-bookend / non-locked / non-departure cards forward to start at
    // 09:00 so the user never sees "Moco Museum 1:33 AM" on Day 2.
    // See mem://constraints/itinerary/late-nightlife-no-next-day-bleed.
    {
      const predawn = normalizePredawnCascade(activities, idx, {
        dayNumber,
        site: 'save-itinerary',
      });
      if (predawn.changed) activities = predawn.activities;
    }
    // Drop stale `late_nightlife_bookend` cards whose chronological-prior
    // non-bookend isn't actually nightlife (or whose start predates the
    // prior's end). The save-time `runStep8` retry below re-injects a
    // fresh bookend when the day still warrants one.
    pruneOrphanLateNightlifeBookend(activities, { dayNumber });
    stripPreDawnHotelReturns(activities, { dayNumber, label: 'SAVE' });
    clampAllBookends(activities, { dayNumber, label: 'SAVE' });
    activities = dedupeHotelReturnBookends(activities, dayNumber);
    // Drop synthetic accommodation rows whose title was truncated by the
    // legacy `extractHotelName` non-greedy regex ("...for Check" without -in
    // /-out). These can never be legitimate hotel names; the only producer
    // was the bug fixed in src/lib/itinerary/ensureHotelReturnBookend.ts.
    {
      const TRUNCATED_BOOKEND_TITLE_RE = /\bfor\s+Check\s*$/i;
      const before = activities.length;
      activities = activities.filter((a: any) => {
        const cat = String(a?.category || '').toUpperCase();
        if (cat !== 'ACCOMMODATION' && cat !== 'STAY') return true;
        const title = String(a?.title || a?.name || '').trim();
        return !TRUNCATED_BOOKEND_TITLE_RE.test(title);
      });
      const dropped = before - activities.length;
      if (dropped > 0) {
        console.log(`[SCRUB_TRUNCATED_BOOKEND] day=${dayNumber} count=${dropped} path=save-itinerary`);
      }
    }
    // Unified scrub boundary — single entry point.
    const daySchedule = buildDayScheduleSummary(activities);
    let dayOps: ScrubOps = { ...EMPTY_OPS } as ScrubOps;
    for (const a of activities) {
      dayOps = addOps(dayOps, scrubActivity(a, { destination, daySchedule }));
    }
    const diningBackfill = ensureDayDiningDescriptions(activities, destination);
    if (diningBackfill.fallback + diningBackfill.whyThisFits > 0) {
      console.log(`[DINING_DESC_BACKFILL] day=${dayNumber} dest="${destination || 'unknown'}" fallback=${diningBackfill.fallback} whyThisFits=${diningBackfill.whyThisFits} scanned=${diningBackfill.scanned} path=save-itinerary`);
    }
    const pruneResult = pruneNonLogisticsAfterCheckout(activities);
    const transferPruneResult = pruneNonLogisticsAfterAirportTransfer(activities, dayNumber);
    // Day-1 post-checkin "Return to Hotel" loop strip (defense-in-depth for
    // paths that bypass the Executioner: legacy trips, chat edits, paste).
    {
      const hotelLoopRes = stripHotelReturnLoop(activities, {
        dayNumber,
        isFirstDay: idx === 0,
        // Best-effort hotel-name lookup: scan the day's check-in row for a
        // brand/title token. normalizeDays doesn't carry trip-level hotelName.
        hotelName: (() => {
          const checkin = activities.find((a: any) =>
            /\bcheck[-\s]?in\b/i.test(String(a?.title || a?.name || ''))
          );
          const raw = String(checkin?.location?.name || checkin?.venue || checkin?.title || '');
          return raw || null;
        })(),
      });
      if (hotelLoopRes.droppedCount > 0) {
        activities = hotelLoopRes.activities;
      }
    }
    // Freshen-up position invariant — drops post-dinner / clamps overlap
    {
      const lockedIds = new Set<string>(
        activities.filter((a: any) => a?.isLocked === true || a?.locked === true || a?.lock_state === 'locked').map((a: any) => String(a.id))
      );
      const fres = enforceFreshenUpPosition(activities, { dayNumber, lockedIds });
      if (fres.repairs.length > 0) {
        activities = fres.activities;
        for (const r of fres.repairs) console.log(`[FRESHEN_UP_POSITION] ${r.message} path=save-itinerary`);
      }
    }
    if (dayOps.titleLeak + dayOps.bodyLeak + dayOps.fragment + dayOps.mealSuffix
        + dayOps.crossCity + dayOps.countryMismatch + dayOps.mealLabel
        + dayOps.phantomRef > 0) {
      console.log(`[SCRUB_ACTIVITY] day=${dayNumber} dest="${destination || 'unknown'}" ops=${formatOps(dayOps)} path=save-itinerary`);
    }
    if (pruneResult.prunedCount > 0) {
      console.log(`[POST_CHECKOUT_PRUNE] day=${dayNumber} count=${pruneResult.prunedCount} titles=${JSON.stringify(pruneResult.prunedTitles)} path=save-itinerary`);
    }
    if (transferPruneResult.prunedCount > 0) {
      console.log(`[POST_TRANSFER_PRUNE] day=${dayNumber} count=${transferPruneResult.prunedCount} titles=${JSON.stringify(transferPruneResult.prunedTitles)} path=save-itinerary`);
    }
    return { ...day, dayNumber, date, activities, _scrubOps: dayOps };
  });
}

// `applyAnchorsWin` lives in ./anchor-guard.ts and is re-exported at the top
// of this file for backwards compatibility with existing imports/tests.


export async function handleSaveItinerary(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId, itinerary, extraUpdate: callerExtraUpdate } = params;
  const skipLedgerCheck = params.skipLedgerCheck === true;
  const saveReason = typeof params.saveReason === 'string' ? params.saveReason : 'unspecified';

  // FIRST-LINE TRACE — fires before access/frozen checks so every save attempt
  // lands in the trip row, even if 403/409 short-circuits below.
  if (tripId) {
    await appendGenerationTrace(supabase, tripId, {
      action: 'save-itinerary',
      phase: 'persist_gate_checked',
      status: 'ok',
      jsonDayCount: Array.isArray(itinerary?.days) ? itinerary.days.length : 0,
      extra: { saveReason, skipLedgerCheck, site: 'entry' },
    }).catch(() => {});
  }

  const saveTraceId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)).slice(0, 8);
  const _saveT0 = Date.now();
  const _daysIn = Array.isArray(itinerary?.days) ? itinerary.days.length : 0;
  console.log(`[SAVE_TRACE] trace=${saveTraceId} tripId=${tripId} reason=${saveReason} skipLedger=${skipLedgerCheck} daysIn=${_daysIn} site=enter`);
  (params as any).__saveTraceId = saveTraceId;

  // Verify trip access
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id, start_date, end_date, flight_selection, metadata, itinerary_status')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    console.warn(`[SAVE_TRACE] trace=${saveTraceId} site=exit status=404 reason=trip_not_found`);
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
    console.error(`[SAVE_TRACE] trace=${saveTraceId} site=exit status=403 reason=unauthorized userId=${userId}`);
    console.error(`[save-itinerary] Unauthorized save attempt by ${userId} for trip ${tripId}`);
    return errorJson("Access denied. You don't have permission to modify this trip.", 403);
  }

  // ── FROZEN GATE (whitelist of user-initiated reasons) ──
  // Once the trip is frozen, only writes that are explicitly user-initiated
  // pass through. The frontend `safeUpdateItineraryData` already gates
  // page-load / hydration / self-heal paths, but direct edge-fn invokes (chat
  // executor with stale tag, optimistic resync from another tab, server-side
  // chains) have to be blocked here too. The whitelist is shared with the
  // backend persist boundary in `_shared/frozen-guard.ts`.
  // See mem://constraints/itinerary/frozen-after-ready.
  const allowFrozenWrite = params.allowFrozenWrite === true;
  {
    const { isUserSaveReason } = await import('../_shared/frozen-guard.ts');
    const meta = (trip.metadata as Record<string, any>) || {};
    const frozenAt = meta?.itinerary_frozen_at;
    const status = String(trip.itinerary_status || '');
    const isFrozen = !!frozenAt || status === 'ready' || status === 'generated';
    if (isFrozen && !allowFrozenWrite && !isUserSaveReason(saveReason)) {
      console.log(
        `[save-itinerary] [FROZEN_BLOCKED] tripId=${tripId} reason=${saveReason} status=${status} frozenAt=${frozenAt || 'n/a'}`,
      );
      return okJson({ success: true, skipped: true, reason: 'frozen' });
    }
  }


  const tripStartDate: string | null = trip.start_date || null;


  // ── NO-SHRINK GUARD ──────────────────────────────────────────────
  const allowShrink = params.allowShrink === true;
  const incomingDays: unknown[] = Array.isArray((itinerary as any)?.days) ? (itinerary as any).days : [];
  const incomingCount = incomingDays.length;

  const { data: currentTrip } = await supabase
    .from('trips')
    .select('itinerary_data, destination')
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
    itineraryDays = normalizeDays(itineraryDays, tripStartDate, (currentTrip as any)?.destination || (trip as any)?.destination);
    // Cross-day bleed guard — moves an untagged pre-dawn head row on Day N+1
    // back to Day N's tail when Day N ended late (≥22:00). Closes the residual
    // "Day 1 nightcap → Day 2 starts at 1:33 AM" risk that all four upstream
    // layers (stripBookendsForPrompt, parser stale-head drop, predawn cascade,
    // chronoKey wrap sort) miss when the LLM emits an untagged real activity.
    // See mem://constraints/itinerary/day1-past-midnight-no-day2-cascade.
    {
      const { assertNoCrossDayBleed } = await import('../_shared/cross-day-bleed-guard.ts');
      const guarded = assertNoCrossDayBleed(itineraryDays, { site: 'save-itinerary' });
      if (guarded.changed) {
        itineraryDays = guarded.days;
        // Re-run per-day normalize on the two affected day arrays so chronoKey
        // sort and timing cascade settle the new tail.
        itineraryDays = normalizeDays(itineraryDays, tripStartDate, (currentTrip as any)?.destination || (trip as any)?.destination);
      }
    }
    // Preserve server-repaired Michelin/ticketed/reference floors that the
    // client copy may have re-serialized from a stale render snapshot.
    const { days: preservedDays, preserved } = preserveLedgerCosts(existingJsonDays as any[], itineraryDays);
    if (preserved > 0) {
      console.log(`[save-itinerary] 🔒 Preserved ${preserved} ledger-floored cost(s) from clobber by autosave`);
    }
    itineraryDays = preservedDays;
    (itinerary as any).days = itineraryDays;
  }

  const totalDays = itineraryDays.length;

  // Validate: reject if any day still has no date after normalization
  const daysWithoutDate = itineraryDays.filter((d: any) => !d.date);
  if (daysWithoutDate.length > 0 && tripStartDate) {
    console.error(`[save-itinerary] ❌ ${daysWithoutDate.length} days still have no date after normalization — this should not happen`);
  }

  console.log(`[save-itinerary] PRE-VALIDATE counts: ${countDays(itineraryDays)}`);

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

  // FALLBACK: If departure time is missing from flight_selection, infer from
  // the last day's terminal logistics card (airport-transfer / flight / checkout).
  // Without this §15z `enforceDepartureDayLogistics` and the meal-policy
  // re-derive silently no-op on legacy / chat-planner trips that never
  // ingested a return flight — leaves "missing lunch on a departure day"
  // false positives and post-checkout leisure leaks. Persists back to
  // `trips.metadata.savedDepartureTime24` so subsequent saves see it.
  // Plan C of audit 44a68e13. See mem://constraints/itinerary/frozen-after-ready.
  let departureBackfillSource: string | null = null;
  if (!savedDepartureTime24 && itineraryDays.length > 0) {
    const lastDay = itineraryDays[itineraryDays.length - 1];
    const acts = (lastDay?.activities || []) as any[];
    // Prefer flight start (most precise), then airport-transfer end, then
    // checkout end (last resort — gives noon-ish lower bound).
    const flightCard = acts.find((a) =>
      ((a?.category || '').toLowerCase() === 'flight') ||
      /\b(flight|departure)\b/i.test(String(a?.title || ''))
    );
    if (flightCard && (flightCard.startTime || flightCard.start_time)) {
      savedDepartureTime24 = String(flightCard.startTime || flightCard.start_time);
      departureBackfillSource = 'flight_card';
    } else {
      const transferCard = acts.find((a) => {
        const cat = String(a?.category || '').toLowerCase();
        if (/^(airport[-_ ]?transfer|transfer[-_ ]?to[-_ ]?airport)$/.test(cat)) return true;
        return /\bairport\b/i.test(String(a?.title || ''));
      });
      if (transferCard && (transferCard.endTime || transferCard.end_time)) {
        // Transfer ends roughly at flight − buffer; treat transfer end as a
        // proxy for departure time (downstream §15z buffers from this).
        savedDepartureTime24 = String(transferCard.endTime || transferCard.end_time);
        departureBackfillSource = 'airport_transfer_card';
      } else {
        const checkoutCard = [...acts].reverse().find((a) => {
          const cat = String(a?.category || '').toLowerCase();
          if (cat === 'checkout' || cat === 'check-out') return true;
          return /\bcheck[-\s]?out\b/i.test(String(a?.title || ''));
        });
        if (checkoutCard && (checkoutCard.endTime || checkoutCard.end_time)) {
          savedDepartureTime24 = String(checkoutCard.endTime || checkoutCard.end_time);
          departureBackfillSource = 'checkout_card';
        }
      }
    }
    if (savedDepartureTime24) {
      console.log(
        `[save-itinerary] ✈️ Backfilled departure time ${savedDepartureTime24} from ${departureBackfillSource} (Plan C)`,
      );
    }
  }

  // Persist backfilled times to trips.metadata so subsequent saves don't
  // re-derive from scratch. Fire-and-forget — failure is non-fatal.
  if (savedArrivalTime24 || savedDepartureTime24) {
    const meta = (trip.metadata as Record<string, any>) || {};
    const patch: Record<string, any> = {};
    if (savedArrivalTime24 && !meta.savedArrivalTime24) patch.savedArrivalTime24 = savedArrivalTime24;
    if (savedDepartureTime24 && !meta.savedDepartureTime24) {
      patch.savedDepartureTime24 = savedDepartureTime24;
      if (departureBackfillSource) {
        patch.savedDepartureTime24_source = departureBackfillSource;
      }
    }
    if (Object.keys(patch).length > 0) {
      supabase
        .from('trips')
        .update({ metadata: { ...meta, ...patch } })
        .eq('id', tripId)
        .then(({ error }: { error: any }) => {
          if (error) console.warn('[save-itinerary] departure-metadata backfill failed:', error.message);
          else console.log(`[save-itinerary] [DEPARTURE_META_BACKFILL] ${JSON.stringify(patch)}`);
        });
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

      // RS.M.I3: prefer the meal policy cached at generation… UNLESS the cache
      // was derived without flight info that we now have. Casablanca Day 4 bug:
      // cache said `midday_departure + [breakfast, lunch]` (built before flight
      // time was known); meanwhile dep=15:05 → afternoon_departure → [breakfast]
      // only. Trusting stale cache injects a floating "Lunch — find a spot"
      // sentinel that §15z later strips at gen-time but not at save-time.
      // See mem://constraints/itinerary/departure-day-save-time-enforcement
      const cachedPolicy = (day as any)?.metadata?.quality?.meal_policy_at_generation;
      const freshPolicy = deriveMealPolicy({
        dayNumber,
        totalDays,
        isFirstDay,
        isLastDay,
        arrivalTime24: isFirstDay ? savedArrivalTime24 : undefined,
        departureTime24: isLastDay ? savedDepartureTime24 : undefined,
      });
      let policy: any;
      if (cachedPolicy && Array.isArray(cachedPolicy.requiredMeals)) {
        const cachedMeals = (cachedPolicy.requiredMeals as RequiredMeal[]).slice().sort().join(',');
        const freshMeals = freshPolicy.requiredMeals.slice().sort().join(',');
        const reconcilable =
          (isLastDay && savedDepartureTime24 && cachedMeals !== freshMeals) ||
          (isFirstDay && savedArrivalTime24 && cachedMeals !== freshMeals);
        if (reconcilable) {
          console.warn(
            `[MEAL_POLICY_REDERIVE] day=${dayNumber} reason=stale_cache cached=[${cachedMeals}] fresh=[${freshMeals}] depTime=${savedDepartureTime24 || 'n/a'} arrTime=${savedArrivalTime24 || 'n/a'}`
          );
          policy = freshPolicy;
          // Stamp the corrected policy so subsequent reads (and Step 2.6) see it.
          (day as any).metadata = (day as any).metadata || {};
          (day as any).metadata.quality = (day as any).metadata.quality || {};
          (day as any).metadata.quality.meal_policy_at_generation = {
            ...cachedPolicy,
            dayMode: freshPolicy.dayMode,
            requiredMeals: freshPolicy.requiredMeals,
            rederived_at_save_at: new Date().toISOString(),
            rederived_reason: 'flight_time_now_known',
          };
        } else {
          policy = {
            dayMode: cachedPolicy.dayMode,
            requiredMeals: cachedPolicy.requiredMeals as RequiredMeal[],
            isFullExplorationDay: !!cachedPolicy.isFullExplorationDay,
          };
        }
      } else {
        policy = freshPolicy;
      }

      // Brunch-band downgrade: when no flight clock is known and the cached
      // policy still demands breakfast, infer the actual arrival from the
      // first non-logistics activity on Day 1. If that lands ≥ 09:30, drop
      // breakfast — the brunch-band rule (Core memory) covers the AM meal
      // via the lunch slot. Closes the recurring "Day 1 missing breakfast"
      // false-positive on no-flight trips.
      // See mem://constraints/itinerary/no-phantom-arrival-clock
      if (
        isFirstDay &&
        !savedArrivalTime24 &&
        Array.isArray(policy.requiredMeals) &&
        policy.requiredMeals.includes('breakfast')
      ) {
        const { inferArrivalMinsFromSchedule } = await import('../_shared/infer-arrival-from-schedule.ts');
        const inferredMin = inferArrivalMinsFromSchedule(day.activities);
        if (inferredMin !== null && inferredMin >= 570) {
          const downgraded = (policy.requiredMeals as RequiredMeal[]).filter(
            (m) => m !== 'breakfast'
          );
          console.warn(
            `[save-itinerary] BRUNCH_BAND_DOWNGRADE day=${dayNumber} inferredArrivalMin=${inferredMin} requiredMeals=[${policy.requiredMeals.join(',')}]→[${downgraded.join(',')}]`
          );
          policy = { ...policy, dayMode: 'morning_arrival', requiredMeals: downgraded };
          // Persist the downgraded policy so subsequent saves don't re-derive.
          (day as any).metadata = (day as any).metadata || {};
          (day as any).metadata.quality = (day as any).metadata.quality || {};
          (day as any).metadata.quality.meal_policy_at_generation = {
            ...(cachedPolicy || {}),
            dayMode: 'morning_arrival',
            requiredMeals: downgraded,
            brunch_band_downgrade_at: new Date().toISOString(),
            inferred_arrival_min: inferredMin,
          };
        }
      }

      // Always stamp top-level dayMode so the read-side health engine reads
      // it directly without falling through to nested-cache or inference.
      // See mem://constraints/itinerary/dayMode-quality-top-level
      (day as any).metadata = (day as any).metadata || {};
      (day as any).metadata.quality = (day as any).metadata.quality || {};
      (day as any).metadata.quality.dayMode = policy.dayMode;

      // Same-day "tomorrow" copy fix — last day with a known dep time means
      // the flight is THIS calendar day. Catches legacy trips + manual edits
      // that bypassed gen-time scrub. See mem://constraints/itinerary/same-day-tomorrow-scrub.
      if (isLastDay && savedDepartureTime24) {
        const { scrubSameDayTomorrowOnAct, isDepartureLogisticsCard } =
          await import('../_shared/prompt-leak-scrub.ts');
        let scrubCount = 0;
        for (const act of day.activities) {
          if (!isDepartureLogisticsCard(act)) continue;
          const res = scrubSameDayTomorrowOnAct(act);
          if (res.changed) scrubCount++;
        }
        if (scrubCount > 0) {
          console.log(`[SAME_DAY_TOMORROW_SCRUB] day=${dayNumber} cards=${scrubCount} (save-time)`);
        }
      }

      if (policy.requiredMeals.length === 0) {
        _harvestSave(day.activities);
        continue;
      }


      const detected = detectMealSlots(day.activities);
      const missing = policy.requiredMeals.filter((m: RequiredMeal) => !detected.includes(m));

      if (missing.length > 0) {
        const destination =
          day.city ||
          day.destination ||
          (trip as any)?.destination ||
          'the destination';
        if (destination === 'the destination') {
          console.warn(`[save-itinerary] ⚠️ Day ${dayNumber}: meal guard running with no resolved destination — fallbacks will be global emergency stubs`);
        }
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
              .ilike('destination', `%${destination.split(',')[0].trim()}%`)
              .in('category', ['restaurant', 'dining', 'cafe', 'bar', 'food'])
              .limit(20);
            if (venues && venues.length > 0) {
              for (const v of venues) {
                saveFallbackVenues.push({ name: v.name, address: v.address || destination, mealType: 'any' });
              }
            }
            if (saveFallbackVenues.length < 3) {
              console.warn(`[VENUE_POOL_THIN] dest="${destination}" count=${saveFallbackVenues.length} — meal-guard will fall through to needsVenuePick sentinels (preserveAsManualPick)`);
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
          {
            earliestTimeMins: arrMinsLoop,
            latestTimeMins: depMinsLoop,
            blockedRestaurants: saveTripBlocked,
            departureTime24: isLastDay ? savedDepartureTime24 : undefined,
          },
        );
        if (!result.alreadyCompliant) {
          itineraryDays[i] = { ...day, activities: result.activities };
          mealGuardInjections += result.injectedMeals.length;
          console.warn(
            `[save-itinerary] 🍽️ MEAL GUARD: Day ${dayNumber} was missing [${result.injectedMeals.join(', ')}] — injected before save`
          );
          console.warn(`[MEAL_AUDIT] day=${dayNumber} dest="${destination}" mode=${policy.dayMode} required=[${policy.requiredMeals.join(',')}] detected=[${detected.join(',')}] missing=[${missing.join(',')}] injected=[${result.injectedMeals.join(',')}] source="save-itinerary"`);
          itineraryDays[i].metadata = itineraryDays[i].metadata || {};
          itineraryDays[i].metadata.quality = itineraryDays[i].metadata.quality || {};
          itineraryDays[i].metadata.quality.meal_audit = {
            required: policy.requiredMeals, detected_pre: detected, missing_pre: missing,
            injected: result.injectedMeals,
            // detected_post is computed implicitly by callers; skip here to keep payload small.
            source: 'save-itinerary',
          };

          // Post-guard description backstop — fill empty-sentinel blurbs.
          const { fillAfterMealGuard } = await import('../_shared/post-meal-guard-fill.ts');
          await fillAfterMealGuard(
            itineraryDays[i].activities as any[],
            destination,
            dayNumber,
            'save-itinerary',
          );
        }
      }

      // Terminal cleanup ALWAYS runs for EVERY day so any surviving
      // "Lunch — pick a restaurant" / "Dinner — pick a café" placeholder is
      // force-replaced by a real named venue before persistence. Previously
      // this was first/last-only, which let middle-day sentinels leak through.
      try {
        const { terminalCleanup } = await import('./universal-quality-pass.ts');
        const cityForCleanup =
          day.city ||
          day.destination ||
          (trip as any)?.destination ||
          ((trip as any)?.metadata?.destination as string | undefined) ||
          'the destination';
        const tripMetaForHotel = ((trip as any)?.metadata || {}) as Record<string, any>;
        const savedHotelName: string | undefined =
          tripMetaForHotel?.selected_hotel?.name ||
          tripMetaForHotel?.hotel?.name ||
          tripMetaForHotel?.accommodation?.name ||
          undefined;
        terminalCleanup(itineraryDays[i].activities, {
          arrivalTime24: isFirstDay ? savedArrivalTime24 : undefined,
          departureTime24: isLastDay ? savedDepartureTime24 : undefined,
          city: cityForCleanup,
          dayNumber,
          isFirstDay,
          isLastDay,
          hotelName: savedHotelName,
        });
        itineraryDays[i] = { ...itineraryDays[i], activities: itineraryDays[i].activities };

        // Save-time hotel-return safety net — covers manual edits, undo/redo,
        // and any generation that escaped the earlier Step 8 + post-meal-guard
        // retries. Skip departure day; idempotent via runStep8's own guard.
        if (!isLastDay && Array.isArray(itineraryDays[i].activities) && itineraryDays[i].activities.length > 0) {
          const acts = itineraryDays[i].activities;
          // Always attempt — runStep8 itself decides whether to append based
          // on terminal card category/title/time. Removed prior nonLogistics
          // guard: a nightcap/relaxation-only day (Florence Day 2 pattern)
          // still needs a bookend, and runStep8 is idempotent.
          try {
            const { runStep8 } = await import('./universal-quality-pass.ts');
            const _beforeLen = acts.length;
            runStep8(acts, dayNumber - 1, savedHotelName);
            if (acts.length > _beforeLen) {
              console.log(`[QUALITY] day=${dayNumber} save-time hotel-return appended`);
              itineraryDays[i].metadata = itineraryDays[i].metadata || {};
              itineraryDays[i].metadata.quality = itineraryDays[i].metadata.quality || {};
              itineraryDays[i].metadata.quality.hotel_return_save_time = true;
            } else {
              // Monitoring signal: bookend skipped despite a non-terminal last
              // card. runStep8's own guards (airport/STAY/return) should have
              // accepted everything else; this fires only when the day is
              // genuinely terminated already.
              const last = acts[acts.length - 1] || {};
              const lastCatU = String(last?.category || '').toUpperCase();
              const lastTitleU = String(last?.title || '');
              const isTerminalAlready =
                lastCatU === 'STAY' ||
                lastCatU === 'ACCOMMODATION' ||
                /return.*hotel|back.*hotel|return\s+to/i.test(lastTitleU) ||
                (/\b(airport|station|terminal|gate)\b/i.test(lastTitleU) &&
                  /TRANSPORT|TRANSIT|TRAVEL|LOGISTICS/.test(lastCatU));
              if (!isTerminalAlready) {
                console.warn(
                  `[SAVE_QUALITY] day=${dayNumber} WARNING: bookend injection skipped despite non-terminal last activity "${lastTitleU}" end="${last?.end_time || last?.endTime || ''}"`,
                );
              }
            }
          } catch (_e) { /* non-blocking */ }
        }
      } catch (_e) { /* non-blocking */ }

      // ── BOOKEND_SUMMARY (observation only) ─────────────────────────
      // One structured line per day so the whole hotel-return pipeline can be
      // diffed across emit/strip/clamp/save sites. See mem://constraints/itinerary/day-end-hotel-return-bookend.
      try {
        const _bsActs = itineraryDays[i]?.activities || [];
        const _bsLast = _bsActs.length ? _bsActs[_bsActs.length - 1] : null;
        const _bsLastSrc = String((_bsLast as any)?.source || '').toLowerCase();
        const _bsLastTitle = String((_bsLast as any)?.title || '');
        const _bsLastCat = String((_bsLast as any)?.category || '').toLowerCase();
        const _bsPersisted =
          /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/.test(_bsLastSrc) ||
          ((_bsLastCat === 'accommodation' || _bsLastCat === 'stay') &&
           /\b(?:return\s+to|back\s+to|head\s+back\s+to)\b/i.test(_bsLastTitle));
        const _bsSaveTime = !!itineraryDays[i]?.metadata?.quality?.hotel_return_save_time;
        const _bsClamped = itineraryDays[i]?.metadata?.quality?.bookend_clamped_count || 0;
        itineraryDays[i].metadata = itineraryDays[i].metadata || {};
        itineraryDays[i].metadata.quality = itineraryDays[i].metadata.quality || {};
        itineraryDays[i].metadata.quality.bookend_trace = {
          persisted: _bsPersisted,
          persistedSource: _bsPersisted ? (_bsLastSrc || 'inferred') : 'none',
          saveTimeInjected: _bsSaveTime,
          lastTitle: _bsLastTitle,
          lastEnd: (_bsLast as any)?.end_time || (_bsLast as any)?.endTime || null,
          isDepartureDay: !!isLastDay,
          clampedCount: _bsClamped,
        };
        console.log(
          `[BOOKEND_SUMMARY] day=${dayNumber} persisted=${_bsPersisted ? 1 : 0} persistedSource=${_bsPersisted ? (_bsLastSrc || 'inferred') : 'none'} saveTimeInjected=${_bsSaveTime ? 1 : 0} clamped=${_bsClamped} isDepartureDay=${isLastDay ? 1 : 0} lastTitle="${_bsLastTitle}"`,
        );
      } catch (_e) { /* non-blocking */ }

      // Always update trip-wide blocked set after this day so later days
      // never reuse a venue that was just kept or injected.
      _harvestSave(itineraryDays[i].activities);
    }

    console.log(`[save-itinerary] POST-VALIDATE counts (post meal-guard): ${countDays(itineraryDays)}`);

    if (mealGuardInjections > 0) {
      console.log(`[save-itinerary] Meal guard total: ${mealGuardInjections} meals injected across trip`);
      (itinerary as any).days = itineraryDays;
    }

    // ── STEP 2.6: MEAL PERSIST INVARIANT ──────────────────────────
    // Closing assertion AFTER terminalCleanup / nuclearDiningStrip have run.
    // If any required meal is still missing, inject a visible
    // preserveAsManualPick sentinel — silent deletion is the bug we're fighting.
    // See mem://constraints/itinerary/meal-persist-invariant
    {
      const destForInvariant =
        (currentTrip as any)?.destination || (trip as any)?.destination || 'the destination';
      const SLOT_TIMES: Record<RequiredMeal, { start: string; end: string }> = {
        breakfast: { start: '08:30', end: '09:30' },
        lunch:     { start: '12:30', end: '13:30' },
        dinner:    { start: '19:30', end: '21:00' },
      };
      for (let i = 0; i < itineraryDays.length; i++) {
        const day = itineraryDays[i];
        if (!day?.activities || !Array.isArray(day.activities)) continue;
        const dayNumber = day.dayNumber || (i + 1);
        const isFirstDay = dayNumber === 1;
        const isLastDay = dayNumber === totalDays;
        // Match STEP 2's stale-cache reconciliation: if cached policy was
        // built without flight info we now have, trust freshly derived policy.
        // See mem://constraints/itinerary/departure-day-save-time-enforcement
        const cachedPolicy = (day as any)?.metadata?.quality?.meal_policy_at_generation;
        const freshPolicy = deriveMealPolicy({
          dayNumber, totalDays, isFirstDay, isLastDay,
          arrivalTime24: isFirstDay ? savedArrivalTime24 : undefined,
          departureTime24: isLastDay ? savedDepartureTime24 : undefined,
        });
        let policy: any;
        if (cachedPolicy && Array.isArray(cachedPolicy.requiredMeals)) {
          const cachedMeals = (cachedPolicy.requiredMeals as RequiredMeal[]).slice().sort().join(',');
          const freshMeals = freshPolicy.requiredMeals.slice().sort().join(',');
          const reconcilable =
            (isLastDay && savedDepartureTime24 && cachedMeals !== freshMeals) ||
            (isFirstDay && savedArrivalTime24 && cachedMeals !== freshMeals);
          policy = reconcilable
            ? freshPolicy
            : { requiredMeals: cachedPolicy.requiredMeals as RequiredMeal[] };
        } else {
          policy = freshPolicy;
        }
        if (!policy.requiredMeals?.length) continue;
        const detected = detectMealSlots(day.activities);
        let stillMissing = policy.requiredMeals.filter((m: RequiredMeal) => !detected.includes(m));
        // Departure-day guard: don't inject a meal sentinel whose hard-coded
        // slot lands inside the airport-transfer window — §15z would still
        // strip it (preserveAsManualPick exemption is dropped post-cutoff)
        // and the user would briefly see a "floating dining card" between
        // STEP 2.6 injection and STEP 2.65 cleanup. Pre-filtering keeps the
        // invariant honest while preventing the impossible-meal case.
        // See mem://constraints/itinerary/departure-day-save-time-enforcement
        if (isLastDay && savedDepartureTime24 && stillMissing.length > 0) {
          const depMin = parseTimeToMinutes(savedDepartureTime24);
          if (depMin > 0) {
            // Mirror §15z: 180m flight buffer (we don't have transport mode here,
            // but flight is the conservative default for an airport departure).
            const FLIGHT_BUFFER_MIN_LOCAL = 180;
            const PRE_BUFFER = 60;
            const transferCutoffMin = depMin - FLIGHT_BUFFER_MIN_LOCAL;
            const fmt = (m: number) => {
              const h = Math.max(0, Math.floor(m / 60));
              const mm = Math.max(0, m % 60);
              return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
            };
            const before = stillMissing.slice();
            stillMissing = stillMissing.filter((m: RequiredMeal) => {
              const slotStart = parseTimeToMinutes(SLOT_TIMES[m].start);
              const fits = slotStart + PRE_BUFFER <= transferCutoffMin;
              if (!fits) {
                console.warn(`[MEAL_PERSIST_SKIP_DEPARTURE] day=${dayNumber} meal=${m} slot=${SLOT_TIMES[m].start} cutoff=${fmt(transferCutoffMin)} dep=${savedDepartureTime24} — skipping injection (would land in transfer window)`);
              }
              return fits;
            });
            if (stillMissing.length !== before.length) {
              (day as any).metadata = (day as any).metadata || {};
              (day as any).metadata.quality = (day as any).metadata.quality || {};
              (day as any).metadata.quality.meal_persist_skipped_departure = before.filter((m: RequiredMeal) => !stillMissing.includes(m));
            }
          }
        }
        if (stillMissing.length === 0) continue;
        console.warn(`[MEAL_PERSIST_FAIL] day=${dayNumber} missing=[${stillMissing.join(',')}] dest="${destForInvariant}" — injecting preserveAsManualPick sentinels`);
        for (const meal of stillMissing) {
          const label = meal.charAt(0).toUpperCase() + meal.slice(1);
          const slot = SLOT_TIMES[meal];
          day.activities.push({
            id: crypto.randomUUID(),
            title: `${label} — find a local spot in ${destForInvariant}`,
            startTime: slot.start,
            endTime: slot.end,
            category: 'dining',
            location: { name: `${label} — find a local spot in ${destForInvariant}`, address: destForInvariant },
            cost: { amount: 0, currency: 'USD', source: 'meal_persist_invariant' },
            cost_per_person: 0,
            description: `No vetted ${meal} venue available — ask the concierge or pick a local favourite on arrival.`,
            tags: ['dining', meal, 'meal-guard', 'manual-pick'],
            bookingRequired: false,
            transportation: { method: 'walk', duration: '5 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
            tips: `Ask the concierge or a local for a great ${meal} spot nearby.`,
            needsRefinement: true,
            metadata: { needsVenuePick: true, unverified_venue: true, preserveAsManualPick: true },
          } as any);
        }
        // Re-sort by startTime so the new card lands in the right place.
        day.activities.sort((a: any, b: any) => parseTimeToMinutes(a.startTime || a.start_time || a.time)
          - parseTimeToMinutes(b.startTime || b.start_time || b.time));
      }
      (itinerary as any).days = itineraryDays;
    }
  }

  // ── STEP 2.65: DEPARTURE-DAY LOGISTICS NET (§15z save-time) ──────
  // Catch-all safety net mirroring repair-day's §15z. Closes the recurring
  // "floating dining card on departure day" bug where any upstream code path
  // (meal-guard, manual edit, undo/redo, chat-action, optimistic patch) added
  // an untimed or post-cutoff dining/leisure card. §15z drops them, retimes
  // checkout/transfer to flight-aware caps. Idempotent — only runs on last day.
  // See mem://constraints/itinerary/departure-day-save-time-enforcement
  if (totalDays > 0 && itineraryDays.length > 0) {
    try {
      const { enforceDepartureDayLogistics } = await import('./pipeline/repair-day.ts');
      const tripMetaForNet = ((trip as any)?.metadata || {}) as Record<string, any>;
      const hotelNameNet: string =
        tripMetaForNet?.selected_hotel?.name ||
        tripMetaForNet?.hotel?.name ||
        tripMetaForNet?.accommodation?.name ||
        'your hotel';
      const hotelAddressNet: string =
        tripMetaForNet?.selected_hotel?.address ||
        tripMetaForNet?.hotel?.address ||
        tripMetaForNet?.accommodation?.address ||
        '';
      const lastIdx = itineraryDays.length - 1;
      const lastDay = itineraryDays[lastIdx];
      if (lastDay?.activities && Array.isArray(lastDay.activities)) {
        const lockedIds = new Set<string>(
          (lastDay.activities as any[])
            .filter((a) => a?.locked === true || a?.isLocked === true || a?.is_locked === true || a?.lock_state === 'locked')
            .map((a) => String(a.id))
            .filter(Boolean)
        );
        const beforeLen = lastDay.activities.length;
        const enforcement = enforceDepartureDayLogistics({
          activities: lastDay.activities as any[],
          dayNumber: lastDay.dayNumber || (lastIdx + 1),
          hotelName: hotelNameNet,
          hotelAddress: hotelAddressNet,
          returnDepartureTime24: savedDepartureTime24,
          isLastDay: true,
          lockedIds,
        } as any);
        if (Array.isArray(enforcement?.activities)) {
          lastDay.activities = enforcement.activities;
        }
        const droppedCount = beforeLen - (lastDay.activities?.length || 0);
        const repairs = enforcement?.repairs || [];
        if (repairs.length > 0 || droppedCount !== 0) {
          (lastDay as any).metadata = (lastDay as any).metadata || {};
          (lastDay as any).metadata.quality = (lastDay as any).metadata.quality || {};
          (lastDay as any).metadata.quality.save_time_departure_repairs = repairs;
          console.log(
            `[SAVE_DEPARTURE_NET] day=${lastDay.dayNumber || (lastIdx + 1)} dropped=${Math.max(0, droppedCount)} repairs=${repairs.length} depTime=${savedDepartureTime24 || 'n/a'}`
          );
        }
        (itinerary as any).days = itineraryDays;
      }
    } catch (netErr) {
      console.warn('[save-itinerary] STEP 2.65 departure-day net failed (non-blocking):', netErr);
    }
  }

  // ── STEP 2.67: AIRPORT-TRANSIT MODE NET ───────────────────────────
  // Force any "Walk to Transfer to Airport — 1h 46m" class card to taxi
  // with ≤45min duration. Runs on every day (not just the last) because
  // multi-city trips have airport transfers on transition days too.
  // See mem://constraints/itinerary/airport-transit-must-be-taxi
  try {
    const { enforceAirportTransitOnDay } = await import('../_shared/airport-transit-classifier.ts');
    for (const day of itineraryDays) {
      const acts = (day as any).activities;
      if (!Array.isArray(acts) || acts.length === 0) continue;
      const lockedIds = new Set<string>(
        acts
          .filter((a: any) => a?.locked === true || a?.isLocked === true || a?.is_locked === true || a?.lock_state === 'locked')
          .map((a: any) => String(a.id))
          .filter(Boolean)
      );
      const fixed = enforceAirportTransitOnDay(acts, { lockedIds });
      if (fixed > 0) {
        console.warn(`[SAVE_AIRPORT_TRANSIT] day=${(day as any).dayNumber} cards_fixed=${fixed}`);
      }
    }
  } catch (atErr) {
    console.warn('[save-itinerary] STEP 2.67 airport-transit net failed (non-blocking):', atErr);
  }

  // ── STEP 2.68: ORPHAN-TRANSIT SAFETY NET ──────────────────────────
  // Final pass that drops "Walk to X" connectors when X no longer appears in
  // the day (cross-city/placeholder strip / manual edit / undo / chat edit).
  // Mirrors the executioner's pass so chat/save paths that don't re-run the
  // executioner can't leak orphans like Amsterdam "Walk to Cafe Chris".
  try {
    const { pruneOrphanTransits } = await import('../_shared/orphan-transit.ts');
    for (const day of itineraryDays) {
      const removed = pruneOrphanTransits(day.activities || []);
      if (removed > 0) {
        console.warn(`[SAVE_ORPHAN_TRANSIT] day=${day.dayNumber} removed=${removed}`);
      }
    }
  } catch (orphanErr) {
    console.warn('[save-itinerary] STEP 2.68 orphan-transit net failed (non-blocking):', orphanErr);
  }



  // ── STEP 2.7: DINING DESCRIPTION BACKSTOP ─────────────────────────
  // Final pass that fills any blank/templated dining blurbs before persistence.
  // Catches:
  //   - meal-guard injections that the per-day post-guard fill missed
  //   - legacy trips loaded with the "real local spot worth visiting" template
  //   - blanked-by-ensureDiningDescription templated leaks with no inline match
  // Per-day batched LLM call (8s timeout each) — only fires when day has flagged
  // dining cards. Runs all days in parallel to bound total latency.
  try {
    const { fillAfterMealGuard } = await import('../_shared/post-meal-guard-fill.ts');
    const destForFill = (currentTrip as any)?.destination || (trip as any)?.destination;
    await Promise.all(itineraryDays.map((d: any, idx: number) =>
      fillAfterMealGuard(d.activities || [], destForFill, idx + 1, 'save-itinerary:final-dining-fill')
    ));
  } catch (fillErr) {
    console.warn('[save-itinerary] final dining-fill pass failed (non-blocking):', fillErr);
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
  // Hoisted so the canonical integrity contract at the freeze stamp can read it.
  let mergedIntentsForContract: any[] = [];
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

      // ── CANONICAL PREFERENCE-SPINE MERGE ──
      // Same module used by compile-prompt. Always merges structured rows +
      // metadata blobs; never gates one source on the other being empty.
      // See mem://constraints/itinerary/canonical-preference-spine.
      let mergedIntents: any[] = [];
      let tripWideFromTable: string[] = [];
      try {
        const { fetchActiveDayIntents } = await import('../_shared/day-intents-store.ts');
        const { mergePreferenceSources } = await import('../_shared/preference-spine.ts');
        const structuredRows = tripId ? await fetchActiveDayIntents(supabase, tripId) : [];
        const merge = mergePreferenceSources({
          structuredRows: structuredRows as any,
          additionalNotes: additionalNotes || '',
          recordedIntents,
          mustDoActivities: (tripMeta as any)?.mustDoActivities,
          perDayActivities: Array.isArray((tripMeta as any)?.perDayActivities)
            ? ((tripMeta as any).perDayActivities as Array<{ dayNumber: number; activities: string }>)
            : undefined,
          tripStartDate: tripStartFromDb,
          totalDays: itineraryDays.length,
        });
        mergedIntents = merge.intents;
        mergedIntentsForContract = merge.intents;
        tripWideFromTable = merge.tripWideNotes;
        console.log(
          `[save-itinerary] PREFERENCE_SPINE total=${merge.intents.length} ` +
          `tripWideNotes=${merge.tripWideNotes.length} bySource=${JSON.stringify(merge.counts)}`,
        );
      } catch (e) {
        console.warn('[save-itinerary] preference-spine merge failed (non-blocking):', e);
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

        // Pull merged intents for this day (per-day + trip-wide actionable wishes).
        const extraIntents: Array<{
          title: string;
          startTime?: string;
          endTime?: string;
          kind?: string;
          source?: string;
          priority?: 'must' | 'should';
          raw?: string;
        }> = [];
        for (const i of mergedIntents) {
          if (i.locked) continue; // locked rows already covered by anchors
          if (i.priority === 'avoid') continue;
          if (i.dayNumber != null && i.dayNumber !== dn) continue;
          extraIntents.push({
            title: i.title,
            startTime: i.startTime,
            endTime: i.endTime,
            kind: i.kind,
            source: i.source,
            priority: i.priority === 'must' ? 'must' : 'should',
            raw: i.raw,
          });
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

      let lc: { days: any[]; removed: number; inserted: number; warnings: any[] };
      if (skipLedgerCheck) {
        // Reload/self-heal saves MUST NOT run destructive ledger trims
        // (repeat_already_done, closure-violation, vibe-clash mutations) —
        // those passes only belong on user-mutating saves. See
        // mem://constraints/itinerary/ledger-check-mutation-only.
        console.log(`[save-itinerary] ledgerCheck SKIPPED reason=${saveReason}`);
        lc = { days: itineraryDays, removed: 0, inserted: 0, warnings: [] };
      } else {
        lc = await ledgerCheck(itineraryDays, ledgers, { supabase, tripId });
      }
      if (lc.removed > 0 || lc.inserted > 0 || lc.warnings.length > 0) {
        console.log(`[save-itinerary] 🧭 Day Brief: removed ${lc.removed}, inserted ${lc.inserted} placeholder(s), warnings ${lc.warnings.length}`);
        for (const w of lc.warnings.slice(0, 20)) {
          console.log(`[save-itinerary]   • [day ${w.dayNumber}] ${w.kind}: ${w.detail}`);
        }
        itineraryDays = lc.days;
        (itinerary as any).days = itineraryDays;
      }
      console.log(`[save-itinerary] POST-VALIDATE counts (post ledgerCheck, skipped=${skipLedgerCheck}): ${countDays(itineraryDays)}`);


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

      // ── SEMANTIC FULFILLMENT TRACE (soft, annotation-only) ──
      // Canonical-preference-spine §5: alias-aware matcher catches "sushi
      // lunch" → omakase, "rooftop" → skybar, "spa" → wellness. Trace-only —
      // we DO NOT mutate the itinerary on a soft miss (that's what the
      // generation prompt + day-brief are for). Surfaces silent preference
      // collapse in logs so we can flag trips that shipped without honoring
      // a Step-3 wish. See mem://constraints/itinerary/canonical-preference-spine.
      try {
        const { matchDayIntents } = await import('../_shared/preference-matcher.ts');
        let totalExpected = 0;
        let totalFulfilled = 0;
        let totalMissed = 0;
        const missedByDay: Array<{ day: number; missed: string[] }> = [];
        const softIntents = mergedIntents.filter((i: any) => !i.locked && i.priority !== 'avoid');
        for (const d of itineraryDays) {
          const dn = (d.dayNumber as number) || 0;
          if (!dn) continue;
          const summary = matchDayIntents(softIntents as any, dn, (d.activities || []) as any);
          if (summary.totalIntents === 0) continue;
          totalExpected += summary.totalIntents;
          totalFulfilled += summary.fulfilledCount;
          totalMissed += summary.missedCount;
          if (summary.missedCount > 0) {
            missedByDay.push({
              day: dn,
              missed: summary.details.filter((x) => !x.fulfilled).map((x) => x.title).slice(0, 6),
            });
          }
        }
        console.log(
          `[save-itinerary] PREFERENCE_SPINE fulfillment expected=${totalExpected} ` +
          `fulfilled=${totalFulfilled} missed=${totalMissed}` +
          (missedByDay.length > 0 ? ` missedByDay=${JSON.stringify(missedByDay)}` : '')
        );
      } catch (matchErr) {
        console.warn('[save-itinerary] preference-matcher trace failed (non-blocking):', matchErr);
      }

      // ── MUST-DO COVERAGE RESTAMP ─────────────────────────────────────────
      // Whenever the itinerary is rewritten, refresh `metadata.must_do_coverage`
      // so we never carry a stale "missing=[]" stamp from a prior generation
      // (root cause of Rome `d18b2e8a…` reporting green while Days 2–3 had
      // no Pantheon/Trevi/Vatican). The matcher itself is tightened — whole-
      // word match + identity-fields-only haystack. See
      // supabase/functions/_shared/assert-must-do-coverage.ts.
      try {
        const { assertMustDoCoverage } = await import('../_shared/assert-must-do-coverage.ts');
        const { extractMustDoVenues } = await import('../_shared/extract-must-dos.ts');
        const { data: tripMetaRow } = await supabase
          .from('trips').select('metadata').eq('id', tripId).single();
        const tmd = (tripMetaRow?.metadata as Record<string, any>) || {};
        const mustDos = extractMustDoVenues(tmd);
        if (mustDos.length > 0) {
          // Read coverage from the DB row JUST written, not the in-memory
          // pre-persist days — persist-itinerary / sync-tables can drop
          // injected must-do anchors on cascade/chronology collision.
          // See plan: must-do coverage from DB source of truth.
          let coverageDays: any[] = itineraryDays;
          try {
            const { data: freshRow } = await supabase
              .from('trips').select('itinerary_data').eq('id', tripId).single();
            const freshDays = (freshRow?.itinerary_data as any)?.days;
            if (Array.isArray(freshDays) && freshDays.length > 0) {
              coverageDays = freshDays;
            }
          } catch (refetchErr) {
            console.warn('[save-itinerary] coverage DB re-fetch failed (non-fatal):', refetchErr);
          }
          const coverage = assertMustDoCoverage(coverageDays, mustDos);
          const nextMeta = {
            ...tmd,
            must_do_coverage: { ...coverage, at: new Date().toISOString() },
          };
          await supabase.from('trips')
            .update({ metadata: nextMeta })
            .eq('id', tripId);
          if (coverage.missing.length > 0) {
            console.warn(`[save-itinerary] MUST_DO_UNCOVERED trip=${tripId} missing=${JSON.stringify(coverage.missing)} scheduled=${coverage.scheduled.length}/${coverage.total}`);
          } else {
            console.log(`[save-itinerary] must-do coverage OK (DB-sourced) ${coverage.scheduled.length}/${coverage.total}`);
          }
        }
      } catch (covErr) {
        console.warn('[save-itinerary] must-do coverage restamp failed (non-blocking):', covErr);
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

  // ── EMPTY / INCOMPLETE ITINERARY GATE ────────────────────────
  // Mirror of the Stage 6 gate in generation-core.ts. Manual / assistant
  // saves should never produce a 'ready' trip with no real activities OR
  // a degenerate hotel-only / hotel + single filler plan — both cause the
  // Budget Coach to surface phantom suggestions.
  let emptyItineraryDetected = false;
  let failureReason: 'empty_itinerary' | 'incomplete_itinerary' | null = null;
  try {
    const { classifyItineraryCompleteness } = await import('./day-validation.ts');
    const probe = classifyItineraryCompleteness((itinerary as any)?.days || []);
    if (probe.status === 'empty') {
      emptyItineraryDetected = true;
      failureReason = 'empty_itinerary';
      console.warn(
        `[save-itinerary] EMPTY ITINERARY DETECTED — meaningfulCount=0, days=${probe.dayCount}, tripId=${tripId}`
      );
    } else if (probe.status === 'incomplete') {
      emptyItineraryDetected = true;
      failureReason = 'incomplete_itinerary';
      console.warn(
        `[save-itinerary] INCOMPLETE ITINERARY DETECTED — paid=${probe.paidMeaningfulCount} meaningful=${probe.meaningfulCount} days=${probe.dayCount}, tripId=${tripId}`
      );
    }
  } catch (e) {
    console.warn('[save-itinerary] empty-itinerary probe failed (non-blocking):', e);
  }

  let existingMetadataForEmpty: Record<string, any> = {};
  if (emptyItineraryDetected) {
    try {
      const { data: tRow } = await supabase
        .from('trips')
        .select('metadata')
        .eq('id', tripId)
        .single();
      existingMetadataForEmpty = (tRow?.metadata as any) || {};
    } catch {
      existingMetadataForEmpty = {};
    }
  }

  // ── STEP 2.9: FINAL TIMING-CONFLICT SWEEP ─────────────────────────
  // Catches same-start collisions and insufficient transit buffers that the
  // generator's per-day repair didn't handle (and that any non-generator save
  // path — manual paste, assistant tool edit — wouldn't have run at all).
  // Without this, refresh-day flags conflicts the user has to fix manually.
  // ── STEP 2.93: NORMALIZE LOCKED FLAGS ─────────────────────────────
  // RS.7 — Different parts of the pipeline read `locked`, `isLocked`, or
  // `is_locked`. If only one is set, downstream sanitizers silently treat
  // the activity as unlocked and regenerate over user pins. Stamp all
  // three spellings whenever any of them is truthy.
  for (const day of itineraryDays) {
    if (!Array.isArray(day?.activities)) continue;
    for (const act of day.activities as any[]) {
      if (act?.locked || act?.isLocked || act?.is_locked) {
        act.locked = true;
        act.isLocked = true;
        act.is_locked = true;
      }
    }
  }

  try {
    const { enforceTimingAndBuffers } = await import('../_shared/timing-cascade.ts');
    let totalFixed = 0;
    for (const day of itineraryDays) {
      if (!Array.isArray(day?.activities) || day.activities.length < 2) continue;
      const lockedIds = new Set<string>(
        (day.activities as any[])
          .filter((a) => a?.locked === true || a?.lock_state === 'locked')
          .map((a) => String(a.id))
      );
      const cascade = enforceTimingAndBuffers(day.activities as any[], { lockedIds });
      day.activities = cascade.activities as any[];
      totalFixed += cascade.repairs.length;
    }
    if (totalFixed > 0) {
      console.log(`[save-itinerary] ⏱️ timing-cascade applied ${totalFixed} pre-save fix(es)`);
      (itinerary as any).days = itineraryDays;
    }
  } catch (cascadeErr) {
    console.warn('[save-itinerary] timing-cascade pre-save sweep failed (non-blocking):', cascadeErr);
  }

  // ── STEP 2.95: NORMALIZE DURATION STRINGS ─────────────────────────
  // Kill any "45:00:00"-shaped duration the AI / manual edits / pasted
  // data may have left behind. Without this, raw JSON carries clock-style
  // duration strings even though the UI hides them via render-time coerce.
  // Duration normalize + persist-day contract + write all happen inside
  // the shared persistTripItinerary helper so every write path enforces the
  // same boundary contract.
  const { persistTripItinerary } = await import('../_shared/persist-itinerary.ts');

  // ── STEP 2.96: SCHEDULE SANITY PASS (pre-validation chokepoint) ──
  // Runs BEFORE validateItineraryForPersist so persist_validation describes
  // the final repaired plan, not stale pre-repair data. Catches the Rome
  // Day 1 class: 00:00 dinner, arrival sequence reversed, duplicate hotel
  // returns, indoor-daylight landmarks after dark, adjacent hotel-transit
  // stubs. See mem://constraints/itinerary/schedule-sanity-persist-chokepoint.
  let preValidationSanityIssues: any[] = [];
  try {
    const { sanitizeSchedule } = await import('../_shared/sanitize-schedule-timing.ts');
    const r = sanitizeSchedule((itinerary as any).days || [], {
      site: 'save-itinerary',
      arrivalTime24: savedArrivalTime24 ?? null,
      departureTime24: savedDepartureTime24 ?? null,
    });
    preValidationSanityIssues = r.counters.issues;
    if (r.touchedDays > 0) {
      (itinerary as any).days = r.days;
    }
  } catch (sanityErr) {
    console.warn('[save-itinerary] schedule sanity pass failed (non-blocking):', sanityErr);
  }

  // ── PERSIST VALIDATION GATE (LOCK 3) ─────────────────────────────
  // Run the dry-run gate BEFORE persist so we can stamp metadata in the
  // same write. The trip still persists (so the user keeps their work),
  // but a 422 is returned with the per-day issues for the UI banner.
  // See .lovable/plan.md (Stage 1).
  let persistVerdict = validateItineraryForPersist((itinerary as any).days || [], {
    destination: (currentTrip as any)?.destination ?? null,
    arrivalTime24: savedArrivalTime24,
    departureTime24: savedDepartureTime24,
  });
  if (preValidationSanityIssues.length > 0) {
    const { mergeScheduleSanityIssues } = await import('../_shared/validate-itinerary-for-persist.ts');
    persistVerdict = mergeScheduleSanityIssues(persistVerdict, preValidationSanityIssues);
  }
  if (!persistVerdict.ok) {
    console.warn(
      `[PERSIST_GATE] tripId=${tripId} errors=${persistVerdict.errors.length} ` +
      `warnings=${persistVerdict.warnings.length} codes=[${[...new Set(persistVerdict.errors.map(e => e.code))].join(',')}]`,
    );
    // Per-error trace lines so post-mortem can see WHICH day + WHICH rule blocked.
    for (const err of persistVerdict.errors.slice(0, 20)) {
      await appendGenerationTrace(supabase, tripId, {
        action: 'save-itinerary',
        phase: 'persist_gate_blocked',
        status: 'fail',
        dayNumber: (err as any).dayNumber,
        errorCode: err.code,
        errorMessage: (err as any).message || (err as any).detail,
      });
    }
  } else {
    await appendGenerationTrace(supabase, tripId, {
      action: 'save-itinerary',
      phase: 'persist_gate_checked',
      status: 'ok',
      jsonDayCount: ((itinerary as any)?.days || []).length,
    });
  }

  const persistValidationStamp = {
    checked_at: new Date().toISOString(),
    ok: persistVerdict.ok,
    errors: persistVerdict.errors,
    warnings: persistVerdict.warnings,
  };

  let nextStatus: 'ready' | 'generated' | 'partial' | 'failed' =
    emptyItineraryDetected ? 'failed' : (persistVerdict.ok ? 'ready' : 'partial');

  // ── CANONICAL COMMIT GATE ──
  // Single shared boundary (used by generation-core Stage 6 and
  // action-generate-trip-day Phase 6 too) that demotes ready→partial when
  // hard semantic failures survived every prior layer. See
  // _shared/commit-itinerary.ts + _shared/itinerary-integrity-contract.ts.
  let integrityMetadataPatch: Record<string, any> = {};
  let saveCommitToken: string | null = null;
  try {
    const { resolveCommitGate } = await import('../_shared/commit-itinerary.ts');
    const tripMetaForContract = (trip.metadata as Record<string, any>) || {};
    const contractHotelName: string | null =
      tripMetaForContract?.selected_hotel?.name
        || tripMetaForContract?.hotel?.name
        || tripMetaForContract?.accommodation?.name
        || null;
    const requiredIntents = Array.isArray(mergedIntentsForContract)
      ? mergedIntentsForContract
          .filter((i: any) => i?.priority === 'must' && typeof i?.title === 'string' && i.title.trim().length > 0)
          .map((i: any) => ({ title: String(i.title), dayNumber: typeof i.dayNumber === 'number' ? i.dayNumber : null }))
      : [];
    const gateResult = await resolveCommitGate({
      supabase,
      tripId,
      days: ((itinerary as any)?.days) || [],
      proposedStatus: nextStatus,
      preloaded: {
        hotelName: contractHotelName,
        requiredIntents,
        arrivalTime24: savedArrivalTime24 || null,
        departureTime24: savedDepartureTime24 || null,
      },
      label: 'save-itinerary',
    });
    nextStatus = gateResult.status;
    integrityMetadataPatch = gateResult.metadataPatch;
    saveCommitToken = gateResult.commitToken || null;
  } catch (icErr) {
    console.warn('[INTEGRITY_CONTRACT] gate failed (non-blocking — allowing prior nextStatus):', icErr);
  }

  // ── FREEZE STAMP ──
  // First time the trip transitions to ready/generated, stamp
  // metadata.itinerary_frozen_at so future page-load self-heal writes are
  // permanently blocked. The stamp is "has ever been ready" — once set, it
  // stays set even if a later partial save flips status back. See
  // mem://constraints/itinerary/frozen-after-ready.
  const existingFrozenAt = ((trip.metadata as Record<string, any>) || {})?.itinerary_frozen_at;
  const freezeStamp = (nextStatus === 'ready' || nextStatus === 'generated')
    ? (existingFrozenAt || new Date().toISOString())
    : existingFrozenAt;

  const extraUpdate: Record<string, any> = {
    // NOTE: itinerary_status enum is {not_started, queued, generating, partial, ready, failed}.
    // 'needs_regeneration' is NOT a valid value — using it rolls back the entire trips.update
    // with Postgres 22P02, leaving partial side-effects (cost-table sync, normalized tables)
    // and causing post-refresh divergence. Use 'partial' for the non-ok-but-non-empty branch.
    itinerary_status: nextStatus,
    updated_at: new Date().toISOString(),
    ...(callerExtraUpdate && typeof callerExtraUpdate === 'object' ? callerExtraUpdate : {}),
    metadata: {
      ...(callerExtraUpdate?.metadata || {}),
      ...(emptyItineraryDetected ? { ...existingMetadataForEmpty, generation_failure_reason: failureReason, empty_itinerary_detected_at: new Date().toISOString() } : {}),
      persist_validation: persistValidationStamp,
      ...integrityMetadataPatch,
      ...(freezeStamp ? { itinerary_frozen_at: freezeStamp } : {}),
      // User edits to an already-ready trip are synchronous — keep fully_persisted true.
      // See mem://constraints/itinerary/saved-badge-honesty.
      ...((nextStatus === 'ready' || nextStatus === 'generated')
        ? { fully_persisted: true, fully_persisted_at: new Date().toISOString() }
        : {}),
    },
  };

  // ── Trip-level duplicate-theme consistency check (observe-only) ──
  const _themeIssues = validateDayThemes((itinerary as any).days || []);
  if (_themeIssues.length > 0) {
    for (const issue of _themeIssues) {
      console.warn(`[consistency] ${issue.type}: ${issue.detail}. ${issue.suggestion}`);
    }
  }

  const { error, regressionBlocked } = await persistTripItinerary(supabase, tripId, itinerary, {
    destination: (currentTrip as any)?.destination ?? null,
    extraUpdate,
    label: 'save-itinerary',
    allowFrozenWrite,
    saveReason,
    commitToken: saveCommitToken,
  });

  if (error) {
    console.error(`[SAVE_TRACE] trace=${saveTraceId} site=exit status=500 reason=persist_error elapsed_ms=${Date.now() - _saveT0}`);
    console.error("[save-itinerary] Failed:", error);
    return errorJson("Failed to save itinerary", 500);
  }

  if (regressionBlocked) {
    // Healthy on-disk plan preserved — DO NOT sync normalized tables from the
    // rejected `itinerary` (they'd re-introduce the regression). The status
    // flags and metadata.rejected_attempts already landed in extraUpdate.
    console.warn('[save-itinerary] regression blocked — kept previous days; skipping table sync');
    return okJson({
      success: true,
      regressionBlocked: true,
      message: 'Kept previous plan — new version was incomplete.',
      mealGuardInjections,
    });
  }

  // ── STEP 4: SYNC TO NORMALIZED TABLES ──────────────────────────
  // RS.6 — Persistence atomicity: JSON in trips.itinerary_data is the source
  // of truth (already saved above). Stamp itinerary_sync_status so the
  // frontend can detect when itinerary_days / itinerary_activities are stale
  // and fall back to JSON or trigger a re-sync.

  // Phase 2: mark sync as pending
  await supabase
    .from('trips')
    .update({ itinerary_sync_status: 'pending', itinerary_synced_at: null })
    .eq('id', tripId);

  // Phase 3: sync normalized tables (non-fatal — JSON is durable)
  let syncSuccess = false;
  try {
    const syncCtx: ActionContext = { supabase, userId, params: { tripId } };
    const { handleSyncItineraryTables } = await import('./action-sync-tables.ts');
    const syncResult = await handleSyncItineraryTables(syncCtx);
    const syncBody = await syncResult.json().catch(() => null);
    if (syncBody && syncBody.success === false) {
      console.error('[save-itinerary] Table sync failed:', syncBody);
    } else {
      syncSuccess = true;
      console.log('[save-itinerary] Table sync complete:', syncBody);
    }
  } catch (syncErr) {
    console.error('[save-itinerary] Table sync error (non-fatal):', syncErr);
  }

  // Phase 4: stamp final itinerary_sync_status
  await supabase
    .from('trips')
    .update({
      itinerary_sync_status: syncSuccess ? 'synced' : 'failed',
      itinerary_synced_at: syncSuccess ? new Date().toISOString() : null,
    })
    .eq('id', tripId);

  // Trigger next journey leg if applicable
  await triggerNextJourneyLeg(supabase, tripId);

  if (!persistVerdict.ok) {
    console.warn(`[SAVE_TRACE] trace=${saveTraceId} site=exit status=200 verdict=needs_regeneration elapsed_ms=${Date.now() - _saveT0} errs=${persistVerdict.errors?.length || 0} warns=${persistVerdict.warnings?.length || 0} syncSuccess=${syncSuccess}`);
    // Return 200 (not 422) so the browser doesn't log a red "Failed to load
    // resource" line on every page-load self-heal. The body still carries
    // `success: false` + `code: 'NEEDS_REGENERATION'`, which is what every
    // client branch reads to surface the in-app banner / suppress for
    // self-heal saves. See mem://constraints/itinerary/persist-issues-toast-user-only.
    return okJson({
      success: false,
      code: 'NEEDS_REGENERATION',
      message: 'Itinerary saved with issues — some days need attention.',
      persistedDespiteErrors: true,
      normalized: true,
      mealGuardInjections,
      errors: persistVerdict.errors,
      warnings: persistVerdict.warnings,
    }, 200);
  }

  console.log(`[SAVE_TRACE] trace=${saveTraceId} site=exit status=200 verdict=ok elapsed_ms=${Date.now() - _saveT0} syncSuccess=${syncSuccess} warns=${persistVerdict.warnings?.length || 0}`);
  return okJson({
    success: true,
    normalized: true,
    mealGuardInjections,
    warnings: persistVerdict.warnings,
  });
}
