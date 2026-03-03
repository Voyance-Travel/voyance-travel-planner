
# Fix: Flight Import Times Not Matching Day 1 Itinerary

## Problem

When a flight is imported showing a 06:15 arrival, the itinerary incorrectly tells the AI the flight "lands at 09:15" and starts scheduling activities from 09:15. The actual arrival time is being overwritten by the intelligence buffer calculation.

## Root Cause

Two bugs in the flight intelligence override logic in `generate-itinerary/index.ts` (lines 2953-2992):

1. **Arrival time overwritten with buffer time**: Line 2967 sets `arrivalTime24 = normalized` where `normalized` is the `availableFrom` value (arrival + 3h buffer). This means the AI prompt says "Flight lands at 09:15" instead of "Flight lands at 06:15". The actual landing time is lost.

2. **Inconsistent buffer (3h vs 4h)**: The `parse-booking-confirmation` edge function calculates `availableFrom` using a 3-hour international buffer. But the generation engine's own logic uses a 4-hour buffer (customs, baggage, transport, check-in, freshen up). After a long overnight international flight landing at 6:15 AM, 3 hours is too aggressive -- the generation engine's 4-hour buffer is more realistic.

## Fix

### File: `supabase/functions/generate-itinerary/index.ts` (lines 2960-2977)

**Change 1: Preserve actual arrival time**

When the intelligence override fires, only update `earliestFirstActivity` -- do NOT overwrite `arrivalTime24` (which should always reflect the actual landing time). The arrival time for the prompt should come from the `arrivalDatetime` field, not the `availableFrom` field.

```
Before (broken):
  arrivalTime24 = normalized;           // BUG: sets arrival to 09:15
  earliestFirstActivity = normalized;   // Sets earliest activity to 09:15

After (fixed):
  earliestFirstActivity = normalized;   // Use intelligence buffer for activity scheduling
  // Extract actual arrival time from arrivalDatetime, NOT availableFrom
  const arrivalDt = firstDest.arrivalDatetime || firstDest.arrival_datetime;
  if (arrivalDt includes 'T') {
    arrivalTime24 = normalize the time portion;  // Keeps actual 06:15
    arrivalTimeStr = time portion;
  }
```

**Change 2: Apply the generation engine's own buffer as a floor**

After the intelligence override, ensure the `earliestFirstActivity` is at least `arrival + 4 hours` (the generation engine's standard). If the intelligence `availableFrom` is earlier than that, bump it up.

```
// Ensure minimum 4-hour buffer from actual arrival (generation engine standard)
if (arrivalTime24 and earliestFirstActivity) {
  const arrivalMins = parseTimeToMinutes(arrivalTime24);
  const earliestMins = parseTimeToMinutes(earliestFirstActivity);
  const minEarliest = arrivalMins + 240; // 4 hours
  if (earliestMins < minEarliest) {
    earliestFirstActivity = minutesToHHMM(minEarliest);
  }
}
```

### File: `supabase/functions/parse-booking-confirmation/index.ts` (line 212-213)

**Change 3: Increase international buffer from 3h to 4h**

Update the `availableFrom` calculation in the AI prompt to use a 4-hour buffer for international flights, matching the generation engine's standard:

```
Before:
  availableFrom = arrival time + 3 hours (international) or + 1.5 hours (domestic)

After:
  availableFrom = arrival time + 4 hours (international) or + 2 hours (domestic)
```

This ensures consistency between the two systems.

## Expected Result

- Flight lands at 06:15 -> prompt correctly says "Flight lands at 06:15"
- Earliest first sightseeing activity: 10:15 (06:15 + 4h buffer)
- Day 1 itinerary includes: arrival, customs, transport to hotel, check-in, freshen up, then first activity around 10:15-11:00
- No more "09:15" phantom arrival time in the itinerary
