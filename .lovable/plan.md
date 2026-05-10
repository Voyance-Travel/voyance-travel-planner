## Bug

`handleCopyToDay` (`src/components/itinerary/EditorialItinerary.tsx:4963-5010`) inserts the copied activity into the destination day's activities array but never calls `syncBudgetFromDays(updated)` inside the `setDays` setter. Result: the duplicated activity's cost row never reaches `activity_costs`, so Budget and Payments tabs ignore it until a global save (or any sibling action that syncs) eventually runs. Same shape as the recently-fixed `handleUpdateActivity` leak.

The neighbor `handleMoveToDay` at lines 4935-4960 already does it correctly:

```ts
const updated = prev.map(...);
syncBudgetFromDays(updated);
return updated;
```

## Fix

One-line parity. Inside `handleCopyToDay`'s `setDays(prev => …)`, capture the mapped result, sync, return:

```ts
setDays(prev => {
  const activity = prev[fromDayIndex]?.activities.find(a => a.id === activityId);
  if (!activity) return prev;

  const copiedActivity: EditorialActivity = { ...activity, id: `${activity.id}-copy-${Date.now()}`, isLocked: false };
  // ...parseTimeToMinutes / insertIndex logic unchanged...

  const updated = prev.map((day, idx) => {
    if (idx !== toDayIndex) return day;
    const newActivities = [...day.activities];
    // ...insert logic unchanged...
    return { ...day, activities: newActivities };
  });
  syncBudgetFromDays(updated);
  return updated;
});
```

Also add `syncBudgetFromDays` to the `useCallback` dependency list (currently `[]`) so the closure captures the latest version — this matches `handleMoveToDay`'s `[syncBudgetFromDays]` dep.

## Files

- `src/components/itinerary/EditorialItinerary.tsx` — `handleCopyToDay` only. Two lines: one `syncBudgetFromDays(updated)` call inside the setter, plus `syncBudgetFromDays` in the deps array.

## Out of scope

- No other copy/duplicate paths exist (grep confirms `handleCopyToDay` is the only consumer of `onCopyToDay`).
- No backend / migration / edge-function change.
- The `activity-costs-changed` event that `syncBudgetFromDays` already dispatches will wake PaymentsTab and BudgetTab automatically — no extra wiring.

## Verification

1. Open a trip with at least 2 days, pick a paid activity, use the copy-to-day menu to duplicate it onto another day.
2. Watch the Budget tab total — it should jump by the activity's cost immediately, no global save needed.
3. PaymentsTab "Activities" group should show the duplicate as a new payable row right away.
4. Undo the copy → totals revert.
5. Sanity: existing move-to-day flow still behaves identically.