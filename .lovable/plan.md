

# Fix: Trip Total Price Not Updating After Regeneration

## Problem

After regenerating an itinerary, the "Trip Total" price stays at the old value. The UI never reflects the new costs from the regenerated activities.

## Root Cause

The total price display uses a two-tier system:

```text
canonicalTripTotal (from activity_costs DB table)
        |
        v
  Is it non-null?
   /          \
 YES           NO
  |             |
Use DB total  Use JS-calculated total
+ flight      (sum of day costs + flight + hotel)
+ hotel
```

**The problem**: `generate-day` (used during regeneration) does NOT write to the `activity_costs` table. Only the old `generate-full` action (initial generation) writes those rows. So after regeneration:

- `activity_costs` still has OLD cost rows
- `canonicalTripTotal` reads old data from `v_trip_total` view
- Since it's non-null, it overrides the correct JS-calculated total
- The UI shows the stale price

## Solution (two parts)

### Part 1: Reset canonical total during regeneration (frontend)

In `EditorialItinerary.tsx`, after regeneration completes:
- Set `canonicalTripTotal` to `null` so the JS-calculated total takes over immediately
- Then trigger an async rebuild of `activity_costs` via the existing `repair-trip-costs` action
- When the rebuild finishes, re-fetch the canonical total

### Part 2: Rebuild activity_costs after regeneration (frontend call)

After `syncBudgetFromDays` and query invalidation, call the `repair-trip-costs` edge function action to rebuild `activity_costs` rows from the new itinerary data. Once complete, re-fetch the canonical total so the DB stays in sync for future page loads.

## Changes

### `src/components/itinerary/EditorialItinerary.tsx`

At the regeneration completion block (around line 2726-2733):

1. Add `setCanonicalTripTotal(null)` immediately -- this lets the JS total show the correct value right away
2. After the existing budget sync and invalidation, fire off an async call to rebuild `activity_costs`:
   - Call the `generate-itinerary` edge function with `action: 'repair-trip-costs'`
   - On success, re-fetch `getTripTotal` and update `canonicalTripTotal`
   - This is fire-and-forget so it doesn't block the user

### No backend changes needed

The `repair-trip-costs` action already exists and rebuilds `activity_costs` from the current itinerary data. We just need to call it after regeneration.

## Why This Works

- **Instant feedback**: Setting `canonicalTripTotal = null` immediately falls through to the JS calculation which correctly sums the new day costs
- **Long-term consistency**: The async `repair-trip-costs` call rebuilds `activity_costs` so subsequent page loads also show correct totals
- **No regression risk**: The JS fallback calculation (`jsTotalCost`) already works correctly -- it was just being bypassed by the stale canonical value
