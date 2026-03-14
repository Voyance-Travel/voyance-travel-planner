/**
 * useTripFinancialSnapshot
 * 
 * Single source of truth for trip financial numbers across all tabs.
 * "Spent" always means "paid only" — amounts with status='paid' in trip_payments.
 * 
 * Outputs (all in cents):
 *   - tripTotalCents:       Total expected cost (itinerary + flights + hotel + manual)
 *   - paidCents:            Sum of trip_payments with status='paid'
 *   - toBePaidCents:        tripTotalCents - paidCents (clamped >= 0)
 *   - budgetTotalCents:     User-set budget from trip settings
 *   - budgetRemainingCents: budgetTotalCents - paidCents
 *   - plannedUnpaidCents:   tripTotalCents - paidCents (same as toBePaidCents, for label clarity)
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
}

interface UseTripFinancialSnapshotOptions {
  tripId: string;
  /** 
   * The computed trip total in cents from the parent component.
   * This should include itinerary activities + flights + hotel + manual expenses.
   * By accepting this as a prop we avoid duplicating the complex payableItems logic.
   */
  tripTotalCents: number;
}

export function useTripFinancialSnapshot({ tripId, tripTotalCents }: UseTripFinancialSnapshotOptions): FinancialSnapshot {
  const [paidCents, setPaidCents] = useState(0);
  const [budgetTotalCents, setBudgetTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    
    // Fetch paid payments and budget settings in parallel
    const [paymentsResult, budgetResult] = await Promise.all([
      supabase
        .from('trip_payments')
        .select('amount_cents, quantity, status')
        .eq('trip_id', tripId)
        .eq('status', 'paid'),
      supabase
        .from('trips')
        .select('budget_total_cents')
        .eq('id', tripId)
        .single(),
    ]);

    // Sum paid amounts
    const paid = (paymentsResult.data || []).reduce(
      (sum, p) => sum + ((p.amount_cents || 0) * (p.quantity || 1)),
      0,
    );
    setPaidCents(paid);

    // Budget
    setBudgetTotalCents(budgetResult.data?.budget_total_cents || 0);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return useMemo(() => {
    const toBePaid = Math.max(0, tripTotalCents - paidCents);
    const budgetRemaining = budgetTotalCents - paidCents;
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
