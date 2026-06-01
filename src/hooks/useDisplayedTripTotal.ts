/**
 * useDisplayedTripTotal
 *
 * Single source of truth for the user-visible "Trip Total" rendered by:
 *   - EditorialItinerary header (top-line + equation row + Reconciling hint)
 *   - PaymentsTab "Trip Total" headline + "Matches itinerary" badge
 *   - BudgetTab `tripTotalCents` + BudgetCoach `currentTotalCents` prop
 *
 * The hook composes `useTripFinancialSnapshot` + `useTripDayBreakdown` and
 * routes them through `computeHeaderStripValues` so every surface renders
 * the same number — including when `displayed = max(snapshot, chipSum)`
 * clamps up to keep the equation
 * `Days + Hotel + Flight + Reserve = Trip Total` balanced.
 *
 * For consumers that already hold a snapshot+breakdown pair (e.g. the
 * EditorialItinerary header, which uses the breakdown for per-day panels too)
 * use `composeDisplayedTripTotal` directly to avoid duplicate fetches —
 * parity is preserved because both code paths run the same composer.
 *
 * See mem://constraints/finance/displayed-trip-total-single-source.
 */

import { useMemo } from 'react';
import { useTripFinancialSnapshot, type FinancialSnapshot } from './useTripFinancialSnapshot';
import { useTripDayBreakdown, type TripDayBreakdown } from './useTripDayBreakdown';
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
 * Pure composer — given already-fetched snapshot + breakdown, returns the
 * displayed-total payload. Use this when the calling component already
 * subscribes to both hooks and you want parity WITHOUT double-fetching.
 *
 * @param dayNumbers Optional list of day numbers to include in the days
 *   subtotal. When omitted, sums every day > 0 in the breakdown (Day 0 is
 *   logistics — hotel/flight chips already capture it).
 */
export function composeDisplayedTripTotal(
  snapshot: FinancialSnapshot,
  breakdown: TripDayBreakdown,
  dayNumbers?: number[],
): DisplayedTripTotal {
  let daysSubtotalCents = 0;
  if (dayNumbers && dayNumbers.length > 0) {
    for (const d of dayNumbers) {
      // Day 0 is logistics (hotel/flight/transfers) — already represented in
      // the displayed total via `effectiveHotelCents` + `effectiveFlightCents`
      // chips. Including it here would double-count and silently inflate
      // `displayedTripTotal = max(snapshot, daysGroup + hotel + flight)`
      // above the snapshot, causing header vs PaymentsTab drift.
      if (d <= 0) continue;
      const b = breakdown.byDay[d];
      if (b) daysSubtotalCents += b.totalCents;
    }
  } else {
    for (const [k, b] of Object.entries(breakdown.byDay)) {
      if (Number(k) > 0) daysSubtotalCents += b.totalCents;
    }
  }

  const headerStripValues = computeHeaderStripValues({
    tripTotalUsd: snapshot.tripTotalCents / 100,
    daysGroupUsd: daysSubtotalCents / 100,
    hotelChipUsd: snapshot.effectiveHotelCents / 100,
    flightChipUsd: snapshot.effectiveFlightCents / 100,
    excludedHotelUsd: snapshot.excludedHotelCents / 100,
    excludedFlightUsd: snapshot.excludedFlightCents / 100,
    loading: snapshot.loading,
  });

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

/**
 * @param tripId   Trip UUID.
 * @param dayNumbers Optional list of day numbers to include in the days
 *   subtotal. When omitted, sums every day > 0 in the breakdown.
 */
export function useDisplayedTripTotal(
  tripId: string,
  dayNumbers?: number[],
): DisplayedTripTotal {
  const snapshot = useTripFinancialSnapshot(tripId);
  const breakdown = useTripDayBreakdown(tripId);

  const dayKey = dayNumbers ? dayNumbers.slice().sort((a, b) => a - b).join(',') : '*';

  return useMemo(
    () => composeDisplayedTripTotal(snapshot, breakdown, dayNumbers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      snapshot.tripTotalCents,
      snapshot.effectiveHotelCents,
      snapshot.effectiveFlightCents,
      snapshot.excludedHotelCents,
      snapshot.excludedFlightCents,
      snapshot.loading,
      breakdown.byDay,
      breakdown.loading,
      dayKey,
    ],
  );
}
