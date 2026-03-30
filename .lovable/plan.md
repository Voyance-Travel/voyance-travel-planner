
Root cause: this is not the new pipeline failing broadly — it is one isolated fallback path still producing placeholders.

What’s happening:
1. The prompt path is correct when a restaurant pool exists:
   - `pipeline/compile-prompt.ts` explicitly says “pick from this pre-verified list” and blocks repeats.
2. But when meals are missing, the final meal guard in `day-validation.ts` injects fallback meals.
3. That final guard still falls back to generic placeholders like:
   - `Breakfast in Lisbon`
   - `Lunch in Lisbon`
4. That happens whenever `fallbackVenues` is empty or never reaches that guard.

Why this is still happening after the refactor:
- The refactor actually did make this easier to diagnose.
- The problem is now localized to:
  - restaurant-pool propagation
  - meal-guard fallback behavior
  - validator coverage for generic meal titles
- So yes: this should now be a relatively simple, targeted fix.

Evidence from the code:
- `compile-prompt.ts` uses `paramRestaurantPool` correctly.
- `action-generate-trip-day.ts` loads `trip.metadata.restaurant_pool`, but logs that it can be empty and then falls through.
- `generation-core.ts` calls `enforceRequiredMealsFinalGuard(...)` without passing fallback venues at all, so on final retry it can inject destination placeholders.
- `day-validation.ts` explicitly creates `Breakfast in ${destination}` / `Lunch in ${destination}` when no venue exists.
- `pipeline/validate-day.ts` flags generic venue names like `local restaurant`, but it does not currently catch `Breakfast in Lisbon` / `Lunch in Lisbon`.

Implementation plan:
1. Remove placeholder meal title generation
   - In `day-validation.ts`, stop generating `Breakfast in ${destination}` / `Lunch in ${destination}` / `Dinner in ${destination}`.
   - If no real venue is available, either:
     - fail hard for retry, or
     - create a clearly marked unresolved placeholder that the validator rejects.
2. Pass real fallback venues through every generation path
   - Update the `generation-core.ts` meal guard call to receive the same restaurant-pool / verified-venue candidates already assembled elsewhere.
   - Ensure the final-attempt path cannot silently degrade into generic destination meal names.
3. Make validation reject these placeholders explicitly
   - Expand `pipeline/validate-day.ts` generic venue detection to catch:
     - `Breakfast in [city]`
     - `Lunch in [city]`
     - `Dinner in [city]`
     - similar city-name-only meal titles
   - This forces repair/retry instead of saving bad cards.
4. Keep repair isolated in the new pipeline
   - If a meal is missing and a real venue exists in pool/fallbacks, let repair/guard inject `Breakfast at [real place]`.
   - If not, surface a generation failure instead of fake specificity.
5. Add regression coverage
   - Add/update tests around:
     - empty restaurant pool
     - pool present but exhausted
     - final retry path
     - validator catching `Lunch in Lisbon`
     - guard preferring real pool venues over generic fallback

Expected outcome:
- No more saved activity cards like “Breakfast in Lisbon.”
- Meals will either:
  - use a real named restaurant, or
  - fail/retry visibly instead of sneaking generic placeholders into the itinerary.

Technical details:
- Primary files to update:
  - `supabase/functions/generate-itinerary/day-validation.ts`
  - `supabase/functions/generate-itinerary/generation-core.ts`
  - `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
  - likely also `supabase/functions/generate-itinerary/action-generate-day.ts` / `action-generate-trip-day.ts` for consistent fallback venue propagation
- Architectural conclusion:
  - Yes, the split model did help.
  - This looks like a focused fix in the meal fallback layer, not a structural rewrite.
