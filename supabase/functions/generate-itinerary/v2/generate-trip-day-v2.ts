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
 * DEPLOY MARKER: v2-meal-coverage-gate-2026-06-04 — forces a fresh edge
 * deployment artifact so the 8g final meal-coverage gate (PR #11) goes live
 * (a prior "Deployed" reported no new artifact / unchanged deploy count).
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
import { assertMustDoCoverage } from '../../_shared/assert-must-do-coverage.ts';
import { injectMissingMustDos } from '../../_shared/inject-missing-must-dos.ts';
import { extractMustDoVenues } from '../../_shared/extract-must-dos.ts';
import { fillAfterMealGuard } from '../../_shared/post-meal-guard-fill.ts';
import { enforceRequiredMealsFinalGuard, detectMealSlots } from '../day-validation.ts';
import { collapseRedundantInjectedMeals } from '../../_shared/meal-protection.ts';
import { runStep8 } from '../universal-quality-pass.ts';
import { ledgerCheck } from '../ledger-check.ts';
import { nuclearCrossCitySweep, nuclearDiningStrip, nuclearWellnessSweep } from '../fix-placeholders.ts';
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
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
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

    // ── 3. Compile prompt + schema ─────────────────────────────────────
    const compiled = await withStage(trace, 'compile_prompt', { dayNumber }, async () =>
      compilePrompt(supabase, userId, LOVABLE_API_KEY, {
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
        apiKey: LOVABLE_API_KEY,
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

    // ── 5a. STAMP ARRIVAL ANCHOR TRUTH (Day 1, post-LLM, pre-validate) ──
    // Authoritative overwrite of the arrival-flight card's start/end to
    // the user's ground-truth landing time, before any other pass can
    // touch it. Idempotent — safe to call again later in the pipeline.
    if (isFirstDay && repairArrivalTime24) {
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
    if (isLastDay && repairDepartureTime24) {
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
        arrivalTime24: repairArrivalTime24,
        returnDepartureTime24: repairDepartureTime24,
        arrivalAirport: facts.arrival.airport || undefined,
        airportTransferMinutes: dayFacts.airportTransferMinutes,
        hotelName: repairHotelName,
        hotelAddress: repairHotelAddress,
        hasHotel: repairHasHotel,
        lockedActivities: dayFacts.lockedActivities ?? [],
        restaurantPool: [],
        usedRestaurants: [],
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
          isFirstDay,
          isLastDay,
          arrivalTime24: isFirstDay ? facts.arrival.time24 : null,
          departureTime24: isLastDay ? facts.departure.time24 : null,
          dayTitle: finalDay?.title || finalDay?.theme || null,
          budgetTier: facts.preferences.budgetTier ?? null,
          geoFlagOnly: !geoDropEnabled,
          geoDropEnabled,
          rawFlightSelection: null,
          destinationIata: isFirstDay ? facts.destination.iata : null,
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
      if (mustDos.length > 0 && mergedDays.length > 0) {
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
    }

    // ── 8f. Persist-boundary bookend verification ──────────────────────
    try {
      const verify = await runBookendVerification(mergedDays, {
        destination: facts.destination.city,
        label: 'v2-bookend',
        expectedTotalDays: totalDays,
      });
      console.log(
        `[v2] [BOOKEND_VERIFY_SUMMARY] scanned=${verify.scanned} expected=${verify.expected} injected=${verify.injected} missing=${verify.missing}`,
      );
    } catch (e) { console.warn('[v2] bookend-verification failed:', e); }

    // ── 8f.5 FINAL-DAY COMPLETENESS GATE ───────────────────────────────
    // ROOT-CAUSE FIX (issue #1, "Day N shipped empty → Partial despite ready"):
    // the table↔JSON divergence can leave a day with a title but no activities
    // in trips.itinerary_data, and every per-day gate skips an empty day. On
    // the LAST day (non-heal run) verify all days 1..N are non-empty and heal
    // any that aren't — table backfill (free, recovers the divergence) → regen
    // (genuine miss) → the null-safe 8g meal floor below (never literally
    // empty). See completeness-gate.ts. Best-effort: never block the write.
    if (isLastDay && !heal) {
      const dayDateFor = (n: number): string | null => {
        if (!facts.dates.startDate) return null;
        const dd = new Date(facts.dates.startDate + 'T00:00:00Z');
        dd.setUTCDate(dd.getUTCDate() + (n - 1));
        return dd.toISOString().slice(0, 10);
      };
      try {
        let empties = findEmptyDays(mergedDays, totalDays);
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

          // ── Tier 2: regenerate any day the table couldn't recover (genuine miss) ──
          empties = findEmptyDays(mergedDays, totalDays);
          for (const dn of empties) {
            try {
              console.warn(`[v2] [COMPLETENESS_HEAL_REGEN] day=${dn} empty in table too — regenerating (heal)`);
              await handleGenerateTripDayV2(supabase, userId, {
                ...params, tripId, dayNumber: dn, totalDays, traceId, heal: true,
              });
              const acts = await readDayActivitiesFromTable(supabase, tripId, dn);
              if (acts.length > 0) {
                applyHealedDay(mergedDays, dn, acts, dayDateFor(dn));
                console.log(`[v2] [COMPLETENESS_HEAL_REGEN] day=${dn} recovered ${acts.length} activities after regen`);
              }
            } catch (e) {
              console.error(`[v2] [COMPLETENESS_HEAL_REGEN] day=${dn} regen failed:`, (e as Error)?.message);
            }
          }

          // ── Tier 3 floor + honest flag: anything still empty gets the 8g meal
          // floor below; record it so the integrity gate/health panel stay honest. ──
          const stillEmpty = findEmptyDays(mergedDays, totalDays);
          if (stillEmpty.length > 0) {
            console.error(`[v2] [COMPLETENESS_GATE] days STILL empty after heal=[${stillEmpty.join(',')}] — meal floor applies; flagging incomplete`);
            for (const dn of stillEmpty) {
              const d = mergedDays.find((x: any) => (x?.dayNumber ?? x?.day_number) === dn);
              if (d) {
                d.metadata = d.metadata || {};
                d.metadata.quality = d.metadata.quality || {};
                d.metadata.quality.incomplete_day = true;
              }
            }
          } else {
            console.log(`[v2] [COMPLETENESS_GATE] all ${totalDays} days non-empty after heal`);
          }
        }
      } catch (e) {
        console.error('[v2] [COMPLETENESS_GATE] failed (non-blocking):', (e as Error)?.message);
      }
    }

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
        const detected = detectMealSlots(acts);
        const missing = policy.requiredMeals.filter((m) => !detected.includes(m));
        if (missing.length === 0) continue;
        const res = enforceRequiredMealsFinalGuard(
          acts,
          policy.requiredMeals,
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

    // ── 9. Single write of merged JSON ─────────────────────────────────
    const persistResult = await withStage(trace, 'persist_written', { dayNumber }, () =>
      persistTripItinerary(
        supabase,
        tripId,
        { ...(tripRow?.itinerary_data || {}), days: mergedDays },
        { label: 'v2-generate-trip-day', saveReason: 'v2-day-write' },
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
