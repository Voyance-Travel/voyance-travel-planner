/**
 * Locks the parity contract between EditorialItinerary header (top-line +
 * equation + Reconciling hint), PaymentsTab "Trip Total" + "Matches
 * itinerary" badge, and BudgetTab/BudgetCoach `currentTotalCents`. Both
 * `useDisplayedTripTotal` (hook) and `composeDisplayedTripTotal` (pure)
 * MUST return byte-identical numbers for the same snapshot+breakdown
 * inputs — otherwise the header + Payments + Budget can drift apart again
 * (Copenhagen $1,124 vs $1,048; Casablanca strip equation).
 *
 * See mem://constraints/finance/displayed-trip-total-single-source.
 */

import { describe, it, expect } from 'vitest';
import { composeDisplayedTripTotal } from '@/hooks/useDisplayedTripTotal';
import type { FinancialSnapshot } from '@/hooks/useTripFinancialSnapshot';
import type { TripDayBreakdown } from '@/hooks/useTripDayBreakdown';

function snap(over: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    tripTotalCents: 0,
    paidCents: 0,
    budgetTotalCents: 0,
    effectiveHotelCents: 0,
    effectiveFlightCents: 0,
    excludedHotelCents: 0,
    excludedFlightCents: 0,
    loading: false,
    ...(over as any),
  } as FinancialSnapshot;
}

function bd(byDay: Record<number, number> = {}, loading = false): TripDayBreakdown {
  const out: TripDayBreakdown['byDay'] = {};
  for (const [k, totalCents] of Object.entries(byDay)) {
    out[Number(k)] = {
      totalCents,
      visibleCents: totalCents,
      otherCents: 0,
      rows: [],
      otherRows: [],
    };
  }
  return { byDay: out, loading, refetch: () => {} };
}

describe('composeDisplayedTripTotal — header/Payments/Budget parity', () => {
  it('clamps displayed UP to chipSum when snapshot < chips (Copenhagen pattern)', () => {
    const r = composeDisplayedTripTotal(
      snap({ tripTotalCents: 104_800, effectiveHotelCents: 50_000, effectiveFlightCents: 20_000 }),
      bd({ 1: 30_000, 2: 28_000 }), // chips = 50k + 20k + 58k = 128k, snap = 104.8k
    );
    expect(r.snapshotUnderChips).toBe(true);
    expect(r.displayedTotalCents).toBe(r.chipSumCents);
    expect(r.displayedTotalCents).toBe(128_000);
  });

  it('keeps displayed = snapshot when snapshot >= chips', () => {
    const r = composeDisplayedTripTotal(
      snap({ tripTotalCents: 200_000, effectiveHotelCents: 50_000, effectiveFlightCents: 20_000 }),
      bd({ 1: 30_000, 2: 28_000 }),
    );
    expect(r.snapshotUnderChips).toBe(false);
    expect(r.displayedTotalCents).toBe(200_000);
  });

  it('flags snapshotOverChips when snapshot exceeds chips + $1', () => {
    const r = composeDisplayedTripTotal(
      snap({ tripTotalCents: 130_000, effectiveHotelCents: 50_000, effectiveFlightCents: 20_000 }),
      bd({ 1: 30_000, 2: 28_000 }), // chips = 128k, snap = 130k → over by $20
    );
    expect(r.snapshotOverChips).toBe(true);
  });

  it('honors explicit dayNumbers filter (header passes visible-days)', () => {
    const r = composeDisplayedTripTotal(
      snap({ tripTotalCents: 100_000 }),
      bd({ 1: 10_000, 2: 20_000, 3: 30_000 }),
      [1, 2],
    );
    expect(r.daysSubtotalCents).toBe(30_000);
  });

  it('sums all days>0 when dayNumbers omitted (Payments + Budget default)', () => {
    const r = composeDisplayedTripTotal(
      snap({ tripTotalCents: 100_000 }),
      bd({ 0: 50_000, 1: 10_000, 2: 20_000, 3: 30_000 }),
    );
    expect(r.daysSubtotalCents).toBe(60_000); // Day 0 excluded — logistics
  });

  it('propagates loading from either snapshot or breakdown', () => {
    expect(composeDisplayedTripTotal(snap({ loading: true }), bd()).loading).toBe(true);
    expect(composeDisplayedTripTotal(snap(), bd({}, true)).loading).toBe(true);
    expect(composeDisplayedTripTotal(snap(), bd()).loading).toBe(false);
  });
});
