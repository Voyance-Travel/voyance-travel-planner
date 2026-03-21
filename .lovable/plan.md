

## Fix: Meal-Type/Time-Slot Coherence on Activity Swaps

### Problem
When the budget coach suggests "Dinner at Osteria Beccafico → Lunch at Osteria Beccafico" (cheaper lunch menu), the client applies the new title "Lunch at Osteria Beccafico" but keeps the original 7:00 PM time slot. Result: "Lunch" at 7 PM — confusing and logically wrong.

### Root Cause
The budget coach prompt (line 119) explicitly suggests `"Expensive dinner restaurants → the same restaurant for lunch"`. The AI returns a title containing "Lunch" but no time data. The client blindly applies `title: suggestion.suggested_swap` while preserving the original time.

This affects **three swap paths**:
1. **Budget Coach** (`EditorialItinerary.tsx` line 6206) — sets `title: suggestion.suggested_swap`
2. **Hotel Swaps** (`TripDetail.tsx` line 2025) — sets `name: swap.suggestedActivity`
3. **Regular Swap Drawer** (`EditorialItinerary.tsx` line 3194) — sets `title: newActivity.title`

### Fix (2 changes)

**Change 1: Add a meal-type coherence guard (shared utility)**

Create a small utility function that detects when a swap would create a meal-type/time-slot mismatch, and corrects the title to match the existing time slot:

```
File: src/utils/mealTimeCoherence.ts (new)
```

Logic:
- Extract meal keyword from title ("breakfast", "lunch", "dinner/supper")
- Check if time slot contradicts the meal keyword:
  - Breakfast: 6:00–10:59
  - Lunch: 11:00–14:59
  - Dinner: 17:00–22:59
- If mismatch detected: replace the meal keyword in the title with the correct one for the time slot
- Example: "Lunch at Osteria Beccafico" at 19:00 → "Dinner at Osteria Beccafico"

**Change 2: Apply the guard in all three swap paths**

- **Budget Coach swap** (`EditorialItinerary.tsx` ~line 6206): Before setting the title, run it through the coherence guard with the preserved time slot
- **Hotel swap** (`TripDetail.tsx` ~line 2025): Same guard on `swap.suggestedActivity`
- **Regular swap drawer** (`EditorialItinerary.tsx` ~line 3194): Same guard on `newActivity.title` (less likely to hit this since swap drawer uses category-filtered results, but defensive)

**Change 3: Update budget coach prompt to prefer venue-only names**

In `supabase/functions/budget-coach/index.ts`, update line 119 to instruct the AI to suggest "same restaurant at lunch price" without changing the title to include "Lunch":

```
- Expensive dinner restaurants → the same restaurant for lunch (keep the venue name, note "lunch service" in the reason, do NOT prefix with "Lunch at")
```

Add to the naming rules:
```
- When suggesting a dinner→lunch swap, keep the original venue name (e.g., "Osteria Beccafico") — do NOT rename to "Lunch at Osteria Beccafico". Explain the lunch-price angle in the "reason" field instead.
```

### Why this approach
- The utility guard is defensive — it catches any AI-generated meal-type mismatch regardless of source
- The prompt fix reduces the frequency of the issue at the source
- Both together ensure the title always matches the time slot

### Files
- `src/utils/mealTimeCoherence.ts` (new) — shared coherence utility
- `src/components/itinerary/EditorialItinerary.tsx` — apply guard in budget swap + regular swap paths
- `src/pages/TripDetail.tsx` — apply guard in hotel swap path
- `supabase/functions/budget-coach/index.ts` — prompt update to avoid meal-type renaming

