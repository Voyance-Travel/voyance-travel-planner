/**
 * useTripFinancialSnapshot
 * 
 * Single source of truth for trip financial numbers across all tabs.
 * Reads from activity_costs directly, respecting budget_include_hotel/flight toggles.
 * 
 * Outputs (all in cents):
 *   - tripTotalCents:       Total expected cost (excluding toggled-off hotel/flight)
 *   - paidCents:            Sum of paid amounts in activity_costs (is_paid = true)
 *   - toBePaidCents:        tripTotalCents - paidCents (clamped >= 0)
 *   - budgetTotalCents:     User-set budget from trip settings
 *   - budgetRemainingCents: budgetTotalCents - tripTotalCents
 *   - plannedUnpaidCents:   tripTotalCents - paidCents (same as toBePaidCents)
 *
 * Transparency:
 *   - lastDelta:           { previousTotalCents, deltaCents, at } when total changes
 *                          between fetches. Lets UI show "Total updated: +$84".
 *   - Logs a console.warn on >25% jumps; only fires a toast when the change can
 *     be itemized via cost_change_log AND was not a system-reconcile (silent
 *     booking-changed event). The unattributed "Trip total changed by ±$X"
 *     toast was removed — it produced phantom pops on tab switch with no
 *     actionable info; the console.warn remains as the diagnostic signal.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { shouldCountRow } from '@/services/tripBudgetService';
import { computeMiscReserve } from '@/services/budgetReserve';
import { resolveCanonicalCostRows, type CanonicalLiveActivity } from '@/services/canonicalCostRows';
import { decomposeTripCost, type BucketCents } from '@/services/tripCostDecomposition';
import { TRIP_PERSISTED_EVENT } from '@/lib/itinerary/resyncItineraryFromDb';

const EMPTY_BUCKETS: BucketCents = {
  essentials: 0, food: 0, activities: 0, transit: 0, misc: 0,
};

export interface FinancialDelta {
  previousTotalCents: number;
  deltaCents: number;
  at: number; // epoch ms
}

export interface FinancialSnapshot {
  tripTotalCents: number;
  paidCents: number;
  toBePaidCents: number;
  budgetTotalCents: number;
  budgetRemainingCents: number;
  plannedUnpaidCents: number;
  paidPercent: number;
  /** Unspent portion of the misc / spending-money reserve folded into the total. */
  miscReserveCents: number;
  /** Toggle state from trips.budget_include_hotel/flight (mirrors what the snapshot honored). */
  includeHotel: boolean;
  includeFlight: boolean;
  /** Day-0 canonical hotel/flight cents (pre-toggle, pre-manual). */
  committedHotelCents: number;
  committedFlightCents: number;
  /** Manual hotel/flight delta from trip_payments (override-aware). */
  manualHotelDelta: number;
  manualFlightDelta: number;
  /** Hotel/flight cents ACTUALLY folded into tripTotalCents (toggle + manual applied, clamped >=0).
   *  Use these — not local computeHotelCostUsd / leg sums — when decomposing the trip total. */
  effectiveHotelCents: number;
  effectiveFlightCents: number;
  /** Per-bucket cents. Invariant: sum(buckets) === tripTotalCents. Read these
   *  in PaymentsTab bucket headers so they cannot drift from the headline. */
  buckets: BucketCents;
  bucketsSumCents: number;
  /** Signed residual folded into `buckets.misc` to maintain the invariant.
   *  |x| > $2 = an upstream contract bug — surfaced via console.warn. */
  residualFoldedCents: number;
  loading: boolean;
  lastDelta: FinancialDelta | null;
  refetch: () => void;
  acknowledgeDelta: () => void;
}

interface SnapshotData {
  tripTotalCents: number;
  paidCents: number;
  budgetTotalCents: number;
  miscReserveCents: number;
  includeHotel: boolean;
  includeFlight: boolean;
  committedHotelCents: number;
  committedFlightCents: number;
  manualHotelDelta: number;
  manualFlightDelta: number;
  buckets: BucketCents;
  residualFoldedCents: number;
  loading: boolean;
}

