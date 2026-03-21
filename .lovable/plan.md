

## Fix: Activities Scheduled Before Hotel Check-In on Arrival Days

### Problem
On Day 1 (arrival), the AI places hotel check-in at 12:00 PM but schedules activities at 10:00 AM and 11:45 AM — before the traveler has even reached their hotel. The prompt (Rule 12) says check-in must be the FIRST activity, but the AI doesn't always comply. The fallback injection (Stage 2.56) only fires when check-in is **missing** — it doesn't fix ordering when check-in exists but isn't first.

### Root Cause
Stage 2.56 (line 6249) checks `hasCheckIn` — if true, it skips entirely with "no injection needed." But it never verifies that check-in is actually the **first** activity chronologically. So when the AI places check-in at noon and sightseeing at 10 AM, the post-processor accepts it as valid.

### Fix (1 file, ~20 lines)

**File: `supabase/functions/generate-itinerary/index.ts`**

**After Stage 2.56's existing check-in injection block (~line 6294), add a new enforcement step:**

When Day 1 (or first day in a new city) has a check-in activity but it's NOT the earliest activity by time:

1. Find the check-in activity and determine its start time
2. Find all activities scheduled before check-in
3. Shift those pre-check-in activities to after check-in ends, maintaining their relative order and spacing
4. Log the fix

```
// Stage 2.57: Enforce check-in-first ordering on arrival days
// If check-in exists but isn't the earliest activity, shift pre-check-in 
// activities to after check-in ends.
```

Logic:
- Parse check-in start time → `checkInStartMin`
- Parse check-in end time → `checkInEndMin`
- For each activity with `startTime < checkInStartMin`: shift it to `checkInEndMin + offset` (preserving original duration and relative order)
- Re-sort activities by start time

This is deterministic post-processing — no AI call, no retry needed. It catches every case where the AI violates the "check-in first" rule regardless of the specific times chosen.

### Why not just fix the prompt?
The prompt (Rule 12) already says "MUST begin with hotel check-in as the FIRST activity." The AI sometimes ignores it. This post-processing enforcement is the reliable backstop — same pattern used for checkout/departure ordering on last days.

### Files
- `supabase/functions/generate-itinerary/index.ts` — add Stage 2.57 check-in-first enforcement

