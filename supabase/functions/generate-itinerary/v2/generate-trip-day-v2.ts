/**
 * generate-trip-day-v2.ts — Phase B wrapper.
 *
 * Thin orchestration over existing pipeline helpers. Composes:
 *   resolveTripFacts → compileDayFacts → compilePrompt → callAI →
 *   repairDay → applyValidationGate → enrichAndValidateHours →
 *   scrubActivity (per-card) → runScheduleExecutioner (per-day) →
 *   persistDay (tables) + merged days → applyAnchorsWin +
 *   normalizePredawnCascade + assertNoCrossDayBleed +
 *   runBookendVerification + must-do coverage/injection (on final day) →
 *   persistTripItinerary (JSON) + writeActivityCostsFromItinerary
 *
 * ──────────────────────────────────────────────────────────────────────────
 * STATUS — STILL BEHIND `trips.metadata.useV2Chain === true`
 * ──────────────────────────────────────────────────────────────────────────
 * Gated default = OFF. Router falls back to v1 (`action-generate-trip-day.ts`)
 * for every trip until v2 ships clean on 5+ internal trips.
 *
 * Still not ported (next round):
 *   - ledger-check destructive passes (vibe-clash dinner downgrade)
 *   - post-injection anchor-enrichment + description-fill
 *   - chain-self-invoke for the next day
 *   - withStage trace-recorder instrumentation
 *   - cross-city nuclear sweeps (scrubActivity covers per-card already)
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
import { runScheduleExecutioner, toExecutionerAuditCodes } from '../../_shared/schedule-executioner.ts';
import { applyAnchorsWin } from '../anchor-guard.ts';
import { runBookendVerification } from '../../_shared/bookend-verification.ts';
import { assertNoCrossDayBleed } from '../../_shared/cross-day-bleed-guard.ts';
import { normalizePredawnCascade } from '../../_shared/predawn-cascade-normalize.ts';
import { assertMustDoCoverage } from '../../_shared/assert-must-do-coverage.ts';
import { injectMissingMustDos } from '../../_shared/inject-missing-must-dos.ts';
import { extractMustDoVenues } from '../../_shared/extract-must-dos.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

export async function handleGenerateTripDayV2(
  supabase: any,
  userId: string,
  params: Record<string, any>,
): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const { tripId, dayNumber } = params;

  if (!tripId || typeof dayNumber !== 'number') {
    return new Response(
      JSON.stringify({ success: false, error: 'tripId and dayNumber required', code: 'V2_BAD_INPUT' }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const t0 = Date.now();
  console.log(`[v2] generate-trip-day tripId=${tripId} day=${dayNumber} user=${userId}`);

  try {
    // ── 1. Unified facts (Phase A) ─────────────────────────────────────
    const facts = await resolveTripFacts(supabase, tripId);
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

    // ── 2. Day-scoped facts (existing helper) ──────────────────────────
    const dayFacts = await compileDayFacts(supabase, userId, {
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
    });

    // ── 3. Compile prompt + schema ─────────────────────────────────────
    const compiled = await compilePrompt(supabase, userId, LOVABLE_API_KEY, {
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
    }, dayFacts);

    const schema = compileDaySchema({
      dayNumber,
      totalDays,
      facts: dayFacts,
      compiled,
    } as any);

    // ── 4. LLM call ────────────────────────────────────────────────────
    const ai = await callAI({
      systemPrompt: compiled.systemPrompt,
      userPrompt: compiled.userPrompt,
      schema,
      LOVABLE_API_KEY,
      action: 'generate-trip-day-v2',
      tripId,
      userId,
      dayNumber,
    } as any);

    if (!ai.success || !ai.day) {
      return new Response(
        JSON.stringify({ success: false, error: 'V2 AI call failed', code: 'V2_AI_FAIL' }),
        { status: 502, headers: jsonHeaders },
      );
    }

    // ── 5. Repair + validation gate ────────────────────────────────────
    const repaired = repairDay({
      day: ai.day,
      dayNumber,
      destination: facts.destination.city,
      destinationCountry: facts.destination.country,
      facts: dayFacts,
      compiled,
      mealPolicy: facts.mealPolicy(dayNumber),
    } as any);

    const validations = validateDay({
      day: repaired.day,
      dayNumber,
      destination: facts.destination.city,
      mealPolicy: facts.mealPolicy(dayNumber),
    } as any);

    const gated = applyValidationGate(repaired.day, validations, {
      dayNumber,
      label: 'v2',
    } as any);

    // ── 5b. scrubActivity per card — unified output validation layer ───
    // See mem://constraints/itinerary/unified-output-validation-layer.
    const scrubAgg = { titleLeak: 0, bodyLeak: 0, fragment: 0, mealSuffix: 0, crossCity: 0, countryMismatch: 0, phantomRef: 0, downgraded: 0 } as Record<string, number>;
    if (Array.isArray(gated.day?.activities)) {
      for (const a of gated.day.activities) {
        const ops = scrubActivity(a, { destination: facts.destination.city });
        for (const k of Object.keys(scrubAgg)) {
          scrubAgg[k] += (ops as any)[k] || 0;
        }
      }
      console.log(`[v2] [SCRUB_ACTIVITY] day=${dayNumber} dest=${facts.destination.city} ops=${JSON.stringify(scrubAgg)}`);
    }

    // ── 6. Address / hours enrichment ──────────────────────────────────
    const enriched = await enrichAndValidateHours({
      supabase,
      tripId,
      dayNumber,
      destination: facts.destination.city,
      destinationCountry: facts.destination.country,
      activities: gated.day.activities,
    } as any);

    let finalDay: any = { ...gated.day, activities: enriched };

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

    // ── 7. Persist tables (itinerary_days + itinerary_activities) ──────
    const persisted = await persistDay({
      supabase,
      tripId,
      dayNumber,
      date: dayDate,
      generatedDay: finalDay,
      normalizedActivities: finalDay.activities,
      action: 'generate-trip-day',
      profile: dayFacts as any,
    });

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
        // Re-mirror the cloned days back into mergedDays slot-by-slot.
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

    // ── 8c. Chain-finalization stages (run on every persisted day;
    //         must-do injection only fires when coverage warrants) ──────
    let mustDoInjection: any = null;
    try {
      const userAnchors: any[] = Array.isArray(tripMeta.userAnchors) ? tripMeta.userAnchors : [];
      if (userAnchors.length > 0) {
        const guarded = applyAnchorsWin(mergedDays, userAnchors);
        if (guarded.restored > 0 || guarded.reaffirmed > 0) {
          console.log(`[v2] [ANCHOR_GUARD] restored=${guarded.restored} reaffirmed=${guarded.reaffirmed}`);
        }
      }

      const mustDos = extractMustDoVenues(tripMeta);
      if (mustDos.length > 0 && mergedDays.length > 0) {
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
        }
      }
    } catch (e) {
      console.warn('[v2] chain-finalization stages failed (non-blocking):', e);
    }

    // ── 8d. Persist-boundary bookend verification (per-day, every write) ─
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

    // ── 9. Single write of merged JSON ─────────────────────────────────
    const persistResult = await persistTripItinerary(
      supabase,
      tripId,
      { ...(tripRow?.itinerary_data || {}), days: mergedDays },
      { label: 'v2-generate-trip-day', saveReason: 'v2-day-write' },
    );

    if (persistResult.error || persistResult.frozenBlocked) {
      console.warn(`[v2] persistTripItinerary not applied: ${persistResult.error || 'frozen'}`);
    }

    // ── 10. Activity costs writer (single source of truth) ─────────────
    await writeActivityCostsFromItinerary(supabase, tripId, mergedDays, {
      destination: facts.destination.city,
      travelers: facts.travelers.count,
      budgetTier: facts.preferences.budgetTier,
    });

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
 * Router-level feature-flag check. Reads `trips.metadata.useV2Chain`.
 * Returns false (and routes to v1) for any error or absent flag.
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
    return (data?.metadata as any)?.useV2Chain === true;
  } catch {
    return false;
  }
}
