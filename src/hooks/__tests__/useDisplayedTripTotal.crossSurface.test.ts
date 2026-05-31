/**
 * Cross-surface parity: locks the contract that the THREE call sites of the
 * displayed-total composer emit byte-identical `displayedTotalCents` for the
 * same snapshot+breakdown inputs:
 *
 *   1. EditorialItinerary header
 *        composeDisplayedTripTotal(snap, bd, days.map(d=>d.dayNumber))
 *   2. PaymentsTab "Trip Total" headline + "Matches itinerary" badge
 *        useDisplayedTripTotal(tripId)  ← omits dayNumbers (sums all days>0)
 *   3. BudgetTab `tripTotalCents` + BudgetCoach `currentTotalCents`
 *        useDisplayedTripTotal(tripId)  ← omits dayNumbers (sums all days>0)
 *
 * Without this test, a future refactor of `composeDisplayedTripTotal` (or a
 * regression where the header passes a different day-key shape) can silently
 * reopen the Copenhagen $1,124 vs $1,048 three-way drift class — the kind of
 * bug that only surfaces on a real trip with hotel/flight chips visible.
 *
 * Test mirrors PaymentsTab + BudgetTab call shape (no dayNumbers) and the
 * header call shape (explicit visible-day list). When the explicit list
 * covers all days >0 in the breakdown, the three results MUST match exactly.
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

function bd(byDay: Record<number, number>): TripDayBreakdown {
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
  return { byDay: out, loading: false, refetch: () => {} };
}

/** Simulate the three call sites against one fixture. */
function threeWayResult(
  s: FinancialSnapshot,
  b: TripDayBreakdown,
  visibleDayNumbers: number[],
) {
  return {
    header: composeDisplayedTripTotal(s, b, visibleDayNumbers),
    payments: composeDisplayedTripTotal(s, b), // no dayNumbers arg
    budget: composeDisplayedTripTotal(s, b), // no dayNumbers arg
  };
}

