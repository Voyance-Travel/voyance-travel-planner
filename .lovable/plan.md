

# Fix Placeholder Restaurant Meals

## Root Cause

The restaurant pool (`tripMeta.restaurant_pool`) is **never populated** anywhere in the codebase. The code in `action-generate-trip-day.ts` reads from `trip.metadata.restaurant_pool`, but no code ever writes to it. This means Priority 1 always returns an empty array.

Priority 2 (`verified_venues` table) likely returns 0 results because the table may be empty for the queried city, or the `ilike` city match fails.

Both guards (in `action-generate-day.ts` and `action-generate-trip-day.ts`) then fall through to the generic placeholder in `day-validation.ts`, which produces titles like "Breakfast at a local café" and tips saying "Find a real restaurant."

## Changes

### 1. `day-validation.ts` — Improve placeholder text (lines 835-858)

The fallback (TRY 2) should never show developer-facing language:

- **Title**: Change `"${label} at a ${hint.venueSuffix}"` to `"${label} in ${destination}"` — so it reads "Breakfast in Vienna" not "Breakfast at a local café"
- **Tips text** (line 856): Replace `'Tap "Find a real restaurant" below...'` with `'Explore local options near your next activity — ask a local or check recent reviews.'`
- **Generic hints** (lines 752-756): Change "neighborhood restaurant" to just use the destination name: `venueSuffix: 'local spot'`, and update descriptions to remove "near your hotel" (already done in prior fix) and remove "your activities"
- Remove the `needs-refinement` tag from the fallback so the UI doesn't show the swap button with developer language

### 2. `action-generate-trip-day.ts` — Add diagnostic logging for empty pool (line ~262)

After the pool resolution block (line 262), add a warning log when the pool is empty:
```typescript
if (restaurantPool.length === 0) {
  console.warn(`[generate-trip-day] ⚠️ Restaurant pool EMPTY for "${dayCity}" — meal guard will fall through to verified_venues or generic fallbacks`);
}
```

### 3. `action-generate-trip-day.ts` — Broaden verified_venues query (lines 766-770)

The `ilike` on `city` may miss entries. Add a fallback query on `country` or destination substring:
- After the city query returns 0 results, try a broader query using just the first word of the destination (e.g., "Vienna" from "Vienna, Austria")

### 4. `action-generate-day.ts` — Same broadened query (lines 977-984)

Mirror the same verified_venues query improvement.

### 5. `src/utils/mealGuard.ts` — Fix client-side placeholder text (line 215)

Change `'Tap "Find a real restaurant" below...'` to `'Explore local options — check recent reviews or ask your accommodation for recommendations.'`

### 6. `src/components/itinerary/EditorialItinerary.tsx` — Guard the "Find a real restaurant" button text

Around lines 10273 and 10644, the swap button shows when `needsRefinement` is true. Update the button label from any developer-facing text to user-friendly copy like "Get a recommendation" or "Swap restaurant".

## Files to modify
- `supabase/functions/generate-itinerary/day-validation.ts` — fix fallback title/description/tips
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — diagnostic log + broaden query
- `supabase/functions/generate-itinerary/action-generate-day.ts` — broaden verified_venues query
- `src/utils/mealGuard.ts` — fix client-side placeholder text
- `src/components/itinerary/EditorialItinerary.tsx` — fix swap button copy

## No new files, no pipeline changes, no self-chaining modifications.

