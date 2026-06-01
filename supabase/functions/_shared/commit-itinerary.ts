/**
 * commit-itinerary — single authoritative commit boundary for itinerary
 * freeze/ready status.
 *
 * This is the ONE place that decides whether a `days` array is allowed to
 * become `ready` / `fully_persisted=true` / `itinerary_frozen_at` stamped.
 * It is called by every freeze-stamp site:
 *
 *   • action-save-itinerary (user edits)
 *   • generation-core Stage 6 (full trip generation final-save)
 *   • action-generate-trip-day Phase 6 (per-day chain final-save)
 *
 * The contract is the same in all three call sites: load the canonical
 * planning context (selected hotel, required user must-dos from the
 * preference spine, saved arrival/departure times), run the integrity
 * contract, and produce a `{ status, metadataPatch }` that the caller
 * folds into its existing `trips.update`.
 *
 * No call site is allowed to flip `itinerary_status='ready'` without
 * going through `resolveCommitGate`. If a code path needs to bypass it
 * (e.g. cancellation/failure), pass `proposedStatus='failed'` or
 * `'partial'` and the gate is a no-op.
 *
 * See .lovable/plan.md (Canonical Commit Boundary).
 */

import {
  applyIntegrityContractToFreezeStamp,
  checkItineraryIntegrity,
  type IntegrityVerdict,
} from './itinerary-integrity-contract.ts';
import { mintCommitToken } from './commit-token.ts';
import { stampArrivalAnchorTruth } from './stamp-arrival-anchor-truth.ts';

export interface CommitGateInput {
  supabase: any;
  tripId: string;
  days: any[];
  proposedStatus: 'ready' | 'generated' | 'partial' | 'failed';
  /** Optional pre-resolved context (action-save-itinerary already has these). */
  preloaded?: {
    hotelName?: string | null;
    requiredIntents?: Array<{ title: string; dayNumber?: number | null }>;
    arrivalTime24?: string | null;
    departureTime24?: string | null;
    requiredMealsByDay?: Record<number, Array<'breakfast' | 'lunch' | 'dinner'>>;
  };
  /** Caller label used in log lines (e.g. 'save-itinerary', 'stage-6'). */
  label: string;
}

export interface CommitGateResult {
  status: 'ready' | 'generated' | 'partial' | 'failed';
  metadataPatch: Record<string, any>;
  verdict: IntegrityVerdict;
  blockedReady: boolean;
  /** Single-use, content-bound HMAC token. Issued ONLY when verdict.ok=true
   *  AND proposedStatus was 'ready'|'generated'. Callers forward this to
   *  `persistTripItinerary({ commitToken })` so the persist boundary can
   *  attest that the exact payload it's writing was gate-approved. */
  commitToken?: string | null;
}

/**
 * Loads canonical context from the trip + structured preference spine
 * unless caller already has it.
 */
