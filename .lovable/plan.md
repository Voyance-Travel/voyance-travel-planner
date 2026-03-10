

## Fix: Allow User-Requested Duplicate/Recurring Activities Through Validation

### Problem
Three duplicate-detection layers block recurring activities (like "US Open both days") even when the user explicitly requested them:

1. **Back-to-back dedup** (line 4607) — no `isRecurringEvent` check at all
2. **Trip-wide dedup** (line 4700) — calls `isRecurringEvent(act, [])` with an empty array, so user-specific must-do matching never fires
3. **`validateGeneratedDay` signature** — doesn't receive `mustDoActivities`, so it can't know what the user requested

### Changes

**File:** `supabase/functions/generate-itinerary/index.ts`

#### 1. Add `mustDoActivities` parameter to `validateGeneratedDay`

Update function signature (line 4434) to accept `mustDoActivities: string[] = []` as the 8th parameter.

#### 2. Back-to-back dedup: skip for recurring events (line 4607)

Before pushing the "too similar" error, add an `isRecurringEvent` check using the new `mustDoActivities` param:

```ts
if (!currIsTransportLike && !prevIsTransportLike && conceptSimilarity(currConcept, prevConcept)) {
  // Skip dedup for recurring events the user explicitly requested
  if (isRecurringEvent(act, mustDoActivities)) {
    // Allow — user wants this activity on multiple days
  } else if (isSmartFinish) {
    warnings.push(...);
  } else {
    errors.push(...);
  }
}
```

#### 3. Trip-wide dedup: pass `mustDoActivities` instead of empty array (line 4700)

```ts
// Before:
if (isRecurringEvent(act, [])) {
// After:
if (isRecurringEvent(act, mustDoActivities)) {
```

#### 4. Update all callers of `validateGeneratedDay`

At each call site (line ~6061 and any others), pass `context.mustDoActivities?.split(',')` or the equivalent must-do list as the new parameter:

```ts
validateGeneratedDay(generatedDay, dayNumber, isFirstDay, isLastDay, context.totalDays, previousDays, !!context.isSmartFinish, mustDoList);
```

This ensures that when a user says "US Open both days", the activity passes through all three dedup gates because `isRecurringEvent` will match it against the user's must-do list.

