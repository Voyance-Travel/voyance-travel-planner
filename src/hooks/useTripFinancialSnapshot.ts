/**
 * useTripFinancialSnapshot
 * 
 * Single source of truth for trip financial numbers across all tabs.
 * Fetches all cost sources internally: activity_costs, hotel, flight, and payments.
 * 
 * Outputs (all in cents):
 *   - tripTotalCents:       Total expected cost (activities + flights + hotel)
 *   - paidCents:            Sum of trip_payments with status='paid'
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
}

export function useTripFinancialSnapshot(tripId: string): FinancialSnapshot {
  const [paidCents, setPaidCents] = useState(0);
  const [budgetTotalCents, setBudgetTotalCents] = useState(0);
  const [activityTotalCents, setActivityTotalCents] = useState(0);
  const [hotelCents, setHotelCents] = useState(0);
  const [flightCents, setFlightCents] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tripId) return;
    
    const [paymentsResult, tripResult, activityResult] = await Promise.all([
      supabase
        .from('trip_payments')
        .select('amount_cents, quantity, status')
        .eq('trip_id', tripId)
        .eq('status', 'paid'),
      supabase
        .from('trips')
        .select('budget_total_cents, hotel_selection, flight_selection')
        .eq('id', tripId)
        .single(),
      supabase
        .from('v_trip_total')
        .select('total_all_travelers_usd')
        .eq('trip_id', tripId)
        .maybeSingle(),
    ]);

    // Sum paid amounts
    const paid = (paymentsResult.data || []).reduce(
      (sum, p) => sum + ((p.amount_cents || 0) * (p.quantity || 1)),
      0,
    );
    setPaidCents(paid);

    // Budget
    setBudgetTotalCents(tripResult.data?.budget_total_cents || 0);

    // Activity costs from v_trip_total (USD → cents)
    const actCents = Math.round((activityResult.data?.total_all_travelers_usd || 0) * 100);
    setActivityTotalCents(actCents);

    // Hotel total from selection JSON
    const hotel = tripResult.data?.hotel_selection as any;
    if (hotel) {
      let hTotal = hotel.totalPrice || 0;
      if (!hTotal && hotel.pricePerNight && hotel.checkIn && hotel.checkOut) {
        const nights = Math.max(1, Math.ceil(
          (new Date(hotel.checkOut).getTime() - new Date(hotel.checkIn).getTime()) / (1000 * 60 * 60 * 24)
        ));
        hTotal = hotel.pricePerNight * nights;
      }
      setHotelCents(Math.round(hTotal * 100));
    } else {
      setHotelCents(0);
    }

    // Flight total from selection JSON
    const flight = tripResult.data?.flight_selection as any;
    setFlightCents(flight?.price ? Math.round(flight.price * 100) : 0);

    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return useMemo(() => {
    const tripTotalCents = activityTotalCents + hotelCents + flightCents;
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
  }, [activityTotalCents, hotelCents, flightCents, paidCents, budgetTotalCents, loading]);
}
