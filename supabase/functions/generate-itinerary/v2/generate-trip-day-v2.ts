/**
 * generate-trip-day-v2.ts — Phase B wrapper.
 *
 * Thin orchestration over existing pipeline helpers. Composes:
 *   resolveTripFacts → compileDayFacts → compilePrompt → callAI →
 *   repairDay → applyValidationGate → scrubActivity (+ scrubPhantomEventRefs) →
 *   enrichAndValidateHours → runScheduleExecutioner → meal-guard +
 *   fillAfterMealGuard + runStep8 retry → persistDay (tables) → merge JSON →
 *   assertNoCrossDayBleed + normalizePredawnCascade → applyAnchorsWin +
 *   ledger-check + must-do coverage/injection → nuclear sweeps (cross-city /
 *   dining / wellness) → runBookendVerification → persistTripItinerary +
 *   writeActivityCostsFromItinerary → chain self-invoke next day.
 *
 * Every stage is wrapped in `withStage(trace, …)` for observability parity
 * with v1. Trace recorder runs in noop mode unless a `traceId` is threaded
 * in via params — same contract as v1.
 *
 * DEPLOY MARKER: v2-completeness-heal-background-2026-06-04 — forces a fresh
 * edge deployment artifact so the final-day completeness gate (#17) + its
 * fire-and-forget background heal (#18) go live. Triggers Lovable's bundler
 * directly on code push (no AI-chat credit needed) when the AI deploy prompt
 * is unavailable. (Prior precedent: the PR #11→#12 no-op-deploy marker.)
 *
 * ──────────────────────────────────────────────────────────────────────────
 * STATUS — PHASE D CUTOVER (DEFAULT-ON)
 * ──────────────────────────────────────────────────────────────────────────
 * v2 is now the DEFAULT generation chain for all trips. Kill-switch:
 * `trips.metadata.useV1Chain = true` forces the legacy v1 handler for
 * emergency rollback. Soak window: 1 week before Phase E deletion.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { corsHeaders } from '../action-types.ts';
import { resolveTripFacts } from '../../_shared/trip-facts.ts';
import { compileDayFacts } from '../pipeline/compile-day-facts.ts';
import { compilePrompt } from '../pipeline/compile-prompt.ts';
import { compileDaySchema } from '../pipeline/compile-day-schema.ts';
import { callAI } from '../pipeline/ai-call.ts';
import { repairDay } from '../pipeline/repair-day.ts';
import { applyValidationGate } from '../pipeline/validation-gate.ts';
import { validateDay } from '../pipeline/validate-day.ts';
import { enrichAndValidateHours } from '../pipeline/enrich-day.ts';
import { verifyAndDropVenues } from '../verify-drop-venues.ts';
import { persistDay } from '../pipeline/persist-day.ts';
import { persistTripItinerary } from '../../_shared/persist-itinerary.ts';
import { writeActivityCostsFromItinerary } from '../../_shared/write-activity-costs.ts';
import { scrubActivity } from '../../_shared/scrub-activity.ts';
import { buildDayScheduleSummary, scrubPhantomEventRefs } from '../../_shared/prompt-leak-scrub.ts';
import { runScheduleExecutioner, toExecutionerAuditCodes } from '../../_shared/schedule-executioner.ts';
import { applyAnchorsWin } from '../anchor-guard.ts';
import { runBookendVerification } from '../../_shared/bookend-verification.ts';
import { assertNoCrossDayBleed } from '../../_shared/cross-day-bleed-guard.ts';
import { normalizePredawnCascade } from '../../_shared/predawn-cascade-normalize.ts';
import { assertMustDoCoverage, dropRedundantInjectedMustDos } from '../../_shared/assert-must-do-coverage.ts';
import { injectMissingMustDos } from '../../_shared/inject-missing-must-dos.ts';
import { extractMustDoVenues } from '../../_shared/extract-must-dos.ts';
import { fillAfterMealGuard } from '../../_shared/post-meal-guard-fill.ts';
import { enforceRequiredMealsFinalGuard, detectMealSlots } from '../day-validation.ts';
import { collapseRedundantInjectedMeals } from '../../_shared/meal-protection.ts';
import { runStep8, terminalCleanup } from '../universal-quality-pass.ts';
import { reorderDayByProximity, retimeAndComputeLegTimes } from '../geographic-coherence.ts';
import { selfCheckAndRepair } from '../../_shared/itinerary-self-check.ts';
import { crossDayDedup } from '../_shared/cross-day-dedup.ts';
import { makePlacesAlternatives } from '../_shared/places-alternatives.ts';
import { ledgerCheck } from '../ledger-check.ts';
import { nuclearCrossCitySweep, nuclearDiningStrip, nuclearWellnessSweep } from '../fix-placeholders.ts';
import { scrubEventVibeFiller, scrubNextDayTipLeak } from '../sanitization.ts';
import { ensureHostCityEventExperience } from '../../_shared/host-city-events.ts';
import { resolveScheduleOverlaps, dropOrphanTransit } from '../../_shared/schedule-overlap.ts';
import { noopTrace, attachTrace, withStage, type Trace } from '../../_shared/trace-recorder.ts';
import { runDetectorRepairs } from './detector-repairs.ts';
import { findEmptyDays, mapTableRowsToActivities, applyHealedDay } from './completeness-gate.ts';
import { stampArrivalAnchorTruth } from '../../_shared/stamp-arrival-anchor-truth.ts';
import { stampDepartureAnchorTruth } from '../../_shared/stamp-departure-anchor-truth.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/**
 * Read a day's persisted activities from the authoritative
 * `itinerary_days` → `itinerary_activities` tables (written by persistDay,
 * step 7) and map them back to the in-memory JSON shape. Used by the
 * final-day completeness gate to recover a day whose JSON merge was lost.
 * Returns [] when the day row or its activities are absent.
 */
async function readDayActivitiesFromTable(
  supabase: any,
  tripId: string,
  dayNumber: number,
): Promise<any[]> {
  const { data: dayRow } = await supabase
    .from('itinerary_days')
    .select('id')
    .eq('trip_id', tripId)
    .eq('day_number', dayNumber)
    .maybeSingle();
  if (!dayRow?.id) return [];
  const { data: rows } = await supabase
    .from('itinerary_activities')
    .select('*')
    .eq('itinerary_day_id', dayRow.id)
    .order('sort_order', { ascending: true });
  return mapTableRowsToActivities(rows || []);
}

