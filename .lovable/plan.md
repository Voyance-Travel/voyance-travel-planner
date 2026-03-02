
# Fix: FlightSyncWarning "Regenerate" Button Not Applying Flight Time Changes

## The Bug
When the FlightSyncWarning banner appears (because your flight arrival time doesn't match Day 1's schedule), clicking "Regenerate Day 1 with correct times" calls the full AI day regeneration. This AI call doesn't receive your flight arrival time as a constraint, so it generates a brand new day that still has the same timing mismatch. You can click it repeatedly and nothing changes -- it keeps regenerating without the flight context.

## The Fix
Instead of calling the full AI regeneration, the button should run the **transport cascade** function (`cascadeArrivalDay`), which already exists and correctly:
- Shifts all activities forward to start after your flight arrival + transit buffer (1h 45m for flights)
- Removes activities that can't fit
- Adds an "Arrive & Check In" block at the right time
- Preserves evening activities and meals

This is a targeted time-sync, not a full regeneration -- no credits spent, instant result, and the activities stay the same (just rescheduled).

## Changes

### File: `src/components/itinerary/EditorialItinerary.tsx`

1. **Add a new `handleSyncFlightToDay` function** (near line 3305) that:
   - Reads the flight arrival time from `destinationArrivalLeg`
   - Detects cross-day flights (overnight) to target the correct day index
   - Calls `cascadeArrivalDay()` from `cascadeTransportToItinerary.ts` with the arrival time
   - Updates the `days` state with the shifted activities
   - Saves a version snapshot before applying (so undo works)
   - Shows a toast with what changed ("3 activities shifted, 1 removed")

2. **Update FlightSyncWarning's `onSyncDay1` prop** (line 3976) to call the new `handleSyncFlightToDay` instead of `handleDayRegenerate(arrivalDayIndex)`

3. **Update the button label** in the `FlightSyncWarning` component (line 6517) from "Regenerate Day 1 with correct times" to "Sync schedule to flight times" -- since this is a time-shift, not a regeneration

### No other files changed
- `cascadeTransportToItinerary.ts` already has all the logic needed
- No edge function calls, no credits consumed
- The cascade is deterministic -- same input always produces the same correctly-shifted output
