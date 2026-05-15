## Root cause

The Trip Total architecture is intact — `useDisplayedTripTotal` is the single source for both surfaces, and the canonical sum in `activity_costs` exactly matches what Payments displays ($1,446 for Barcelona `4197c39d…`).

The reported "mismatch" is actually a **currency-display divergence + a stuck Reconciling badge**:

- **Header** renders Trip Total in `tripCurrency` (EUR for Barcelona/Dublin/Paris) via `displayCost(displayedTripTotalUsd)` → applies FX.
- **PaymentsTab "Trip Total"** renders raw `estimatedTotal` cents through `formatCurrency`, which is **always USD**.
- The "Matches itinerary" badge in `PaymentsTab` (line ~1240) compares the two as if both were USD cents — they are, but the user-visible numbers below them are in different currencies, so the user sees a "mismatch" and the panel is functionally lying. Worse, when the snapshot/chip clamp asymmetry triggers `snapshotUnderChips` or `snapshotOverChips`, the badge falls into bounded "Reconciling…" and never resolves because the underlying state is stable, not transient.

The three "bugs" reported across cities collapse to:

1. Header EUR vs Payments USD (perceived mismatch).
2. User's manual bucket arithmetic omitted the Transit and Reserve rows that Payments correctly includes.
3. "Reconciling…" latches when the equality check runs against pre-FX cents while the user reads post-FX header chrome.

## Fix scope (UI only)

### 1. PaymentsTab "Trip Total" must render in `tripCurrency` like the header
File: `src/components/itinerary/PaymentsTab.tsx`

- Pull `tripCurrency` from the same source the header uses (already available via the trip record / `useTripCurrency` hook used in `EditorialItinerary.tsx`).
- Replace the `formatCurrency(estimatedTotal)` headline (line ~1229) and Paid/Unpaid/Overpaid lines (1288, 1302, 1335, 1745, 1781) with `formatCurrency(displayCost(estimatedTotal/100), tripCurrency)` so Payments and header speak the same units.
- Also convert the per-bucket totals so the breakdown numbers match what's in the cards.

### 2. "Matches itinerary" / "Reconciling…" badge must use the same units as what the user sees
- Compare `displayedTotal.displayedTotalCents` vs `estimatedTotal` AFTER converting both through the same `displayCost` lens (or assert in raw USD cents but then never render mixed units above the badge).
- Add a hard cap: if `useReconcilingState` is still un-resolved after 8s of stable inputs, dismiss the badge entirely and emit a `[PaymentsTab] reconcile-timeout` warn instead of leaving "Reconciling…" forever.

### 3. Currency-source guard
- Add a one-liner dev assertion: when `tripCurrency !== 'USD'` and the header strip's `displayedTripTotalUsd` differs from `displayedTotal.displayedTotalCents/100` by more than $1, log `[Trip Total] FX-render drift` so future regressions surface in console.

### 4. Optional — surface category total inline next to bucket header
Tiny UX win: render `($1,446 of $1,446)` next to the breakdown title so users can self-verify the categories sum. Avoids the Bali/Barcelona "I added wrong" confusion.

## Out of scope

- No backend / `useTripFinancialSnapshot` / `resolveCanonicalCostRows` changes — the canonical data is correct.
- No edits to `useDisplayedTripTotal` or `computeHeaderStripValues` — they already produce a single number; only the rendering currency differs between surfaces.

## Verification

1. Open Barcelona `4197c39d-e069-40ad-9bde-78f8edaa2a68`. Header = `€1,244`, Payments Trip Total now also = `€1,244` (same FX). Badge shows "Matches itinerary" within 1s.
2. Bali (USD trip) — both render `$1,678`. Badge stable green.
3. Dublin (EUR) — both render `€1,340`. No "Reconciling…" latch.
4. Console: zero `[PaymentsTab] divergence` and zero `[Trip Total] FX-render drift`.
5. After 8s, no trip leaves a "Reconciling…" badge on screen even if upstream `useReconcilingState` thinks it's still pending.

## Memory note (post-ship)

Add to `mem://constraints/finance/displayed-trip-total-single-source`: "PaymentsTab `Trip Total` headline + bucket subtotals + Matches/Reconciling badge MUST render in `tripCurrency` (same `displayCost` lens as the header). Comparing pre-FX USD cents above a post-FX EUR header is the recurring 'totals don't match' regression vector."