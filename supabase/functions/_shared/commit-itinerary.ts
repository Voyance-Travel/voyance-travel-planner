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
  };
  /** Caller label used in log lines (e.g. 'save-itinerary', 'stage-6'). */
  label: string;
}

export interface CommitGateResult {
  status: 'ready' | 'generated' | 'partial' | 'failed';
  metadataPatch: Record<string, any>;
  verdict: IntegrityVerdict;
  blockedReady: boolean;
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
}> {
  let hotelName = preloaded?.hotelName ?? null;
  let requiredIntents = preloaded?.requiredIntents ?? null;
  let arrivalTime24 = preloaded?.arrivalTime24 ?? null;
  let departureTime24 = preloaded?.departureTime24 ?? null;

  // Short-circuit: caller already prepared everything.
  if (
    requiredIntents !== null &&
    arrivalTime24 !== null &&
    departureTime24 !== null
  ) {
    return {
      hotelName,
      requiredIntents,
      arrivalTime24,
      departureTime24,
    };
  }

  try {
    const { data: trip } = await supabase
      .from('trips')
      .select('metadata, destination_country, start_date')
      .eq('id', tripId)
      .single();
    const meta = ((trip as any)?.metadata as Record<string, any>) || {};
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
      // Pull from preference spine — same source action-save-itinerary uses.
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
  };
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
      },
      blockedReady: false,
    };
  }

  try {
    const ctx = await loadCommitContext(supabase, tripId, preloaded);
    const verdict = checkItineraryIntegrity(days || [], {
      hotelName: ctx.hotelName,
      requiredIntents: ctx.requiredIntents,
      arrivalTime24: ctx.arrivalTime24,
      departureTime24: ctx.departureTime24,
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

    return {
      status: applied.status,
      metadataPatch: applied.metadataPatch,
      verdict,
      blockedReady,
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
      },
      blockedReady: false,
    };
  }
}
