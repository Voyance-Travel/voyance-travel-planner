

## Fix: "De Kas" Replaced by Generic Placeholder in Smart Finish

### Problem
Smart Finish correctly receives "De Kas" as a must-do activity but the Meal Final Guard then injects a generic "Dinner at a restaurant" placeholder because `detectMealSlots()` fails to recognize "De Kas" as dinner.

### Root Cause
`detectMealSlots()` in `day-validation.ts` (line 134) only detects meals via keyword matching — it checks if the activity **title** contains "dinner", "supper", or "evening meal". A restaurant like "De Kas" with `category: "dining"` scheduled at 19:00 doesn't contain any dinner keywords, so it's invisible to the detector.

The Final Guard sees "dinner is missing", injects a generic placeholder, and the original "De Kas" activity either gets pushed aside or the duplicate confuses the output.

### Fix

**File: `supabase/functions/generate-itinerary/day-validation.ts` — `detectMealSlots()` (~line 134)**

Add time-based meal detection for dining-category activities. If an activity has `category` in `DINING_CATEGORIES` and its `startTime` falls within a meal window, count it as that meal:

```typescript
// After keyword matching loop, add time-based detection for dining activities:
if (isDining) {
  const startTime = (activity as any).startTime || '';
  const minutes = parseTimeToMinutesLocal(startTime);
  if (minutes !== null) {
    if (minutes >= 6*60 && minutes < 11*60) detected.add('breakfast');
    else if (minutes >= 11*60 && minutes < 15*60) detected.add('lunch');
    else if (minutes >= 17*60 && minutes <= 22*60) detected.add('dinner');
  }
}
```

This means "De Kas" at 19:00 with `category: "dining"` will be detected as dinner, preventing the Final Guard from injecting a duplicate.

**Update the type signature** of the `activities` parameter to include optional `startTime`:
```typescript
activities: Array<Pick<StrictActivityMinimal, 'title' | 'category'> & { startTime?: string }>
```

`parseTimeToMinutesLocal` already exists at line 166 in the same file.

### Scope
1 file, ~10 lines added. No client-side or database changes.

