

## Fix: Same Breakfast Recommended Multiple Days in a Row

### Root Cause

Two issues allow repeated breakfast (and meal) recommendations:

1. **Validation skips meals entirely** — In `day-validation.ts` line 244, the trip-wide uniqueness check has `if (actType === 'dining') continue;`, meaning meal duplicates across days are never flagged as errors or warnings.

2. **Prompt doesn't explicitly require meal variety** — While `previousActivities` includes meal titles in the "AVOID REPEATING" list, there's no explicit instruction emphasizing that **each day must have different restaurant recommendations**. The AI treats the dedup list as a soft suggestion and often picks the same "safe" breakfast spot.

### Fix Plan

**File: `supabase/functions/generate-itinerary/day-validation.ts`** (~line 237-244)

Add meal-specific trip-wide duplicate detection. Instead of blanket-skipping all `dining` activities, check if a meal venue name was already used on a previous day:

```typescript
// Keep skipping transport/accommodation from trip-wide dedup, but NOT dining
if (actType === 'transport' || actType === 'accommodation') continue;
if (LOGISTICAL_PATTERNS.test(actTitle)) continue;

// Meal-specific dedup: flag if same restaurant name appears on previous days
if (actType === 'dining') {
  for (const prevConcept of previousConcepts) {
    if (conceptSimilarity(actConcept, prevConcept)) {
      if (isRecurringEvent(act, mustDoActivities)) continue;
      errors.push(`MEAL REPEAT: "${act.title}" is too similar to a meal from a previous day. Each day should feature DIFFERENT restaurants.`);
      break;
    }
  }
  continue; // Skip non-meal dedup checks for dining
}
```

Also update `previousConcepts` collection (line 228-234) to include dining activities in the concept set (currently they are included, so no change needed there).

**File: `supabase/functions/generate-itinerary/index.ts`** (~line 1983-1991)

Add an explicit meal variety instruction to the AI prompt, right after the dedup list:

```typescript
lines += `\n🍽️ MEAL VARIETY RULE: Every breakfast, lunch, and dinner MUST be at a DIFFERENT restaurant than any previous day. Never recommend the same café or restaurant twice across the trip. Variety in cuisine type is also encouraged.\n`;
```

**File: `supabase/functions/generate-itinerary/prompt-library.ts`** (~line 1289)

Strengthen the existing meal requirements text to emphasize variety:

```
- BREAKFAST: Real restaurant/café name — MUST BE DIFFERENT from any previous day's breakfast
- LUNCH: Restaurant near previous activity — MUST BE DIFFERENT from any previous day's lunch
- DINNER: Restaurant — MUST BE DIFFERENT from any previous day's dinner
```

### Summary

| File | Change |
|------|--------|
| `day-validation.ts` | Remove dining exemption from trip-wide dedup; add meal-specific duplicate error |
| `index.ts` | Add explicit "MEAL VARIETY RULE" to AI prompt after dedup list |
| `prompt-library.ts` | Strengthen meal requirement text to mandate unique restaurants per day |

