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
  loading: boolean;
  lastDelta: FinancialDelta | null;
  refetch: () => void;
  acknowledgeDelta: () => void;
}

interface SnapshotData {
  tripTotalCents: number;
  paidCents: number;
  budgetTotalCents: number;
  loading: boolean;
}

export function useTripFinancialSnapshot(tripId: string): FinancialSnapshot {
  const [data, setData] = useState<SnapshotData>({
    tripTotalCents: 0,
    paidCents: 0,
    budgetTotalCents: 0,
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
    const liveActivityIds = new Set<string>();
    const days = ((tripData as any)?.itinerary_data?.days) || [];
    for (const day of days) {
      for (const a of (day?.activities || [])) {
        if (a?.id) liveActivityIds.add(String(a.id));
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
      .eq('trip_id', tripId);

    const manualPayments = (allPayments || []).filter(
      (p) => typeof p.item_id === 'string' && /^manual-/i.test(p.item_id)
    );

    let totalCents = 0;
    let paidTotal = 0;
    let canonicalHotelCents = 0;
    let canonicalFlightCents = 0;
    // Track committed hotel/flight + already-logged misc spend so we can fold
    // the unspent portion of the misc reserve into the trip total.
    let committedHotelCents = 0;
    let committedFlightCents = 0;
    let loggedMiscCents = 0;

    for (const row of costs || []) {
      // Orphan filter: drop activity-bound rows whose activity_id no longer
      // exists in the live itinerary. Logistics rows (day_number=0 or
      // source=logistics-sync) are exempt — they belong to hotel/flight,
      // not to itinerary activities. This MUST mirror getBudgetLedger and
      // usePayableItems exactly so all three views report the same total.
      const isLogisticsRow =
        row.source === 'logistics-sync' ||
        row.day_number == null ||
        row.day_number === 0;
      if (
        !isLogisticsRow &&
        row.activity_id &&
        !liveActivityIds.has(String(row.activity_id))
      ) {
        continue;
      }

      const rowTotal = (row.cost_per_person_usd || 0) * (row.num_travelers || 1);
      const rowCents = Math.round(rowTotal * 100);
      const cat = (row.category || '').toLowerCase();

      // Track canonical day-0 logistics rows separately so we can compute the
      // manual override delta (manual replaces canonical, doesn't add to it).
      if (row.day_number === 0 && cat === 'hotel') canonicalHotelCents += rowCents;
      if (row.day_number === 0 && cat === 'flight') canonicalFlightCents += rowCents;
      if (cat === 'hotel') committedHotelCents += rowCents;
      else if (cat === 'flight') committedFlightCents += rowCents;
      else if (cat === 'misc') loggedMiscCents += rowCents;

      // Use shared inclusion rule — must match getBudgetSummary exactly,
      // otherwise snapshot total and summary total drift apart.
      if (!shouldCountRow(row, includeHotel, includeFlight)) continue;

      totalCents += rowCents;

      if (row.is_paid) {
        const paidUsd = row.paid_amount_usd != null ? row.paid_amount_usd : rowTotal;
        paidTotal += Math.round(paidUsd * 100);
      }
    }

    // Manual payment delta — override-aware for hotel/flight, additive for others.
    let manualHotelCents = 0;
    let manualFlightCents = 0;
    let manualOtherCents = 0;
    let manualPaidCents = 0;
    for (const p of manualPayments || []) {
      const cents = (p.amount_cents || 0) * (p.quantity || 1);
      if (p.item_type === 'hotel') manualHotelCents += cents;
      else if (p.item_type === 'flight') manualFlightCents += cents;
      else manualOtherCents += cents;
      manualPaidCents += cents;
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
    paidTotal += manualPaidCents;

    // Misc reserve — the user explicitly set aside cash for tips / SIM /
    // pharmacy / market finds. The itinerary never auto-fills it, so without
    // folding the unspent portion into the total the headline budget reads
    // as having phantom headroom equal to the slider value.
    const budgetTotalForReserve = tripData?.budget_total_cents || 0;
    if (budgetTotalForReserve > 0 && miscPercent > 0) {
      const reserve = computeMiscReserve({
        budgetTotalCents: budgetTotalForReserve,
        miscPercent,
        committedHotelCents,
        committedFlightCents,
        includeHotel,
        includeFlight,
        loggedMiscCents,
      });
      totalCents += reserve.contributionToTotalCents;
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
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.optimisticTotalCents != null) {
        setData(prev => ({ ...prev, tripTotalCents: detail.optimisticTotalCents }));
      }
      fetchData(); // Still fetch for full accuracy
    };
    window.addEventListener('booking-changed', handler);
    return () => window.removeEventListener('booking-changed', handler);
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
