

# Fix: Remove Activities Too Close to Departure on Last Day

## Problem
On the departure day, activities like lunch get scheduled 13 minutes before a train departs. The existing departure buffer logic in the prompt and repair pipeline isn't preventing the AI from generating these conflicting activities.

## Solution
Add the user's inline filter in `action-generate-day.ts` right after the existing placeholder-address cleanup (line 1320), reusing variables already in scope:
- `isLastDay` — already computed
- `_departureTransportType` — already extracted from flight selection (line 438)
- `flightContext.returnDepartureTime24` — already available

## Implementation

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`** (after line 1320)

Add a departure-buffer filter block that:
1. Only runs when `isLastDay` is true
2. Parses `flightContext.returnDepartureTime24` to get departure minutes
3. Uses 120-min buffer for trains, 180-min for flights (matching the existing `_isTrain` / `_depBufferMins` pattern already at line 1262)
4. Filters out any activity starting after the cutoff, except checkout/departure cards
5. Logs removed activities with `[CLEANUP]` prefix

This adapts the user's provided code to use the variables already in scope (`_departureTransportType`, `flightContext.returnDepartureTime24`) rather than `trip.flights.return`.

No new files. No changes to timing, ordering, or non-last days.

