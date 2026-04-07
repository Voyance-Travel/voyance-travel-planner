

## Upgrade AI Slot Filler to DNA-Aware

### Problem
1. `generateFallbackRestaurant` has duplicate variable declarations at lines 308-310 (bug from previous merge — `priceRange`, `styleDesc`, `locationStr` declared twice)
2. The slot filler doesn't clamp AI-returned prices to the DNA config range
3. The user wants a cleaner `fillPlaceholderSlot` function that combines detection + AI call + field patching in one step

### Changes

#### `supabase/functions/generate-itinerary/fix-placeholders.ts`

1. **Fix duplicate declarations** (lines 308-310): Remove the duplicate `priceRange`, `styleDesc`, `locationStr` declarations that conflict with the ones set inside the `if (diningConfig)` block above

2. **Add price clamping** in `applyFallbackToActivity`: After setting `cost.amount`, clamp to the dining config's price range when a `DiningConfig` is provided. Update the function signature to accept an optional `DiningConfig`

3. **Add exported `fillPlaceholderSlot` function** that wraps the full flow:
   - Determines meal type from start time
   - Calls `isPlaceholderMeal` (caller should pre-check, but defensive)
   - Tries hardcoded fallback first
   - Falls back to AI `generateFallbackRestaurant`
   - Clamps price to `diningConfig.priceRange[mealType]`
   - Patches all activity fields (title, venue_name, address, cost, description)
   - Adds venue to `usedVenueNames` set
   - Returns boolean success

4. **Refactor `fixPlaceholdersForDay`** to call `fillPlaceholderSlot` internally, reducing duplication

### What Stays Unchanged
- `isPlaceholderMeal` — untouched
- `INLINE_FALLBACK_RESTAURANTS` — untouched
- `RESTAURANT_SUGGESTION_TOOL` schema — untouched
- `universal-quality-pass.ts` — already passes `diningConfig` through

### Deployment
Redeploy `generate-itinerary` edge function.

