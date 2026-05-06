/**
 * Reconciliation tests for `usePayableItems`. These pin down the
 * Flights & Hotels ↔ Payments tab agreement: when the itinerary shows
 * a hotel/flight in the details tab, the same row must surface in the
 * Payments tab with the same dollar amount, and a manual override must
 * suppress the canonical row.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePayableItems } from '@/hooks/usePayableItems';
import type { TripPayment } from '@/services/tripPaymentsAPI';

const baseDays = [
  { dayNumber: 1, activities: [] },
  { dayNumber: 2, activities: [] },
  { dayNumber: 3, activities: [] },
];

describe('usePayableItems — Flights & Hotels reconciliation', () => {
  it('emits a hotel-selection row matching the selection totalPrice', () => {
    const { result } = renderHook(() =>
      usePayableItems({
        days: baseDays,
        flightSelection: null,
        hotelSelection: { name: 'Four Seasons George V', totalPrice: 2400 },
        travelers: 2,
        payments: [],
        activityCosts: [],
        paymentsLoaded: true,
      }),
    );

    const hotel = result.current.items.find(i => i.type === 'hotel');
    expect(hotel).toBeTruthy();
    expect(hotel?.id).toBe('hotel-selection');
    expect(hotel?.amountCents).toBe(240000);
    expect(hotel?.name).toBe('Four Seasons George V');
  });

  it('suppresses the canonical hotel row when a manual hotel payment exists', () => {
    const manual: TripPayment = {
      id: 'p1',
      trip_id: 't1',
      item_type: 'hotel',
      item_id: 'manual-four-seasons',
      amount_cents: 240000,
      currency: 'USD',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    const { result } = renderHook(() =>
      usePayableItems({
        days: baseDays,
        flightSelection: null,
        hotelSelection: { name: 'Phantom Hotel', totalPrice: 2850 },
        travelers: 2,
        payments: [manual],
        activityCosts: [],
        paymentsLoaded: true,
      }),
    );

    // The canonical "hotel-selection" row should NOT appear; only the manual row.
    const canonical = result.current.items.find(i => i.id === 'hotel-selection');
    expect(canonical).toBeUndefined();
    const hotelRows = result.current.items.filter(i => i.type === 'hotel');
    expect(hotelRows).toHaveLength(1);
    expect(hotelRows[0].id).toBe('manual-four-seasons');
  });

  it('emits a flight row matching the flight selection totalPrice', () => {
    const { result } = renderHook(() =>
      usePayableItems({
        days: baseDays,
        flightSelection: { totalPrice: 1800, outbound: { airline: 'Air France' } } as any,
        hotelSelection: null,
        travelers: 1,
        payments: [],
        activityCosts: [],
        paymentsLoaded: true,
      }),
    );

    const flight = result.current.items.find(i => i.type === 'flight');
    expect(flight?.id).toBe('flight-selection');
    expect(flight?.amountCents).toBe(180000);
    expect(flight?.name).toContain('Air France');
  });

  it('suppresses canonical hotel/flight rows until payments are loaded', () => {
    const { result } = renderHook(() =>
      usePayableItems({
        days: baseDays,
        flightSelection: { totalPrice: 1800 } as any,
        hotelSelection: { totalPrice: 2400 },
        travelers: 1,
        payments: [],
        activityCosts: [],
        paymentsLoaded: false,
      }),
    );

    // While payments are still loading we should not flash duplicate rows.
    expect(result.current.items.find(i => i.id === 'hotel-selection')).toBeUndefined();
    expect(result.current.items.find(i => i.id === 'flight-selection')).toBeUndefined();
  });
});
