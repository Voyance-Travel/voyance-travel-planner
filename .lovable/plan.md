

## Fix: Meal Guard Injects Duplicate Meals Because `detectMealSlots` Only Checks `category === 'dining'`

### Problem

`detectMealSlots` in `day-validation.ts` (line 141) has a strict filter:
```typescript
const isDining = category === 'dining' || category.includes('dining');
if (!isDining) continue;
```

If the AI generates a meal activity with category `"restaurant"`, `"food"`, `"cafe"`, or even no category at all, it's skipped entirely. The guard then thinks no meals exist and injects placeholder "Breakfast/Lunch/Dinner at restaurant" entries — creating duplicates.

The same issue exists in the **client-side** `mealGuard.ts`, which has a similar narrow check requiring category to include "dining"/"food"/"restaurant" but then *also* requires meal keywords in the title. If the title is something like "Morning at Café Procope" without the word "breakfast", it's missed.

### Fix

**1. `supabase/functions/generate-itinerary/day-validation.ts` — Broaden `detectMealSlots`**

Update the detection to:
- Accept categories: `dining`, `restaurant`, `food`, `cafe`, `meal`
- Also check the title for meal keywords **regardless of category** (a "Breakfast at X" with category "activity" is still a breakfast)

```typescript
export function detectMealSlots(activities) {
  const detected = new Set<RequiredMeal>();
  const DINING_CATEGORIES = ['dining', 'restaurant', 'food', 'cafe', 'meal'];

  for (const activity of activities) {
    const title = (activity.title || '').toLowerCase();
    const category = (activity.category || '').toLowerCase();
    const isDining = DINING_CATEGORIES.some(c => category.includes(c));

    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      if (MEAL_KEYWORDS[mealType].some(kw => title.includes(kw))) {
        detected.add(mealType); // Title match is sufficient
      } else if (isDining) {
        // For dining-category activities, check category text too
        if (MEAL_KEYWORDS[mealType].some(kw => category.includes(kw))) {
          detected.add(mealType);
        }
      }
    }
  }
  return ['breakfast', 'lunch', 'dinner'].filter(m => detected.has(m));
}
```

**2. `src/utils/mealGuard.ts` — Same broadening on client side**

Update `detectMeals` to match the same logic: if the title contains "breakfast"/"lunch"/"dinner", detect it regardless of category.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-itinerary/day-validation.ts` | Broaden `detectMealSlots` — title-based keyword match should work regardless of category |
| 2 | `src/utils/mealGuard.ts` | Same broadening in client-side `detectMeals` |

