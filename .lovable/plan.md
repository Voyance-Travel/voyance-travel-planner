# Fix: First-trip generation unlocks all days instead of only days 1-2

## Problem

For first trips, all requested days are generated (correct), but the backend's progressive unlock logic (`unlocked_day_count = max(current, dayNumber)`) runs for every day it generates. By the time generation completes, `unlocked_day_count` equals the total number of days (e.g., 7). The client's `handleGenerationComplete` then computes `computeUnlockedDayCount({isFirstTrip: true}) = 2`, but the no-shrink guard `Math.max(existingUnlocked, computedUnlocked)` picks the backend's 7. Result: all days are fully unlocked instead of days 1-2 only.

## Root Cause

**File:** `supabase/functions/generate-itinerary/index.ts`, lines 11871-11875, 11927-11930, 11953-11957

The `generate-trip-day` handler unconditionally runs:

```
const newUnlocked = Math.max(currentUnlocked, dayNumber);
```

...and writes it to `unlocked_day_count` on every save. It has no concept of "first trip" and treats every generated day as unlocked.

## Fix

### 1. Backend: Pass `isFirstTrip` flag through generation chain

**File:** `supabase/functions/generate-itinerary/index.ts`

- In the `generate-trip` handler (line ~11027): accept `isFirstTrip` from params (already passed by client via `startServerGeneration`)
- Pass it through to each chained `generate-trip-day` call
- In `generate-trip-day`: if `isFirstTrip` is true, cap `newUnlocked` to `Math.min(newUnlocked, 2)` (using the `FIRST_TRIP_FREE_DAYS` constant value)

The progressive unlock line changes from:

```typescript
const newUnlocked = Math.max(currentUnlocked, dayNumber);
```

to:

```typescript
let newUnlocked = Math.max(currentUnlocked, dayNumber);
if (isFirstTrip) {
  newUnlocked = Math.min(newUnlocked, 2); // FIRST_TRIP_FREE_DAYS
}
```

This applies in three places: the mid-generation save, the final completion save, and the failure save.

### 2. Frontend: Pass `isFirstTrip` to server generation

**File:** `src/components/itinerary/ItineraryGenerator.tsx`

In `startServerGeneration` call (line ~647), add `isFirstTrip: gateResult.isFirstTrip ?? false` to the params so the edge function receives it.

### 3. Client-side safety net (already mostly correct)

The existing `handleGenerationComplete` in TripDetail.tsx uses `Math.max(existingUnlocked, computedUnlocked)`. Once the backend correctly caps `unlocked_day_count` to 2 for first trips, this guard works correctly — it will see `max(2, 2) = 2`.

4. Also for first trip just generate the first 2 days. generate the others on user unlock. do this for first trip only

## Files Changed


| File                                              | Change                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `supabase/functions/generate-itinerary/index.ts`  | Accept `isFirstTrip` param, cap `unlocked_day_count` to 2 for first trips in 3 save locations |
| `src/components/itinerary/ItineraryGenerator.tsx` | Pass `isFirstTrip` flag to `startServerGeneration`                                            |
