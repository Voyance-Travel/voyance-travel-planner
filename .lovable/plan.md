

## Fix: Stale Refresh Results After Adding Activity

### Root Cause

When an activity is added via `handleAddActivity` (line 4225), the `refreshResults` state (line 1941) is never cleared for the affected day. The `RefreshDayDiffView` continues displaying stale data — showing "12 activities unchanged" even though there are now 13 activities.

The same issue likely applies to other activity mutations: remove, reorder, and move.

### Fix — 1 file: `src/components/itinerary/EditorialItinerary.tsx`

**Clear the refresh result for the modified day** whenever activities change. Add a single line inside `handleAddActivity` (after the `setDays` call, around line 4285):

```typescript
// Clear stale refresh result for this day
const dayNum = days[dayIndex]?.dayNumber;
if (dayNum) {
  setRefreshResults(prev => { const next = { ...prev }; delete next[dayNum]; return next; });
}
```

Apply the same pattern to these other mutation handlers that modify a day's activities:
- `handleDeleteActivity` — clear refresh for the affected day
- `handleActivityReorder` — clear refresh for the reordered day
- `handleActivityMove` — clear refresh for the affected day

This matches the existing pattern already used in `handleApplyRefreshChanges` (line 2017).

### Result

After adding/removing/reordering an activity, the stale "Day 2: All Good — 12 activities unchanged" panel is dismissed. The user can re-run Refresh Day to get an updated analysis reflecting the current activity count.

