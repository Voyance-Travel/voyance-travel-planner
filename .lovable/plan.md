

## Problem: Venue-Meal Mismatch After Relabeling

The current MEAL_ORDER repair (Step 5a) relabels "Lunch at Nobu" → "Breakfast at Nobu" — but Nobu doesn't serve breakfast. Renaming the label without checking venue suitability produces nonsensical results.

### What to Change

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Step 5a MEAL_ORDER block (lines ~275-336)

After determining the `correctMeal` for the time slot, before relabeling:

1. **Check if the venue is appropriate for the corrected meal type.** Define a set of heuristic keywords that signal a venue is wrong for a given meal:
   - **Breakfast-incompatible**: "nobu", "steakhouse", "izakaya", "omakase", "fine dining", "cocktail", "bar & grill", "tapas", "sushi" (high-end dinner spots that don't do breakfast)
   - **Dinner-incompatible**: "bakery", "café", "coffee", "pancake", "diner" (breakfast/brunch spots unlikely to do dinner service)

2. **If the venue seems incompatible with the corrected meal**, attempt a **venue swap** from `restaurantPool`:
   - Filter the pool for venues matching the `correctMeal` mealType (or "any") that haven't been used yet
   - If a match is found: replace the activity's `title`, `name`, `description`, and `location` fields with the pool venue
   - If no match: fall back to relabeling only (current behavior) — imperfect but better than removing the meal entirely

3. **If the venue seems compatible** (e.g., a generic café being relabeled from lunch to breakfast), just relabel as currently done.

**File: `supabase/functions/generate-itinerary/day-validation.ts`** — `enforceRequiredMealsFinalGuard()` pre-pass (lines ~782+)

Apply the same venue-appropriateness check in the final guard's relabeling pre-pass. The final guard already has access to `fallbackVenues` — use them for swaps when a venue doesn't fit the corrected meal type.

### Technical Details

```text
Step 5a flow (revised):

  MEAL_ORDER violation detected
  → Determine correctMeal for time slot
  → Is venue compatible with correctMeal?
     YES → Relabel title only (current behavior)
     NO  → Try swap from restaurantPool (mealType match)
            Found → Replace title/name/location/description
            Not found → Relabel only (fallback)
```

Incompatibility detection uses a keyword blocklist per meal type. This is a heuristic — it won't catch every case, but it handles the obvious ones (Nobu for breakfast, a bakery for dinner).

### Expected Result
- "Lunch at Nobu" at 8:30 AM → swapped to "Breakfast at [pool breakfast venue]" instead of "Breakfast at Nobu"
- "Dinner at The Pancake House" at 19:00 → kept as-is (pancake house unlikely but time is correct) or swapped if the label was wrong
- When no pool venue is available, falls back to relabeling only (existing behavior)

