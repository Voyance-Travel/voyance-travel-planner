

## Extract Arrival/Departure Timing into Reusable Functions

### Current State
The arrival/departure timing enforcement logic is **duplicated inline** in two files:
- `action-generate-day.ts` (lines 775-828) — has both arrival and departure filtering
- `action-generate-trip-day.ts` (lines 954-977) — has only departure filtering (missing arrival)

Both use the same pattern: filter activities based on time buffers (2h after arrival, 3h before departure), preserving transport/flight/check-in/check-out activities.

### Problem
1. Code duplication across two generation paths
2. `action-generate-trip-day.ts` is missing arrival timing enforcement entirely
3. No shared, testable functions for this logic

### Changes

**File: `supabase/functions/generate-itinerary/flight-hotel-context.ts`**

Add two exported functions at the end of the file (this file already exports `parseTimeToMinutes`, `minutesToHHMM`, etc.):

- `enforceArrivalTiming(activities, arrivalTime24)` — filters out activities starting before arrival + 2h, preserving transport/flight/check-in
- `enforceDepartureTiming(activities, departureTime24)` — filters out activities starting after departure - 3h, preserving transport/flight/check-out

Both return the filtered array and log removals with `[ARRIVAL]` / `[DEPARTURE]` prefixes.

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**

- Import `enforceArrivalTiming` and `enforceDepartureTiming` from `flight-hotel-context.ts`
- Replace the inline block (lines 776-828) with two function calls:
  ```typescript
  if (isFirstDay && _arrivalTime24) {
    normalizedActivities = enforceArrivalTiming(normalizedActivities, _arrivalTime24);
  }
  if (isLastDay && _departureTime24) {
    normalizedActivities = enforceDepartureTiming(normalizedActivities, _departureTime24);
  }
  ```

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

- Import `enforceArrivalTiming` and `enforceDepartureTiming` from `flight-hotel-context.ts`
- Replace the inline departure block (lines 954-977) with a call to `enforceDepartureTiming`
- **Add** arrival timing enforcement (currently missing) using `enforceArrivalTiming` for `isFirstDay`

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/flight-hotel-context.ts` | Add `enforceArrivalTiming()` and `enforceDepartureTiming()` exports |
| `supabase/functions/generate-itinerary/action-generate-day.ts` | Replace inline block with function calls |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Replace inline departure block + add missing arrival enforcement |

### Deployment
Redeploy `generate-itinerary` edge function.

