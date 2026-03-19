

## Fix: "All Good" refresh result contradicts "no travel buffer" banner

### Root cause

Two independent UI elements display simultaneously with conflicting messages:

1. **Day-level buffer warning banner** (line ~9050): Runs a local `computeGapMinutes` check and shows "7 activities have no travel buffer" whenever any consecutive pair has gap ≤ 0.
2. **RefreshDayDiffView** (line ~9459): Shows the edge function's validation result, which may report "All Good" because its `insufficient_buffer` detection uses different logic (category-aware minimum buffers, coordinate checks, etc.).

After the user clicks "Refresh Day", both are visible at the same time — the banner saying there are problems, the diff view saying everything is fine.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

Suppress the day-level buffer warning banner when a refresh result is active for that day. The refresh result is the authoritative validation — if it says "All Good", the simpler heuristic banner should not contradict it.

At line ~9051, add a check: if `refreshResult` exists and its `dayNumber` matches the current day, return `null` early (skip rendering the banner).

```tsx
if (dayIsPreview || isCleanPreview) return null;
// Hide banner when refresh result is active — it's the authoritative source
if (refreshResult && refreshResult.dayNumber === day.dayNumber) return null;
```

One line addition. The banner reappears if the user dismisses the refresh result or mutates the itinerary (which already clears `refreshResults`).