export async function handleGenerateTripDayV2(
  supabase: any,
  userId: string,
  params: Record<string, any>,
): Promise<Response> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!;
  const { tripId, dayNumber, traceId } = params;
  // `heal` marks a re-entrant regeneration fired by the final-day completeness
  // gate to fill a genuinely-empty day. A heal run skips the chain self-invoke
  // (no cascade) and skips the completeness gate (no nested recursion) — it
  // only re-generates + persists its own day, then returns.
  const heal = params.heal === true;

  if (!tripId || typeof dayNumber !== 'number') {
    return new Response(
      JSON.stringify({ success: false, error: 'tripId and dayNumber required', code: 'V2_BAD_INPUT' }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const t0 = Date.now();
  const trace: Trace = traceId ? attachTrace(traceId) : noopTrace();
  console.log(`[v2] generate-trip-day tripId=${tripId} day=${dayNumber} user=${userId}`);

  try {
    // ── 1. Unified facts (Phase A) ─────────────────────────────────────
    const facts = await withStage(trace, 'compile_facts', { dayNumber, inputs: { tripId } }, async (ctx) => {
      const f = await resolveTripFacts(supabase, tripId);
      ctx.outputs = { destination: f.destination.city, totalDays: f.dates.totalDays };
      return f;
    });
    const totalDays = facts.dates.totalDays;
    const isFirstDay = dayNumber === 1;
    const isLastDay = totalDays > 0 && dayNumber === totalDays;
    // NOTE: `isLastDay`/`isFirstDay` stay TRUE for a 0-night local day trip —
    // it genuinely IS the trip's only/last day, so the last-day CATCH-ALLS
    // (must-do coverage @ 8g, thin-day heal scheduling @ ~1088, cross-day
    // dedup) must still run. What a local day trip is NOT is an arrival or a
    // DEPARTURE day. That distinction is `isArrivalDay`/`isDepartureDay`,
    // derived once below from dayFacts.isLocalDayTrip; the arrival/departure-
    // specific passes (executioner, terminalCleanup, departure stamps/cleanup)
    // key off those, not the raw day flags.

    // Compute the calendar date for this day.
    const dayDate = (() => {
      if (!facts.dates.startDate) return null;
      const d = new Date(facts.dates.startDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + (dayNumber - 1));
      return d.toISOString().slice(0, 10);
    })();

    // Cancel-flag guard — chain self-invoke writes generation_cancelled.
    // Also: stamp `metadata.quality.v2_chain_used = true` unconditionally so
    // the 7-day soak (before Phase E v1 deletion) produces real evidence that
    // the v2 chain is actually serving trips. Mirrors the v1 stamp in
    // generate-itinerary/index.ts kill-switch branch. See soak-telemetry note.
    {
      const { data: cancelRow } = await supabase
        .from('trips')
        .select('metadata')
        .eq('id', tripId)
        .maybeSingle();
      if ((cancelRow?.metadata as any)?.generation_cancelled === true) {
        console.log(`[v2] generation_cancelled=true — short-circuit day=${dayNumber}`);
        return new Response(
          JSON.stringify({ success: false, cancelled: true, code: 'V2_CANCELLED' }),
          { status: 200, headers: jsonHeaders },
        );
      }
      // Soak-telemetry stamp (read-modify-write JSON merge — matches the
      // pattern used elsewhere in this file for metadata writes; safe to
      // race with Phase-6 freeze because we only set a single quality key).
      try {
        const priorMeta = (cancelRow?.metadata as any) || {};
        const priorQuality = priorMeta.quality || {};
        // Start-of-day heartbeat — keeps the launcher watchdog fresh even when a
        // single day's generation is slow (issue #1). Always written; the
        // v2_chain_used soak stamp piggybacks on the same merge.
        await supabase
          .from('trips')
          .update({
            metadata: {
              ...priorMeta,
              generation_heartbeat: new Date().toISOString(),
              quality: { ...priorQuality, v2_chain_used: true },
            },
          })
          .eq('id', tripId);
      } catch (e) {
        // Telemetry/heartbeat only; never block generation on stamp failure.
        console.warn(`[v2] start-of-day heartbeat/stamp failed (non-fatal):`, (e as Error)?.message);
      }
    }


    // ── 2. Day-scoped facts (existing helper) ──────────────────────────
    const dayFacts = await withStage(trace, 'compile_facts', { dayNumber, inputs: { stage: 'day' } }, async () =>
      compileDayFacts(supabase, userId, {
        ...params,
        tripId,
        dayNumber,
        totalDays,
        destination: facts.destination.city,
        destinationCountry: facts.destination.country,
        date: dayDate,
        travelers: facts.travelers.count,
        preferences: facts.preferences.interests,
        isMultiCity: (params as any).isMultiCity,
      })
    );

    // ── C3 cross-day variety: feed already-used venues to the prompt so the
    // LLM doesn't reuse the same restaurant/attraction on multiple days. Each
    // day generates independently (chain self-invoke), so without this the
    // model has no memory of prior days and repeats "Granja Viader" all trip.
    // compilePrompt already has a "DO NOT USE THESE" variety rule — it was just
    // never given the list. Non-blocking; empty list on day 1 / read failure.
    let usedRestaurantsForPrompt = [];
    let usedVenuesForPrompt = [];
    try {
      const { data: priorRow } = await supabase.from('trips').select('itinerary_data').eq('id', tripId).maybeSingle();
      const priorDays = Array.isArray(priorRow?.itinerary_data?.days) ? priorRow.itinerary_data.days : [];
      const restSet = new Set(); const venSet = new Set();
      for (const pd of priorDays) {
        if ((pd?.dayNumber ?? 0) === dayNumber) continue;
        for (const a of (pd?.activities || [])) {
          const nm = a?.location?.name || a?.venue_name || a?.venueName || a?.title || a?.name;
          if (!nm) continue;
          const t = String(a?.title || a?.name || '');
          const cat = String(a?.category || '').toLowerCase();
          if (cat === 'dining' || cat === 'restaurant' || /\b(breakfast|brunch|lunch|dinner)\b/i.test(t)) restSet.add(String(nm));
          else if (!/^\s*(walk|travel|transfer|taxi|train|bus|metro|depart|arriv|check[- ]?(in|out)|return to)/i.test(t)) venSet.add(String(nm));
        }
      }
      usedRestaurantsForPrompt = [...restSet];
      usedVenuesForPrompt = [...venSet];
    } catch (_e) { /* non-blocking */ }

    // ── 3. Compile prompt + schema ─────────────────────────────────────
    const compiled = await withStage(trace, 'compile_prompt', { dayNumber }, async () =>
      compilePrompt(supabase, userId, OPENROUTER_API_KEY, {
        ...params,
        tripId,
        dayNumber,
        totalDays,
        destination: facts.destination.city,
        date: dayDate,
        travelers: facts.travelers.count,
        tripType: facts.preferences.tripType,
        budgetTier: facts.preferences.budgetTier,
        preferences: facts.preferences.interests,
        usedRestaurants: usedRestaurantsForPrompt,
        usedVenues: usedVenuesForPrompt,
      }, dayFacts)
    );

    const schema = await withStage(trace, 'compile_schema', { dayNumber }, () =>
      compileDaySchema({ dayNumber, totalDays, facts: dayFacts, compiled } as any)
    );

    // ── 4. LLM call ────────────────────────────────────────────────────
    const ai = await withStage(trace, 'ai_call', { dayNumber }, async (ctx) => {
      const r = await callAI({
        systemPrompt: compiled.systemPrompt,
        userPrompt: compiled.userPrompt,
        apiKey: OPENROUTER_API_KEY,
        dayNumber,
        trace,
        tracePurpose: 'generate-trip-day-v2',
      } as any);
      ctx.outputs = { success: r.success, activities: r.day?.activities?.length || 0 };
      return r;
    });

    if (!ai.success || !ai.day) {
      return new Response(
        JSON.stringify({ success: false, error: 'V2 AI call failed', code: 'V2_AI_FAIL' }),
        { status: 502, headers: jsonHeaders },
      );
    }

    // ── 5. Validation + repair + validation gate ───────────────────────
    const repairHotelName = dayFacts.resolvedHotelOverride?.name || dayFacts.flightContext?.hotelName || facts.hotel.name || undefined;
    const repairHotelAddress = dayFacts.resolvedHotelOverride?.address || dayFacts.flightContext?.hotelAddress || facts.hotel.address || '';
    const repairHasHotel = !!(repairHotelName || repairHotelAddress);
    const repairArrivalTime24 = dayFacts.flightContext?.arrivalTime24 || facts.arrival.time24 || undefined;
    const repairDepartureTime24 = dayFacts.flightContext?.returnDepartureTime24 || facts.departure.time24 || undefined;
    const mealPolicyForDay = facts.mealPolicy(dayNumber);

    // ── LOCAL DAY-TRIP (0-night, no hotel, no flights) ───────────────────
    // compile-day-facts is the single source of truth (dayFacts.isLocalDayTrip)
    // and already demoted the PROMPT-side flags so compile-prompt frames a full
    // exploration day. Here we derive the arrival/departure-specific flags the
    // post-LLM passes use. A local day trip is NEITHER an arrival nor a
    // departure day, so the executioner / terminalCleanup / departure stamps +
    // final departure-cleanup are all suppressed — but isFirstDay/isLastDay
    // stay true so the last-day catch-alls (must-do coverage, thin-day heal,
    // dedup) still run. Re-checked against the orchestrator's authoritative
    // hotel/flight signals so a 1-day trip that DOES have a hotel or flight is
    // treated as a normal arrival+departure day.
    const isLocalDayTrip = !!dayFacts.isLocalDayTrip
      && !repairHasHotel && !repairArrivalTime24 && !repairDepartureTime24;
    const isArrivalDay = isFirstDay && !isLocalDayTrip;
    const isDepartureDay = isLastDay && !isLocalDayTrip;
    if (isLocalDayTrip) {
      console.log(`[v2] LOCAL_DAY_TRIP day=${dayNumber} — full exploration day; arrival/departure passes suppressed, last-day catch-alls retained.`);
    }

    // ── 5a. STAMP ARRIVAL ANCHOR TRUTH (Day 1, post-LLM, pre-validate) ──
    // Authoritative overwrite of the arrival-flight card's start/end to
    // the user's ground-truth landing time, before any other pass can
    // touch it. Idempotent — safe to call again later in the pipeline.
    if (isArrivalDay && repairArrivalTime24) {
      const stamp = stampArrivalAnchorTruth(ai.day, {
        isFirstDay: true,
        arrivalTime24: repairArrivalTime24,
        arrivalAirport: facts.arrival.airport || dayFacts.flightContext?.arrivalAirport || null,
        isHotelChange: dayFacts.resolvedIsHotelChange,
      });
      if (stamp.mutated) {
        console.log(
          `[STAMP_ARRIVAL_TRUTH] v2 day=${dayNumber} was=${stamp.wasStart}-${stamp.wasEnd} now=${stamp.newStart}-${stamp.newEnd} (truth=${repairArrivalTime24})`,
        );
      }
    }

    // ── 5b. STAMP DEPARTURE ANCHOR TRUTH (last day, post-LLM, pre-validate) ──
    // Mirror of arrival stamper — overwrite hallucinated departure-flight
    // card with the user's real return-departure time.
    if (isDepartureDay && repairDepartureTime24) {
      const stampDep = stampDepartureAnchorTruth(ai.day, {
        isLastDay: true,
        departureTime24: repairDepartureTime24,
        departureAirport: (facts as any)?.departure?.airport || (dayFacts.flightContext as any)?.return?.departureAirport || null,
        boardingLeadMins: 45,
      });
      if (stampDep.mutated) {
        console.log(
          `[STAMP_DEPARTURE_TRUTH] v2 day=${dayNumber} was=${stampDep.wasStart}-${stampDep.wasEnd} now=${stampDep.newStart}-${stampDep.newEnd} (truth=${repairDepartureTime24})`,
        );
      }
    }





    const { data: preRepairTripRow } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .maybeSingle();
    const previousDaysForValidation: any[] = Array.isArray(preRepairTripRow?.itinerary_data?.days)
      ? preRepairTripRow.itinerary_data.days.filter((d: any) => (d?.dayNumber ?? 0) !== dayNumber)
      : [];

    const preRepairValidations = await withStage(trace, 'validate_day_pre_repair', { dayNumber }, (ctx) => {
      const v = validateDay({
        day: ai.day,
        dayNumber,
        isFirstDay,
        isLastDay,
        totalDays,
        destination: facts.destination.city,
        hasHotel: repairHasHotel,
        hotelName: repairHotelName,
        arrivalTime24: repairArrivalTime24,
        returnDepartureTime24: repairDepartureTime24,
        requiredMeals: mealPolicyForDay.requiredMeals || [],
        previousDays: previousDaysForValidation,
        dietaryRestrictions: facts.preferences.dietary || [],
        mustDoActivities: facts.mustHaves?.map((m: any) => m.title || m.name || '').filter(Boolean) || [],
        isHotelChange: dayFacts.resolvedIsHotelChange,
        previousHotelName: dayFacts.resolvedPreviousHotelName,
        budgetTier: facts.preferences.budgetTier,
      } as any);
      ctx.outputs = { issues: v.length };
      return v;
    });

    const repaired = await withStage(trace, 'repair_day', { dayNumber }, () =>
      repairDay({
        day: ai.day,
        validationResults: preRepairValidations,
        dayNumber,
        isFirstDay,
        isLastDay,
        isLocalDayTrip,
        arrivalTime24: repairArrivalTime24,
        returnDepartureTime24: repairDepartureTime24,
        arrivalAirport: facts.arrival.airport || undefined,
        airportTransferMinutes: dayFacts.airportTransferMinutes,
        hotelName: repairHotelName,
        hotelAddress: repairHotelAddress,
        hasHotel: repairHasHotel,
        lockedActivities: dayFacts.lockedActivities ?? [],
        restaurantPool: [],
        usedRestaurants: usedRestaurantsForPrompt,
        isTransitionDay: dayFacts.resolvedIsTransitionDay,
        isMultiCity: dayFacts.resolvedIsMultiCity,
        isLastDayInCity: dayFacts.resolvedIsLastDayInCity,
        resolvedDestination: dayFacts.resolvedDestination || facts.destination.city,
        nextLegTransport: dayFacts.resolvedNextLegTransport,
        nextLegCity: dayFacts.resolvedNextLegCity,
        nextLegTransportDetails: dayFacts.resolvedNextLegTransportDetails,
        hotelOverride: dayFacts.resolvedHotelOverride,
        isHotelChange: dayFacts.resolvedIsHotelChange,
        previousHotelName: dayFacts.resolvedPreviousHotelName,
        previousHotelAddress: dayFacts.resolvedPreviousHotelAddress,
        earliestStart: facts.arrival.earliestFirstActivityTime || undefined,
        budgetTier: facts.preferences.budgetTier,
        paceScore: facts.travelers.profile?.traitScores?.pace,
        destination: facts.destination.city,
        destinationCountry: facts.destination.country,
        facts: dayFacts,
        compiled,
        mealPolicy: mealPolicyForDay,
      } as any)
    );

    const validations = await withStage(trace, 'validate_day', { dayNumber }, (ctx) => {
      const v = validateDay({
        day: repaired.day,
        dayNumber,
        isFirstDay,
        isLastDay,
        totalDays,
        destination: facts.destination.city,
        hasHotel: repairHasHotel,
        hotelName: repairHotelName,
        arrivalTime24: repairArrivalTime24,
        returnDepartureTime24: repairDepartureTime24,
        requiredMeals: mealPolicyForDay.requiredMeals || [],
        previousDays: previousDaysForValidation,
        dietaryRestrictions: facts.preferences.dietary || [],
        mustDoActivities: facts.mustHaves?.map((m: any) => m.title || m.name || '').filter(Boolean) || [],
        isHotelChange: dayFacts.resolvedIsHotelChange,
        previousHotelName: dayFacts.resolvedPreviousHotelName,
        budgetTier: facts.preferences.budgetTier,
      } as any);
      ctx.outputs = { issues: v.length };
      return v;
    });

    const gated = applyValidationGate(repaired.day, validations, { dayNumber, label: 'v2' } as any);

    // ── 5b. scrubActivity + scrubPhantomEventRefs per card ─────────────
    // See mem://constraints/itinerary/unified-output-validation-layer +
    //     mem://constraints/itinerary/schedule-coherent-copy.
    const scrubAgg = { titleLeak: 0, bodyLeak: 0, fragment: 0, mealSuffix: 0, crossCity: 0, countryMismatch: 0, phantomRef: 0, downgraded: 0 } as Record<string, number>;
    if (Array.isArray(gated.day?.activities)) {
      const summary = buildDayScheduleSummary(gated.day.activities);
      for (const a of gated.day.activities) {
        const ops = scrubActivity(a, { destination: facts.destination.city });
        for (const k of Object.keys(scrubAgg)) {
          scrubAgg[k] += (ops as any)[k] || 0;
        }
        try {
          const phantom = scrubPhantomEventRefs(a, summary);
          if (phantom.changed) scrubAgg.phantomRef += phantom.stripped;
        } catch (_e) { /* non-blocking */ }
      }
      console.log(`[v2] [SCRUB_ACTIVITY] day=${dayNumber} dest=${facts.destination.city} ops=${JSON.stringify(scrubAgg)}`);
    }

    // ── 6. Address / hours enrichment ──────────────────────────────────
    const enriched = await withStage(trace, 'enrich_day', { dayNumber }, () =>
      enrichAndValidateHours({
        supabase,
        tripId,
        dayNumber,
        destination: facts.destination.city,
        destinationCountry: facts.destination.country,
        activities: gated.day.activities,
      } as any)
    );

    let finalDay: any = { ...gated.day, activities: enriched };

    // ── 6a0. Venue grounding — drop NAMED venues Google Places can't verify
    // (hallucinations like "Marrakesh Market → modern Israeli cuisine"). Runs
    // BEFORE the meal-coverage gate + thin-day backfill so dropped slots get
    // refilled. STRICTLY FAIL-OPEN: only confident not-found / cross-city /
    // low-overlap drops; no key, API errors, timeouts, budget, or cache hits all
    // keep the venue. See verify-drop-venues.ts.
    try {
      const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
      if (googleKey) {
        const vd = await verifyAndDropVenues(finalDay.activities, {
          destination: facts.destination.city,
          supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
          supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
          googleKey,
          timeBudgetMs: 20_000,
        });
        if (vd.dropped.length > 0) {
          finalDay.activities = vd.activities;
          console.log(`[v2] [VENUE_GROUNDING] day=${dayNumber} checked=${vd.checked} verified=${vd.verified} dropped=${vd.dropped.length}: ${vd.dropped.map((d) => `${d.title}(${d.reason})`).join(', ')}`);
        }
      }
    } catch (e) {
      console.warn('[v2] venue grounding failed (non-blocking):', e);
    }

    // ── 6a. Phase C: v2 detector→repair upgrades ────────────────────────
    // Closing-hours drop + overlap auto-shift (cap 90min/day) + transit-sanity widen.
    // Runs AFTER enrich (needs venue hours + coords) and BEFORE executioner so
    // the executioner's geo/flight/buffer pass sees the cleaned schedule.
    try {
      const det = await withStage(trace, 'v2_detector_repairs', { dayNumber }, (ctx) => {
        const r = runDetectorRepairs(finalDay.activities, dayNumber);
        ctx.outputs = r.counters as any;
        return r;
      });
      finalDay.activities = det.activities;
      finalDay.metadata = finalDay.metadata || {};
      finalDay.metadata.quality = finalDay.metadata.quality || {};
      finalDay.metadata.quality.v2_detector_repairs = det.counters;
      if (det.unresolvedOverlaps.length > 0) {
        finalDay.metadata.quality.unresolved_overlaps = det.unresolvedOverlaps;
      }
    } catch (e) {
      console.warn('[v2] detector-repairs failed (non-blocking):', e);
    }

    // ── 6b. Schedule Executioner — deterministic post-pipeline chokepoint
    // See mem://constraints/itinerary/schedule-executioner.
    if (Array.isArray(finalDay.activities) && finalDay.activities.length > 0) {
      try {
        const geoDropEnabled = (Deno.env.get('EXECUTIONER_GEO_DROP_ENABLED') || '').toLowerCase() === 'true';
        const execCtx = {
          dayNumber,
          totalDays,
          // Arrival/departure flags — false for a local day trip so the
          // executioner skips departure-transfer flagging + orphan-transit
          // handling and never treats the day as having a flight terminal.
          isFirstDay: isArrivalDay,
          isLastDay: isDepartureDay,
          arrivalTime24: isArrivalDay ? facts.arrival.time24 : null,
          departureTime24: isDepartureDay ? facts.departure.time24 : null,
          dayTitle: finalDay?.title || finalDay?.theme || null,
          budgetTier: facts.preferences.budgetTier ?? null,
          geoFlagOnly: !geoDropEnabled,
          geoDropEnabled,
          rawFlightSelection: null,
          destinationIata: isArrivalDay ? facts.destination.iata : null,
          hotelName: facts.hotel.name,
        } as any;
        const exec = runScheduleExecutioner(finalDay.activities, execCtx);
        finalDay.activities = exec.activities;
        finalDay.metadata = finalDay.metadata || {};
        finalDay.metadata.quality = finalDay.metadata.quality || {};
        finalDay.metadata.quality.executioner = {
          flightAnchorRepaired: exec.counters.flightAnchorRepaired,
          midnightSpilloversAllowed: exec.counters.midnightSpilloversAllowed,
          midnightSpilloversDropped: exec.counters.midnightSpilloversDropped,
          bufferRepairs: exec.counters.bufferRepairs,
          overlapRepairs: exec.counters.overlapRepairs,
          transitRecomputed: exec.counters.transitRecomputed,
          geoOutliersFlagged: exec.counters.geoOutliersFlagged,
          geoOutliersDropped: exec.counters.geoOutliersDropped,
          droppedActivities: exec.counters.droppedActivities,
          gapsRefilled: exec.counters.gapsRefilled,
          geoDropEnabled,
        };
        finalDay.metadata.quality.executioner_audit = toExecutionerAuditCodes(exec.counters, dayNumber);
        console.log(
          `[v2] [EXECUTIONER_SUMMARY] day=${dayNumber} flight=${exec.counters.flightAnchorRepaired} buffer=${exec.counters.bufferRepairs} overlap=${exec.counters.overlapRepairs} geoFlagged=${exec.counters.geoOutliersFlagged} dropped=${exec.counters.droppedActivities}`,
        );
      } catch (execErr) {
        console.warn('[v2] schedule-executioner failed (non-blocking):', execErr);
      }
    }

    // ── 6c. Meal-guard + post-fill ─────────────────────────────────────
    // Per mem://constraints/itinerary/day-end-hotel-return-bookend +
    //     mem://constraints/itinerary/dining-description-persist-net.
    //
    // The meal guard is PRIMARY — it guarantees breakfast/lunch/dinner
    // coverage. Its failure must NEVER be silently swallowed: a thrown guard
    // (or one that doesn't fully resolve) means a genuine meal gap ships and
    // the user sees "Day N missing dinner" with no record of why. We keep
    // generation alive (no rethrow — a crashed day is worse than a logged
    // gap) but RECORD every outcome in metadata.quality.meal_audit so the
    // integrity gate + flight recorder see it instead of a silent hole.
    try {
      const mealPolicy = facts.mealPolicy(dayNumber);
      if (mealPolicy.requiredMeals.length > 0) {
        const detectedPre = detectMealSlots(finalDay.activities || []);
        const missingPre = mealPolicy.requiredMeals.filter((m) => !detectedPre.includes(m));
        if (missingPre.length > 0) {
          const fmgResult = enforceRequiredMealsFinalGuard(
            finalDay.activities,
            mealPolicy.requiredMeals,
            dayNumber,
            facts.destination.city || 'the destination',
            'USD',
            mealPolicy.dayMode,
            [], // no per-day pool prefetch in v2 minimal port (fillAfterMealGuard re-describes)
            {
              departureTime24: dayNumber === totalDays ? (facts.departure?.time24 || undefined) : undefined,
            },
          );
          if (!fmgResult.alreadyCompliant) {
            finalDay.activities = fmgResult.activities as any;
            finalDay.metadata = finalDay.metadata || {};
            finalDay.metadata.quality = finalDay.metadata.quality || {};
            finalDay.metadata.quality.meal_audit = {
              required: mealPolicy.requiredMeals,
              detected_pre: detectedPre,
              missing_pre: missingPre,
              injected: fmgResult.injectedMeals,
              source: 'v2:final-per-day',
            };
            console.warn(`[v2] [MEAL_AUDIT] day=${dayNumber} required=[${mealPolicy.requiredMeals.join(',')}] injected=[${fmgResult.injectedMeals.join(',')}]`);
            // Description backfill is SECONDARY — wrap it separately so its
            // failure can never discard the meal cards the guard just injected.
            try {
              await fillAfterMealGuard(finalDay.activities, facts.destination.city, dayNumber, 'v2:final-per-day');
            } catch (fillErr) {
              console.warn(`[v2] fillAfterMealGuard failed (non-blocking, injected meals retained) day=${dayNumber}:`, fillErr);
            }
          }
        }
        // POST-VERIFY: the guard must leave every required meal present. If any
        // are STILL missing, that's a real coverage gap (guard threw inside,
        // a downstream pass stripped a card, or the window skipped a slot).
        // Record it loudly so it is diagnosable AND so the integrity gate can
        // demote to 'partial' honestly — never ship the gap silently.
        const detectedPost = detectMealSlots(finalDay.activities || []);
        const stillMissing = mealPolicy.requiredMeals.filter((m) => !detectedPost.includes(m));
        if (stillMissing.length > 0) {
          finalDay.metadata = finalDay.metadata || {};
          finalDay.metadata.quality = finalDay.metadata.quality || {};
          finalDay.metadata.quality.meal_audit = {
            ...(finalDay.metadata.quality.meal_audit || {}),
            required: mealPolicy.requiredMeals,
            detected_post: detectedPost,
            unresolved_missing: stillMissing,
            source: 'v2:final-per-day:post-verify',
          };
          console.error(`[v2] [MEAL_GUARD_INCOMPLETE] day=${dayNumber} required=[${mealPolicy.requiredMeals.join(',')}] STILL missing=[${stillMissing.join(',')}] — meal guard did not resolve coverage`);
        }
      }
    } catch (e) {
      // The guard threw — record the gap in metadata so it is never silent,
      // then continue (generation stays alive).
      try {
        finalDay.metadata = finalDay.metadata || {};
        finalDay.metadata.quality = finalDay.metadata.quality || {};
        finalDay.metadata.quality.meal_audit = {
          ...(finalDay.metadata.quality.meal_audit || {}),
          error: e instanceof Error ? e.message : String(e),
          source: 'v2:final-per-day:threw',
        };
      } catch { /* metadata stamp is best-effort */ }
      console.error(`[v2] [MEAL_GUARD_FAILED] day=${dayNumber} meal guard threw — meal coverage NOT enforced:`, e);
    }

    // ── 6d. Step 8 retry (hotel-return bookend) — independent of the guard ──
    // Separated into its own try/catch so a meal-guard failure can't skip the
    // bookend, and a bookend failure can't suppress the meal_audit above.
    // Unconditional, idempotent (per Predawn-Strip Allowlist memory).
    try {
      if (dayNumber < totalDays) {
        const beforeLen = (finalDay.activities || []).length;
        runStep8(finalDay.activities, dayNumber - 1, facts.hotel.name || undefined);
        if ((finalDay.activities || []).length > beforeLen) {
          finalDay.metadata = finalDay.metadata || {};
          finalDay.metadata.quality = finalDay.metadata.quality || {};
          finalDay.metadata.quality.hotel_return_post_meal_guard = true;
          console.log(`[v2] hotel_return_post_meal_guard day=${dayNumber}`);
        }
      }
    } catch (e) {
      console.warn(`[v2] Step 8 (hotel-return) retry failed (non-blocking) day=${dayNumber}:`, e);
    }

    // ── 6d-bis. Geographic clustering + consistent travel times — V2 parity ──
    // The V1 single-day path (action-generate-day.ts) and the V1 full-trip path
    // (action-generate-trip-day.ts) both cluster the day by proximity and rewrite
    // per-leg travel times; the V2 chain (the LIVE production path) did NOT — so
    // real multi-neighbourhood trips shipped city-crossing zig-zags and the
    // "all legs 15m" placeholder symptom. reorderDayByProximity pins meals/locked/
    // bookends, so the meal-guard + step-8 work above survives; the Schedule
    // Executioner above does NOT touch the per-leg transportation.duration field,
    // so there is no conflict. Runs AFTER the executioner and BEFORE terminalCleanup
    // (mirrors the V1 full-trip ordering: cluster + retime, then clean). Non-blocking.
    if (Array.isArray(finalDay.activities) && finalDay.activities.length > 0) {
      try {
        // reorderDayByProximity + retimeAndComputeLegTimes: static imports (top of file).
        const geoDest = facts.destination.city || '';
        const geoLockedIds = new Set<string>(
          ((finalDay.activities as any[]) || [])
            .filter((a: any) => a?.locked || a?.isLocked || a?.lock_state === 'locked')
            .map((a: any) => a?.id).filter(Boolean)
        );
        const reorder = reorderDayByProximity(finalDay.activities, {
          hotelCoords: null,
          lockedIds: geoLockedIds,
          destination: geoDest,
        });
        finalDay.activities = retimeAndComputeLegTimes(reorder.activities, { destination: geoDest });
        if (reorder.reordered || reorder.strippedConnectors > 0) {
          finalDay.metadata = finalDay.metadata || {};
          finalDay.metadata.quality = finalDay.metadata.quality || {};
          finalDay.metadata.quality.geo_order = {
            reordered: reorder.reordered,
            flexible: reorder.flexibleCount,
            stripped_connectors: reorder.strippedConnectors,
            source: 'v2:final-per-day',
          };
          console.log(`[v2] [geo-order] day=${dayNumber}: clustered ${reorder.flexibleCount} flexible stop(s), stripped ${reorder.strippedConnectors} stale connector(s)`);
        }
      } catch (routeErr) {
        console.warn(`[v2] geo-ordering failed (non-blocking) day=${dayNumber}:`, routeErr);
      }
    }

    // ── 6b1. Meal-sanity + late-overflow guard (C7) ──
    // Real clean-trip failures this targets: TWO dinners on one day (19:30 +
    // 23:29) and a nightcap that cascaded to 01:55. Keep ONE of each meal type
    // (the earliest, which is the sensible one) and drop non-logistics cards
    // that overflow past midnight (00:00–04:59). Locked/user items are kept.
    try {
      const seenMeal = new Set();
      finalDay.activities = (finalDay.activities || []).filter((a) => {
        const isLk = a?.locked || a?.isLocked || a?.lock_state === 'locked';
        const t = String(a?.title || a?.name || '').toLowerCase();
        let mt = null;
        if (/\bbreakfast\b/.test(t)) mt = 'breakfast';
        else if (/\blunch\b/.test(t)) mt = 'lunch';
        else if (/\bdinner\b/.test(t)) mt = 'dinner';
        if (mt) {
          // Count the meal even when locked, so a later UNLOCKED duplicate is
          // still detected (the first dinner is often lock_state='locked').
          if (seenMeal.has(mt)) {
            if (!isLk) { console.log(`[v2] meal-dedup day=${dayNumber}: dropped extra ${mt} "${a.title || a.name}"`); return false; }
          } else {
            seenMeal.add(mt);
          }
        }
        const tm = (() => { const x = String(a?.startTime || a?.time || '').match(/(\d{1,2}):(\d{2})/); return x ? (+x[1]) * 60 + (+x[2]) : null; })();
        const cat = String(a?.category || '').toLowerCase();
        const isLog = ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(cat);
        if (!isLk && tm != null && tm < 300 && !isLog) { console.log(`[v2] late-overflow day=${dayNumber}: dropped "${a.title || a.name}" at ${a.startTime || a.time}`); return false; }
        return true;
      });
    } catch (e) {
      console.warn(`[v2] meal-sanity guard failed day=${dayNumber}:`, e);
    }

    // ── 6b2. C5 vague-title sanitize ──
    // Strip placeholder/instruction phrasing the model leaves in titles
    // ("Breakfast — find a local spot in Vienna", "… or similar"). These read
    // as an unfinished to-do note. Clean the text only; the rest is untouched.
    try {
      const VAGUE_STRIP = [
        /\s*[—–-]\s*find (?:a |your )?(?:local|the perfect|a good|a great)?\s*(?:spot|place|restaurant|caf[eé]|eatery|gem|favou?rite|meal)\b/ig,
        /\s*\(?\bor (?:similar|high[- ]?end|comparable)[^)]*\)?/ig,
        /\s*[—–-]\s*(?:a )?(?:nearby|local) (?:caf[eé]|spot|restaurant|eatery)\b/ig,
      ];
      for (const a of (finalDay.activities || [])) {
        if (!a) continue;
        let t = String(a.title || a.name || '');
        const before = t;
        for (const re of VAGUE_STRIP) t = t.replace(re, '');
        t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/[—–-]\s*$/, '').trim();
        if (t && t !== before) { a.title = t; a.name = t; }
      }
    } catch (e) {
      console.warn(`[v2] vague-title sanitize failed (non-blocking) day=${dayNumber}:`, e);
    }

    // ── 6c. Terminal cleanup — V2 departure-day parity ──
    // The V1 / single-day paths run terminalCleanup; the V2 chain (the LIVE
    // production path) did NOT — so no-return-flight trips kept sightseeing +
    // lunch scheduled AFTER the airport transfer and duplicate "Departure" rows.
    // Strip post-barrier non-logistics + collapse duplicate departures on the
    // last day, on the final activities just before persist. Non-blocking.
    try {
      // terminalCleanup is a static import (top of file) — a dynamic import here
      // silently failed in the bundled edge runtime, so per-day departure cleanup never ran.
      terminalCleanup(finalDay.activities, {
        departureTime24: isDepartureDay ? (repairDepartureTime24 || undefined) : undefined,
        city: facts.destination.city,
        dayNumber,
        isFirstDay: isArrivalDay,
        // isDepartureDay (not isLastDay): a local day trip is the last day but
        // has no departure barrier — keep terminalCleanup from stripping the
        // afternoon/evening as if it were post-flight.
        isLastDay: isDepartureDay,
        hotelName: facts.hotel.name || undefined,
      });
    } catch (e) {
      console.warn(`[v2] terminalCleanup failed (non-blocking) day=${dayNumber}:`, e);
    }

    // ── 7. Persist tables (itinerary_days + itinerary_activities) ──────
    const persisted = await withStage(trace, 'persist_gate', { dayNumber }, () =>
      persistDay({
        supabase,
        tripId,
        dayNumber,
        date: dayDate,
        generatedDay: finalDay,
        normalizedActivities: finalDay.activities,
        action: 'generate-trip-day',
        profile: dayFacts as any,
      })
    );

    if (!persisted.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'V2 persistDay failed', code: 'V2_PERSIST_FAIL' }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // ── 8. Patch trips.itinerary_data with this day ────────────────────
    const { data: tripRow } = await supabase
      .from('trips')
      .select('itinerary_data, metadata')
      .eq('id', tripId)
      .maybeSingle();
    const existingDays: any[] = Array.isArray(tripRow?.itinerary_data?.days)
      ? tripRow!.itinerary_data.days
      : [];
    const mergedDays = [...existingDays];
    const idx = mergedDays.findIndex((d: any) => d?.dayNumber === dayNumber);
    const newDayPayload = { ...finalDay, dayNumber, date: dayDate };
    if (idx >= 0) mergedDays[idx] = newDayPayload;
    else mergedDays.push(newDayPayload);
    mergedDays.sort((a: any, b: any) => (a?.dayNumber ?? 0) - (b?.dayNumber ?? 0));

    // ── 8a2. THIN-DAY LANDMARK BACKFILL (heal, middle days only) ────────
    // The thin-day heal re-generates a light middle day, but the regen itself can
    // come back light. Owner: a thin day-3-of-5 is a planning failure — middle
    // days must carry ~2 real activities, NOT get relabeled as "rest". Floor:
    // fill from city_landmarks_cache (the wizard's own suggest-landmarks cache —
    // real venues like "Acropolis of Athens"; populated for every city a user
    // builds, zero extra LLM cost). Skips anything already on the trip.
    // Defined here, INVOKED after the final cross-day dedup (8h2): the heal's
    // LLM output can look full at merge-time and then be thinned BY the dedup
    // (run 5 Athens: D3 healed twice, dedup dropped the dup venues each time,
    // 5 fresh landmarks sat unused because the backfill had already passed).
    // Backfill cards skip the dedup by construction — they're filtered against
    // every title already on the trip — and still pass the 8i self-check.
    const runThinDayBackfill = async () => {
      // Mid-trip heal days OR any single-day trip. The day-trip case
      // (dayNumber === 1 === totalDays) was excluded before, so a vague 1-day
      // request shipped a thin day with no real venues — and the landmark cache
      // is often empty for the city (e.g. Atlanta), so the resolver fallback
      // below supplies real venues when the cache can't.
      if (!((heal && dayNumber > 1 && dayNumber < totalDays) || totalDays === 1)) return;
      try {
        const dayObj: any = newDayPayload;
        const acts: any[] = Array.isArray(dayObj.activities) ? dayObj.activities : (dayObj.activities = []);
        const lcb = (s: unknown) => String(s ?? '').toLowerCase();
        const isLogB = (a: any) => ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(lcb(a?.category)) || /check.?in|check.?out|transfer|airport|\bflight\b|return to|travel to|\bdepart/i.test(lcb(a?.title || a?.name));
        const isMealB = (a: any) => ['breakfast', 'lunch', 'dinner', 'dining', 'restaurant'].includes(lcb(a?.category)) || /\b(breakfast|brunch|lunch|dinner)\b/i.test(lcb(a?.title || a?.name));
        const isDrinkB = (a: any) => /\bnight ?cap\b|late[- ]?night (?:drink|jazz|stroll|out|bar|bite)|evening (?:drink|nightcap)/i.test(lcb(a?.title || a?.name));
        const realCount = acts.filter((a) => !isLogB(a) && !isMealB(a) && !isDrinkB(a)).length;
        const targetReal = totalDays === 1 ? 4 : 2; // a single full local day wants a richer fill
        if (realCount < targetReal) {
          // BARE city — facts.destination.city carries the wizard's full
          // "Athens, Greece" but city_landmarks_cache stores "Athens"; the
          // ilike('%Athens, Greece%') lookup matched nothing and the backfill
          // silently no-opped (streak run 2, Athens D3 shipped thin).
          const city = String(facts.destination.city || '').split(',')[0].trim();
          const { data: lmRow } = await supabase
            .from('city_landmarks_cache').select('landmarks').ilike('city', `%${city}%`).limit(1).maybeSingle();
          const landmarks: any[] = Array.isArray(lmRow?.landmarks) ? lmRow!.landmarks : [];
          const tripBlob = mergedDays
            .flatMap((dd: any) => (Array.isArray(dd?.activities) ? dd.activities : []))
            .map((a: any) => lcb(a?.title || a?.name) + ' ' + lcb(a?.location?.name)).join(' | ');
          let candidates: any[] = landmarks.filter((l: any) => l?.name && !tripBlob.includes(lcb(l.name)));
          // Cache empty/exhausted (e.g. Atlanta has no landmark row) → REASON OUT
          // real venues for the vibe with the grounded resolver (model proposes;
          // cross-city + filler rejection disposes). Safe fallback: [] on error,
          // leaving the day as-is. Killable via VIBE_RESOLVER_DISABLED.
          if (candidates.length < targetReal - realCount && Deno.env.get('VIBE_RESOLVER_DISABLED') !== 'true') {
            try {
              const vibeBits: string[] = [String((tripMeta as any)?.additionalNotes || '')];
              try {
                const { extractMustDoExperiences } = await import('../../_shared/extract-must-dos.ts');
                vibeBits.push(extractMustDoExperiences(tripMeta).join('; '));
              } catch { /* non-fatal */ }
              const vibe = vibeBits.filter(Boolean).join(' ').trim() || 'a balanced first-time day';
              const { resolveVibeToVenues } = await import('../../_shared/resolve-vibe-venues.ts');
              const callModel = async (sys: string, usr: string): Promise<string> => {
                const rr = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: 'google/gemini-2.5-flash', temperature: 0.4, messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }] }),
                });
                if (!rr.ok) return '';
                const jj = await rr.json().catch(() => null);
                return jj?.choices?.[0]?.message?.content ?? '';
              };
              const resolved = await resolveVibeToVenues({ destination: facts.destination.city, vibe, limit: targetReal, callModel });
              const extra = resolved
                .map((v) => ({ name: v.name, category: v.category || 'sightseeing' }))
                .filter((v) => !tripBlob.includes(lcb(v.name)) && !candidates.some((c: any) => lcb(c.name) === lcb(v.name)));
              if (extra.length) {
                candidates = [...candidates, ...extra];
                console.log(`[v2] [THIN_DAY_RESOLVER] day=${dayNumber} city=${city} resolved=${extra.length} real venue(s) (cache had ${landmarks.length})`);
              }
            } catch (e) {
              console.warn('[v2] vibe resolver failed (non-blocking):', (e as Error)?.message);
            }
          }
          const pMinB = (s: unknown) => { const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
          const hhmmB = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
          const taken = acts.map((a) => pMinB(a?.startTime || a?.time)).filter((m): m is number => m != null);
          const slotFree = (m: number) => taken.every((t) => Math.abs(t - m) >= 75);
          const slots = (totalDays === 1 ? [540, 660, 870, 990, 1140] : [600, 900, 990]).filter(slotFree); // single-day → richer fill
          let added = 0;
          for (const lm of candidates) {
            if (added >= Math.min(targetReal - realCount, slots.length)) break;
            const start = slots[added];
            acts.push({
              id: `backfill-${dayNumber}-${added}-${String(lm.name).replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
              title: String(lm.name),
              name: String(lm.name),
              category: String(lm.category || 'sightseeing'),
              description: `One of ${city}'s essential stops.`,
              startTime: hhmmB(start), time: hhmmB(start), endTime: hhmmB(start + 105),
              durationMinutes: 105,
              location: { name: String(lm.name) },
              source: 'thin-day-backfill',
            });
            taken.push(start);
            added++;
          }
          if (added > 0) {
            acts.sort((a: any, b: any) => (pMinB(a?.startTime || a?.time) ?? 1e9) - (pMinB(b?.startTime || b?.time) ?? 1e9));
            console.log(`[v2] [THIN_DAY_BACKFILL] day=${dayNumber} added=${added} from landmarks cache (real=${realCount}→${realCount + added})`);
          }
        }
      } catch (e) {
        console.warn('[v2] thin-day backfill failed (non-blocking):', (e as Error)?.message);
      }
    };

    const tripMeta = (tripRow?.metadata as any) || {};

    // ── 8b. Cross-day quality passes (run every day; cheap + idempotent) ─
    try {
      const bleed = assertNoCrossDayBleed(mergedDays, { site: 'v2' });
      if (bleed.changed) {
        for (let i = 0; i < mergedDays.length && i < bleed.days.length; i++) {
          (mergedDays[i] as any).activities = (bleed.days[i] as any).activities;
        }
        console.log(`[v2] [DAY1_BLEED_GUARD] moved=${bleed.movedCount}`);
      }
    } catch (e) { console.warn('[v2] cross-day-bleed-guard failed:', e); }

    for (let i = 0; i < mergedDays.length; i++) {
      const d = mergedDays[i];
      try {
        const acts = Array.isArray(d?.activities) ? d.activities : [];
        const res = normalizePredawnCascade(acts, i, { dayNumber: d?.dayNumber, site: 'v2' });
        if (res.changed) {
          d.activities = res.activities;
          console.log(`[v2] [PREDAWN_CASCADE_NORMALIZE] day=${d.dayNumber} count=${res.count} shiftMin=${res.shiftMin}`);
        }
      } catch (e) { console.warn('[v2] predawn normalize failed:', e); }
    }

    // ── 8c. Chain-finalization: anchors-win + must-do coverage/injection ─
    let mustDoInjection: any = null;
    try {
      const userAnchors: any[] = Array.isArray(tripMeta.userAnchors) ? tripMeta.userAnchors : [];
      if (userAnchors.length > 0) {
        await withStage(trace, 'anchor_guard', { dayNumber }, (ctx) => {
          const guarded = applyAnchorsWin(mergedDays, userAnchors);
          ctx.outputs = { restored: guarded.restored, reaffirmed: guarded.reaffirmed };
          if (guarded.restored > 0 || guarded.reaffirmed > 0) {
            console.log(`[v2] [ANCHOR_GUARD] restored=${guarded.restored} reaffirmed=${guarded.reaffirmed}`);
          }
          return guarded;
        });
      }

      const mustDos = extractMustDoVenues(tripMeta);
      // Inject ONLY on the full-picture requests (last day / heal). A per-day
      // fill assesses coverage against its STALE view of the trip — under the
      // parallel chain each fill saw "Templo Mayor missing" and injected its
      // own copy, shipping the must-do on D1+D2+D3 with three title variants.
      // Coverage is a cross-day property; only the finalize can judge it.
      if ((isLastDay || heal) && mustDos.length > 0 && mergedDays.length > 0) {
        await withStage(trace, 'must_do_coverage', { dayNumber }, async (ctx) => {
          const coverage = assertMustDoCoverage(mergedDays, mustDos);
          if (coverage.missing.length > 0) {
            mustDoInjection = injectMissingMustDos(mergedDays, coverage.missing, {
              arrivalTime24: facts.arrival.time24,
              departureTime24: facts.departure.time24,
              arrivalBufferMins: 120,
              departureBufferMins: 180,
              transferMinsToAirport: 60,
            } as any);
            console.log(
              `[v2] [MUST_DO_INJECT] attempted=${mustDoInjection.attempted.length} injected=${mustDoInjection.injected.length} unscheduled=${mustDoInjection.unscheduled.length}`,
            );
            // Post-injection description fill for stubs.
            if (mustDoInjection.injected.length > 0) {
              await fillAfterMealGuard(
                mergedDays.flatMap((d: any) => Array.isArray(d?.activities) ? d.activities : []),
                facts.destination.city,
                dayNumber,
                'v2:must-do-inject',
              );
            }
          }
          ctx.outputs = { missing: coverage.missing.length, injected: mustDoInjection?.injected?.length || 0 };
        });
      }
    } catch (e) {
      console.warn('[v2] chain-finalization stages failed (non-blocking):', e);
    }

    // ── 8d. Ledger-check (vibe-clash + repeat detection) ───────────────
    // Pragmatic minimal-port: build a single-day ledger context from
    // mergedDays metadata. Mutating passes (vibe-clash dinner downgrade)
    // still fire because they only need forwardState + alreadyDone.
    try {
      const priorActs = mergedDays
        .filter((d: any) => (d?.dayNumber ?? 0) < dayNumber)
        .flatMap((d: any) => Array.isArray(d?.activities)
          ? d.activities.map((a: any) => ({ title: a?.title || a?.name || '', dayNumber: d.dayNumber }))
          : []);
      const forwardActs = mergedDays
        .filter((d: any) => (d?.dayNumber ?? 0) > dayNumber)
        .flatMap((d: any) => Array.isArray(d?.activities)
          ? d.activities.map((a: any) => ({
              dayNumber: d.dayNumber,
              title: a?.title || a?.name || '',
              category: a?.category,
              startTime: a?.startTime,
              kind: undefined,
            }))
          : []);
      const ledger: any = {
        dayNumber,
        userIntent: [],
        alreadyDone: priorActs.filter((p) => p.title),
        closures: [],
        forwardState: forwardActs.filter((f) => f.title),
      };
      const lc = await withStage(trace, 'ledger_check', { dayNumber }, async (ctx) => {
        const r = await ledgerCheck(mergedDays, [ledger], { supabase, tripId });
        ctx.outputs = { warnings: r.warnings.length, removed: r.removed, inserted: r.inserted };
        return r;
      });
      if (lc.removed > 0 || lc.inserted > 0 || lc.warnings.length > 0) {
        console.log(`[v2] [LEDGER_CHECK] removed=${lc.removed} inserted=${lc.inserted} warnings=${lc.warnings.length}`);
      }
      // ledgerCheck returns mutated days array (same refs).
      if (Array.isArray(lc.days)) {
        for (let i = 0; i < mergedDays.length && i < lc.days.length; i++) {
          (mergedDays[i] as any).activities = (lc.days[i] as any).activities;
        }
      }
    } catch (e) {
      console.warn('[v2] ledger-check failed (non-blocking):', e);
    }

    // ── 8e. Terminal nuclear sweeps (cross-city / dining / wellness) ───
    // Final safety net before persist. See mem://constraints/itinerary/
    // {cross-city-fallback-integrity, orphan-transit-and-dining-strip,
    //  wellness-placeholder-leak-paths}.
    for (const d of mergedDays) {
      const acts = Array.isArray(d?.activities) ? d.activities : null;
      if (!acts) continue;
      try {
        const cc = nuclearCrossCitySweep(acts, facts.destination.city || '');
        if (cc > 0) console.log(`[v2] [NUCLEAR_CROSS_CITY] day=${d.dayNumber} swept=${cc}`);
      } catch (_e) { /* non-blocking */ }
      try {
        const ds = nuclearDiningStrip(acts, facts.destination.city || '');
        if (ds > 0) console.log(`[v2] [NUCLEAR_DINING_STRIP] day=${d.dayNumber} stripped=${ds}`);
      } catch (_e) { /* non-blocking */ }
      try {
        const ws = nuclearWellnessSweep(acts, facts.destination.city || '', facts.hotel.name || undefined);
        if (ws > 0) console.log(`[v2] [NUCLEAR_WELLNESS] day=${d.dayNumber} swept=${ws}`);
      } catch (_e) { /* non-blocking */ }
      try {
        // Major-event vibe-filler scrub. sanitizeGeneratedDay (which also hosts
        // it) is a V1-only path and never runs in the v2 chain, so the scrub
        // must be invoked here or a "{event} vibes" card ships unscrubbed.
        const before = acts.length;
        d.activities = scrubEventVibeFiller(acts);
        if (d.activities.length !== before) console.log(`[v2] [EVENT_VIBE_SCRUB] day=${d.dayNumber} ${before}→${d.activities.length}`);
      } catch (_e) { /* non-blocking */ }
      try {
        // BULLETPROOF backstop: if the trip is for a curated host-city event
        // (e.g. World Cup in Atlanta) on this day's date and the model omitted
        // the real fan festival, inject it deterministically from authoritative
        // data, then re-sort so it sits in chronological order. See
        // host-city-events.ts. Runs AFTER the scrub so its real card survives.
        const dnum = (d?.dayNumber ?? d?.day_number ?? 1);
        let dDate: string | null = null;
        if (facts.dates.startDate) {
          const dd = new Date(facts.dates.startDate + 'T00:00:00Z');
          dd.setUTCDate(dd.getUTCDate() + (Number(dnum) - 1));
          dDate = dd.toISOString().slice(0, 10);
        }
        // Detect the event from ALL intent fields — the chat extractor often
        // drops "World Cup" from additionalNotes and stashes it in
        // mustDoActivities / tripContext instead, so checking only one field
        // misses it (live: notes="no flights…", World Cup in must-dos).
        const intentText = [
          (tripMeta as any)?.additionalNotes,
          Array.isArray((tripMeta as any)?.mustDoActivities) ? (tripMeta as any).mustDoActivities.join(' ') : (tripMeta as any)?.mustDoActivities,
          (tripMeta as any)?.tripContext,
          (tripMeta as any)?.occasion,
          (tripMeta as any)?.tripType,
        ].filter(Boolean).join(' • ');
        const r = ensureHostCityEventExperience(d.activities, {
          destination: facts.destination.city,
          dateISO: dDate,
          notes: intentText,
          dayNumber: dnum,
        });
        if (r.injected) {
          d.activities = r.activities.sort((x: any, y: any) => {
            const pm = (s: any) => { const m = String(s?.startTime || s?.time || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : 9999; };
            return pm(x) - pm(y);
          });
          console.log(`[v2] [HOST_CITY_EVENT] day=${dnum} injected "${r.event?.primaryExperience.name}" (deterministic backstop)`);
        }
      } catch (_e) { /* non-blocking */ }
      try {
        // Timeline-integrity guard — ABSOLUTE LAST timing step. After every
        // injection (meals, host-city events) nothing may be double-booked.
        const ov = resolveScheduleOverlaps(d.activities);
        if (ov.fixed > 0) console.log(`[v2] [OVERLAP_FIX] day=${dnum} resolved ${ov.fixed} overlapping block(s)`);
        // Strip next-day scheduling scaffolding that leaks into insider tips
        // ("…Wake 08:30. Breakfast at West Egg Café (10 min drive…").
        const tipFix = scrubNextDayTipLeak(d.activities);
        if (tipFix > 0) console.log(`[v2] [TIP_LEAK_SCRUB] day=${dnum} cleaned ${tipFix} tip(s)`);
      } catch (_e) { /* non-blocking */ }
    }

    // ── 8f. Persist-boundary bookend verification ──────────────────────
    try {
      const verify = await runBookendVerification(mergedDays, {
        destination: facts.destination.city,
        label: 'v2-bookend',
        expectedTotalDays: totalDays,
        // 0-night local day trip → not a departure day (no return-flight/terminal
        // injection). Only valid when the whole trip is this single local day.
        isLocalDayTrip: isLocalDayTrip && totalDays === 1,
      });
      console.log(
        `[v2] [BOOKEND_VERIFY_SUMMARY] scanned=${verify.scanned} expected=${verify.expected} injected=${verify.injected} missing=${verify.missing}`,
      );
    } catch (e) { console.warn('[v2] bookend-verification failed:', e); }

    // ── 8f.5 FINAL-DAY COMPLETENESS GATE ───────────────────────────────
    // ROOT-CAUSE FIX (issue #1, "Day N shipped empty → Partial despite ready"):
    // an intermittent LLM miss (or a table↔JSON divergence) can leave a day with
    // a title but no activities, and every per-day gate skips an empty day. On
    // the LAST day (non-heal run) verify all days 1..N are non-empty.
    //   Tier 1 — table backfill (cheap, in-request): recovers the divergence
    //     case (table rows committed but JSON merge lost) at zero LLM cost.
    //   Tier 2 — background regen: days still empty after backfill are queued in
    //     `pendingHeals` and re-generated via a FIRE-AND-FORGET self-invoke fired
    //     AFTER this request's JSON write (see step 11b). This MUST NOT be awaited
    //     here: a synchronous regen makes the final-day request overrun the edge
    //     wall-clock budget, the heartbeat goes stale, and the launcher watchdog
    //     (correctly) flags "Generation paused" — converting a healable gap into
    //     a hard stall. The background heal is its own request with its own budget
    //     and heartbeat.
    //   Tier 3 — null-safe 8g meal floor (below) keeps a pending-heal day
    //     non-empty in THIS write until the background heal upgrades it; an
    //     `incomplete_day` flag keeps the health panel honest in the interim.
    let pendingHeals: number[] = [];
    if (isLastDay && !heal) {
      const dayDateFor = (n: number): string | null => {
        if (!facts.dates.startDate) return null;
        const dd = new Date(facts.dates.startDate + 'T00:00:00Z');
        dd.setUTCDate(dd.getUTCDate() + (n - 1));
        return dd.toISOString().slice(0, 10);
      };
      try {
        const empties = findEmptyDays(mergedDays, totalDays);
        if (empties.length > 0) {
          console.error(`[v2] [COMPLETENESS_GATE] last-day check found EMPTY days=[${empties.join(',')}] — healing`);

          // ── Tier 1: backfill from the authoritative itinerary_activities table ──
          for (const dn of empties) {
            try {
              const acts = await readDayActivitiesFromTable(supabase, tripId, dn);
              if (acts.length > 0) {
                applyHealedDay(mergedDays, dn, acts, dayDateFor(dn));
                console.log(`[v2] [COMPLETENESS_HEAL_TABLE] day=${dn} recovered ${acts.length} activities from itinerary_activities`);
              }
            } catch (e) {
              console.warn(`[v2] [COMPLETENESS_HEAL_TABLE] day=${dn} failed:`, (e as Error)?.message);
            }
          }

          // ── Tier 2: queue days still empty for a background regen (step 11b) ──
          pendingHeals = findEmptyDays(mergedDays, totalDays);
          if (pendingHeals.length > 0) {
            console.error(`[v2] [COMPLETENESS_GATE] days needing background regen=[${pendingHeals.join(',')}] — queued; meal floor applies; flagging incomplete`);
            for (const dn of pendingHeals) {
              const d = mergedDays.find((x: any) => (x?.dayNumber ?? x?.day_number) === dn);
              if (d) {
                d.metadata = d.metadata || {};
                d.metadata.quality = d.metadata.quality || {};
                d.metadata.quality.incomplete_day = true;
              }
            }
          } else {
            console.log(`[v2] [COMPLETENESS_GATE] all ${totalDays} days recovered from table — non-empty`);
          }
        }
      } catch (e) {
        console.error('[v2] [COMPLETENESS_GATE] failed (non-blocking):', (e as Error)?.message);
      }
    }

    // ── 8f3. C3 cross-day venue dedup (non-meal repeats) ──
    // The model reuses the same market/viewpoint/venue across days despite the
    // prompt variety rule (clean Lisbon trip had "Mercado de Campo de Ourique"
    // 3× and a Fado bar 2×). Deterministically keep the FIRST occurrence of each
    // non-meal venue and drop later repeats. Meals are LEFT alone — dropping a
    // meal is worse than a repeat restaurant; restaurant-swap needs a venue pool
    // (separate follow-up). Logistics + locked items always kept. Last day only.
    const runCrossDayDedup = async () => {
      try {
        // First: drop must-do cards the per-day injector added redundantly. Under
        // the V2 self-invoke race the injector can fire against a partial view and
        // re-inject a venue the AI already placed on another day, landing a locked
        // duplicate on the departure day (which the cross-day de-dup then refuses
        // to drop because it's a must_do anchor). Run on the complete mergedDays
        // so coverage sees every real placement. See assert-must-do-coverage.ts.
        try {
          const r = dropRedundantInjectedMustDos(mergedDays as any[]);
          if (r.dropped.length > 0) {
            console.log(`[v2] [MUST_DO_INJECT_DEDUP] dropped=${r.dropped.length} redundant injected must-dos`);
          }
        } catch (e) {
          console.warn('[v2] injected-must-do dedup failed (non-blocking):', e);
        }
        // The full cross-day cleanup — meal-time relabel, same-day duplicate-meal
        // drop (auto-lock-aware), cross-day restaurant swap (inline catalog + a
        // Google-Places fallback for non-catalog cities via recommend-restaurants),
        // and non-meal duplicate drop — now lives in the shared module so the
        // regenerate-day path runs the identical logic. See _shared/cross-day-dedup.ts.
        // bare city: the dedup's inline restaurant catalog + generic-meal
        // detection key on "Athens", not "Athens, Greece"
        await crossDayDedup(mergedDays as any[], String(facts.destination.city || '').split(',')[0].trim(), makePlacesAlternatives(supabase, userId));
        // ── must-do-aware cross-day collapse ──────────────────────────────
        // The title-keyed dedup above treats the SAME user must-do venue as
        // distinct when the model renders it with varying titles across days
        // (Istanbul: "Spice Bazaar (Egyptian Bazaar) Exploration" on D1/D2 +
        // "Explore the Spice Bazaar" on D4 all survived). Collapse to ONE card
        // per user must-do, matched by the must-do's core tokens (parentheticals
        // stripped), keeping the first occurrence. Only fires against EXPLICIT
        // user must-do strings, so it can't over-merge unrelated venues.
        try {
          const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'at', 'on', 'explore', 'exploration', 'visit', 'tour', 'see', 'experience', 'time', 'your', 'day', 'morning', 'afternoon', 'evening', 'one', 'memorable']);
          const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
          const coreTokens = (s: unknown) => norm(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t));
          const isLog = (a: any) =>
            ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics', 'travel'].includes(String(a?.category ?? '').toLowerCase()) ||
            /check.?in|check.?out|transfer|airport|\bflight\b|return to|travel to|\bdepart/i.test(String(a?.title ?? a?.name ?? ''));
          const mustDoStrings: string[] = (extractMustDoVenues(tripMeta) as string[]) || [];
          for (const md of mustDoStrings) {
            const mdTokens = coreTokens(md);
            if (mdTokens.length === 0) continue;
            let kept = false;
            for (const d of mergedDays as any[]) {
              if (!Array.isArray(d?.activities)) continue;
              d.activities = d.activities.filter((a: any) => {
                if (isLog(a)) return true;
                const cardN = norm(a?.title ?? a?.name) + ' ' + norm(a?.location?.name);
                if (!mdTokens.every((t) => cardN.includes(t))) return true; // not this must-do
                if (!kept) { kept = true; return true; }                    // keep first occurrence
                drops++; console.log(`[v2] [MUSTDO_DEDUP] dropped repeat of "${md}": "${a?.title || a?.name}"`); return false;
              });
            }
          }
        } catch (e) {
          console.warn('[v2] must-do-aware dedup failed (non-blocking):', e);
        }
      } catch (e) {
        console.warn('[v2] C3 dedup/swap failed (non-blocking):', e);
      }
    };
    // Run once BEFORE 8g (catches model-made dups), then AGAIN after 8g/8h
    // (see 8h2 below) — the meal-coverage gate re-injects meals with the title
    // in location.name, which is how a duplicate breakfast survived on Barcelona.
    // Also run on `heal`: the background completeness-heal re-generates a thin day
    // and can re-introduce a venue that already lives on another day (Buenos Aires:
    // Museo de Arte Moderno landed on D2 AND a healed D4). The heal request never had
    // isLastDay, so dedup never re-ran — gate on heal too (matches selfCheck @1257).
    if (isLastDay || heal) await runCrossDayDedup();

    // ── 8g. FINAL meal-coverage gate — the LAST thing before the write ──
    // ROOT-CAUSE FIX (Day-N-missing-dinner): the 6c meal guard runs
    // mid-pipeline, BEFORE the step-8 mutating passes. ledger-check
    // (vibe-clash / repeated-venue removal, e.g. the same restaurant used on
    // 3 days) and nuclearDiningStrip can REMOVE or downgrade a meal the guard
    // already approved — turning a 19:00 dinner into a mis-timed afternoon
    // "lunch" — and nothing re-verified coverage afterward, so the day shipped
    // without dinner. Re-detect every day here, as the final step, and
    // re-inject anything the late passes dropped. Idempotent: only fires when
    // a required meal is genuinely absent.
    for (const d of mergedDays) {
      const dNum = d?.dayNumber;
      if (typeof dNum !== 'number') continue;
      // Null-safe: an empty/absent-activities day must NOT be skipped — it's
      // exactly the day that needs the meal floor. Normalize to [] so the
      // guard can inject required meals (completeness-gate floor, issue #1).
      if (!Array.isArray(d.activities)) d.activities = [];
      const acts = d.activities;
      try {
        const policy = facts.mealPolicy(dNum);
        if (!policy.requiredMeals.length) continue;
        // ── departure-day meal filter ──────────────────────────────────────
        // An early-departure last day must NOT have a meal re-injected whose slot
        // opens after the airport transfer / checkout. When flight details are
        // skipped, mealPolicy has no departure clock and still "requires" breakfast,
        // but the chain generates an early airport transfer — so the post-checkout
        // strip removes the breakfast, the day looks thin, and 8g re-injects it as a
        // post-departure placeholder (Istanbul D5: 08:30 breakfast after a 07:35
        // transfer). Drop any required meal whose normal slot opens at/after the
        // earliest departure barrier present on the day.
        let requiredMeals: string[] = policy.requiredMeals;
        if (dNum === totalDays) {
          const pMin = (s: unknown) => { const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
          const depTimes = acts
            .filter((a: any) => /airport|\bflight\b|\bdepart|transfer to|check.?out/i.test(String(a?.title || a?.name || '')))
            .map((a: any) => pMin(a?.startTime || a?.time))
            .filter((m: number | null): m is number => m != null);
          if (depTimes.length) {
            const depMin = Math.min(...depTimes);
            const slotOpen: Record<string, number> = { breakfast: 8 * 60, lunch: 12 * 60, dinner: 18 * 60 };
            requiredMeals = requiredMeals.filter((m) => (slotOpen[m] ?? 0) < depMin);
          }
        }
        if (!requiredMeals.length) continue;
        const detected = detectMealSlots(acts);
        const missing = requiredMeals.filter((m) => !detected.includes(m));
        if (missing.length === 0) continue;
        const res = enforceRequiredMealsFinalGuard(
          acts,
          requiredMeals,
          dNum,
          facts.destination.city || 'the destination',
          'USD',
          policy.dayMode,
          [],
          { departureTime24: dNum === totalDays ? (facts.departure?.time24 || undefined) : undefined },
        );
        if (!res.alreadyCompliant) {
          d.activities = res.activities;
          d.metadata = d.metadata || {};
          d.metadata.quality = d.metadata.quality || {};
          d.metadata.quality.meal_audit = {
            ...(d.metadata.quality.meal_audit || {}),
            required: policy.requiredMeals,
            missing_after_passes: missing,
            reinjected: res.injectedMeals,
            source: 'v2:final-coverage-gate',
          };
          console.warn(
            `[v2] [MEAL_FINAL_GATE] day=${dNum} late passes dropped=[${missing.join(',')}] reinjected=[${res.injectedMeals.join(',')}]`,
          );
          try {
            await fillAfterMealGuard(acts, facts.destination.city, dNum, 'v2:final-coverage-gate');
          } catch (fillErr) {
            console.warn(`[v2] final-gate fillAfterMealGuard failed (non-blocking) day=${dNum}:`, fillErr);
          }
        }
      } catch (e) {
        console.warn(`[v2] final meal-coverage gate failed (non-blocking) day=${dNum}:`, e);
      }
      // Collapse any duplicate injected meal sentinels (6c + 8g can each add one
      // since a needsVenuePick sentinel doesn't satisfy meal-detection) into one
      // per slot before the JSON write.
      try {
        const removed = collapseRedundantInjectedMeals(d.activities);
        if (removed > 0) console.log(`[v2] [MEAL_DEDUP] day=${dNum} removed ${removed} redundant injected meal sentinel(s)`);
      } catch (_e) { /* non-blocking */ }
    }

    // ── 8h. FINAL departure-day cleanup (runs AFTER 8g re-injection) ──
    // 8g (meal-coverage) + the departure-transport injection run AFTER the 6c
    // terminalCleanup + 6b2 vague-title pass, so an awkward departure day can
    // still ship a vague "Breakfast — find a local spot" injected at 08:30 AFTER
    // the airport transfer, plus duplicate "Departure" rows. Re-run vague-title
    // sanitize + terminalCleanup on the LAST day here, as the absolute final
    // step before the write, so nothing re-introduced after cleanup survives.
    // isDepartureDay (not isLastDay): a 0-night local day trip has no departure
    // terminal — running this final terminalCleanup would strip its real
    // afternoon/evening as if it were post-flight.
    if (isDepartureDay) {
      try {
        const ld: any = mergedDays.find((d: any) => (d?.dayNumber ?? d?.day_number) === totalDays) || mergedDays[mergedDays.length - 1];
        if (ld && Array.isArray(ld.activities)) {
          const STRIP = [
            /\s*[—–-]\s*find (?:a |your )?(?:local|the perfect|a good|a great)?\s*(?:spot|place|restaurant|caf[eé]|eatery|gem|favou?rite|meal)\b[^,.;]*/ig,
            /\s*\(?\bor (?:similar|high[- ]?end|comparable)[^)]*\)?/ig,
          ];
          for (const a of ld.activities) {
            if (!a) continue;
            let tt = String(a.title || a.name || '');
            const before = tt;
            for (const re of STRIP) tt = tt.replace(re, '');
            tt = tt.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/\s*[—–-]\s*(?:in|at)?\s*the destination\s*$/i, '').replace(/[—–-]\s*$/, '').trim();
            if (tt && tt !== before) { a.title = tt; a.name = tt; }
          }
          // Re-time a mis-placed airport transfer to the ACTUAL departure flight.
          // The model sometimes puts the transfer hours too early (e.g. 07:35
          // for a 15:25 flight), which made terminalCleanup's barrier far too
          // early and wrongly stripped the whole morning. Anchor the transfer at
          // flight − 180min, then re-sort, so cleanup sees a coherent barrier.
          const pM = (s: any) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
          const fM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          let depMin: number | null = repairDepartureTime24 ? pM(repairDepartureTime24) : null;
          for (const a of ld.activities) {
            const tt = String(a?.title || '').toLowerCase(); const c = String(a?.category || '').toLowerCase();
            if (c === 'flight' || /\bdeparture flight\b|\bflight\b/.test(tt)) { const m = pM(a.startTime || a.time); if (m != null) depMin = Math.max(depMin ?? 0, m); }
          }
          if (depMin != null && depMin > 180) {
            const tgt = depMin - 180;
            let retimed = false;
            let transferMin: number | null = null;
            for (const a of ld.activities) {
              const tt = String(a?.title || '').toLowerCase();
              const cc = String(a?.category || '').toLowerCase();
              // Match the airport transfer even when the airport NAME is in the
              // title ("Taxi to London Heathrow Airport"): any transport card
              // mentioning an airport/terminal, or a movement verb toward one.
              if (/\bairport\b|\bterminal\b/.test(tt) && (/transport|transit|transfer|logistics/.test(cc) || /\b(transfer|taxi|head|drive|ride|car|shuttle|travel|head to)\b/.test(tt))) {
                const m = pM(a.startTime || a.time);
                // Anchor the airport transfer at flight − 3h whether the model placed
                // it too EARLY (e.g. 07:35 for a 15:25 flight) OR too LATE (e.g. a
                // 07:35 taxi for an 08:00 transatlantic flight — you'd miss it).
                if (m != null && Math.abs(m - tgt) > 45) { a.startTime = fM(tgt); a.time = a.startTime; retimed = true; console.log(`[v2] [DEP_RETIME] transfer ${fM(m)} → ${fM(tgt)} (flight ${fM(depMin)})`); }
                transferMin = pM(a.startTime || a.time);
              }
            }
            // Checkout can't happen after you've left for the airport — pull it to
            // just before the transfer if the model scheduled it later.
            if (transferMin != null) {
              for (const a of ld.activities) {
                const tt = String(a?.title || '').toLowerCase();
                if (/check[- ]?out/.test(tt)) {
                  const m = pM(a.startTime || a.time);
                  if (m != null && m > transferMin - 15) { a.startTime = fM(Math.max(0, transferMin - 30)); a.time = a.startTime; retimed = true; console.log(`[v2] [DEP_RETIME] checkout ${fM(m)} → ${a.startTime} (before transfer ${fM(transferMin)})`); }
                }
              }
            }
            if (retimed) ld.activities.sort((x: any, y: any) => (pM(x.startTime || x.time) ?? 9999) - (pM(y.startTime || y.time) ?? 9999));
          }
          const finalTC = terminalCleanup; // static import (top of file)
          finalTC(ld.activities, {
            departureTime24: repairDepartureTime24 || undefined,
            city: facts.destination.city,
            dayNumber: totalDays,
            isFirstDay: false,
            isLastDay: true,
            hotelName: facts.hotel.name || undefined,
          });
        }
      } catch (e) {
        console.warn('[v2] final departure-day cleanup failed (non-blocking):', e);
      }
    }

    // ── 8h2. Re-run cross-day de-dup AFTER 8g/8h. The meal-coverage gate (8g)
    // re-injects required meals from the catalog WITHOUT cross-day awareness, so
    // it can re-create a duplicate the first 8f3 pass already cleaned (e.g.
    // Barcelona shipped Syra Coffee on days 2 AND 3 — day 3 was an 8g injection).
    // Running de-dup again here, after all injections, is the final word.
    if (isLastDay || heal) await runCrossDayDedup();

    // ── 8h3. Thin-day landmark backfill — POST-dedup so realCount is judged on
    // the day as it will actually ship. Defined back at 8a2; see comment there
    // for why it must run after the final dedup (run-5 Athens autopsy).
    await runThinDayBackfill();

    // ── 8h4. RELAXED-DAY DENSITY CAP — deterministic backstop to the relaxed
    // prompt (the model over-delivers: a live "walk around" Atlanta day came
    // back with 7 stops to 22:10). Runs AFTER the backfill so it caps the final
    // count: ≤3 meals + ≤2 non-meal stops + transit/protected. Relaxed when the
    // pace is chosen relaxed, the notes use walk-around language, or it's a
    // 0-night day trip — and never when 'packed' was explicitly chosen.
    try {
      const _pace = String((tripMeta as any)?.pacing || '').toLowerCase();
      const _notes = String((tripMeta as any)?.additionalNotes || '').toLowerCase();
      const RELAXED_RE = /\b(walk(?:ing)? around|wander|stroll|chill|relax(?:ed|ing)?|laid.?back|leisurely|slow(?:\s*(?:pace|day))?|take it easy|low.?key|unwind)\b/;
      const isRelaxedDay = _pace !== 'packed' && (_pace === 'relaxed' || RELAXED_RE.test(_notes) || totalDays === 1);
      if (isRelaxedDay) {
        const { trimRelaxedDay } = await import('../../_shared/day-density.ts');
        for (const dd of mergedDays) {
          if (!Array.isArray(dd?.activities)) continue;
          const t = trimRelaxedDay(dd.activities, { maxActivities: 2 });
          if (t.dropped.length > 0) {
            dd.activities = t.activities;
            console.log(`[v2] [RELAXED_CAP] day=${dd.dayNumber ?? '?'} dropped ${t.dropped.length}: ${t.dropped.join(', ')}`);
          }
        }
      }
    } catch (e) {
      console.warn('[v2] relaxed-day cap failed (non-blocking):', e);
    }

    // ── 8h5. Drop a dangling "Travel to X" at the end of a day — the
    // destination venue was removed (venue grounding / dedup / cap) leaving an
    // orphan transit going nowhere (live WC day ended on "Travel to 9 Mile
    // Station" with no activity there). Runs last so it sees the final set.
    try {
      for (const dd of mergedDays) {
        if (!Array.isArray(dd?.activities)) continue;
        const o = dropOrphanTransit(dd.activities);
        if (o.dropped > 0) { dd.activities = o.activities; console.log(`[v2] [ORPHAN_TRANSIT] day=${dd.dayNumber ?? '?'} dropped ${o.dropped} trailing transit`); }
      }
    } catch (_e) { /* non-blocking */ }

    // ── 8i. SELF-CHECK GATE — verify + repair + score before the write ──
    // The auditor's checks, run inside generation as the final quality gate so
    // nothing broken ships: repairs any HIGH-severity issue that slipped through
    // (post-departure activities, prompt-scaffolding cards, duplicate
    // departures) and stamps a 0–100 quality score into trips.metadata for live
    // observability — we can monitor the real distribution instead of only test
    // trips, and flag low-scoring trips for review.
    // Run on the real last day AND on every completeness-heal. A heal
    // regenerates a single (non-last) day, so without `|| heal` that day's
    // fresh output never gets the gate's time repairs (early-breakfast lift,
    // predawn clamp, dangling-title, redundant-leg) and ships ungated — the one
    // path that could still leak a 06:00 breakfast onto a finished trip.
    // mergedDays is the full trip on a heal too, so per-day repairs land on the
    // healed day while the last-day-only strips stay scoped to the actual last day.
    if (isLastDay || heal) {
      try {
        // selfCheckAndRepair is a static import (top of file).
        const sc = selfCheckAndRepair(mergedDays);
        const highCount = sc.issues.filter((i) => i.severity === 'high').length;
        console.log(`[v2] [SELF_CHECK] score=${sc.score} repaired=${sc.repaired} remaining=${sc.issues.length} high=${highCount}`);
        if (sc.score < 75 || highCount > 0) console.warn(`[v2] [SELF_CHECK] LOW score=${sc.score} issues=${JSON.stringify(sc.issues.slice(0, 8))}`);
        // SOFT-WARN — over-capacity: re-check must-do coverage AFTER the gate.
        // The post-checkout strip may have dropped must-dos that genuinely could
        // not fit (e.g. 6 must-dos in a 3-day trip). Surface the unmet ones so the
        // UI can set honest expectations instead of silently cramming them.
        let unmetMustDos: string[] = [];
        try {
          const _md = extractMustDoVenues(tripMeta);
          if (_md.length > 0) {
            unmetMustDos = assertMustDoCoverage(mergedDays, _md).missing;
            // assertMustDoCoverage is venue-NAME based, so an intent must-do with
            // no fixed venue ("one memorable splurge dinner", "a taqueria",
            // "X market") reads as unmet even when a card satisfies the intent
            // (Marrakech/Paris/MexicoCity all HAD a splurge dinner yet it was
            // flagged). Drop any must-do whose salient keyword appears in a card
            // title so the warning lists only genuinely-absent priorities.
            if (unmetMustDos.length > 0) {
              const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
              const titles = norm(mergedDays.flatMap((d: any) => (d?.activities || []).map((a: any) => `${a?.title || a?.name || ''}`)).join(' | '));
              const STOP = new Set(['one', 'memorable', 'traditional', 'where', 'locals', 'actually', 'eat', 'your', 'through', 'some', 'good', 'great', 'best', 'really', 'authentic', 'local', 'morning', 'evening', 'night', 'lunch', 'breakfast', 'spot', 'place', 'visit', 'with', 'from', 'that', 'this', 'must']);
              unmetMustDos = unmetMustDos.filter((m: string) => {
                const words = norm(m).replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter((w: string) => w.length >= 4 && !STOP.has(w));
                return !words.some((w: string) => titles.includes(w)); // any salient word present → intent satisfied
              });
            }
          }
        } catch { /* non-blocking */ }
        try {
          const { data: mRow } = await supabase.from('trips').select('metadata').eq('id', tripId).maybeSingle();
          const meta: any = (mRow?.metadata as any) || {};
          meta.quality = meta.quality || {};
          meta.quality.self_check = { score: sc.score, repaired: sc.repaired, issues: sc.issues.length, high: highCount, top: sc.issues.slice(0, 6), at: dayDate };
          if (sc.score < 75 || highCount > 0) meta.quality.needs_review = true; else delete meta.quality.needs_review;
          if (unmetMustDos.length > 0) {
            meta.quality.capacity_warning = {
              unmet: unmetMustDos,
              message: `This trip was ambitious for its length — we couldn't fit ${unmetMustDos.length} of your must-do${unmetMustDos.length > 1 ? 's' : ''} (${unmetMustDos.join('; ')}). Add a day or two, or trim a priority, and we'll get them all in.`,
            };
            // "Saved for later" holding bay — the dropped must-dos as placeable items.
            // Text-only here (resolved: null); the place-held-item edge action resolves
            // a concrete venue lazily, only when the user actually places one. Stable,
            // deterministic ids so a regenerate doesn't duplicate the same item.
            const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
            meta.holding_bay = unmetMustDos.map((m: string) => ({
              id: `held-${slug(m)}`,
              source: 'capacity_overflow',
              label: m,
              resolved: null,
              originalMustDo: m,
              createdAt: dayDate,
            }));
          } else {
            delete meta.quality.capacity_warning;
            delete meta.holding_bay;
          }
          await supabase.from('trips').update({ metadata: meta }).eq('id', tripId);
        } catch (_e) { /* metadata stamp non-blocking */ }
      } catch (e) {
        console.warn('[v2] self-check gate failed (non-blocking):', e);
      }
    }

    // ── 8z. RACE-SAFE FINAL CLEANUP ────────────────────────────────────
    // The per-day requests run in parallel and EACH writes the whole trip
    // (section 9 below). The last-day request runs crossDayDedup + selfCheck
    // (gated isLastDay||heal), but a NON-last request that finishes LATER then
    // re-persists its own, uncleaned view of the trip — silently clobbering that
    // cleanup. This is how Athens D1's "Return→Nightcap→Return" clutter survived
    // even though selfCheck removes it (proven on the dumped data). Fix: if the
    // trip is already COMPLETE when a non-last request is about to write, re-run
    // the (idempotent) cleanups first, so whichever request writes last always
    // lands a cleaned itinerary. Gated on completeness so it never runs the
    // last-day-only departure strip against a partial trip.
    if (!isLastDay && !heal) {
      try {
        const complete = Array.isArray(mergedDays) && mergedDays.length >= totalDays &&
          mergedDays.slice(0, totalDays).every((d: any) => Array.isArray(d?.activities) && d.activities.length > 0);
        if (complete) {
          await runCrossDayDedup();
          selfCheckAndRepair(mergedDays);
          console.log('[v2] [RACE_SAFE_CLEANUP] re-cleaned an already-complete trip on a non-last write');
        }
      } catch (e) {
        console.warn('[v2] race-safe final cleanup failed (non-blocking):', e);
      }
    }

    // ── 9. Single write of merged JSON ─────────────────────────────────
    // C-PERSIST-1: saveReason MUST be a whitelisted prefix or the frozen gate
    // silently drops this write on an already-ready trip (regenerate-a-day and
    // the background completeness-heal both run on frozen trips). 'v2-day-write'
    // was NOT whitelisted → table updated but JSON didn't → reverted on refresh.
    // This write only ever merges onto current itinerary_data (no stale clobber),
    // so bypassing the freeze here is correct. 'regenerate-' is whitelisted.
    const persistResult = await withStage(trace, 'persist_written', { dayNumber }, () =>
      persistTripItinerary(
        supabase,
        tripId,
        { ...(tripRow?.itinerary_data || {}), days: mergedDays },
        {
          label: 'v2-generate-trip-day', saveReason: 'regenerate-day-v2', finalGate: true,
          // 0-night local day trip → persist's bookend pass must not re-stamp it
          // departure_day / inject a hotel-return (it runs after the orchestrator's
          // own bookend and would otherwise clobber the trace).
          isLocalDayTrip,
          // V2 parallel-race fix: never overwrite the whole days array. A fill (non-last,
          // non-heal) request atomically merges ONLY its own day; the finalize (last-day or
          // heal) merges every cleaned day. No whole-array overwrite ⇒ no concurrent day is
          // ever clobbered (proven: 10 concurrent overwrites kept 1 day, merges kept all 10).
          ...((isLastDay || heal) ? { mergeAllDays: true } : { mergeDayNumber: dayNumber }),
        },
      )
    );

    if (persistResult.error || persistResult.frozenBlocked) {
      console.warn(`[v2] persistTripItinerary not applied: ${persistResult.error || 'frozen'}`);
    }

    // ── 10. Activity costs writer (single source of truth) ─────────────
    await withStage(trace, 'activity_costs_written', { dayNumber }, () =>
      writeActivityCostsFromItinerary(supabase, tripId, mergedDays, {
        destination: facts.destination.city,
        travelers: facts.travelers.count,
        budgetTier: facts.preferences.budgetTier,
      })
    );

    // ── 10b. Refresh generation heartbeat + progress ───────────────────
    // ROOT-CAUSE FIX (issue #1, "Generation paused at Day N"): the launcher
    // watchdog (src/hooks/useGenerationPoller.ts) treats a generation_heartbeat
    // older than STALE_THRESHOLD_MS (5 min) as a dead/zombie run and shows
    // "Generation paused" — even when generation is actively progressing. The
    // v1 chain refreshed the heartbeat per day; the v2 cutover dropped it, so
    // the heartbeat stayed frozen at the kickoff time and any v2 run longer
    // than 5 min (4-day trips, slow LLM days, or a slow final-day hop) was
    // falsely flagged paused despite having finished. Refresh heartbeat +
    // completed-day count after each day persists (high-water mark; never
    // decreases). Best-effort — never block generation on the stamp.
    try {
      const { data: progRow } = await supabase
        .from('trips').select('metadata').eq('id', tripId).maybeSingle();
      const progMeta = (progRow?.metadata as any) || {};
      const priorCompleted = Number(progMeta.generation_completed_days) || 0;
      await supabase.from('trips').update({
        metadata: {
          ...progMeta,
          generation_heartbeat: new Date().toISOString(),
          generation_completed_days: Math.max(priorCompleted, dayNumber),
        },
      }).eq('id', tripId);
    } catch (e) {
      console.warn(`[v2] heartbeat/progress refresh failed (non-blocking) day=${dayNumber}:`, (e as Error)?.message);
    }

    // ── 10c. Finalize itinerary_status — THE V2 CUTOVER DROPPED THIS ───
    // The V1 chain flipped status ready/partial on the last day
    // (action-generate-trip-day.ts:4285). V2 never ported it, so EVERY v2 trip
    // stayed at the launcher's kickoff 'generating' forever — even after the
    // last day persisted. That is the root of "stuck generating + the gate's
    // repaired itinerary never looks applied": the trip never reaches a terminal
    // state, and the frontend/poller treats it as in-flight. Flip it here based on
    // real completeness — on the real last day AND on a background heal. The heal
    // is exactly what fills a day the parallel race left empty at first finalize;
    // without re-finalizing on the heal, that trip is set 'partial' and STAYS
    // partial forever even after the heal completes it (Vienna + Seoul both stuck
    // this way). The allComplete guard means a heal only flips 'ready' once the
    // trip is genuinely whole; an incomplete heal just re-affirms 'partial'.
    if (isLastDay || heal) {
      try {
        // AUTHORITATIVE completeness: read the CURRENT persisted trip, not this
        // request's possibly-stale in-memory mergedDays — under the parallel race a
        // heal can hold a view momentarily missing a day, and computing status from
        // THAT flipped a healthy ready trip back to partial (Tokyo). UPGRADE-ONLY on
        // a heal: flip partial→ready once whole; never downgrade ready→partial.
        const { data: stRow } = await supabase
          .from('trips').select('itinerary_data, itinerary_status, metadata, journey_id, unlocked_day_count').eq('id', tripId).maybeSingle();
        const dbDays: any[] = Array.isArray((stRow?.itinerary_data as any)?.days) ? (stRow!.itinerary_data as any).days : mergedDays;
        const allComplete = Array.isArray(dbDays) && dbDays.length >= totalDays &&
          dbDays.slice(0, totalDays).every((d: any) => Array.isArray(d?.activities) && d.activities.length > 0);
        const curStatus = String(stRow?.itinerary_status || '');
        const finalStatus: 'ready' | 'partial' | null =
          allComplete ? 'ready'
          : (isLastDay && !heal && curStatus !== 'ready') ? 'partial'
          : null;
        if (finalStatus) {
        const statusUpdate: Record<string, any> = { itinerary_status: finalStatus };
        // ── JOURNEY LEGS ARE PREPAID: unlock their days on ready ──────────
        // The journey is charged ONCE (on leg 1's tripId), and spend-credits
        // sets unlocked_day_count only on the trip it charged — legs 2+ stayed
        // at 0, so the UI locked every prepaid day and offered to sell them
        // again ("Unlock all remaining for 240 credits" on a leg the user
        // already paid for — owner's journey eyes-on, bug 13). Max-based so a
        // larger existing count is never reduced.
        if (finalStatus === 'ready' && (stRow as any)?.journey_id) {
          statusUpdate.unlocked_day_count = Math.max(Number((stRow as any)?.unlocked_day_count || 0), totalDays);
          console.log(`[v2] [JOURNEY_LEG_UNLOCKED] trip=${tripId} unlocked_day_count→${statusUpdate.unlocked_day_count}`);
        }
        // ── Stamp fully_persisted=true alongside the ready flip — the OTHER half of
        // the V1 Phase-6 finalize (generation-core.ts:3305) that the v2 cutover also
        // dropped. Without it the frontend `isFinalizing` gate (TripDetail.tsx) treats
        // ready + !fully_persisted (post-2026-04-01 trips) as "still finalizing" and the
        // trip is stuck on "Loading your itinerary…" forever — never rendering until a
        // user edit happens to stamp it. v2 builds each day synchronously (no async
        // post-ready enrichment phase), so "ready" == "fully persisted" here. Re-fetch
        // metadata fresh so we merge on top of holding_bay / heartbeat writes above.
        if (finalStatus === 'ready') {
          const fpMeta = { ...((stRow?.metadata as any) || {}) };
          // STALE-VERDICT RECONCILE: a parallel writer judging its incomplete view
          // can stamp a blocking integrity verdict (e.g. MEAL_COVERAGE_MISSING)
          // moments before this authoritative finalize confirms the trip is whole
          // (Athens 638c9def: verdict said D1 missing breakfast+lunch; persisted D1
          // plainly has both). Ready is judged from DB truth here — any stored
          // verdict predates that truth, so drop it rather than ship a ready trip
          // wearing a false "missing meals" badge in the health panel.
          delete fpMeta.integrity_contract;
          // Stale failure residue (chain_error from a long-dead trigger attempt,
          // chain_broken_at_day, generation_error) must not survive onto a READY
          // trip — the frontend poller reads these as failed/stalled and the
          // status label flaps between progress beats (bug 14 churn).
          fpMeta.chain_error = null;
          fpMeta.chain_broken_at_day = null;
          fpMeta.generation_error = null;
          statusUpdate.metadata = { ...fpMeta, fully_persisted: true, fully_persisted_at: new Date().toISOString() };
        }
        await supabase.from('trips').update(statusUpdate).eq('id', tripId);
        console.log(`[v2] [STATUS_FINALIZE] status=${finalStatus} allComplete=${allComplete} heal=${heal} days=${dbDays.length}/${totalDays}`);
        // ── JOURNEY LEG CHAIN (V2 port) — V1 kicked the next journey leg after
        // its finalize (generation-core Phase-6 / action-generate-trip-day), but
        // V2 never called it: leg 1 finished ready and legs 2+ sat not_started
        // forever (Step-5 journey QA: Rome ready, Florence/Venice never started;
        // zero journey trips have ever completed in prod). No-op for non-journey
        // trips (journey_order null) and for legs already running/done.
        if (finalStatus === 'ready') {
          try {
            const { triggerNextJourneyLeg } = await import('../action-save-itinerary.ts');
            await triggerNextJourneyLeg(supabase, tripId);
          } catch (e) {
            console.warn('[v2] journey leg chain failed (non-blocking):', (e as Error)?.message);
          }
          // ── FIRST-TRIP BENEFIT CLAIM (server-authoritative) ──────────
          // The kickoff gate stamps metadata.free_first_trip_authorized when
          // it grants an uncharged generation off profiles.first_trip_used.
          // Consume the flag HERE, where ready is stamped — the old claim
          // lived only in TripDetail.tsx (browser callback), so closing the
          // tab mid-generation left the flag false and EVERY subsequent trip
          // generated free (QA funnel test F4/F5). claim_first_trip_benefit
          // is an atomic check-and-set; the client call remains a backstop.
          if ((stRow?.metadata as any)?.free_first_trip_authorized === true) {
            try {
              // NOT the claim_first_trip_benefit RPC: it raises 'unauthorized'
              // unless auth.uid() = p_user_id, and this finalize runs under the
              // SERVICE ROLE (auth.uid() NULL) — the first deploy of this claim
              // silently no-op'd into the catch below (funnel re-test F4 still
              // false on v347). Same atomic check-and-set, done directly; the
              // WHERE first_trip_used=false keeps retries/double-claims inert.
              const { data: claimed, error: claimErr } = await supabase
                .from('profiles')
                .update({ first_trip_used: true })
                .eq('id', userId)
                .eq('first_trip_used', false)
                .select('id');
              if (claimErr) console.warn('[v2] first-trip claim failed (client backstop remains):', claimErr.message);
              else console.log(`[v2] [FIRST_TRIP_CLAIMED] user=${userId} trip=${tripId} rows=${claimed?.length ?? 0}`);
            } catch (e) {
              console.warn('[v2] first-trip claim threw (non-blocking):', (e as Error)?.message);
            }
          }
        }
        }
      } catch (e) {
        console.warn('[v2] status finalize failed (non-blocking):', (e as Error)?.message);
      }
    }

    // ── 11a. THIN-DAY heal: queue underfilled days for the same background
    // regen as empty days. A non-departure day with < 2 real (non-meal, non-
    // logistics) activities reads as underfilled — Athens D3 had only one
    // sightseeing card all day (Philopappos) and the Acropolis was never placed.
    // Computed on the FINAL merged trip (post-dedup/self-check) so a day thinned
    // BY the dedup is caught too. Departure day exempt (legitimately light:
    // checkout + transfer). Reuses the tested heal path (step 11b) + the heal's
    // own dedup/self-check + the race-safe pass clean the regenerated day.
    if (isLastDay && !heal) {
      try {
        const realCount = (d: any) => (Array.isArray(d?.activities) ? d.activities : []).filter((a: any) => {
          const t = String(a?.title || a?.name || '').toLowerCase();
          const c = String(a?.category || '').toLowerCase();
          const log = ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(c) || /check.?in|check.?out|transfer|airport|\bflight\b|return to|travel to|\bdepart/.test(t);
          const meal = ['breakfast', 'lunch', 'dinner', 'dining', 'restaurant'].includes(c) || /\b(breakfast|brunch|lunch|dinner)\b/.test(t);
          // nightcaps/drinks are filler, not substance — parity with the QA audit's
          // G9 so the heal fires on every day the audit would call thin
          const drink = /\bnight ?cap\b|late[- ]?night (?:drink|jazz|stroll|out|bar|bite)|evening (?:drink|nightcap)/.test(t);
          return !log && !meal && !drink;
        }).length;
        const thin: number[] = [];
        for (let n = 1; n < totalDays; n++) { // exclude the departure (last) day
          const d = mergedDays.find((x: any) => (x?.dayNumber ?? x?.day_number) === n);
          if (d && Array.isArray(d.activities) && d.activities.length > 0 && realCount(d) < 2 && !pendingHeals.includes(n)) thin.push(n);
        }
        if (thin.length > 0) {
          console.error(`[v2] [THIN_DAY_HEAL] underfilled days=[${thin.join(',')}] (<2 real activities) — queued for background regen`);
          pendingHeals.push(...thin);
        }
      } catch (e) {
        console.warn('[v2] thin-day detection failed (non-blocking):', (e as Error)?.message);
      }
    }

    // ── 11b. Background completeness heal (fire-and-forget) ────────────
    // Re-generate any day the table backfill could not recover, as its OWN
    // request (own wall-clock budget + heartbeat). Fired AFTER step 9's JSON
    // write so the heal's later write lands on top and is never clobbered by
    // this request. heal=true (forwarded via `...params` in the router) makes
    // the heal run skip the day-chain self-invoke (no cascade) and the
    // completeness gate (no recursion). NOT awaited — keeping the final-day
    // request short is exactly what prevents the watchdog false-pause.
    if (isLastDay && !heal && pendingHeals.length > 0) {
      try {
        const healUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-itinerary`;
        const healKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const eRTHeal = (globalThis as any).EdgeRuntime;
        for (const dn of pendingHeals) {
          const healBody = JSON.stringify({
            action: 'generate-trip-day', tripId, userId,
            dayNumber: dn, totalDays, traceId, heal: true,
          });
          const healPromise = (async () => {
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                const resp = await fetch(healUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${healKey}` },
                  body: healBody,
                });
                if (resp.ok) return;
                await resp.text().catch(() => null);
                if (resp.status >= 400 && resp.status < 500) {
                  console.error(`[v2] [COMPLETENESS_HEAL_REGEN] day=${dn} client error ${resp.status} — not retrying`);
                  return;
                }
              } catch (err) {
                console.error(`[v2] [COMPLETENESS_HEAL_REGEN] day=${dn} attempt ${attempt} error:`, err);
              }
              if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
            }
            console.error(`[v2] [COMPLETENESS_HEAL_REGEN] day=${dn} background heal failed after retries`);
          })();
          if (eRTHeal && typeof eRTHeal.waitUntil === 'function') eRTHeal.waitUntil(healPromise);
          console.log(`[v2] [COMPLETENESS_HEAL_REGEN] day=${dn} background heal dispatched`);
        }
      } catch (e) {
        console.warn('[v2] [COMPLETENESS_HEAL_REGEN] dispatch setup failed (non-blocking):', e);
      }
    }

    // ── 11. Chain self-invoke for next day (fire-and-forget) ───────────
    // Mirrors v1 action-generate-trip-day:4684 — uses EdgeRuntime.waitUntil
    // so the response returns immediately while the next day generates
    // server-side. Cancel-aware via metadata.generation_cancelled.
    if (dayNumber < totalDays && !heal) {
      try {
        const generateUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-itinerary`;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const chainBody = JSON.stringify({
          action: 'generate-trip-day',
          tripId,
          userId,
          dayNumber: dayNumber + 1,
          totalDays,
          traceId,
        });
        const chainPromise = (async () => {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const resp = await fetch(generateUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
                body: chainBody,
              });
              if (resp.ok) return;
              await resp.text().catch(() => null);
              if (resp.status >= 400 && resp.status < 500) {
                console.error(`[v2] chain attempt ${attempt} client error ${resp.status} — not retrying`);
                return;
              }
            } catch (err) {
              console.error(`[v2] chain attempt ${attempt} error:`, err);
            }
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
          console.error(`[v2] all chain attempts failed for day ${dayNumber + 1}`);
        })();
        const eRT = (globalThis as any).EdgeRuntime;
        if (eRT && typeof eRT.waitUntil === 'function') eRT.waitUntil(chainPromise);
        console.log(`[v2] chained to day ${dayNumber + 1}`);
      } catch (e) {
        console.warn('[v2] chain self-invoke setup failed (non-blocking):', e);
      }
    }

    const ms = Date.now() - t0;
    console.log(`[v2] generate-trip-day OK day=${dayNumber} in ${ms}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        version: 'v2',
        dayNumber,
        day: finalDay,
        mustDoInjection: mustDoInjection
          ? { attempted: mustDoInjection.attempted.length, injected: mustDoInjection.injected.length, unscheduled: mustDoInjection.unscheduled.length }
          : null,
        durationMs: ms,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error('[v2] generate-trip-day fatal:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: (err as Error)?.message || 'V2 chain failed',
        code: 'V2_FATAL',
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
}

/**
 * Router-level feature-flag check. Phase D (cutover):
 *   - v2 is the DEFAULT for all trips.
 *   - Kill-switch: set `trips.metadata.useV1Chain === true` to force the
 *     legacy handler. Intended for emergency rollback during 1-week soak;
 *     scheduled for deletion in Phase E.
 * Returns true → route to v2. Empty tripId → false (defensive).
 * Errors fail OPEN to v2 (post-cutover default).
 */
export async function shouldUseV2Chain(
  supabase: any,
  tripId: string,
): Promise<boolean> {
  if (!tripId) return false;
  try {
    const { data } = await supabase
      .from('trips')
      .select('metadata')
      .eq('id', tripId)
      .maybeSingle();
    const meta = (data?.metadata as any) ?? {};
    if (meta.useV1Chain === true) return false; // kill-switch wins
    return true; // default-on
  } catch {
    return true; // fail open to v2 (cutover default)
  }
}
