# Pricing 3A — No silent hotel/flight exclusion from Trip Total

## Goal
When the user has flipped off "Include hotel in budget" (or flight), the itinerary header and Payments tab must make it visually obvious that a known cost is being held outside the Trip Total. Today it disappears silently: Travel Essentials reads "Free", the header chip vanishes, and Trip Total drops to activities only — while Payments still shows the full $900 hotel line. We keep the toggle (per your choice) but eliminate the silent path.

## Scope
Read-only behavior change — the underlying math stays as it is. No DB migration. No change to `useTripFinancialSnapshot`, `resolveCanonicalCostRows`, or the budget-visibility toggle semantics. Pure presentation in three surfaces.

## Changes

### 1. `src/components/itinerary/EditorialItinerary.tsx` — header strip
- Right after the existing `Days + Hotel + Flight + Reserve = Trip Total` row, render a single muted note when `headerStripValues.hasExcludedLogistics` is true, e.g.:
  - `Hotel $900 + Flights $1,240 excluded from Trip Total — toggle on in Budget Visibility to include`
  - Pluralize/singularize based on which of `excludedHotelUsd` / `excludedFlightUsd` are > 0.
  - Use `formatCurrency(displayCost(...), tripCurrency)` so it follows the USD/local toggle and the per-traveler convention already used by the chips.
- Pure render addition; `headerStripValues` already carries `excludedHotelUsd`, `excludedFlightUsd`, `excludedTotalUsd`, `hasExcludedLogistics` (no new hook plumbing needed).

### 2. `src/components/itinerary/PaymentsTab.tsx` — Travel Essentials row
- Replace the silent "$0 / Free" essentials headline when the toggle excludes hotel/flight but `essentialItems` (which is sourced from `usePayableItems`, toggle-agnostic) still has rows.
- Show the real essentials amount (sum of `essentialItems.amountCents`) when `financialSnapshot.buckets.essentials` is 0 due to the toggle. Render a small badge next to the amount:
  - `Excluded from Trip Total` (amber `bg-amber-500/15 text-amber-700`) when the toggle is off.
  - Tooltip on the badge: "Hotel and/or flight are hidden from your Trip Total because Budget Visibility is set to exclude them. Toggle them on to include."
- Important: do NOT change `estimatedTotal` / `paidAmount` / overpaid logic — those already read from `displayedTotal` and `financialSnapshot.paidCents`. We only adjust the Essentials card's headline + badge.

### 3. `src/lib/itinerary/headerStripValues.ts` — helper
- Already exposes `hasExcludedLogistics`. Add a small derivation `excludedBreakdownLabel(values, formatter)` that returns the human string (`"Hotel $900"`, `"Flights $1,240"`, or `"Hotel $900 + Flights $1,240"`) so both surfaces stay in sync. Pure function; no React.

### 4. Tests (`src/lib/itinerary/__tests__/headerStripValues.test.ts`)
- New cases:
  - Hotel-only excluded → `hasExcludedLogistics = true`, label `"Hotel $900"`.
  - Flight-only excluded → label `"Flights $1,240"`.
  - Both → label `"Hotel $900 + Flights $1,240"`.
  - Neither excluded → `hasExcludedLogistics = false`, label `""`.

## Out of scope (deliberate)
- The toggle itself (`budget_include_hotel` / `budget_include_flight`) and where users flip it — unchanged.
- `tripTotalCents` math — unchanged. The displayed Trip Total still equals what the toggle implies.
- Payments line items list — unchanged.
- Memory updates — no new constraint; this is a presentation fix layered on existing `excludedHotelCents` / `excludedFlightCents` snapshot fields that were already plumbed for exactly this case.

## Files touched
- `src/lib/itinerary/headerStripValues.ts` (add `excludedBreakdownLabel`)
- `src/lib/itinerary/__tests__/headerStripValues.test.ts` (4 new cases)
- `src/components/itinerary/EditorialItinerary.tsx` (header strip note, ~10 lines near line 6470)
- `src/components/itinerary/PaymentsTab.tsx` (Travel Essentials headline + badge, ~15 lines near line 1438)

## Verification
1. Trip with hotel `$900`, flight `$0`, toggle off → header reads `Days + Reserve = Trip Total $240` and below it `Hotel $900 excluded from Trip Total — toggle on …`; Payments Essentials row shows `$900` + amber `Excluded from Trip Total` badge.
2. Toggle on → note + badge disappear; chip reappears; Trip Total includes hotel as before.
3. Both hotel & flight excluded → combined label renders.
4. No regression to the "Matches itinerary" badge or reconcile hint (they read from `displayedTotal`, which we don't touch).
