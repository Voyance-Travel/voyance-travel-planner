## The bug

The Itinerary header reconciliation strip shows:

```
Days MAD 14,288 + Hotel MAD 5,224 = Trip Total MAD 14,288
```

The Trip Total is missing the hotel — the equation is internally inconsistent.

## Root cause

`resolveCanonicalCostRows` (`src/services/canonicalCostRows.ts:344-349`) computes the manual-payment fold for hotel/flight as:

```ts
const manualHotelDelta = canonicalDay0HotelCents > 0
  ? (manualHotelCents - canonicalDay0HotelCents)   // override branch
  : manualHotelCents;
```

The override branch fires whenever a Day-0 hotel row exists in `activity_costs`, **even when there is no manual hotel `trip_payments` row** (`manualHotelCents === 0`). In that common case:

- `totalCents` already includes the hotel row (e.g. +MAD 5,224 → 19,512)
- `manualHotelDelta = 0 − 5,224 = −5,224`
- `effectiveTotalCents = 19,512 + (−5,224) = 14,288` (hotel silently subtracted back out)

Meanwhile `effectiveHotelCents` (snapshot line 580) is computed as `committedHotelCents + manualHotelDelta = 5,224 + (−5,224) = 0`, so the Hotel chip should disappear — except `committedHotelCents` is sourced from `canonical.hotelCents` (the pre-toggle bookkeeping at canonicalCostRows.ts:257), which is the raw 5,224. So one branch sees the hotel and the other doesn't, producing the visibly wrong equation.

The bug applies symmetrically to flights.

A regression test exists for the "manual override" branch (`canonicalCostRows.test.ts:92`) but **none for the much more common "Day-0 hotel row, no manual payment" case** — which is why this slipped in.

## Fix

Treat the override branch as opt-in: only fold when a manual row actually exists. Otherwise the canonical Day-0 row already counts inside `totalCents` and the delta is zero.

```ts
const manualHotelDelta  = manualHotelCents  > 0 ? (manualHotelCents  - canonicalDay0HotelCents)  : 0;
const manualFlightDelta = manualFlightCents > 0 ? (manualFlightCents - canonicalDay0FlightCents) : 0;
```

Also tighten `useTripFinancialSnapshot` `effectiveHotelCents` / `effectiveFlightCents` (lines 580–585) so the chip mirrors the same rule — when there's no manual row, the chip equals `committedHotelCents` (already included in `tripTotalCents`), not `committed + negative_delta`.

### Steps

1. **`src/services/canonicalCostRows.ts`** — guard both `manualHotelDelta` and `manualFlightDelta` on `manual*Cents > 0`. Update the doc comment on line 74 to say "delta is 0 when no manual row exists".
2. **`src/hooks/useTripFinancialSnapshot.ts`** — no logic change needed once the resolver is fixed (the hook already uses `committedHotelCents + manualHotelDelta`, which becomes `committed + 0` correctly). Add a dev-only `[Snapshot] hotel/flight effective vs total mismatch` warn when `effectiveHotelCents > 0 && manualHotelCents === 0 && committedHotelCents > 0` and the value is not already in `tripTotalCents` (sanity belt).
3. **`src/services/__tests__/canonicalCostRows.test.ts`** — add the missing regression test:
   - "Day-0 hotel row + NO manual hotel payment → delta=0, effectiveTotalCents includes hotel" (the bug case).
   - Same for flight.
   - Existing "manual hotel OVERRIDES" test stays green.
4. **Memory** — extend `mem://constraints/finance/header-strip-mirrors-snapshot` with: "manual*Delta MUST be 0 when no manual row exists, even if a canonical Day-0 row is present. Override math only fires when manual* > 0."

### Verification

- Unit tests pass (existing override + new no-manual case).
- Header strip on a trip with a Day-0 hotel row but no manual hotel payment: `Days + Hotel = Trip Total` balances exactly, Reserve chip stays hidden.
- Header strip on a trip with a manual hotel payment overriding canonical: behavior unchanged (existing test still green).
- No DB migration required.

### Out of scope

- The `archive_orphan_trip_payments` / manual-row immunity work shipped earlier today is unrelated and stays.
- Payments tab totals already use `effectiveTotalCents`, so they self-correct with the resolver fix.
