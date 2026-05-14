## Goal

Make the Payments tab "Trip Total" and the itinerary header "Trip Total" mathematically identical at all times, and turn the "Matches itinerary" badge into a verified equality check (not a cosmetic ribbon).

## Root Causes

Two independent bugs combine into the symptoms reported.

**Bug 1 — Header silently clamps up; Payments doesn't (the $76 Copenhagen gap).**
`src/lib/itinerary/headerStripValues.ts` computes:

```text
displayedTripTotalUsd = max(snapshot.tripTotalCents, daysGroup + hotelChip + flightChip)
```

The itinerary header renders `headerStripValues.displayedTripTotalUsd` (EditorialItinerary.tsx L6131). PaymentsTab renders `financialSnapshot.tripTotalCents` raw (PaymentsTab.tsx L1184). Whenever the per-day breakdown sum exceeds the canonical snapshot — a common transient when `useTripDayBreakdown` and `useTripFinancialSnapshot` finish at different times, or when a Day-N row is double-counted vs the resolver — the header inflates and Payments does not. Copenhagen $1,124 vs $1,048 = exactly that 76¢-on-the-chip-side delta.

**Bug 2 — Snapshot doesn't refetch on itinerary persist (the Dublin "$998 stale" read).**
Every successful itinerary persist dispatches `TRIP_PERSISTED_EVENT` (Core memory: "DB Is Source of Truth"). `useTripFinancialSnapshot` only listens for `booking-changed`. After a regenerate / regression-block / reload self-heal lands on the database, `EditorialItinerary` re-reads `trips.itinerary_data` and re-renders, but the snapshot powering Payments never refetches, so Payments keeps showing the previous session's number.

**Badge is non-diagnostic.**
`{!financialSnapshot.loading && financialSnapshot.tripTotalCents > 0 && "Matches itinerary"}` (PaymentsTab.tsx L1186-L1191) only checks "snapshot loaded with a positive value" — it never compares Payments' displayed total to the header's displayed total. So the badge fires even when the two diverge.

## Fix

### 1. One displayed-total resolver, two consumers

Promote `computeHeaderStripValues` into the canonical "what the user sees as Trip Total" math, then have both surfaces read it:

- Add a thin hook `useDisplayedTripTotal(tripId)` in `src/hooks/` that internally uses `useTripFinancialSnapshot` + `useTripDayBreakdown` and returns `{ displayedTotalCents, snapshotTotalCents, chipSumCents, snapshotUnderChips, snapshotOverChips, loading }`.
- `EditorialItinerary.tsx` keeps consuming `headerStripValues.displayedTripTotalUsd` (no behavioral change) but routes through the new hook so the value is computed once.
- `PaymentsTab.tsx` `baseTotal` switches from `financialSnapshot.tripTotalCents` to `displayedTotalCents`. This closes the $76 gap for Copenhagen by definition: same number, same rounding, same source.

### 2. Snapshot listens to `TRIP_PERSISTED_EVENT`

In `useTripFinancialSnapshot.ts`, add a second `window.addEventListener(TRIP_PERSISTED_EVENT, handler)` next to the existing `booking-changed` handler (L642). Reuse the same coalesced refetch path (leading + trailing 600 ms) and the silent-suppress flag so the auto-refetch doesn't spawn a phantom delta toast.

This closes the Dublin stale read: after the regression-block heal lands and `safeUpdateItineraryData` fires `TRIP_PERSISTED_EVENT`, every mounted snapshot — Payments, Budget, header — refetches in lock-step.

### 3. Make the "Matches itinerary" badge mean something

Replace the current condition with an actual equality check inside PaymentsTab (L1186-L1191):

```text
const headerMatches =
  !displayedLoading
  && Math.abs(estimatedTotal - displayedTotalCents) <= 100   // ≤ $1
  && !snapshotUnderChips                                      // header had to clamp up
  && !snapshotOverChips;                                      // unattributed snapshot cost

if (headerMatches) → green check + "Matches itinerary"
else if (snapshotUnderChips || snapshotOverChips) → amber dot + "Reconciling…"
else → render nothing (no green badge during loading or transient drift)
```

The same drift telemetry already in PaymentsTab (`[PaymentsTab] divergence`, L509) stays as the developer signal — this change is user-facing only.

### 4. Suppress the post-snapshot-event delta toast

The new `TRIP_PERSISTED_EVENT` listener must mark `suppressNextToastRef = { active: true, reason: 'trip-persisted' }` before refetch — a snapshot diff caused by the persist isn't an actionable user-driven price change.

## Acceptance

- Open Copenhagen trip — Payments "Trip Total" === itinerary header "Trip Total" to the cent. Same after toggling Hotel/Flight.
- Open Dublin trip, force a regenerate or regression-block, then read both surfaces without a hard refresh — both update in the same render frame; Payments never strands the prior value.
- "Matches itinerary" badge only appears when the two displayed numbers actually match within $1 AND no clamping happened. During reconciliation it shows an amber "Reconciling…" hint instead of a misleading green checkmark.
- Existing `[PaymentsTab] divergence` and `[useTripFinancialSnapshot] …` console signals continue to fire on real upstream contract bugs.

## Out of scope

- Fixing why `useTripDayBreakdown` ever sums higher than the canonical resolver (separate Day-N hotel double-count bug — telemetry stays as `snapshotUnderChips`).
- Hero image, health engine, regression guard work shipped earlier in the loop.
- Touching the resolver math in `resolveCanonicalCostRows` — both surfaces will simply agree on whatever it produces.

## Files

- `src/hooks/useDisplayedTripTotal.ts` (new, ~40 lines)
- `src/hooks/useTripFinancialSnapshot.ts` (add `TRIP_PERSISTED_EVENT` listener)
- `src/components/itinerary/PaymentsTab.tsx` (swap `baseTotal` source, rewrite badge)
- `src/components/itinerary/EditorialItinerary.tsx` (route header through new hook)
- `mem://constraints/finance/displayed-trip-total-single-source` (new memory entry)
- `mem://index.md` (reference)
