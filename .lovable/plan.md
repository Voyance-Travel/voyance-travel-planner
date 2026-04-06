

## Ensure Every Full Day Has Dinner (Not Just Cocktails)

### Root Cause

`detectMealSlots()` in `day-validation.ts` (line 163) treats **any** dining-category activity between 17:00–22:00 as dinner via time-based detection. A cocktail bar like "Cocktails at Pavilhão Chinês" at 8:56 PM with category `dining` satisfies the dinner check, so the meal guard never fires and no dinner is injected.

### Plan

#### 1. Fix `detectMealSlots` in `day-validation.ts`

Add a drinks-only exclusion to the time-based dinner detection (line 156–165). Before counting a dining activity as dinner by time alone, check that its title doesn't match a cocktail/bar/drinks pattern:

```typescript
const DRINKS_ONLY_RE = /\b(cocktail|nightcap|drinks?|bar|lounge|aperitif|speakeasy)\b/i;

// In the time-based detection block:
if (isDining) {
  const startTime = (activity as any).startTime || '';
  const minutes = parseTimeToMinutesLocal(startTime);
  if (minutes !== null) {
    if (minutes >= 6 * 60 && minutes < 11 * 60) detected.add('breakfast');
    else if (minutes >= 11 * 60 && minutes < 15 * 60) detected.add('lunch');
    else if (minutes >= 17 * 60 && minutes <= 22 * 60) {
      // Cocktail bars don't count as dinner
      if (!DRINKS_ONLY_RE.test(title)) {
        detected.add('dinner');
      }
    }
  }
}
```

This means cocktail bars no longer satisfy the dinner requirement, and the existing `enforceRequiredMealsFinalGuard` will inject a proper dinner restaurant.

#### 2. Add prompt-layer rule in `compile-prompt.ts`

Add to the meal timing rules section (~line 929):

```
- Cocktail bars, lounges, and nightcap venues do NOT count as dinner. Every full day must have a proper sit-down dinner restaurant between 7:00 PM and 9:30 PM, separate from any bar/lounge visit.
- If the day includes a cocktail/bar visit, schedule it AFTER dinner.
```

#### 3. No new files needed

The existing meal guard (`enforceRequiredMealsFinalGuard`) already handles injection of missing meals with real restaurant names. The only fix is making `detectMealSlots` correctly identify that a cocktail bar is not dinner.

### Files to edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/day-validation.ts` | Add `DRINKS_ONLY_RE` exclusion to time-based dinner detection |
| `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` | Add cocktail≠dinner rule to meal timing section |

### Verification

- Generate a 4-day Lisbon trip — every full day should have a proper dinner restaurant
- Days with cocktail bars should have dinner scheduled before the bar visit
- Check console for meal guard logs — if it fires for missing dinner, it means the fix is working

