/**
 * useDisplayedTripTotal
 *
 * Single source of truth for the user-visible "Trip Total" rendered by:
 *   - EditorialItinerary header (top-line + equation row)
 *   - PaymentsTab "Trip Total" headline + "Matches itinerary" badge
 *
 * Internally composes `useTripFinancialSnapshot` + `useTripDayBreakdown` and
 * runs them through `computeHeaderStripValues` so both surfaces always render
 * the same number — including when `displayed = max(snapshot, chipSum)` clamps
 * up to keep the equation `Days + Hotel + Flight + Reserve = Trip Total`
 * balanced.
 *
 * Closes the Copenhagen $1,124 vs $1,048 gap: PaymentsTab used to read raw
 * `snapshot.tripTotalCents` while the header read `displayedTripTotalUsd`.
 *
 * See mem://constraints/finance/displayed-trip-total-single-source.
 */

import { useMemo } from 'react';
import { useTripFinancialSnapshot, type FinancialSnapshot } from './useTripFinancialSnapshot';
import { useTripDayBreakdown } from './useTripDayBreakdown';
import { computeHeaderStripValues, type HeaderStripValues } from '@/lib/itinerary/headerStripValues';

export interface DisplayedTripTotal {
  /** What the UI should render as "Trip Total" (cents). */
  displayedTotalCents: number;
  /** Raw snapshot total — useful for badge equality checks. */
  snapshotTotalCents: number;
  /** daysGroup + hotel + flight (cents). */
  chipSumCents: number;
  /** True when snapshot < chipSum (header clamped UP to chipSum). */
  snapshotUnderChips: boolean;
  /** True when snapshot > chipSum + $1 (snapshot has unattributed cost). */
  snapshotOverChips: boolean;
  /** Combined loading state of snapshot + day breakdown. */
  loading: boolean;
  /** Pass-through snapshot for callers that also need paid/reserve/etc. */
  snapshot: FinancialSnapshot;
  /** Raw header-strip values (chips, reserve, etc.) for the equation row. */
  headerStripValues: HeaderStripValues;
  /** Sum of per-day badges (cents) — same source the header equation uses. */
  daysSubtotalCents: number;
}

/**
 * @param tripId   Trip UUID.
 * @param dayNumbers Optional list of day numbers to include in the days
 *   subtotal. When omitted, sums every day > 0 in the breakdown (Day 0 is
 *   logistics — hotel/flight chips already capture it).
 */
export function useDisplayedTripTotal(
  tripId: string,
  dayNumbers?: number[],
): DisplayedTripTotal {
  const snapshot = useTripFinancialSnapshot(tripId);
  const breakdown = useTripDayBreakdown(tripId);

  const dayKey = dayNumbers ? dayNumbers.slice().sort((a, b) => a - b).join(',') : '*';

  const daysSubtotalCents = useMemo(() => {
    let sum = 0;
    if (dayNumbers && dayNumbers.length > 0) {
      for (const d of dayNumbers) {
        const b = breakdown.byDay[d];
        if (b) sum += b.totalCents;
      }
    } else {
      for (const [k, b] of Object.entries(breakdown.byDay)) {
        if (Number(k) > 0) sum += b.totalCents;
      }
    }
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown.byDay, dayKey]);

  const headerStripValues = useMemo(
    () =>
      computeHeaderStripValues({
        tripTotalUsd: snapshot.tripTotalCents / 100,
        daysGroupUsd: daysSubtotalCents / 100,
        hotelChipUsd: snapshot.effectiveHotelCents / 100,
        flightChipUsd: snapshot.effectiveFlightCents / 100,
        loading: snapshot.loading,
      }),
    [
      snapshot.tripTotalCents,
      snapshot.effectiveHotelCents,
      snapshot.effectiveFlightCents,
      snapshot.loading,
      daysSubtotalCents,
    ],
  );

  const displayedTotalCents = Math.round(headerStripValues.displayedTripTotalUsd * 100);
  const chipSumCents = Math.round(headerStripValues.chipSumUsd * 100);

  return {
    displayedTotalCents,
    snapshotTotalCents: snapshot.tripTotalCents,
    chipSumCents,
    snapshotUnderChips: headerStripValues.snapshotUnderChips,
    snapshotOverChips: headerStripValues.snapshotOverChips,
    loading: snapshot.loading || breakdown.loading,
    snapshot,
    headerStripValues,
    daysSubtotalCents,
  };
}
