

# Fix: Hotel price not persisting to budget/payments

## Problem
When a hotel is selected in the planner (step 1), the price never reaches the `activity_costs` table — so it doesn't appear in the Budget or Payments tabs.

## Root Causes

There are **two gaps** in the hotel price sync pipeline:

### Gap 1: Planner never syncs to budget ledger
`PlannerHotelEnhanced.tsx` saves the hotel to `trips.hotel_selection` via `saveTrip()`, but **never calls `syncHotelToLedger()`**. The flight/hotel budget sync only happens later in `EditorialItinerary` or via `useSaveHotelSelection` — but the planner flow uses neither.

### Gap 2: `syncHotelToLedger` can't calculate the price from the data it receives
Even when `EditorialItinerary` does call `syncHotelToLedger` on load, it fails silently because:
- The hotel object has **no `totalPrice`** field (only `pricePerNight`)
- The fallback calculation needs `checkIn` and `checkOut` as **dates** (YYYY-MM-DD), but the planner sets them to **times** (`"15:00"`, `"11:00"`)
- After normalization in `TripDetail`, the dates move to `checkInDate`/`checkOutDate` — but `syncHotelToLedger` looks for `checkIn`/`checkOut`

So the price is always `0`, and the function calls `removeLogisticsCost` instead of upserting.

## Fix Plan

### 1. Fix `syncHotelToLedger` to handle all field name variants
**File: `src/services/budgetLedgerSync.ts`**

Update the fallback price calculation to also check `checkInDate`/`checkOutDate` (the normalized field names), and accept `nights` as a direct field:

```typescript
// Check both legacy and normalized field names
let totalUsd = hotel.totalPrice || 0;

if (!totalUsd && hotel.pricePerNight) {
  const checkIn = hotel.checkIn || (hotel as any).checkInDate;
  const checkOut = hotel.checkOut || (hotel as any).checkOutDate;
  const nights = (hotel as any).nights 
    || (checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0);
  if (nights > 0) {
    totalUsd = hotel.pricePerNight * nights;
  }
}
```

### 2. Add `syncHotelToLedger` call in `PlannerHotelEnhanced`
**File: `src/pages/planner/PlannerHotelEnhanced.tsx`**

After saving the trip in the single-city path (~line 539), call `syncHotelToLedger` with the correct dates:

```typescript
const tripId = await saveTrip();
if (tripId) {
  // Sync hotel price to budget ledger
  const syncData = {
    ...hotelSelection,
    checkIn: startDate,  // trip start date (YYYY-MM-DD)
    checkOut: endDate,    // trip end date (YYYY-MM-DD)
    totalPrice: (room?.pricePerNight || hotel.pricePerNight) * nights,
  };
  syncHotelToLedger(tripId, syncData as any)
    .catch(err => console.warn('[PlannerHotel] Budget sync failed:', err));
}
```

### 3. Also add sync for the multi-city path
In the multi-city branch (~line 526), call `syncHotelToLedger` after saving to `trip_cities`.

### Files Changed

| File | Change |
|------|--------|
| `src/services/budgetLedgerSync.ts` | Handle `checkInDate`/`checkOutDate` and `nights` field variants |
| `src/pages/planner/PlannerHotelEnhanced.tsx` | Call `syncHotelToLedger` after hotel selection save |

