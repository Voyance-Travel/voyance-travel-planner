
Fix Restaurant Repetition — Hard Post-Generation Deduplication

What I found
- The prompt side is already in place: `compile-prompt.ts` already filters the restaurant pool by `usedRestaurants` and adds strong “do not reuse” instructions.
- The problem is enforcement:
  - `sanitizeGeneratedDay()` already checks repeats, but it only logs warnings and does not remove or replace anything.
  - `action-generate-trip-day.ts` re-sanitizes the final day without passing `usedRestaurants`, so that last pass cannot enforce cross-day dedup at all.
  - The later chain dedup in `action-generate-trip-day.ts` only swaps from the pool; if no replacement exists, it warns and still keeps the duplicate.
  - `used_restaurants` is being loaded and passed, but collection is narrow enough that some reused venues can be missed.

Plan
1. Make `sanitizeGeneratedDay()` a hard dedup guard
   - Upgrade the existing repeat detector from warning-only to hard removal/neutralization of repeated dining activities.
   - Check all dining cards using the broader meal regex already used elsewhere.
   - Compare normalized restaurant names using exact match plus contains fallback, and inspect `venue_name`, `restaurant.name`, `location.name`, and stripped title text.

2. Pass `usedRestaurants` through every final sanitize path
   - Update the chain-side `sanitizeGeneratedDay(...)` call in `action-generate-trip-day.ts` to pass `usedRestaurants`.
   - Add the requested debug log at the start of `action-generate-day.ts` so we can see the incoming `usedRestaurants` payload on every day.

3. Make the chain fallback zero-tolerance
   - Keep the existing pool-swap logic in `action-generate-trip-day.ts`.
   - If a repeated restaurant survives and there is no unused replacement in the pool, remove/blank that meal instead of only warning, so duplicates never persist into the saved itinerary.
   - Let the existing meal guard refill any required missing meal with a different venue afterward.

4. Broaden `used_restaurants` tracking
   - When saving restaurants for future days, extract from `venue_name`, `restaurant.name`, `location.name`, and title so the blocklist is complete.
   - Keep normalization consistent with the dedup check.

Technical details
- Files to update:
  - `supabase/functions/generate-itinerary/sanitization.ts`
  - `supabase/functions/generate-itinerary/action-generate-day.ts`
  - `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
  - `supabase/functions/generate-itinerary/generation-utils.ts` only if I centralize the repeat-matching helper instead of duplicating logic
- No changes to:
  - self-chaining architecture
  - generation pipeline structure
  - new files

Verification
- Generate a 4-day Lisbon trip and list all dining venues across all 4 days: zero repeats.
- Check logs for:
  - `Generating day X. usedRestaurants (N): [...]`
  - `RESTAURANT REPEAT BLOCKED` when the AI tries to reuse a venue
- Confirm Day 2+ receives a non-empty `usedRestaurants` array unless the prior day truly had no dining venues.
- Confirm any blocked repeat is either swapped to a new venue or removed and then refilled by the existing meal guard with a different restaurant.
