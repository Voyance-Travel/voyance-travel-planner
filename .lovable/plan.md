

## Fix: Make Deduplication Respect User-Requested Repeats

### Problem

`deduplicateActivities()` (day-validation.ts line 326) blindly strips same-title or same-concept+location activities within a day. It has **no awareness of must-dos or user requests**. So if a user says "I want to visit the Louvre morning AND evening" or "beach session twice today," dedup kills the second one.

Meanwhile, the **validation** checks (lines 178-180, 247-249) already use `isRecurringEvent()` to exempt user-requested repeats — but `deduplicateActivities()` does not.

### Fix

**Single change in `deduplicateActivities()`** — add a `mustDoActivities` parameter and skip dedup for activities that match via `isRecurringEvent()`.

```typescript
export function deduplicateActivities(
  day: StrictDayMinimal, 
  mustDoActivities: string[] = []  // NEW
): { day: StrictDayMinimal; removed: string[] }
```

Inside the loop, before checking `seenTitles`/`seenConcepts`, add:

```typescript
if (isRecurringEvent(act, mustDoActivities)) {
  kept.push(act);
  continue;
}
```

Then update the **two call sites** in `index.ts` to pass `mustDoActivities`:
- Old path (~line 2733): `deduplicateActivities(generatedDay, ctx.mustDoActivities || [])`
- Schema path (to be added in Gap 6 port): same pattern

### Files Changed: 2
- `supabase/functions/generate-itinerary/day-validation.ts` — add `mustDoActivities` param + `isRecurringEvent` guard
- `supabase/functions/generate-itinerary/index.ts` — pass `mustDoActivities` at call sites

