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
  });
});
