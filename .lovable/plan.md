

## Fix: Import Overwrites Locked Activities + Estimated Cost Confusion

### Issue 1: Import Replaces Locked Activities

**Root cause** (line 4272-4273 in `EditorialItinerary.tsx`):
```typescript
if (mode === 'replace') {
  updated[dayIndex] = { ...day, activities: newActivities };
}
```
When mode is `'replace'`, ALL existing activities are discarded — including locked ones. The locked activities should be preserved and merged with the imported set.

**Fix** in `handleImportActivities` (line 4272-4273):
- Before replacing, extract locked activities from the existing day
- Merge them back into the new activity list
- Sort chronologically

```typescript
if (mode === 'replace') {
  const lockedActivities = day.activities.filter(a => a.isLocked);
  const merged = [...lockedActivities, ...newActivities];
  merged.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  updated[dayIndex] = { ...day, activities: merged };
}
```

### Issue 2: Estimated Cost Display for Free Activities

**Root cause**: When imported activities have `cost: { amount: 0 }`, the `getActivityCostInfo` function (line 1043) checks if the category is "never free" (dining, tours, etc.). If it matches, it falls through to the estimation engine which generates a ~$5-10 estimate. The user sees `~$5`, `~$10` etc. even though the source data says "free."

The problem is the estimation engine is too aggressive — it second-guesses explicit $0 costs from imported data. For imported activities specifically, $0 should mean $0 unless the user changes it.

**Fix**: When the cost comes from an explicit source (imported data, user override), respect it as-is. The issue is that imported activities set `cost: { amount: 0, currency }` but `getActivityCostInfo` treats 0 as "missing" for never-free categories.

Two-part fix:
1. In `handleImportActivities` (line 4264): If the parsed activity has no cost data at all, don't set `cost.amount = 0` — leave cost undefined so estimation can kick in naturally. But if the source explicitly says free/0, mark it with a flag.
2. In `getActivityCostInfo` (line 1043): Check for an `__importedCostExplicit` flag or similar — if cost was explicitly provided as 0, respect it even for never-free categories.

**Simpler approach**: Tag imported activities so the cost engine knows the $0 was intentional:
- Add `costSource: 'imported'` to imported activities
- In `getActivityCostInfo`, if `costAmount === 0 && shouldNeverBeFree && activity.costSource === 'imported'`, return 0 instead of estimating

### Changes

| # | File | Change |
|---|------|--------|
| 1 | `EditorialItinerary.tsx` (line 4272-4273) | Preserve locked activities during `'replace'` import mode |
| 2 | `EditorialItinerary.tsx` (line 4264) | Add `costSource: 'imported'` to imported activities that have explicit cost data |
| 3 | `EditorialItinerary.tsx` (line 1043) | In `getActivityCostInfo`, respect $0 cost when `costSource === 'imported'` or `costSource === 'user_override'` — skip never-free estimation |

