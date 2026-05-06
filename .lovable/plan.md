# Lock down Flights & Hotels tab vs Payments consistency

## Problem

The Flights & Hotels tab (the `details` tab in `EditorialItinerary.tsx` at line 6801, label `"Flights & Hotels"`) renders three things that have to stay in sync with the Payments tab:

1. **Flight legs total** — `flightCost` in `EditorialItinerary` (sums `leg.price`) vs the `Round-trip Flight` row that `usePayableItems` builds from `flightSelection`.
2. **Single-hotel total** — `hotelCost` (lines 3381–3400) using `totalPrice ?? pricePerNight × nights` vs the `hotel-selection` row in `usePayableItems` (lines 254–271).
3. **Multi-city hotels** — `allHotels.reduce(...)` in EditorialItinerary vs `syncMultiCityHotelsToLedger` (writes one `activity_costs` hotel row aggregated across cities).

Two real failure modes have already happened (and have inline-comment guards but no test):

- "Hotel Accommodation $2,850" auto-estimate appearing alongside a manual "Four Seasons $2,400" — guard added in `syncHotelToLedger` (lines 187–197): if any `manual-` hotel payment exists, remove the canonical row instead of upserting. **No regression test.**
- A selected hotel without an explicit price triggering a reference-table estimate that surprised users and double-billed — guard added (lines 207–214). **No regression test.**

If either guard regresses, the Flights & Hotels tab will silently disagree with the Payments tab again.

## Plan

### 1. Extract `computeHotelCost(allHotels, hotelSelection, daysCount)` into a small utility

Today the hotel-cost math in `EditorialItinerary.tsx` (lines 3381–3400) is duplicated in three places: that file, `usePayableItems` (line 258), and `syncHotelToLedger` (lines 199–214). Extract a single pure function:

```ts
// src/lib/hotel-cost.ts
export function computeHotelCostUsd(
  allHotels: Array<{ hotel?: { totalPrice?: number; pricePerNight?: number }; checkInDate?: string; checkOutDate?: string }> | null | undefined,
  hotelSelection: { totalPrice?: number; pricePerNight?: number; nights?: number } | null | undefined,
  daysCount: number,
): number;
```

Wire all three callers to use it. No behavior change.

### 2. Unit tests for `computeHotelCostUsd`

`src/lib/__tests__/hotel-cost.test.ts`:

- multi-city: sum of `totalPrice` per hotel
- multi-city: `pricePerNight × nights` when `totalPrice` missing, with the existing 1-night floor
- single hotel `totalPrice` wins over `pricePerNight × nights`
- single hotel falls back to `pricePerNight × (nights ?? days-1)`
- empty/null returns `0`

### 3. Regression tests for the manual-override guard

The double-billing fix (lines 187–197 of `syncHotelToLedger`) is the highest-leverage thing to lock down. Pure-function test isn't possible because it queries supabase, so:

`src/services/__tests__/budgetLedgerSync.test.ts`:

- mock `supabase.from('trip_payments')` to return one `manual-` hotel row → assert `removeLogisticsCost` is called and `upsertLogisticsCost` is **not** called, even when `hotel.totalPrice = 2850`
- mock no manual rows + `hotel.totalPrice = 2400` → assert `upsertLogisticsCost(tripId, 'hotel', 2400, ...)`
- mock no manual rows + only `pricePerNight = 600` and 4 nights via checkIn/checkOut → asserts $2,400 via the nights × rate path
- mock no manual rows + no price at all → asserts `removeLogisticsCost` (the "no auto-estimate" guard)

### 4. `usePayableItems` hotel/flight reconciliation tests

`src/hooks/__tests__/usePayableItems.test.ts` — render the hook via `renderHook` with three scenarios:

- **Selection-only**: `hotelSelection.totalPrice = 2400`, no payments → emits one `hotel-selection` row at 240000 cents.
- **Manual override**: one `payments` row with `item_type='hotel'`, `item_id='manual-...'` → canonical `hotel-selection` row is suppressed (the `hasManualHotel` branch). This is the "phantom $2,850" prevention case.
- **Inclusion toggles**: `includeHotel = false` → hotel row dropped from the result; `includeFlight = false` (default) keeps flights surfaced because the flight branch isn't gated by `includeFlight` in the hook (verify or fix; today the `activityCosts` filter respects both flags but the selection branch only honors `hasManualFlight`).

Same for flight: the third test acts as a real audit — if `includeFlight=false` should hide the canonical flight row but doesn't, we surface it as a finding rather than fix in this loop.

### 5. Document the agreement

Add a short comment block at the top of `EditorialItinerary.tsx`'s `details` tab section ("Flights & Hotels tab — invariants") listing the three sources of truth that must agree (selection-derived UI, `activity_costs` ledger, `usePayableItems`). Cheaper than another doc; lives where the code does.

## Out of scope

- Changing the actual UI of the tab. We're locking down data agreement, not redesigning.
- Reworking `useTripFinancialSnapshot` — already canonical.
- Adding e2e tests; vitest unit/hook tests cover the regression risk surfaced by the user.

## Files

- `src/lib/hotel-cost.ts` (new)
- `src/lib/__tests__/hotel-cost.test.ts` (new)
- `src/services/__tests__/budgetLedgerSync.test.ts` (new)
- `src/hooks/__tests__/usePayableItems.test.ts` (new)
- `src/components/itinerary/EditorialItinerary.tsx` (use `computeHotelCostUsd`, add invariants comment)
- `src/hooks/usePayableItems.ts` (use `computeHotelCostUsd` for the selection branch)
- `src/services/budgetLedgerSync.ts` (use `computeHotelCostUsd` after the manual guard)
