

## Fix Hotel Pricing Mismatch Between Budget & Payments

### Root Cause

Two different calculation paths produce different hotel prices:

**Budget tab** → `useTripFinancialSnapshot` → reads `activity_costs` table → hotel row written by `syncHotelToLedger` which correctly computes `totalPrice` or `pricePerNight × nights` (from check-in/check-out dates).

**Payments tab** → `usePayableItems` → reads `hotelSelection` JSON directly → line 130:
```js
const hotelPrice = hotelSelection.totalPrice || (hotelSelection.pricePerNight || 0) * days.length;
```

**Problem**: `days.length` is the number of **days** (e.g. 7), but hotels charge per **night** (e.g. 6). When `totalPrice` is missing and only `pricePerNight` exists, the Payments tab overcharges by one night.

Additionally, `syncHotelToLedger` calls `upsertLogisticsCost` with `numTravelers=1` (default), which stores the full hotel cost as `cost_per_person_usd`. The snapshot then multiplies `cost_per_person_usd × num_travelers` — this works correctly only because both default to 1. But if `numTravelers` were ever passed differently, it would break.

### Fix

**File: `src/hooks/usePayableItems.ts` — line 130**

Change the fallback from `days.length` to `Math.max(1, days.length - 1)` to match the standard nights calculation used everywhere else:

```js
// Before
const hotelPrice = hotelSelection.totalPrice || (hotelSelection.pricePerNight || 0) * days.length;

// After
const nights = Math.max(1, days.length - 1);
const hotelPrice = hotelSelection.totalPrice || (hotelSelection.pricePerNight || 0) * nights;
```

This is a one-line fix in one file that aligns the Payments tab with the Budget tab and the DB ledger.

### Files changed

| File | Change |
|------|--------|
| `src/hooks/usePayableItems.ts` | Fix hotel nights calculation: `days.length` → `Math.max(1, days.length - 1)` |