export function useTripFinancialSnapshot(tripId: string): FinancialSnapshot {
  const [data, setData] = useState<SnapshotData>({
    tripTotalCents: 0,
    paidCents: 0,
    budgetTotalCents: 0,
    miscReserveCents: 0,
    includeHotel: true,
    includeFlight: false,
    committedHotelCents: 0,
    committedFlightCents: 0,
    manualHotelDelta: 0,
    manualFlightDelta: 0,
    buckets: { ...EMPTY_BUCKETS },
    residualFoldedCents: 0,
    loading: true,
  });
  const [lastDelta, setLastDelta] = useState<FinancialDelta | null>(null);

  // Track previous total across renders without retriggering effects.
  const prevTotalRef = useRef<number | null>(null);
  // Suppress the very first delta (initial load) and avoid duplicate toasts.
  const initialLoadRef = useRef(true);
  const lastWarnedTotalRef = useRef<number | null>(null);
  // Mount time — used to suppress the "just now" badge for transient deltas
  // that happen during hydration (e.g. optimistic event from a sibling, a
  // logistics-sync upsert that lands a beat after the initial fetch). Real
  // user-driven changes happen well after this window.
  const mountedAtRef = useRef<number>(Date.now());
  const STABILIZATION_MS = 4_000;
  // Tracks the last orphan-payment fingerprint we asked the DB to archive,
  // so we don't re-fire the archival RPC on every refetch when nothing changed.
  const lastArchivedFingerprintRef = useRef<string | null>(null);
  // Per-trip + content-hash backfill guard. Stores `${tripId}:${jsonPriceHash}`
  // for the most recent backfill we triggered so we (a) don't refire on every
  // refetch and (b) DO fire when the user opens a different legacy trip in the
  // same component instance (a plain boolean would block trip #2 forever).
  // The hash also lets a content change re-trigger if the user adds priced
  // items after the first attempt.
  const lastBackfillFingerprintRef = useRef<string | null>(null);
  // One-shot suppress flag for the next computed delta toast. Set when a
  // `booking-changed` event arrives with `detail.silent: true` (system-driven
  // reconciliation: PaymentsTab tab-mount, expire-stale, orphan-archive,
  // sync-trip-cost-table backfill). Prevents phantom "Trip total changed by
  // ±$X" toasts when the user took no action.
  const suppressNextToastRef = useRef<{ active: boolean; reason: string }>({
    active: false,
    reason: '',
  });

  const fetchData = useCallback(async () => {
    if (!tripId) {
      // Don't strand `loading: true` if tripId is briefly null on mount —
      // the next effect run with a real tripId will refetch and re-fill.
      setData(prev => (prev.loading ? { ...prev, loading: false } : prev));
      return;
    }
    // Absolute safety net: if no setData fires within 8s (network hang,
    // promise that never resolves), force-clear the spinner so the UI can
    // render whatever number we already have ($0 on a cold load).
    const safetyTimer = setTimeout(() => {
      setData(prev => {
        if (!prev.loading) return prev;
        console.warn(
          `[useTripFinancialSnapshot] spinner safety timeout fired (tripId=${tripId})`
        );
        return { ...prev, loading: false };
      });
    }, 8_000);
    try {
    // 1. Fetch trip settings (budget + inclusion toggles) AND itinerary_data so
    // we can filter out orphaned activity_costs rows whose activity_id no
    // longer exists in the live itinerary. Without this, the snapshot total
    // includes ghost rows that Budget/Payments correctly drop, producing
    // session-to-session drift and a permanent "Reconciling…" mismatch.
    const { data: tripData } = await supabase
      .from('trips')
      .select('budget_total_cents, budget_include_hotel, budget_include_flight, budget_allocations, itinerary_data, travelers, destination, budget_tier')
      .eq('id', tripId)
      .single();

    const includeHotel = tripData?.budget_include_hotel ?? true;
    const includeFlight = tripData?.budget_include_flight ?? false;
    const miscPercent = Number(
      (tripData as any)?.budget_allocations?.misc_percent ?? 0
    ) || 0;

    // Build the live activity ID set from the rendered itinerary JSON.
    // Also count "meaningful" activities (excluding hotel/logistics rituals)
    // so we can suppress the misc-reserve contribution on empty itineraries —
    // otherwise Trip Expenses inflates beyond what the itinerary contains.
    const liveActivityIds = new Set<string>();
    const liveActivities: CanonicalLiveActivity[] = [];
    let meaningfulActivityCount = 0;
    const NON_MEANINGFUL_CATEGORIES = new Set([
      'hotel', 'flight', 'accommodation', 'lodging', 'stay',
      'check-in', 'check-out', 'bag-drop', 'departure', 'arrival',
    ]);
    const NON_MEANINGFUL_TITLE_RE = /check\s*-?\s*in|check\s*-?\s*out|bag\s*-?\s*drop|return\s+to\s+(?:your\s+)?hotel|hotel\s+check(?:in|out)|airport\s+transfer|departure/i;
    const days = ((tripData as any)?.itinerary_data?.days) || [];
    for (const day of days) {
      const dayNum = Number(day?.dayNumber) || 0;
      for (const a of (day?.activities || [])) {
        if (a?.id) {
          liveActivityIds.add(String(a.id));
          const explicit = typeof a.cost === 'number' ? a.cost
            : (a.cost && typeof a.cost === 'object' && typeof a.cost.amount === 'number') ? a.cost.amount
            : (typeof a.explicitCost === 'number' ? a.explicitCost : 0);
          liveActivities.push({
            id: String(a.id),
            dayNumber: dayNum,
            name: String(a.title || a.name || ''),
            category: String(a.category || a.type || '').toLowerCase(),
            jsonCost: Number(explicit) || 0,
          });
        }
        const cat = String(a?.category || '').toLowerCase().trim();
        const title = String(a?.title || a?.name || '');
        if (NON_MEANINGFUL_CATEGORIES.has(cat)) continue;
        if (NON_MEANINGFUL_TITLE_RE.test(title)) continue;
        meaningfulActivityCount++;
      }
    }

    // 2. Fetch all activity_costs for this trip
    const { data: costs } = await supabase
      .from('activity_costs')
      .select('id, activity_id, cost_per_person_usd, num_travelers, is_paid, paid_amount_usd, category, day_number, source')
      .eq('trip_id', tripId);

    // 2b. Fetch ALL trip_payments. trip_payments is the authoritative source
    // for "paid so far" — every Mark Paid click in PaymentsTab writes here,
    // and the activity_costs.is_paid mirror is best-effort (silently no-ops
    // when activity_id doesn't match, e.g. orphaned/regenerated activities).
    // Without folding paid trip_payments rows in, BudgetTab's "Paid so far"
    // drifts below PaymentsTab's "Paid so far" (the L'Arpège bug).
    const { data: allPayments } = await supabase
      .from('trip_payments')
      .select('item_type, item_id, amount_cents, quantity, status')
      .eq('trip_id', tripId)
      .is('archived_at', null);

    const manualPayments = (allPayments || []).filter(
      (p) => typeof p.item_id === 'string' && /^manual-/i.test(p.item_id)
    );

    let totalCents = 0;
    let paidTotal = 0;
    let canonicalHotelCents = 0;
    let canonicalFlightCents = 0;
    let committedHotelCents = 0;
    let committedFlightCents = 0;
    let loggedMiscCents = 0;

    // Lookup of activity_ids covered by a paid trip_payments row, so we don't
    // double-count when both the activity_costs.is_paid mirror and the
    // trip_payments row exist for the same item. Strip the composite `_dN`
    // suffix that PaymentsTab sometimes appends to item_id.
    const stripDaySuffix = (id: string): string => id.replace(/_d\d+$/, '');

    // Orphan detection: trip_payments rows pointing at activities that no
    // longer exist in the live itinerary (e.g. survived a regeneration).
    // Excludes hotel/flight (governed by include toggles, not the activity
    // list) and manual-* rows (free-form, not tied to an activity_id).
    // Build the set of live "transit group" ids (`transit-dN`) per day so
    // grouped transit payments aren't mis-flagged as orphans. A grouped row
    // exists for a given day whenever that day has at least one live activity
    // categorized as transport/transit/transfer/taxi/etc.
    const liveTransitGroupIds = new Set<string>();
    for (const day of days) {
      const dayNum = Number(day?.dayNumber) || 0;
      const hasTransit = (day?.activities || []).some((a: any) => {
        const cat = String(a?.category || a?.type || '').toLowerCase();
        return cat === 'transport' || cat === 'transportation' || cat === 'transit'
            || cat === 'transfer' || cat === 'taxi' || cat === 'rideshare';
      });
      if (hasTransit) liveTransitGroupIds.add(`transit-d${dayNum}`);
    }

    const isLivePaymentItem = (rawItemId: string): boolean => {
      const stripped = stripDaySuffix(rawItemId);
      if (liveActivityIds.has(stripped)) return true;
      // Grouped transit row id is itself the canonical id (no _dN suffix to strip)
      if (liveTransitGroupIds.has(rawItemId)) return true;
      return false;
    };

    const orphanPaymentItemIds = new Set<string>();
    for (const p of allPayments || []) {
      if (typeof p.item_id !== 'string') continue;
      if (/^manual-/i.test(p.item_id)) continue;
      const cat = (p.item_type || '').toLowerCase();
      if (cat === 'hotel' || cat === 'flight' || cat === 'flights') continue;
      if (!isLivePaymentItem(p.item_id)) {
        orphanPaymentItemIds.add(p.item_id);
      }
    }

    const paidActivityIds = new Set<string>();
    for (const p of allPayments || []) {
      if (p.status !== 'paid') continue;
      if (typeof p.item_id !== 'string') continue;
      if (/^manual-/i.test(p.item_id)) continue;
      if (orphanPaymentItemIds.has(p.item_id)) continue;
      paidActivityIds.add(stripDaySuffix(p.item_id));
    }

    // Canonical resolver: shared with usePayableItems so the row sum, the
    // header total, AND the manual-payment fold-in apply identical rules.
    const tripTravelers = Number((tripData as any)?.travelers) || 1;
    const canonical = resolveCanonicalCostRows({
      costs: (costs || []) as any,
      liveActivities,
      includeHotel,
      includeFlight,
      manualPayments: (allPayments || []) as any,
      travelers: tripTravelers,
    });
    totalCents = canonical.effectiveTotalCents;
    // Header strip Hotel/Flight chips MUST surface ONLY Day-0 logistics rows
    // (and manual overrides via manualHotelDelta). Day-N hotel/flight rows
    // already live inside the per-day badges via useTripDayBreakdown — using
    // canonical.hotelCents (sum of ALL rows) double-displays the Day-N hotel
    // and breaks the strip equation in the Osaka pattern: Days ¥X + Hotel ¥Y
    // = Trip Total ¥X (because the hotel is already inside ¥X).
    // See mem://constraints/finance/header-strip-mirrors-snapshot.
    committedHotelCents = canonical.canonicalDay0HotelCents;
    committedFlightCents = canonical.canonicalDay0FlightCents;
    loggedMiscCents = canonical.loggedMiscCents;
    canonicalHotelCents = canonical.canonicalDay0HotelCents;
    canonicalFlightCents = canonical.canonicalDay0FlightCents;

    // Diagnostic: surface json-rescue usage. Persistent non-zero values mean
    // either the per-day chain writer or the auto-backfill is broken — the
    // rescue path is a display safety net, not a steady state.
    if (canonical.pricedJsonRescueCents > 0) {
      console.warn(
        `[useTripFinancialSnapshot] pricedJsonRescueCents=$${(canonical.pricedJsonRescueCents / 100).toFixed(2)} for trip ${tripId} — backend activity_costs writes lagging`
      );
    }

    // is_paid mirror — count rows whose activity is still live and not
    // already covered by a trip_payments paid row.
    for (const row of costs || []) {
      if (!row.is_paid) continue;
      if (!shouldCountRow(row, includeHotel, includeFlight)) continue;
      if (row.activity_id && paidActivityIds.has(stripDaySuffix(String(row.activity_id)))) continue;
      const rowTotal = (row.cost_per_person_usd || 0) * (row.num_travelers || 1);
      const paidUsd = row.paid_amount_usd != null ? row.paid_amount_usd : rowTotal;
      paidTotal += Math.round(paidUsd * 100);
    }

    // Manual hotel/flight/other fold is now handled inside the resolver.
    // canonicalHotelCents / canonicalFlightCents are kept for reserve math below.
    totalCents = Math.max(0, totalCents);

    // Authoritative paid: sum every paid trip_payments row, honoring the
    // hotel/flight inclusion toggles so the figure matches "Trip Total".
    // This makes BudgetTab "Paid so far" identical to PaymentsTab.
    let paidFromTripPayments = 0;
    for (const p of allPayments || []) {
      if (p.status !== 'paid') continue;
      // Skip orphan rows whose underlying activity no longer exists in the
      // itinerary — otherwise a regenerated trip inherits "phantom" payments
      // from the prior session and triggers a false "Overpaid" warning.
      if (typeof p.item_id === 'string' && orphanPaymentItemIds.has(p.item_id)) continue;
      const cat = (p.item_type || '').toLowerCase();
      if (cat === 'hotel' && !includeHotel) continue;
      if ((cat === 'flight' || cat === 'flights') && !includeFlight) continue;
      paidFromTripPayments += (p.amount_cents || 0) * (p.quantity || 1);
    }
    paidTotal += paidFromTripPayments;

    // Fire-and-forget archival of orphan rows so PaymentsTab (which reads
    // its own list) catches up on the next refetch. Guarded by a fingerprint
    // so we don't hammer the RPC across re-renders.
    if (orphanPaymentItemIds.size > 0) {
      const fingerprint = Array.from(orphanPaymentItemIds).sort().join('|');
      if (fingerprint !== lastArchivedFingerprintRef.current) {
        lastArchivedFingerprintRef.current = fingerprint;
        supabase
          .rpc('archive_orphan_trip_payments', { p_trip_id: tripId })
          .then(({ data: archResult, error: archErr }) => {
            if (archErr) {
              console.warn('[useTripFinancialSnapshot] orphan archive failed', archErr);
              return;
            }
            const count = (archResult as any)?.archived_count ?? 0;
            if (count > 0) {
              console.info(
                `[useTripFinancialSnapshot] auto-archived ${count} orphan payment${count === 1 ? '' : 's'} for trip ${tripId}`
              );
              // Sentinel — fires if the SQL RPC archives more rows than the JS
              // orphan set contained. JS deliberately excludes manual-* rows
              // from orphan detection (lines ~238-239); a higher count here
              // means the RPC archived a manual row, silently dropping its
              // amount from the trip total. Migration on 2026-05-13 closes
              // this; the log stays as an early-warning if regression occurs.
              if (count > orphanPaymentItemIds.size) {
                console.warn(
                  `[useTripFinancialSnapshot] orphan archive over-count ${count} > js=${orphanPaymentItemIds.size} — manual leak suspected (tripId=${tripId})`
                );
              }
              window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId, silent: true, reason: 'orphan-archive' } }));
            }
          });
      }
    } else {
      lastArchivedFingerprintRef.current = null;
    }

    // ── Auto-backfill activity_costs for legacy / partially-written trips ─
    // Old gate (`canonical.totalCents === 0`) only fired when activity_costs
    // was completely empty. The recurring "$160 vs $3,600" bug actually shows
    // up when the table is *partially* populated — e.g. the hotel row exists
    // (so totalCents > 0) but the dining/activities/transit rows from the
    // per-day chain were never written. Coverage check fires the backfill
    // whenever priced JSON activities lack a matching cost row.
    const pricedJsonIds = new Set(
      liveActivities.filter((a) => a.jsonCost > 0).map((a) => a.id)
    );
    const coveredIds = new Set(
      (costs || [])
        .filter(
          (c) => c.activity_id && (Number(c.cost_per_person_usd) || 0) > 0
        )
        .map((c) => String(c.activity_id))
    );
    const uncoveredPricedCount = [...pricedJsonIds].filter(
      (id) => !coveredIds.has(id)
    ).length;
    const coverageRatio = pricedJsonIds.size > 0
      ? 1 - uncoveredPricedCount / pricedJsonIds.size
      : 1;

    // Build a content fingerprint over (tripId + sorted priced JSON ids) so we
    // re-fire when the user navigates to a different legacy trip OR adds new
    // priced cards after the first backfill attempt.
    const pricedJsonHash = [...pricedJsonIds].sort().join(',');
    const backfillFingerprint = `${tripId}:${pricedJsonHash}`;

    if (
      lastBackfillFingerprintRef.current !== backfillFingerprint &&
      pricedJsonIds.size > 0 &&
      coverageRatio < 0.5
    ) {
      lastBackfillFingerprintRef.current = backfillFingerprint;
      const dest = String((tripData as any)?.destination || '');
      const tier = (tripData as any)?.budget_tier || null;
      console.info(
        `[useTripFinancialSnapshot] activity_costs coverage ${(coverageRatio * 100).toFixed(0)}% for trip ${tripId} (uncovered=${uncoveredPricedCount}/${pricedJsonIds.size}) — triggering backfill`
      );
      supabase.functions
        .invoke('sync-trip-cost-table', {
          body: { tripId, destination: dest, travelers: tripTravelers, budgetTier: tier },
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[useTripFinancialSnapshot] sync-trip-cost-table failed', error);
            return;
          }
          console.info(`[useTripFinancialSnapshot] auto-backfilled activity_costs for trip ${tripId}`);
          window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId, silent: true, reason: 'backfill' } }));
        });
    }

    // Reconciliation guard: BudgetTab must never under-report compared to
    // PaymentsTab. PaymentsTab's "Paid so far" is sum(trip_payments where
    // status='paid'); if our combined figure (which folds in the
    // activity_costs.is_paid mirror minus dedupe) somehow comes out lower,
    // prefer the canonical sum and warn so we can investigate.
    if (paidFromTripPayments > paidTotal + 1) {
      console.warn(
        `[useTripFinancialSnapshot] paid reconciliation: trip_payments sum ` +
        `($${(paidFromTripPayments / 100).toFixed(2)}) exceeds combined ` +
        `($${(paidTotal / 100).toFixed(2)}); preferring canonical. tripId=${tripId}`
      );
      paidTotal = paidFromTripPayments;
    }

    // Misc reserve — the user explicitly set aside cash for tips / SIM /
    // pharmacy / market finds. The itinerary never auto-fills it, so without
    // folding the unspent portion into the total the headline budget reads
    // as having phantom headroom equal to the slider value.
    const budgetTotalForReserve = tripData?.budget_total_cents || 0;
    // Gate: on empty itineraries (hotel-only / logistics-only) the reserve is
    // a planning placeholder with no real spend behind it. Adding it inflates
    // Trip Expenses beyond what the itinerary actually contains, which the
    // Budget tab already flags via its empty-state breakdown.
    let miscReserveContributionCents = 0;
    if (budgetTotalForReserve > 0 && miscPercent > 0 && meaningfulActivityCount >= 1) {
      const reserve = computeMiscReserve({
        budgetTotalCents: budgetTotalForReserve,
        miscPercent,
        committedHotelCents,
        committedFlightCents,
        includeHotel,
        includeFlight,
        loggedMiscCents,
      });
      miscReserveContributionCents = reserve.contributionToTotalCents;
      totalCents += miscReserveContributionCents;
    }

    // ── Decompose into Payments-tab buckets. By construction the bucket sum
    //    equals `totalCents`; any residual is folded into `misc` and surfaced
    //    via `residualFoldedCents` for telemetry. This is the contract that
    //    closes the Bali "$900 + $480 + $200 = $1,580 vs $1,322" pattern.
    //    See mem://constraints/finance/single-cost-decomposition.
    const decomposition = decomposeTripCost({
      costs: (costs || []) as any,
      liveActivities,
      includeHotel,
      includeFlight,
      manualPayments: (allPayments || []) as any,
      travelers: tripTravelers,
      miscReserveContributionCents,
    });
    if (Math.abs(decomposition.residualFoldedCents) > 200) {
      console.warn(
        `[useTripFinancialSnapshot] decomposition residual $${(decomposition.residualFoldedCents / 100).toFixed(2)} ` +
        `folded into misc — upstream contract violation. tripId=${tripId} ` +
        `displayed=${decomposition.displayedTotalCents} bucketsRaw=${decomposition.displayedTotalCents - decomposition.residualFoldedCents}`
      );
    }

    // Compute delta against the previous fetch (skip on initial load and
    // during the brief stabilization window where hydration / logistics-sync
    // can legitimately move the total without it being a user-perceived change).
    const prev = prevTotalRef.current;
    const withinStabilization = Date.now() - mountedAtRef.current < STABILIZATION_MS;
    if (!initialLoadRef.current && !withinStabilization && prev != null && prev !== totalCents) {
      const delta: FinancialDelta = {
        previousTotalCents: prev,
        deltaCents: totalCents - prev,
        at: Date.now(),
      };
      setLastDelta(delta);

      // Defensive guard: warn on large unexpected jumps. Threshold = 25%.
      const ratio = prev > 0 ? Math.abs(delta.deltaCents) / prev : Infinity;
      // Consume one-shot suppression flag from a silent system-driven event.
      const suppressed = suppressNextToastRef.current.active;
      const suppressReason = suppressNextToastRef.current.reason;
      if (suppressed) {
        suppressNextToastRef.current = { active: false, reason: '' };
      }
      if (ratio > 0.25 && lastWarnedTotalRef.current !== totalCents) {
        lastWarnedTotalRef.current = totalCents;
        const sign = delta.deltaCents >= 0 ? '+' : '−';
        const amount = Math.abs(delta.deltaCents) / 100;

        // Always log the diagnostic. The user-visible toast is gated below.
        console.warn(
          `[useTripFinancialSnapshot] Trip total jumped ${sign}$${amount.toFixed(0)} ` +
          `(${(ratio * 100).toFixed(0)}%). prev=${prev} new=${totalCents} tripId=${tripId} suppressed=${suppressed}${suppressed ? ` reason=${suppressReason}` : ''}`
        );

        // Try to attribute the jump to a recent cost-repair pass. Only an
        // ATTRIBUTED change ever surfaces a toast — and only when this fetch
        // was not a system-reconcile (silent booking-changed). The previous
        // unattributed "Trip total changed by ±$X" toast was removed because
        // it fired phantom pops on tab switch with no actionable info; the
        // race between per-instance suppress flags and parallel async RPCs
        // (orphan-archive, sync-trip-cost-table) made it unreliable to gate.
        if (!suppressed) {
          try {
            const { getRecentCostChanges } = await import('@/services/activityCostService');
            const changes = await getRecentCostChanges(tripId, 8_000);
            if (changes.length > 0) {
              const top = changes.slice(0, 2).map(c => {
                const d = (c.new_cents - c.previous_cents) / 100;
                const s = d >= 0 ? '+' : '−';
                return `${c.activity_title || 'Activity'} ${s}$${Math.abs(d).toFixed(0)}`;
              }).join(', ');
              const more = changes.length > 2 ? ` and ${changes.length - 2} more` : '';
              console.warn(
                `[useTripFinancialSnapshot] Total ${sign}$${amount.toFixed(0)} attributed to repair: ${top}${more}`
              );
              try {
                toast.info(`Pricing updated: ${sign}$${amount.toFixed(0)}`, {
                  description: `${top}${more}`,
                  duration: 7000,
                });
              } catch {}
            }
          } catch {}
        }
      } else if (suppressed && ratio > 0.25) {
        const sign = delta.deltaCents >= 0 ? '+' : '−';
        const amount = Math.abs(delta.deltaCents) / 100;
        console.info(
          `[useTripFinancialSnapshot] suppressed system-reconcile toast (reason=${suppressReason}) ${sign}$${amount.toFixed(0)} tripId=${tripId}`
        );
        // Still mark so a later identical-total real event doesn't double-fire
        lastWarnedTotalRef.current = totalCents;
      }
    }
    prevTotalRef.current = totalCents;
    initialLoadRef.current = false;

    // Atomic update — all values in one setState call
    setData({
      tripTotalCents: totalCents,
      paidCents: paidTotal,
      budgetTotalCents: tripData?.budget_total_cents || 0,
      miscReserveCents: miscReserveContributionCents,
      includeHotel,
      includeFlight,
      committedHotelCents: canonicalHotelCents,
      committedFlightCents: canonicalFlightCents,
      manualHotelDelta: canonical.manualHotelDelta,
      manualFlightDelta: canonical.manualFlightDelta,
      buckets: decomposition.buckets,
      residualFoldedCents: decomposition.residualFoldedCents,
      loading: false,
    });
    } catch (err) {
      // A network/auth blip must NOT wedge the spinner forever. Surface as
      // $0 + a console.warn so the next event-driven refetch can recover.
      console.warn('[useTripFinancialSnapshot] fetchData failed — clearing loading', err);
      setData(prev => ({ ...prev, loading: false }));
    } finally {
      clearTimeout(safetyTimer);
      // Always clear the suppress flag at end of fetchData so a leftover
      // silent flag can't swallow a future legitimate user-driven change.
      // (Listener re-arms the flag for the trailing 600ms refetch path.)
      if (suppressNextToastRef.current.active) {
        suppressNextToastRef.current = { active: false, reason: '' };
      }
    }
  }, [tripId]);

  useEffect(() => {
    // Reset bookkeeping when tripId changes
    initialLoadRef.current = true;
    prevTotalRef.current = null;
    lastWarnedTotalRef.current = null;
    mountedAtRef.current = Date.now();
    setLastDelta(null);
    fetchData();
  }, [fetchData]);

  // Re-fetch when bookings change (hotel/flight added)
  // Also accept optimistic totals via event detail for instant UI updates
  useEffect(() => {
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Silent system-driven event (PaymentsTab tab-mount, expire-stale,
      // orphan-archive, sync-trip-cost-table backfill). Suppress the next
      // computed-delta toast so the user doesn't see a phantom "Trip total
      // changed by ±$X" when they took no action.
      if (detail?.silent === true) {
        suppressNextToastRef.current = {
          active: true,
          reason: typeof detail.reason === 'string' ? detail.reason : 'system',
        };
      }
      if (detail?.optimisticTotalCents != null) {
        setData(prev => ({ ...prev, tripTotalCents: detail.optimisticTotalCents }));
      }
      // Optimistic paid delta — applied immediately so BudgetTab updates in
      // the same frame Mark Paid is clicked, before the DB read returns.
      if (typeof detail?.optimisticPaidDeltaCents === 'number' && detail.optimisticPaidDeltaCents !== 0) {
        setData(prev => ({
          ...prev,
          paidCents: Math.max(0, prev.paidCents + detail.optimisticPaidDeltaCents),
        }));
      }
      const isSilent = detail?.silent === true;
      const silentReason = isSilent
        ? (typeof detail.reason === 'string' ? detail.reason : 'system')
        : '';
      fetchData(); // Immediate refetch (consumes suppress flag if silent)
      // Mirror PaymentsTab's fetchPayments(delayMs) pattern: re-read after
      // ~600 ms to catch rows that weren't read-visible on the first pass
      // (the original L'Arpège bug). Replaces any in-flight pending pass.
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => {
        // Re-arm suppression for the trailing refetch so silent system events
        // don't surface a toast on either pass.
        if (isSilent) {
          suppressNextToastRef.current = { active: true, reason: silentReason };
        }
        fetchData();
      }, 600);
    };
    window.addEventListener('booking-changed', handler);
    // Snapshot must also refetch when the itinerary itself is persisted —
    // otherwise PaymentsTab/Budget read stale numbers after a regenerate /
    // regression-block heal lands on the DB (the Dublin "$998 stale" pattern).
    // Treat as a silent system event so the auto-refetch never spawns a
    // phantom "Trip total changed by ±$X" toast.
    const persistedHandler = () => {
      suppressNextToastRef.current = { active: true, reason: 'trip-persisted' };
      window.dispatchEvent(
        new CustomEvent('booking-changed', {
          detail: { tripId, silent: true, reason: 'trip-persisted' },
        }),
      );
    };
    window.addEventListener(TRIP_PERSISTED_EVENT, persistedHandler);
    return () => {
      window.removeEventListener('booking-changed', handler);
      window.removeEventListener(TRIP_PERSISTED_EVENT, persistedHandler);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [fetchData, tripId]);

  const refetch = useCallback(() => fetchData(), [fetchData]);
  const acknowledgeDelta = useCallback(() => setLastDelta(null), []);

  return useMemo(() => {
    const toBePaid = Math.max(0, data.tripTotalCents - data.paidCents);
    const budgetRemaining = data.budgetTotalCents - data.tripTotalCents;
    const paidPct = data.tripTotalCents > 0 ? (data.paidCents / data.tripTotalCents) * 100 : 0;
    const effectiveHotelCents = data.includeHotel
      ? Math.max(0, data.committedHotelCents + data.manualHotelDelta)
      : 0;
    const effectiveFlightCents = data.includeFlight
      ? Math.max(0, data.committedFlightCents + data.manualFlightDelta)
      : 0;

    return {
      tripTotalCents: data.tripTotalCents,
      paidCents: data.paidCents,
      toBePaidCents: toBePaid,
      budgetTotalCents: data.budgetTotalCents,
      budgetRemainingCents: budgetRemaining,
      plannedUnpaidCents: toBePaid,
      paidPercent: Math.min(paidPct, 100),
      miscReserveCents: data.miscReserveCents,
      includeHotel: data.includeHotel,
      includeFlight: data.includeFlight,
      committedHotelCents: data.committedHotelCents,
      committedFlightCents: data.committedFlightCents,
      manualHotelDelta: data.manualHotelDelta,
      manualFlightDelta: data.manualFlightDelta,
      effectiveHotelCents,
      effectiveFlightCents,
      loading: data.loading,
      lastDelta,
      refetch,
      acknowledgeDelta,
    };
  }, [data, refetch, lastDelta, acknowledgeDelta]);
}
