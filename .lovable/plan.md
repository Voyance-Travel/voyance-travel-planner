

## Why Checkout Is Missing — Root Cause Analysis

There are **two gaps** causing missing hotel checkout activities:

### Gap 1: No Post-Generation Checkout Guarantee (Backend)

The `generate-day` handler has a **check-in guarantee** (line 9253-9340) that deterministically injects a check-in activity if the AI omits one. There is **no equivalent checkout guarantee**. 

For the trip's last day (`isLastDay`), the AI prompt is very detailed about checkout sequencing (lines 7387-7734). For multi-city intermediate cities (`paramIsLastDayInCity && !isLastDay`), checkout is only a soft prompt instruction at line 7750. If the AI ignores it, checkout silently disappears.

### Gap 2: Client-Side Stripping Without Reliable Re-Injection

`injectHotelActivitiesIntoDays` calls `stripExistingHotelActivities` which **removes ALL accommodation activities** with "check-out"/"checkout" in the title — including AI-generated ones with proper flight-aware timing. It then tries to re-inject a generic 30-min checkout at 11:00 AM, but:
- Only re-injects if `checkOutDayIdx !== checkInDayIdx` — fails for single-day trips
- For multi-city, hotel data from `trip_cities.hotel_selection` often lacks `checkOutDate`, causing `findDayIndex` to fall back to the trip's **last day** instead of the city's last day

### Fix Plan

**File:** `supabase/functions/generate-itinerary/index.ts`

**Add a checkout guarantee** after the existing check-in guarantee (~line 9340). When `isLastDay` OR `paramIsLastDayInCity`, verify the generated day contains a checkout activity. If missing, deterministically inject one:

```text
Location: After the check-in guarantee block (line ~9340)

Logic:
1. needsCheckoutGuarantee = isLastDay || (paramIsLastDayInCity && !resolvedIsTransitionDay)
2. Check if any activity has category='accommodation' AND title contains 'checkout'/'check-out'/'check out'
3. If missing, inject a "Hotel Checkout" activity:
   - For isLastDay with flight data: 2 hours before leaveHotelBy time
   - For isLastDay without flight: 11:00 AM default
   - For paramIsLastDayInCity (intermediate city): 11:00 AM
   - Duration: 15-30 min
   - Hotel name from paramHotelOverride or flightContext
```

**File:** `src/utils/injectHotelActivities.ts`

**Fix the strip-then-re-inject logic** to not strip checkout on the last day if no reliable re-injection will happen:

1. In `stripExistingHotelActivities`: preserve checkout activities on the last day if they were AI-generated (not deterministic IDs)
2. In `injectHotelActivitiesIntoDays`: handle single-day trips by injecting checkout even when `checkOutDayIdx === checkInDayIdx`
3. In `injectMultiHotelActivities`: use city departure dates from `trip_cities` to place checkout on the correct day rather than falling back to the trip's last day

