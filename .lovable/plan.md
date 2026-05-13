## Problem

Header reconciliation strip on the Itinerary tab reads:

```
Days (group) $820  +  Hotel $1,780  =  Trip Total $460
```

…which obviously doesn't add up. Pre-refresh the Trip Total was $820, post-refresh it settles to $460. PaymentsTab already showed $460 before refresh because tab-switch fires a `booking-changed` event that re-runs the canonical snapshot.

## Root cause

Two distinct issues that combined produce the visible mismatch:

### 1. Strip pulls hotel/flight chip values from local state, not from the snapshot

`src/components/itinerary/EditorialItinerary.tsx` (lines 6142–6168) renders the chips like this:

```ts
const daysGroupUsd = daysSubtotalCents / 100;
const tripLevelUsd = tripLevelCents / 100;          // = snapshot total − Σ day badges
const reserveUsd = Math.max(0, tripLevelUsd - hotelCost - flightCost);
…
<Chip label="Hotel"   value={hotelCost} />          // ← from computeHotelCostUsd(...)
<Chip label="Flights" value={flightCost} />         // ← from local sum of legs
```

`hotelCost` / `flightCost` are computed locally and have **nothing to do with the snapshot total**. When `trips.budget_include_hotel = false` (or the trip has a manual-hotel override that zeros out the canonical day-0 hotel row, etc.), the snapshot correctly excludes the hotel from `tripTotalCents`, but the strip still proudly stamps `+ Hotel $1,780`. Result: `820 + 1,780 = 460`, exactly the pattern reported.

`tripLevelCents = max(0, tripTotal − daysSubtotal)` makes this worse: it can never go negative, so when `tripTotal < daysSubtotal` (which happens e.g. with manual overpayments / inactive toggles) it clamps to 0 and the equation is irrecoverable.

### 2. Snapshot does not expose the toggle / committed hotel/flight values

`useTripFinancialSnapshot` returns only `tripTotalCents` and a few aggregates. The resolver (`resolveCanonicalCostRows`) already computes `hotelCents`, `flightCents`, `canonicalDay0HotelCents`, `canonicalDay0FlightCents`, `manualHotelDelta`, `manualFlightDelta`, and the consumer reads `budget_include_hotel`/`budget_include_flight` — none of those flow out of the hook. So the strip has no way to display "what the snapshot actually counted".

(The pre-refresh $820 vs post-refresh $460 is the same root cause: `tripLevelCents` swallowed an optimistic event in one render and resync corrected it. Fixing #1 + #2 makes both states consistent and self-explanatory.)

## Fix

### A. Expose snapshot internals (single file: `src/hooks/useTripFinancialSnapshot.ts`)

Add to the returned `FinancialSnapshot`:

- `includeHotel: boolean`
- `includeFlight: boolean`
- `committedHotelCents: number`        — `canonical.canonicalDay0HotelCents` (pre-toggle, pre-manual)
- `committedFlightCents: number`       — `canonical.canonicalDay0FlightCents`
- `manualHotelDelta: number`           — from resolver
- `manualFlightDelta: number`          — from resolver
- `effectiveHotelCents: number`        — `includeHotel ? committedHotelCents + manualHotelDelta : 0` (clamped ≥0)
- `effectiveFlightCents: number`       — `includeFlight ? committedFlightCents + manualFlightDelta : 0` (clamped ≥0)

These are *what the snapshot actually folded into `tripTotalCents`* for hotel/flight. The strip becomes a deterministic decomposition of the same number.

### B. Rewrite the reconciliation strip (single file: `src/components/itinerary/EditorialItinerary.tsx`, lines ~6142–6176)

Use snapshot values, not the local `hotelCost`/`flightCost`:

```ts
const tripTotalUsd       = financialSnapshot.tripTotalCents / 100;
const daysGroupUsd       = daysSubtotalCents / 100;
const hotelChipUsd       = financialSnapshot.effectiveHotelCents / 100;
const flightChipUsd      = financialSnapshot.effectiveFlightCents / 100;
const reserveAdjustUsd   = (financialSnapshot.tripTotalCents
                          - daysSubtotalCents
                          - financialSnapshot.effectiveHotelCents
                          - financialSnapshot.effectiveFlightCents) / 100;
```

Render rules:
- `Days (group)` chip always shown.
- `Hotel` chip only when `effectiveHotelCents > 0`.
- `Flights` chip only when `effectiveFlightCents > 0`.
- `Reserve & adjustments` chip when `Math.abs(reserveAdjustUsd) > 0.5` — and **allow negative** (rendered with a `−` prefix). Negative reserve means a manual override reduced the snapshot below the day-cards subtotal (the actual story when "$820 days, $460 total"); surfacing it as `Reserve & adjustments −$360` makes the math close.
- Equation always balances: `daysGroup + hotel + flights + reserveAdjust ≡ tripTotal`. Add a dev-only `console.warn` when `Math.abs(...) > $1` so future regressions surface immediately.

Keep `tripLevelCents` calc only if used elsewhere (search shows it's only used by this strip — can be removed).

### C. Memory entry

Add a `mem://constraints/finance/header-strip-mirrors-snapshot` constraint so future edits to the strip don't reintroduce locally-computed chip values.

## Files

- `src/hooks/useTripFinancialSnapshot.ts` — add exposed fields.
- `src/components/itinerary/EditorialItinerary.tsx` — rewrite chip block (~30 lines).
- `mem://constraints/finance/header-strip-mirrors-snapshot` — new memory.
- `mem://index.md` — add Core line.

## Validation

- Trip with `budget_include_hotel=false`, large hotel selection: strip omits Hotel chip; equation balances.
- Trip with manual-hotel override that reduces snapshot total below day badges sum: strip shows `Reserve & adjustments −$X`; equation balances.
- Trip with no hotel/flight at all: only `Days (group)` + `Trip Total` shown.
- Refresh ↔ pre-refresh produce identical visible math (because both use the same snapshot fields).

## Out of scope

- The `optimisticTotalCents` event mechanism — it's working as designed; the perceived "regression" was the strip lying after settle, not the snapshot itself.
- PaymentsTab — already reads `financialSnapshot.tripTotalCents` directly; no change needed.
- Backend / activity_costs / Edge functions — no touches.
