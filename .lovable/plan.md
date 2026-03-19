

## Fix: Same-start-time activities not detected as overlap by Refresh Day

### Root cause

In `supabase/functions/refresh-day/index.ts`, the overlap check at line 329 only triggers when:
```
effectiveEnd > nextStart
```

When "Taxi to the Left Bank" and "Stroll through Saint-Germain-des-Prés" both start at 3:15 PM, the taxi (a short-duration transit activity) likely has `endTime === nextStartTime` or the taxi's `endTime` also equals its `startTime` (zero-duration transport stub). Since `915 > 915` is `false`, no overlap is flagged.

Additionally, `getMinBufferMinutes` returns `0` for transit categories, so the buffer check also passes silently.

### Fix

**File: `supabase/functions/refresh-day/index.ts`** — Add a same-start-time detection before the existing overlap check (around line 323).

When two consecutive sorted activities share the exact same start time, immediately flag a `timing_overlap` error and propose shifting the second activity to start after the first one ends. This runs before the existing `effectiveEnd > nextStart` check.

```
// Inside the loop, after getting nextStart:
const currStartMin = patchedTimes.get(act.id)?.start ?? startMin;
if (currStartMin !== null && nextStart !== null && currStartMin === nextStart) {
  // Same start time = always a conflict
  // → propose shifting next activity to after current ends
}
```

The proposed fix shifts the second activity's start to `effectiveEnd + 5` (or `currStartMin + duration + 5` if effectiveEnd is unavailable), reusing the existing `time_shift` proposedChange pattern already in the file. The `changedIds` and `patchedTimes` maps are updated so downstream cascade checks remain accurate.

### Scope

Single file change: `supabase/functions/refresh-day/index.ts`. Redeploy the edge function.

