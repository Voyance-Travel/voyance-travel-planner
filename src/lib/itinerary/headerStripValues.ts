/**
 * Pure helper for the header-strip equation rendered by EditorialItinerary:
 *   `Days (group) + Hotel + Flight [+ Reserve & adjustments] = Trip Total`
 *
 * The three input numbers come from independent hooks:
 *   - daysGroupUsd   ← useTripDayBreakdown
 *   - hotelChipUsd   ← useTripFinancialSnapshot.effectiveHotelCents
 *   - flightChipUsd  ← useTripFinancialSnapshot.effectiveFlightCents
 *   - tripTotalUsd   ← useTripFinancialSnapshot.tripTotalCents
 *
 * Because the two hooks fetch independently, the snapshot total can transiently
 * lag behind the chip values. The previous safety net (`stripDrift`) only
 * folded when chipSum > tripTotal, which left the symmetric failure mode
 * exposed: when tripTotal == daysGroup and a hotel chip is visible the
 * displayed equation reads `X + Y = X` (the Casablanca/Kyoto/Osaka pattern).
 *
 * This helper makes the visible equation balance by construction:
 *   displayedTripTotalUsd = max(tripTotalUsd, chipSumUsd) when a logistics
 *   chip is visible; otherwise tripTotalUsd. The reserve/adjustment chip is
 *   always `displayedTripTotalUsd - daysGroup - hotel - flight`, which is
 *   ≥ 0 by construction.
 *
 * Pure & deterministic — easy to unit-test without mounting the 12K-line
 * EditorialItinerary component. See mem://constraints/finance/header-strip-mirrors-snapshot.
 */

export interface HeaderStripInputs {
  tripTotalUsd: number;
  daysGroupUsd: number;
  hotelChipUsd: number;
  flightChipUsd: number;
  /** Snapshot still mid-fetch — suppresses dev warns and the reconcile hint. */
  loading?: boolean;
  /** Hotel cost the snapshot knows about but the budget toggle is hiding. */
  excludedHotelUsd?: number;
  /** Flight cost the snapshot knows about but the budget toggle is hiding. */
  excludedFlightUsd?: number;
}

export interface HeaderStripValues {
  /** Sum of the LHS chips (days + hotel + flight). */
  chipSumUsd: number;
  /** Value rendered as the RHS "Trip Total". */
  displayedTripTotalUsd: number;
  /** Reserve & adjustments amount (always ≥ 0). */
  reserveAdjustUsd: number;
  /** Whether the reserve chip should render (>$0.50). */
  showReserve: boolean;
  /** True when the snapshot total < chip sum (snapshot is missing visible chips). */
  snapshotUnderChips: boolean;
  /** True when the snapshot total > chip sum + $1 (snapshot has unattributed cost). */
  snapshotOverChips: boolean;
  /** Echo of the excluded inputs (clamped ≥ 0) so callers can render a muted chip. */
  excludedHotelUsd: number;
  excludedFlightUsd: number;
  /** Sum of all excluded categories (≥ 0). */
  excludedTotalUsd: number;
  /** True when there is a known, non-trivial excluded amount (> $0.50). */
  hasExcludedLogistics: boolean;
}

/**
 * Compute the four numbers the header strip needs to render a balancing
 * equation regardless of which hook is currently mid-fetch.
 */
export function computeHeaderStripValues(input: HeaderStripInputs): HeaderStripValues {
  const tripTotalUsd = Number.isFinite(input.tripTotalUsd) ? input.tripTotalUsd : 0;
  const daysGroupUsd = Number.isFinite(input.daysGroupUsd) ? input.daysGroupUsd : 0;
  const hotelChipUsd = Number.isFinite(input.hotelChipUsd) ? input.hotelChipUsd : 0;
  const flightChipUsd = Number.isFinite(input.flightChipUsd) ? input.flightChipUsd : 0;

  const chipSumUsd = daysGroupUsd + hotelChipUsd + flightChipUsd;
  const hasLogisticsChip = hotelChipUsd > 0 || flightChipUsd > 0;

  // When a hotel/flight chip is visible AND the snapshot hasn't caught up,
  // surface the chip sum as the displayed total so the equation balances.
  // Symmetric to the previous one-sided `stripDrift` guard.
  const snapshotUnderChips = hasLogisticsChip && tripTotalUsd + 1 < chipSumUsd;
  const snapshotOverChips = chipSumUsd + 1 < tripTotalUsd;
  const displayedTripTotalUsd = snapshotUnderChips
    ? chipSumUsd
    : Math.max(tripTotalUsd, chipSumUsd);

  // Reserve/adjustments captures any positive remainder (Day-0 logistics that
  // aren't surfaced as their own chip, misc reserve, manual override fold).
  // Floor at 0 — the displayed total is `max(...)` so this never goes negative.
  const reserveAdjustUsd = Math.max(0, displayedTripTotalUsd - daysGroupUsd - hotelChipUsd - flightChipUsd);
  const showReserve = reserveAdjustUsd > 0.5;

  return {
    chipSumUsd,
    displayedTripTotalUsd,
    reserveAdjustUsd,
    showReserve,
    snapshotUnderChips,
    snapshotOverChips,
  };
}
