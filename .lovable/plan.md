

## Fix: Hotel Change Detection Skipped for Single-City Split-Stay

### Problem
On hotel change days in a single-city trip, no checkout card for Hotel A and no check-in card for Hotel B are injected. The itinerary just continues as if the same hotel applies all trip.

### Root Cause
In `action-generate-day.ts` line 831, the hotel resolution block (which also handles hotel-change detection) is gated by:

```typescript
if (tripId && (!resolvedRepairHotelName || resolvedRepairHotelName === 'Hotel' || resolvedIsMultiCity))
```

For single-city split-stay trips:
- `resolvedRepairHotelName` is already set from `flightContext.hotelName` or `paramHotelName` (truthy, not 'Hotel')
- `resolvedIsMultiCity` is `false`

So the entire block is **skipped**, meaning:
- `resolvedIsHotelChange` stays `false`
- `resolvedPreviousHotelName` stays `undefined`
- The repair pipeline (steps 7/8) never injects checkout/check-in cards

### Fix

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**

1. **Always run hotel-change detection**: Change the guard so the block always executes when `tripId` exists and `trip_cities` data is available. The existing hotel name can still be overridden by the date-aware resolver when it finds a better match. At minimum, hotel-change detection must always run.

   Change line 831 from:
   ```typescript
   if (tripId && (!resolvedRepairHotelName || resolvedRepairHotelName === 'Hotel' || resolvedIsMultiCity)) {
   ```
   to:
   ```typescript
   if (tripId) {
   ```

   Then inside the block, only override `resolvedRepairHotelName` when the resolved hotel is more specific (the existing conditional on lines 885-887 already handles this).

2. **Hotel change detection remains unchanged** — the comparison logic at lines 892-906 is correct, it just never gets to run today for single-city trips with a pre-resolved hotel name.

### Expected Behavior
- On hotel-change days: Checkout from Hotel A (morning) + Check-in at Hotel B (afternoon) always appear
- Non-hotel-change days: no change in behavior
- Multi-city trips: no change (already worked because `resolvedIsMultiCity` was true)

### Files Changed
- `supabase/functions/generate-itinerary/action-generate-day.ts` — relax guard to always run hotel-change detection

