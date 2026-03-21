

## Fix: Venue Hours Shift Must Respect Hard Downstream Constraints (Checkout/Departure)

### Problem
Stage 4.5 correctly detects "church opens at 10:30, scheduled at 10:00" and shifts the activity to 10:40 AM. But it doesn't check whether the shifted time creates an impossible squeeze against hard downstream events like hotel checkout (11:00 AM). The result: a 30-minute visit ending at 11:10 AM + 30-minute transit = checkout pushed to 11:40 AM, which violates the checkout constraint.

The fixes already deployed (Stage 4.5 auto-fix + single-day path auto-fix) handle the time-shift correctly. The gap is that **neither path validates the shifted time against hard constraints on the same day** — specifically checkout/departure on last days or transition days.

### Root Cause
Stage 4.5 shifts `startTime` forward and continues. Stage 4.6 then cascade-shifts everything downstream, including checkout — which shouldn't be movable on departure/transition days. There's no "is this a hard-stop activity?" check before cascade-shifting.

### Fix (1 file, ~25 lines)

**File: `supabase/functions/generate-itinerary/index.ts`**

**In Stage 4.5's time-shift block (~line 6855):** After calculating `newStartMins`, before applying the shift, check if the day has a hard downstream constraint (checkout or departure transport). If the shifted activity + its duration + minimum transit buffer would exceed the hard constraint's start time, **remove the activity** instead of shifting it — the day can't fit it.

```
Logic (pseudocode):
1. Find hard-stop activity on this day (checkout, departure transport)
2. If found, get its startTime in minutes → hardStopMins
3. After computing newStartMins:
   - estimatedEnd = newStartMins + duration + 20 (minimum transit buffer)
   - If estimatedEnd > hardStopMins → REMOVE the activity
4. Same check in the single-day path (~line 9705)
```

This prevents Stage 4.5 from shifting an activity into a position that Stage 4.6 will then cascade into checkout, and prevents checkout from being pushed.

**Additionally in Stage 4.6 (~line 6966):** Add a guard that prevents cascade-shifting activities whose category is `accommodation` (checkout) or `transport`/`flight` on the last day or transition days. If a cascade shift would hit one of these, truncate the cascade at that point and remove the preceding activity that caused the overflow instead.

### Files
- `supabase/functions/generate-itinerary/index.ts` — add hard-constraint check in Stage 4.5 shift logic + Stage 4.6 cascade guard

