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
 *   - Logs a console.warn + toast when a single refresh jumps the total by >25%
 *     (catches silent rewrite regressions in repair/sync pipelines).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { shouldCountRow } from '@/services/tripBudgetService';
import { computeMiscReserve } from '@/services/budgetReserve';
import { resolveCanonicalCostRows, type CanonicalLiveActivity } from '@/services/canonicalCostRows';

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
  loading: boolean;
}

export function useTripFinancialSnapshot(tripId: string): FinancialSnapshot {
  const [data, setData] = useState<SnapshotData>({
    tripTotalCents: 0,
    paidCents: 0,
    budgetTotalCents: 0,
    miscReserveCents: 0,
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

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    
    // 1. Fetch trip settings (budget + inclusion toggles) AND itinerary_data so
    // we can filter out orphaned activity_costs rows whose activity_id no
    // longer exists in the live itinerary. Without this, the snapshot total
    // includes ghost rows that Budget/Payments correctly drop, producing
    // session-to-session drift and a permanent "Reconciling…" mismatch.
    const { data: tripData } = await supabase
      .from('trips')
      .select('budget_total_cents, budget_include_hotel, budget_include_flight, budget_allocations, itinerary_data')
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
    const orphanPaymentItemIds = new Set<string>();
    for (const p of allPayments || []) {
      if (typeof p.item_id !== 'string') continue;
      if (/^manual-/i.test(p.item_id)) continue;
      const cat = (p.item_type || '').toLowerCase();
      if (cat === 'hotel' || cat === 'flight' || cat === 'flights') continue;
      const stripped = stripDaySuffix(p.item_id);
      if (!liveActivityIds.has(stripped)) {
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

    // Canonical resolver: shared with usePayableItems so the row sum and
    // the header total apply identical orphan-rescue + $0-JSON-rescue rules.
    const canonical = resolveCanonicalCostRows({
      costs: (costs || []) as any,
      liveActivities,
      includeHotel,
      includeFlight,
    });
    totalCents = canonical.totalCents;
    committedHotelCents = canonical.hotelCents;
    committedFlightCents = canonical.flightCents;
    loggedMiscCents = canonical.loggedMiscCents;

    // Day-0 canonical hotel/flight (used by manual-override delta below)
    for (const row of costs || []) {
      const cat = (row.category || '').toLowerCase();
      const rowCents = Math.round(((row.cost_per_person_usd || 0) * (row.num_travelers || 1)) * 100);
      if (row.day_number === 0 && cat === 'hotel') canonicalHotelCents += rowCents;
      if (row.day_number === 0 && cat === 'flight') canonicalFlightCents += rowCents;
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

    // Manual payment delta — override-aware for hotel/flight, additive for others.
    let manualHotelCents = 0;
    let manualFlightCents = 0;
    let manualOtherCents = 0;
    for (const p of manualPayments || []) {
      const cents = (p.amount_cents || 0) * (p.quantity || 1);
      if (p.item_type === 'hotel') manualHotelCents += cents;
      else if (p.item_type === 'flight') manualFlightCents += cents;
      else manualOtherCents += cents;
    }
    const hotelDelta = canonicalHotelCents > 0
      ? (manualHotelCents - canonicalHotelCents)
      : manualHotelCents;
    const flightDelta = canonicalFlightCents > 0
      ? (manualFlightCents - canonicalFlightCents)
      : manualFlightCents;
    if (includeHotel) totalCents += hotelDelta;
    if (includeFlight) totalCents += flightDelta;
    totalCents += manualOtherCents;
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
              window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
            }
          });
      }
    } else {
      lastArchivedFingerprintRef.current = null;
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
      if (ratio > 0.25 && lastWarnedTotalRef.current !== totalCents) {
        lastWarnedTotalRef.current = totalCents;
        const sign = delta.deltaCents >= 0 ? '+' : '−';
        const amount = Math.abs(delta.deltaCents) / 100;

        // Try to attribute the jump to a recent cost-repair pass first.
        // If we find logged changes, replace the generic "Trip total changed"
        // toast with an itemized one so users know exactly what moved.
        let attributed = false;
        try {
          const { getRecentCostChanges } = await import('@/services/activityCostService');
          const changes = await getRecentCostChanges(tripId, 8_000);
          if (changes.length > 0) {
            attributed = true;
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

        if (!attributed) {
          console.warn(
            `[useTripFinancialSnapshot] Trip total jumped ${sign}$${amount.toFixed(0)} ` +
            `(${(ratio * 100).toFixed(0)}%). prev=${prev} new=${totalCents} tripId=${tripId}`
          );
          try {
            toast.warning(`Trip total changed by ${sign}$${amount.toFixed(0)}`, {
              description: 'Tap to see what changed',
              duration: 7000,
            });
          } catch {}
        }
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
      loading: false,
    });
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
      fetchData(); // Immediate refetch
      // Mirror PaymentsTab's fetchPayments(delayMs) pattern: re-read after
      // ~600 ms to catch rows that weren't read-visible on the first pass
      // (the original L'Arpège bug). Replaces any in-flight pending pass.
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { fetchData(); }, 600);
    };
    window.addEventListener('booking-changed', handler);
    return () => {
      window.removeEventListener('booking-changed', handler);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(), [fetchData]);
  const acknowledgeDelta = useCallback(() => setLastDelta(null), []);

  return useMemo(() => {
    const toBePaid = Math.max(0, data.tripTotalCents - data.paidCents);
    const budgetRemaining = data.budgetTotalCents - data.tripTotalCents;
    const paidPct = data.tripTotalCents > 0 ? (data.paidCents / data.tripTotalCents) * 100 : 0;

    return {
      tripTotalCents: data.tripTotalCents,
      paidCents: data.paidCents,
      toBePaidCents: toBePaid,
      budgetTotalCents: data.budgetTotalCents,
      budgetRemainingCents: budgetRemaining,
      plannedUnpaidCents: toBePaid,
      paidPercent: Math.min(paidPct, 100),
      loading: data.loading,
      lastDelta,
      refetch,
      acknowledgeDelta,
    };
  }, [data, refetch, lastDelta, acknowledgeDelta]);
}
