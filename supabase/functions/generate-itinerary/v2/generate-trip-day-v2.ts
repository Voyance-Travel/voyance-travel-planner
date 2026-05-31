/**
 * generate-trip-day-v2.ts — Phase B scaffold.
 *
 * Thin wrapper over the existing pipeline helpers. Composes:
 *   resolveTripFacts → compileDayFacts → compilePrompt → callAI →
 *   repairDay → applyValidationGate → enrichAndValidateHours →
 *   persistDay (tables) + persistTripItinerary (JSON) +
 *   writeActivityCostsFromItinerary
 *
 * ──────────────────────────────────────────────────────────────────────────
 * STATUS — NOT PRODUCTION READY
 * ──────────────────────────────────────────────────────────────────────────
 * Gated behind `trips.metadata.useV2Chain === true`. The router falls back
 * to v1 (`action-generate-trip-day.ts`, 4,780 lines) for every trip until
 * the v1-only stages below are ported into the wrapper or its callees:
 *
 *   - scheduleMustDos + injectMissingMustDos (must-do coverage gate)
 *   - schedule-executioner (final deterministic post-pipeline chokepoint)
 *   - persist-boundary bookend verification (runBookendVerification)
 *   - anchor-guard cross-day dedupe / floating drop
 *   - ledger-check destructive passes (vibe-clash dinner downgrade, etc.)
 *   - post-meal guard + runStep8 retry
 *   - scrubActivity / scrubPhantomEventRefs / cross-city sweeps
 *   - assertNoCrossDayBleed
 *   - chain-self-invoke for the next day
 *   - trace-recorder withStage instrumentation
 *
 * Cutover plan: enable per-trip via `useV2Chain` metadata flag on 5 internal
 * trips, verify byte-for-byte parity vs v1 across the 10 P0 checks, then
 * flip the default in the router and delete v1.
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

    // Compute the calendar date for this day (TripFacts has start/total only).
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
      totalDays: facts.dates.totalDays,
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
      totalDays: facts.dates.totalDays,
      destination: facts.destination.city,
      date: dayDate,
      travelers: facts.travelers.count,
      tripType: facts.preferences.tripType,
      budgetTier: facts.preferences.budgetTier,
      preferences: facts.preferences.interests,
    }, dayFacts);


    const schema = compileDaySchema({
      dayNumber,
      totalDays: facts.dates.totalDays,
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

    // ── 6. Address / hours enrichment ──────────────────────────────────
    const enriched = await enrichAndValidateHours({
      supabase,
      tripId,
      dayNumber,
      destination: facts.destination.city,
      destinationCountry: facts.destination.country,
      activities: gated.day.activities,
    } as any);

    const finalDay = { ...gated.day, activities: enriched };

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

    // ── 8. Patch trips.itinerary_data with this day, then write costs ──
    const { data: tripRow } = await supabase
      .from('trips')
      .select('itinerary_data')
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

    const persistResult = await persistTripItinerary(
      supabase,
      tripId,
      { ...(tripRow?.itinerary_data || {}), days: mergedDays },
      { label: 'v2-generate-trip-day', saveReason: 'v2-day-write' },
    );

    if (persistResult.error || persistResult.frozenBlocked) {
      console.warn(`[v2] persistTripItinerary not applied: ${persistResult.error || 'frozen'}`);
    }

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