describe('useDisplayedTripTotal — cross-surface parity (Header / Payments / Budget)', () => {
  it('Copenhagen pattern: snapshot < chips → all three clamp UP to chipSum', () => {
    // Snapshot lags chips: tripTotal 1048, but hotel 500 + flight 200 + days (300+280) = 1280
    const s = snap({
      tripTotalCents: 104_800,
      effectiveHotelCents: 50_000,
      effectiveFlightCents: 20_000,
    });
    const b = bd({ 1: 30_000, 2: 28_000 });
    const r = threeWayResult(s, b, [1, 2]);

    expect(r.header.displayedTotalCents).toBe(128_000);
    expect(r.payments.displayedTotalCents).toBe(r.header.displayedTotalCents);
    expect(r.budget.displayedTotalCents).toBe(r.header.displayedTotalCents);

    // Reconciling-hint predicate must also agree across surfaces.
    expect(r.header.snapshotUnderChips).toBe(true);
    expect(r.payments.snapshotUnderChips).toBe(true);
    expect(r.budget.snapshotUnderChips).toBe(true);
  });

  it('Healthy case: snapshot >= chips → all three render snapshot', () => {
    const s = snap({
      tripTotalCents: 200_000,
      effectiveHotelCents: 50_000,
      effectiveFlightCents: 20_000,
    });
    const b = bd({ 1: 30_000, 2: 28_000 });
    const r = threeWayResult(s, b, [1, 2]);

    expect(r.header.displayedTotalCents).toBe(200_000);
    expect(r.payments.displayedTotalCents).toBe(200_000);
    expect(r.budget.displayedTotalCents).toBe(200_000);
  });

  it('Casablanca-strip pattern: snapshot == days, hotel chip present → all balance', () => {
    // Header used to render "Days 14288 + Hotel 5224 = Trip Total 14288"
    // because snapshot didn't include the hotel row. Composer fixes this.
    const s = snap({
      tripTotalCents: 1_428_800, // matches just the days
      effectiveHotelCents: 522_400,
      effectiveFlightCents: 0,
    });
    const b = bd({ 1: 500_000, 2: 500_000, 3: 428_800 });
    const r = threeWayResult(s, b, [1, 2, 3]);

    const expected = 1_428_800 + 522_400; // chips win
    expect(r.header.displayedTotalCents).toBe(expected);
    expect(r.payments.displayedTotalCents).toBe(expected);
    expect(r.budget.displayedTotalCents).toBe(expected);
  });

  it('Day 0 logistics row: header passes only days 1..N; Payments/Budget still match because Day 0 is excluded by default', () => {
    // Day 0 carries a logistics row (e.g. airport transfer). Header excludes
    // Day 0 from `days.map(d=>d.dayNumber)` (UI doesn't render a Day 0 card),
    // and Payments/Budget skip Day 0 in the default "sum all days > 0" branch.
    // Both code paths MUST yield the same daysSubtotal.
    const s = snap({
      tripTotalCents: 150_000,
      effectiveHotelCents: 40_000,
      effectiveFlightCents: 20_000,
    });
    const b = bd({ 0: 5_000, 1: 40_000, 2: 35_000, 3: 30_000 });
    const r = threeWayResult(s, b, [1, 2, 3]);

    expect(r.header.daysSubtotalCents).toBe(105_000);
    expect(r.payments.daysSubtotalCents).toBe(105_000);
    expect(r.budget.daysSubtotalCents).toBe(105_000);
    expect(r.header.displayedTotalCents).toBe(r.payments.displayedTotalCents);
    expect(r.header.displayedTotalCents).toBe(r.budget.displayedTotalCents);
  });

  it('snapshotOverChips flag is consistent across surfaces', () => {
    const s = snap({
      tripTotalCents: 150_000, // overshoots chips by $200
      effectiveHotelCents: 50_000,
      effectiveFlightCents: 20_000,
    });
    const b = bd({ 1: 30_000, 2: 28_000 }); // chips = 128k
    const r = threeWayResult(s, b, [1, 2]);

    expect(r.header.snapshotOverChips).toBe(true);
    expect(r.payments.snapshotOverChips).toBe(true);
    expect(r.budget.snapshotOverChips).toBe(true);
  });

  it('PaymentsTab loading fallback: when displayed.loading, PaymentsTab uses snapshot.tripTotalCents — and snapshot itself must match header when not loading', () => {
    // PaymentsTab logic: `displayed.loading ? snapshot.tripTotalCents : displayed.displayedTotalCents`
    // This guards the parity invariant against a transient mid-fetch render.
    const s = snap({
      tripTotalCents: 200_000,
      effectiveHotelCents: 50_000,
      effectiveFlightCents: 20_000,
    });
    const b = bd({ 1: 30_000, 2: 28_000 });
    const r = threeWayResult(s, b, [1, 2]);

    // Not loading → PaymentsTab renders displayed, header renders displayed → equal
    const paymentsRendered = r.payments.loading ? s.tripTotalCents : r.payments.displayedTotalCents;
    expect(paymentsRendered).toBe(r.header.displayedTotalCents);
  });

  it('Triple parity holds across a wide cents range (fuzz)', () => {
    const fixtures: Array<[FinancialSnapshot, TripDayBreakdown, number[]]> = [
      [snap({ tripTotalCents: 0 }), bd({}), []],
      [snap({ tripTotalCents: 50, effectiveHotelCents: 100 }), bd({ 1: 25 }), [1]],
      [snap({ tripTotalCents: 999_999, effectiveHotelCents: 333_333, effectiveFlightCents: 222_222 }),
       bd({ 1: 111_111, 2: 111_111, 3: 111_111, 4: 111_111 }), [1, 2, 3, 4]],
      [snap({ tripTotalCents: 1, effectiveHotelCents: 1 }), bd({ 1: 1 }), [1]],
    ];
    for (const [s, b, days] of fixtures) {
      const r = threeWayResult(s, b, days);
      expect(r.header.displayedTotalCents).toBe(r.payments.displayedTotalCents);
      expect(r.header.displayedTotalCents).toBe(r.budget.displayedTotalCents);
      expect(r.payments.chipSumCents).toBe(r.budget.chipSumCents);
    }
  });
});
