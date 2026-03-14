/**
 * useTripFinancialSnapshot
 * 
 * Single source of truth for trip financial numbers across all tabs.
 * Reads from activity_costs via v_trip_total and v_payments_summary views.
 * 
 * Outputs (all in cents):
 *   - tripTotalCents:       Total expected cost from activity_costs (activities + flights + hotel)
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

export function useTripFinancialSnapshot(tripId: string): FinancialSnapshot {
  const [paidCents, setPaidCents] = useState(0);
  const [budgetTotalCents, setBudgetTotalCents] = useState(0);
  const [tripTotalCents, setTripTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    
    const [tripTotalResult, paymentsSummaryResult, tripResult] = await Promise.all([
      // v_trip_total: total_all_travelers_usd from activity_costs
      supabase
        .from('v_trip_total')
        .select('total_all_travelers_usd')
        .eq('trip_id', tripId)
        .maybeSingle(),
      // v_payments_summary: paid/unpaid from activity_costs
      supabase
        .from('v_payments_summary')
        .select('total_paid_usd')
        .eq('trip_id', tripId)
        .maybeSingle(),
      // Budget setting from trips table
      supabase
        .from('trips')
        .select('budget_total_cents')
        .eq('id', tripId)
        .single(),
    ]);

    // Trip total from activity_costs view (USD → cents)
    const totalUsd = Number(tripTotalResult.data?.total_all_travelers_usd) || 0;
    setTripTotalCents(Math.round(totalUsd * 100));

    // Paid from activity_costs view (USD → cents)
    const paidUsd = Number(paymentsSummaryResult.data?.total_paid_usd) || 0;
    setPaidCents(Math.round(paidUsd * 100));

    // Budget
    setBudgetTotalCents(tripResult.data?.budget_total_cents || 0);

    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  return useMemo(() => {
    const toBePaid = Math.max(0, tripTotalCents - paidCents);
    const budgetRemaining = budgetTotalCents - tripTotalCents;
    const paidPct = tripTotalCents > 0 ? (paidCents / tripTotalCents) * 100 : 0;

    return {
      tripTotalCents,
      paidCents,
      toBePaidCents: toBePaid,
      budgetTotalCents,
      budgetRemainingCents: budgetRemaining,
      plannedUnpaidCents: toBePaid,
      paidPercent: Math.min(paidPct, 100),
      loading,
    };
  }, [tripTotalCents, paidCents, budgetTotalCents, loading]);
}
