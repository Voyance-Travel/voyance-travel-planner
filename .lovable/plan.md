

## Fix: Prevent Transit Cards from Satisfying Meal Detection

### Problem

A transport card titled "Walk to Dinner in San Marco" contains the keyword "dinner" in its title. `detectMealSlots()` in `day-validation.ts` matches meal keywords in titles **regardless of category** (line 146), so it reports dinner as present. The meal guard sees dinner as "detected" and never injects the actual dinner activity — leaving a 2.5-hour evening gap.

### Root Cause

`detectMealSlots()` line 146:
```typescript
if (MEAL_KEYWORDS[mealType].some(keyword => title.includes(keyword))) {
  detected.add(mealType);
}
```

This matches "dinner" in "Walk to **Dinner** in San Marco" even though the activity's category is `transport`, not `dining`.

### Fix

**File: `supabase/functions/generate-itinerary/day-validation.ts` (~line 139-151)**

Add a category guard: skip transport/accommodation/logistics activities from title-based meal keyword matching. Only allow title-based detection for activities that are either dining-category or uncategorized.

```typescript
for (const activity of activities) {
  const title = (activity.title || '').toLowerCase();
  const category = (activity.category || '').toLowerCase();
  const isDining = DINING_CATEGORIES.some(c => category.includes(c));
  
  // Skip non-dining structural categories for title-based meal detection
  const isStructural = ['transport', 'accommodation', 'logistics'].includes(category);

  for (const mealType of Object.keys(MEAL_KEYWORDS) as RequiredMeal[]) {
    if (!isStructural && MEAL_KEYWORDS[mealType].some(keyword => title.includes(keyword))) {
      detected.add(mealType);
    } else if (isDining && MEAL_KEYWORDS[mealType].some(keyword => category.includes(keyword))) {
      detected.add(mealType);
    }
  }
  // ... time-based detection unchanged (already gated on isDining)
}
```

Single condition change. No other files affected — `detectMealSlots` is used by both `validate-day.ts` and the meal guard in `day-validation.ts`, so this fix propagates to all callers.

### Impact

- Transport cards like "Walk to Dinner" no longer fool the meal detector
- Meal guard correctly fires and injects actual dinner activity
- The TIME_OVERLAP cascade (step 13) will handle any resulting time conflicts

