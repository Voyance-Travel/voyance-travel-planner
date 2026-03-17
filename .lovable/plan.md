

## Fix: Refresh Day Cascade — Proposed Changes Create New Overlaps

### Problem

The `refresh-day` edge function's overlap resolution loop at lines 319-352 uses each activity's **original** times when computing fixes for subsequent activities. When activity A is shifted forward (e.g., 11:00-11:30 → 11:20-11:50), the next iteration still reads A's original `endMin` (11:30) to fix activity B. So B gets shifted to 11:35, which is *inside* A's new window (11:20-11:50) — creating a new overlap that the user sees when they apply the changes.

**Example from screenshot:**
- "Hotel Checkout from Hotel": 11:00-11:30 → 11:20-11:50
- "Return to Hotel for Checkout": 11:15-11:30 → 11:35-11:50
- After applying: Checkout ends at 11:50, Return starts at 11:35 → **still overlapping**

### Fix

**File: `supabase/functions/refresh-day/index.ts`**

Maintain a `patchedTimes` map that tracks shifted start/end times. When resolving overlaps, use the patched end time of the current activity (if it was shifted) instead of the original. After proposing a shift for `next`, record its new times in the map.

```typescript
// Before the loop:
const patchedTimes = new Map<string, { start: number; end: number }>();

// Inside the loop, replace raw endMin with:
const effectiveEnd = patchedTimes.get(act.id)?.end ?? endMin;

// After proposing a shift for next, record:
patchedTimes.set(next.id, { start: fixedStartMin, end: fixedEndMin });
```

This ensures each successive overlap check uses the **cascaded** end time, producing non-overlapping proposed changes.

Same pattern applies to the buffer check (lines 360-394) — use `effectiveEnd` instead of raw `endMin`.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/refresh-day/index.ts` | Add `patchedTimes` map; use cascaded times in overlap and buffer resolution |