async function loadCommitContext(
  supabase: any,
  tripId: string,
  preloaded: CommitGateInput['preloaded'],
): Promise<{
  hotelName: string | null;
  requiredIntents: Array<{ title: string; dayNumber?: number | null }>;
  arrivalTime24: string | null;
  departureTime24: string | null;
  requiredMealsByDay: Record<number, Array<'breakfast' | 'lunch' | 'dinner'>>;
}> {
  let hotelName = preloaded?.hotelName ?? null;
  let requiredIntents = preloaded?.requiredIntents ?? null;
  let arrivalTime24 = preloaded?.arrivalTime24 ?? null;
  let departureTime24 = preloaded?.departureTime24 ?? null;
  let requiredMealsByDay = preloaded?.requiredMealsByDay ?? null;

  // Short-circuit: caller already prepared everything.
  if (
    requiredIntents !== null &&
    arrivalTime24 !== null &&
    departureTime24 !== null &&
    requiredMealsByDay !== null
  ) {
    return {
      hotelName,
      requiredIntents,
      arrivalTime24,
      departureTime24,
      requiredMealsByDay,
    };
  }

  let destination: string | null = null;
  let hotelTotalPriceUsdCents: number | null = null;
  let budgetIncludeHotel: boolean | null = null;

  try {
    const { data: trip } = await supabase
      .from('trips')
      .select('metadata, destination, destination_country, start_date, budget_include_hotel')
      .eq('id', tripId)
      .single();
    const meta = ((trip as any)?.metadata as Record<string, any>) || {};
    destination = (trip as any)?.destination || meta?.destination || null;
    budgetIncludeHotel = (trip as any)?.budget_include_hotel ?? meta?.budget_include_hotel ?? null;
    const hotelSel = meta?.selected_hotel || meta?.hotel || meta?.accommodation;
    if (hotelSel) {
      const totalUsdCents = Number(
        hotelSel?.totalPriceUsdCents ?? hotelSel?.total_price_usd_cents ?? 0,
      );
      const totalUsd = Number(hotelSel?.totalPrice ?? hotelSel?.total_price ?? 0);
      if (Number.isFinite(totalUsdCents) && totalUsdCents > 0) {
        hotelTotalPriceUsdCents = totalUsdCents;
      } else if (Number.isFinite(totalUsd) && totalUsd > 0) {
        hotelTotalPriceUsdCents = Math.round(totalUsd * 100);
      }
    }
    if (hotelName === null) {
      hotelName =
        meta?.selected_hotel?.name ||
        meta?.hotel?.name ||
        meta?.accommodation?.name ||
        null;
    }
    if (arrivalTime24 === null) {
      arrivalTime24 = (meta?.savedArrivalTime24 as string) || null;
    }
    if (departureTime24 === null) {
      departureTime24 = (meta?.savedDepartureTime24 as string) || null;
    }
    if (requiredIntents === null) {
      try {
        const { fetchActiveDayIntents } = await import('./day-intents-store.ts');
        const { mergePreferenceSources } = await import('./preference-spine.ts');
        const structuredRows = await fetchActiveDayIntents(supabase, tripId);
        const merge = mergePreferenceSources({
          structuredRows: structuredRows as any,
          additionalNotes: (meta?.additionalNotes as string) || '',
          recordedIntents: Array.isArray(meta?.userIntents)
            ? (meta.userIntents as any[])
            : [],
          mustDoActivities: meta?.mustDoActivities,
          perDayActivities: Array.isArray(meta?.perDayActivities)
            ? (meta.perDayActivities as any[])
            : undefined,
          tripStartDate: (trip as any)?.start_date || null,
          totalDays: 0,
        });
        requiredIntents = (merge.intents || [])
          .filter(
            (i: any) =>
              i?.priority === 'must' &&
              typeof i?.title === 'string' &&
              i.title.trim().length > 0,
          )
          .map((i: any) => ({
            title: String(i.title),
            dayNumber: typeof i.dayNumber === 'number' ? i.dayNumber : null,
          }));
      } catch (e) {
        console.warn('[commit-itinerary] preference-spine load failed:', e);
        requiredIntents = [];
      }
    }
  } catch (e) {
    console.warn('[commit-itinerary] context load failed:', e);
  }

  return {
    hotelName,
    requiredIntents: requiredIntents || [],
    arrivalTime24,
    departureTime24,
    requiredMealsByDay: requiredMealsByDay || {},
    destination,
    hotelTotalPriceUsdCents,
    budgetIncludeHotel,
  } as any;
}

/**
 * Derive per-day required meals from `deriveMealPolicy`, mirroring the
 * windows the generator used. Returns {} when meal-policy can't be
 * imported in this build (e.g. shared-only test contexts).
 */
async function deriveRequiredMealsByDay(
  days: any[],
  arrivalTime24: string | null,
  departureTime24: string | null,
): Promise<Record<number, Array<'breakfast' | 'lunch' | 'dinner'>>> {
  const out: Record<number, Array<'breakfast' | 'lunch' | 'dinner'>> = {};
  try {
    const { deriveMealPolicy } = await import('../generate-itinerary/meal-policy.ts');
    const totalDays = days.length;
    for (let i = 0; i < days.length; i++) {
      const dayNumber = Number(days[i]?.dayNumber || i + 1);
      const isFirstDay = i === 0;
      const isLastDay = i === days.length - 1;
      const policy = deriveMealPolicy({
        dayNumber,
        totalDays,
        isFirstDay,
        isLastDay,
        arrivalTime24: isFirstDay && arrivalTime24 ? arrivalTime24 : undefined,
        departureTime24: isLastDay && departureTime24 ? departureTime24 : undefined,
      });
      out[dayNumber] = policy.requiredMeals as Array<'breakfast' | 'lunch' | 'dinner'>;
    }
  } catch (e) {
    console.warn('[commit-itinerary] deriveRequiredMealsByDay failed:', e);
  }
  return out;
}

/**
 * Run the canonical commit gate. Returns the (possibly demoted) status
 * and a metadata patch to fold into the caller's trips.update payload.
 *
 * Hard contract:
 *   • proposedStatus='partial'|'failed' → pass through, no demotion.
 *   • proposedStatus='ready'|'generated' + verdict.ok=false → demoted to
 *     'partial' AND metadataPatch.integrity_contract carries violations.
 *   • Gate failure (exception) → caller's proposedStatus passes through
 *     with a warn log. Never throws.
 */
