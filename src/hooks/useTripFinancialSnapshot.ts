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
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FinancialSnapshot {
  tripTotalCents: number;
  paidCents: number;
  toBePaidCents: number;
  budgetTotalCents: number;
  budgetRemainingCents: number;
  plannedUnpaidCents: number;
  paidPercent: number;
  loading: boolean;
  refetch: () => void;
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

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    
    // 1. Fetch trip settings (budget + inclusion toggles)
    const { data: tripData } = await supabase
      .from('trips')
      .select('budget_total_cents, budget_include_hotel, budget_include_flight')
      .eq('id', tripId)
      .single();

    const includeHotel = tripData?.budget_include_hotel ?? true;
    const includeFlight = tripData?.budget_include_flight ?? false;

    // 2. Fetch all activity_costs for this trip
    const { data: costs } = await supabase
      .from('activity_costs')
      .select('cost_per_person_usd, num_travelers, is_paid, paid_amount_usd, category, day_number')
      .eq('trip_id', tripId);

    let totalCents = 0;
    let paidTotal = 0;

    for (const row of costs || []) {
      // Skip hotel/flight logistics rows (day_number=0) when toggled off
      if (row.day_number === 0 && row.category === 'hotel' && !includeHotel) continue;
      if (row.day_number === 0 && row.category === 'flight' && !includeFlight) continue;

      const rowTotal = (row.cost_per_person_usd || 0) * (row.num_travelers || 1);
      totalCents += Math.round(rowTotal * 100);

      if (row.is_paid) {
        // Use paid_amount_usd if set, otherwise use the full cost
        const paidUsd = row.paid_amount_usd != null ? row.paid_amount_usd : rowTotal;
        paidTotal += Math.round(paidUsd * 100);
      }
    }

    // Atomic update — all values in one setState call
    setData({
      tripTotalCents: totalCents,
      paidCents: paidTotal,
      budgetTotalCents: tripData?.budget_total_cents || 0,
      loading: false,
    });
  }, [tripId]);

  useEffect(() => {
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
      refetch,
    };
  }, [data, refetch]);
}
