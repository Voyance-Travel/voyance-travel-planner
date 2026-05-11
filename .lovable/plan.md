# Fix: False-positive meal detection skips meal-guard

## Root Cause
`detectMealSlots` in `supabase/functions/generate-itinerary/day-validation.ts` (lines 160–198) treats any non-structural card with a meal keyword in its title as a satisfied meal. A wellness card like "Freshen Up before anniversary dinner" matches "dinner" → meal-guard considers dinner present → no real dinner injected.

## Change — `day-validation.ts` `detectMealSlots` (lines 160–198)

1. **Restrict title-keyword matching to dining categories only.** Drop the `!isStructural` branch. Title-based meal detection fires only when `isDining` is true (category includes `dining`/`food`/`restaurant`).

2. **Add temporal-modifier guard.** Even on dining cards, reject titles where the meal keyword is preceded by a forward/backward temporal modifier:
   ```
   /\b(before|after|for|prep|prepare|preparing|ahead\s+of|en\s+route\s+to|on\s+the\s+way\s+to|heading\s+to|towards?)\s+\w*\s*(breakfast|brunch|lunch|dinner|supper)\b/i
   ```
   If matched → skip without adding to `detected`, log:
   `[detectMealSlots] Rejected false-positive "${title}" — temporal modifier before meal keyword OR non-dining category`

3. **Keep time-based detection (lines 183–197) unchanged** — already gated on `isDining` and has the drinks-only guard.

4. **Keep category-keyword branch** (`category.includes(keyword)` when `isDining`) unchanged.

## New Logic Sketch
```ts
const TEMPORAL_MEAL_MODIFIER_RE = /\b(before|after|for|prep|prepare|preparing|ahead\s+of|en\s+route\s+to|on\s+the\s+way\s+to|heading\s+to|towards?)\s+\w*\s*(breakfast|brunch|lunch|dinner|supper)\b/i;

for (const activity of activities) {
  if (isPlaceholderMealActivity(activity)) continue;
  const title = (activity.title || '').toLowerCase();
  const category = (activity.category || '').toLowerCase();
  const isDining = DINING_CATEGORIES.some(c => category.includes(c));

  // Hard reject temporal modifiers OR non-dining title matches
  const hasTemporalModifier = TEMPORAL_MEAL_MODIFIER_RE.test(activity.title || '');

  for (const mealType of Object.keys(MEAL_KEYWORDS) as RequiredMeal[]) {
    const titleHit = MEAL_KEYWORDS[mealType].some(k => title.includes(k));
    const categoryHit = MEAL_KEYWORDS[mealType].some(k => category.includes(k));

    if (titleHit && (!isDining || hasTemporalModifier)) {
      console.log(`[detectMealSlots] Rejected false-positive "${activity.title}" — temporal modifier before meal keyword OR non-dining category`);
      continue;
    }
    if (isDining && (titleHit || categoryHit)) detected.add(mealType);
  }

  // ... time-based block unchanged
}
```

## Sentinel
`[detectMealSlots] Rejected false-positive ...` fires for wellness/leisure cards mentioning meals.

## Out of Scope
- Meal-guard injection logic
- `MEAL_KEYWORDS` / `DINING_CATEGORIES` definitions
- Time-based detection branch
- `isPlaceholderMealActivity`

## Tests (new `__tests__/meal-detection-false-positives.test.ts`)
1. "Freshen Up before anniversary dinner" (wellness) → dinner NOT detected
2. "Walk to lunch" (transport) → lunch NOT detected (already covered by structural skip; regression guard)
3. "Prep for dinner at hotel" (leisure) → dinner NOT detected
4. "Dinner at Da Ivo" (dining, 19:30) → dinner detected
5. "Cooking class: pasta lunch" (food category) → lunch detected (no temporal modifier)
6. "Heading to brunch at Sant Ambroeus" (transport) → brunch NOT detected