export async function resolveCommitGate(
  input: CommitGateInput,
): Promise<CommitGateResult> {
  const { supabase, tripId, days, proposedStatus, preloaded, label } = input;

  // Short-circuit: nothing to gate.
  if (proposedStatus === 'partial' || proposedStatus === 'failed') {
    return {
      status: proposedStatus,
      metadataPatch: {},
      verdict: {
        ok: true,
        ranAt: new Date().toISOString(),
        violations: [],
        codes: [],
        infeasibleDays: [],
        omittedRequests: [],
        mealCoverage: [],
      },
      blockedReady: false,
    };
  }

  try {
    const ctx = await loadCommitContext(supabase, tripId, preloaded);
    const requiredMealsByDay =
      Object.keys(ctx.requiredMealsByDay || {}).length > 0
        ? ctx.requiredMealsByDay
        : await deriveRequiredMealsByDay(days || [], ctx.arrivalTime24, ctx.departureTime24);

    // Wire neighborhood-coherence guard into the contract via a globalThis
    // bridge — keeps the integrity contract tree-shake friendly and avoids
    // an import cycle (contract → guard → contract via tests).
    try {
      const g: any = globalThis as any;
      if (!g.__neighborhoodGuard) {
        const mod = await import('./neighborhood-coherence-guard.ts');
        g.__neighborhoodGuard = { checkNeighborhoodCoherence: mod.checkNeighborhoodCoherence };
      }
    } catch (e) {
      console.warn('[commit-itinerary] neighborhood guard bridge failed:', e);
    }

    // ── SERVER-SIDE HOTEL COST SYNC ──────────────────────────────────
    // Lisbon/Amsterdam root cause: a priced hotel was selected, but the
    // Day-0 `activity_costs` row was written by the frontend AFTER the
    // gate ran. The gate then flagged HOTEL_COST_NOT_SURFACED and either
    // demoted to partial or was silently bypassed by `allowFrozenWrite`.
    //
    // Fix: write the Day-0 hotel row HERE, before the check, so the gate
    // and the user's Payments tab see the same canonical source of truth.
    // Frontend `useHotelLedgerSync` is now belt-and-suspenders.
    let hotelCostRowFound = false;
    const hotelTotalCents = (ctx as any).hotelTotalPriceUsdCents;
    const budgetIncludeHotel = (ctx as any).budgetIncludeHotel;
    if (
      typeof hotelTotalCents === 'number' &&
      hotelTotalCents > 0 &&
      budgetIncludeHotel !== true
    ) {
      hotelCostRowFound = await ensureHotelCostRow(
        supabase,
        tripId,
        hotelTotalCents,
        ctx.hotelName,
      );
    }

    const verdict = checkItineraryIntegrity(days || [], {
      hotelName: ctx.hotelName,
      requiredIntents: ctx.requiredIntents,
      arrivalTime24: ctx.arrivalTime24,
      departureTime24: ctx.departureTime24,
      requiredMealsByDay,
      destination: (ctx as any).destination ?? null,
      hotelTotalPriceUsdCents: hotelTotalCents ?? null,
      budgetIncludeHotel: budgetIncludeHotel ?? null,
      hotelCostRowFound,
    });
    const applied = applyIntegrityContractToFreezeStamp({
      proposedStatus,
      verdict,
    });
    const blockedReady = applied.status !== proposedStatus;

    if (!verdict.ok) {
      console.warn(
        `[COMMIT_GATE] site=${label} tripId=${tripId} blocked_ready=${blockedReady} ` +
          `codes=[${verdict.codes.join(',')}] violations=${verdict.violations.length} ` +
          `requiredIntents=${ctx.requiredIntents.length}`,
      );
      for (const v of verdict.violations.slice(0, 10)) {
        console.warn(
          `[COMMIT_GATE]   day=${v.dayNumber} code=${v.code} — ${v.detail}`,
        );
      }
    } else {
      console.log(
        `[COMMIT_GATE] site=${label} tripId=${tripId} ok requiredIntents=${ctx.requiredIntents.length}`,
      );
    }

    // Mint a commit token ONLY when verdict.ok=true. The token is content-
    // bound (HMAC over a sha256 of the exact `days` payload) so a caller
    // can't swap days between mint and persist. See commit-token.ts.
    let commitToken: string | null = null;
    if (verdict.ok && (proposedStatus === 'ready' || proposedStatus === 'generated')) {
      try {
        commitToken = await mintCommitToken(tripId, days || []);
      } catch (e) {
        console.warn(`[COMMIT_GATE] site=${label} mintCommitToken failed:`, e);
      }
    }

    return {
      status: applied.status,
      metadataPatch: applied.metadataPatch,
      verdict,
      blockedReady,
      commitToken,
    };
  } catch (e) {
    console.warn(`[COMMIT_GATE] site=${label} gate failed (non-blocking):`, e);
    return {
      status: proposedStatus,
      metadataPatch: {},
      verdict: {
        ok: true,
        ranAt: new Date().toISOString(),
        violations: [],
        codes: [],
        infeasibleDays: [],
        omittedRequests: [],
        mealCoverage: [],
      },
      blockedReady: false,
      commitToken: null,
    };
  }
}

