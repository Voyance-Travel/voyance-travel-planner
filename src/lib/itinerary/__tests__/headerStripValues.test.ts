import { describe, expect, it } from 'vitest';
import { computeHeaderStripValues } from '../headerStripValues';

describe('computeHeaderStripValues', () => {
  it('balances when snapshot total equals days subtotal but a hotel chip is visible (Casablanca / Kyoto / Osaka pattern)', () => {
    // Symmetric drift: the snapshot fetch hasn't included the hotel yet
    // (or useTripDayBreakdown raced ahead). Visible equation must still
    // read `Days + Hotel = Trip Total` consistently.
    const v = computeHeaderStripValues({
      tripTotalUsd: 812,
      daysGroupUsd: 812,
      hotelChipUsd: 525,
      flightChipUsd: 0,
    });
    expect(v.snapshotUnderChips).toBe(true);
    expect(v.displayedTripTotalUsd).toBe(1337); // 812 + 525
    expect(v.reserveAdjustUsd).toBe(0);
    expect(v.showReserve).toBe(false);
  });

  it('surfaces a positive reserve chip when snapshot total exceeds chip sum (Day-0 reserve / unattributed cost)', () => {
    const v = computeHeaderStripValues({
      tripTotalUsd: 1500,
      daysGroupUsd: 800,
      hotelChipUsd: 525,
      flightChipUsd: 0,
    });
    expect(v.snapshotOverChips).toBe(true);
    expect(v.displayedTripTotalUsd).toBe(1500);
    expect(v.reserveAdjustUsd).toBeCloseTo(175, 5);
    expect(v.showReserve).toBe(true);
  });

  it('preserves existing chip-sum override when chips exceed the snapshot (legacy stripDrift case)', () => {
    const v = computeHeaderStripValues({
      tripTotalUsd: 460,
      daysGroupUsd: 820,
      hotelChipUsd: 1780,
      flightChipUsd: 0,
    });
    expect(v.snapshotUnderChips).toBe(true);
    expect(v.displayedTripTotalUsd).toBe(2600);
    expect(v.reserveAdjustUsd).toBe(0);
    expect(v.showReserve).toBe(false);
  });

  it('balances trivially when no hotel/flight chip is shown', () => {
    const v = computeHeaderStripValues({
      tripTotalUsd: 800,
      daysGroupUsd: 800,
      hotelChipUsd: 0,
      flightChipUsd: 0,
    });
    expect(v.snapshotUnderChips).toBe(false);
    expect(v.snapshotOverChips).toBe(false);
    expect(v.displayedTripTotalUsd).toBe(800);
    expect(v.reserveAdjustUsd).toBe(0);
    expect(v.showReserve).toBe(false);
  });

  it('does not over-trigger reserve chip on sub-cent rounding (≤ $0.50 noise stays hidden)', () => {
    const v = computeHeaderStripValues({
      tripTotalUsd: 1337.3,
      daysGroupUsd: 812,
      hotelChipUsd: 525,
      flightChipUsd: 0,
    });
    // displayed = max(1337.3, 1337) = 1337.3; reserve = 0.3 → suppressed
    expect(v.displayedTripTotalUsd).toBeCloseTo(1337.3, 5);
    expect(v.showReserve).toBe(false);

  // Regression: the headline `Trip Total` and the equation-row `Trip Total`
  // MUST both render `displayedTripTotalUsd`. When the snapshot lags the
  // chip sum, the headline must NOT keep showing the days-only snapshot
  // (Casablanca/Kyoto/Osaka/Amsterdam/Sapporo: "Days $812 + Hotel $525 =
  // Trip Total $812"). Both consumers reading the same field is what
  // guarantees the equation and the headline can never disagree.
  it('headline + equation-row Trip Total share displayedTripTotalUsd for every reported city', () => {
    const cases = [
      { name: 'Casablanca', tripTotalUsd: 812,  daysGroupUsd: 812, hotelChipUsd: 525  },
      { name: 'Kyoto',      tripTotalUsd: 524,  daysGroupUsd: 524, hotelChipUsd: 1100 },
      { name: 'Osaka',      tripTotalUsd: 652,  daysGroupUsd: 652, hotelChipUsd: 1360 },
      { name: 'Amsterdam',  tripTotalUsd: 804,  daysGroupUsd: 804, hotelChipUsd: 290  },
      { name: 'Sapporo',    tripTotalUsd: 876,  daysGroupUsd: 876, hotelChipUsd: 500  },
    ];
    for (const c of cases) {
      const v = computeHeaderStripValues({
        tripTotalUsd: c.tripTotalUsd,
        daysGroupUsd: c.daysGroupUsd,
        hotelChipUsd: c.hotelChipUsd,
        flightChipUsd: 0,
      });
      const expected = c.daysGroupUsd + c.hotelChipUsd;
      expect(v.displayedTripTotalUsd, `${c.name} displayedTripTotalUsd`).toBe(expected);
      expect(v.reserveAdjustUsd, `${c.name} reserveAdjustUsd`).toBe(0);
    }
  });
});