/**
 * Ensure a Day-0 hotel row exists in `activity_costs` for the trip.
 *
 * Mirrors the shape written by `src/services/budgetLedgerSync.ts::syncHotelToLedger`
 * (category='hotel', day_number=0, source='commit-gate-hotel-sync') so the
 * Payments view + commit gate share one canonical source of truth.
 *
 * Guards:
 *  • Skip if a manual hotel `trip_payments` row already exists — the user
 *    owns the hotel line in that case (matches the frontend syncHotelToLedger
 *    guard that prevented the "Hotel Accommodation $2,850" double-billing).
 *  • Skip if a Day-0 hotel row already exists (idempotent).
 *
 * Returns `true` when a Day-0 hotel row is present after this call.
 * Returns `false` on any error so the caller can still surface
 * HOTEL_COST_NOT_SURFACED as a blocking code.
 */
async function ensureHotelCostRow(
  supabase: any,
  tripId: string,
  hotelTotalPriceUsdCents: number,
  hotelName: string | null,
): Promise<boolean> {
  try {
    // Manual hotel payment exists → user owns the cost line. Don't write.
    const { data: manual } = await supabase
      .from('trip_payments')
      .select('id')
      .eq('trip_id', tripId)
      .eq('item_type', 'hotel')
      .like('item_id', 'manual-%')
      .is('archived_at', null)
      .limit(1);
    if (manual && manual.length > 0) {
      // Treat as surfaced — manual payment satisfies HOTEL_COST_NOT_SURFACED.
      return true;
    }

    // Idempotent check.
    const { data: existing } = await supabase
      .from('activity_costs')
      .select('id, cost_per_person_usd, num_travelers')
      .eq('trip_id', tripId)
      .eq('category', 'hotel')
      .eq('day_number', 0)
      .maybeSingle();
    if (existing) {
      const total = Number(existing.cost_per_person_usd || 0) *
        Math.max(Number(existing.num_travelers || 1), 1);
      if (total > 0) return true;
      // Row exists with $0 — refresh it below.
    }

    // Load traveler count for per-person split.
    const { data: trip } = await supabase
      .from('trips')
      .select('num_travelers')
      .eq('id', tripId)
      .maybeSingle();
    const numTravelers = Math.max(Number(trip?.num_travelers || 1), 1);
    const totalUsd = hotelTotalPriceUsdCents / 100;
    const perPerson = totalUsd / numTravelers;

    // Deterministic activity_id mirroring the frontend logisticsActivityId.
    const base = String(tripId).replace(/-/g, '');
    const activityId =
      'a' + base.slice(1, 8) + '-' + base.slice(8, 12) + '-4' + base.slice(13, 15) +
      'a-' + base.slice(16, 20) + '-' + base.slice(20, 32);

    const notes = hotelName ? `Hotel: ${hotelName}` : 'Hotel';
    if (existing) {
      const { error } = await supabase
        .from('activity_costs')
        .update({
          cost_per_person_usd: perPerson,
          num_travelers: numTravelers,
          notes,
          source: 'commit-gate-hotel-sync',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) {
        console.warn('[commit-itinerary] ensureHotelCostRow update failed:', error.message);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('activity_costs')
        .insert({
          trip_id: tripId,
          activity_id: activityId,
          day_number: 0,
          category: 'hotel',
          cost_per_person_usd: perPerson,
          num_travelers: numTravelers,
          source: 'commit-gate-hotel-sync',
          confidence: 'high',
          is_paid: false,
          notes,
        });
      if (error) {
        console.warn('[commit-itinerary] ensureHotelCostRow insert failed:', error.message);
        return false;
      }
    }
    console.log(
      `[COMMIT_GATE] hotel cost row synced trip=${tripId} total=$${totalUsd.toFixed(0)} per_person=$${perPerson.toFixed(0)} travelers=${numTravelers}`,
    );
    return true;
  } catch (e) {
    console.warn('[commit-itinerary] ensureHotelCostRow failed:', e);
    return false;
  }
}
