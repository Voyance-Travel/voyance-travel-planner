
## Fix Restaurant Repetition — Fábrica da Nata 3× in One Trip

### What I found
- The code already has multiple anti-repeat layers:
  - `action-generate-trip-day.ts` loads and persists `metadata.used_restaurants`
  - `compile-prompt.ts` already filters the restaurant pool and prints an “already used” blocklist
  - `validate-day.ts` flags repeated dining venues across previous days
  - `repair-day.ts` swaps repeated restaurants from the pool when possible
  - `action-generate-trip-day.ts` also has a post-generation cross-day dedup pass
- Since repeats are still happening, the likely gap is **matching consistency**, not missing architecture. The current normalization is lowercase-based but not accent-insensitive, so variants like `Fábrica da Nata` vs `Fabrica da Nata` can slip past the blocklist, validator, repair swap, and `used_restaurants` dedup.
- Prompt edits should follow the current extracted architecture: implement them in `pipeline/compile-prompt.ts` rather than re-building prompt logic inside `action-generate-day.ts`.

### Plan
1. **Harden canonical restaurant matching at the source**
   - Update `supabase/functions/generate-itinerary/generation-utils.ts` so restaurant name normalization is accent-insensitive and more stable.
   - Keep using `extractRestaurantVenueName()` as the single shared matcher so existing prompt filtering, validation, repair, and `used_restaurants` tracking all get stronger automatically.

2. **Add the explicit hard blocklist text the AI can’t miss**
   - In `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`, add a short plain-text blocklist built directly from `paramUsedRestaurants`.
   - Keep the existing pool blocklist, but add an extra high-visibility instruction near the end of the prompt:
     - do not use any listed restaurants
     - never repeat a restaurant across days
     - breakfast/lunch/dinner must all be different venues

3. **Add a soft post-generation repeat detector in sanitization**
   - Extend `supabase/functions/generate-itinerary/sanitization.ts` so `sanitizeGeneratedDay()` accepts an optional `usedRestaurants` array.
   - Use the actual current schema (`title`, `location.name`, dining category / meal-title heuristics), not a new `venue_name` field.
   - Log a clear warning when a dining activity matches a previously used restaurant after canonical normalization.

4. **Wire the sanitizer only where the blocklist already exists**
   - Pass `paramUsedRestaurants` into `sanitizeGeneratedDay()` inside `supabase/functions/generate-itinerary/action-generate-day.ts`.
   - Keep the new parameter optional so other callers like `generation-core.ts` remain compatible without broader refactors.

5. **Rely on the existing hard guards once matching is fixed**
   - With stronger normalization, the current systems in:
     - `compile-prompt.ts`
     - `validate-day.ts`
     - `repair-day.ts`
     - `action-generate-trip-day.ts`
     should correctly recognize accent/case variants and stop repeats much more aggressively without changing self-chaining or restaurant-pool generation.

### Technical details
- **Files to edit**
  - `supabase/functions/generate-itinerary/generation-utils.ts`
  - `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
  - `supabase/functions/generate-itinerary/sanitization.ts`
  - `supabase/functions/generate-itinerary/action-generate-day.ts`
- **No changes**
  - no new files
  - no self-chaining architecture changes
  - no restaurant pool generation changes
  - no database changes

### Verification
- Generate a 4-day Lisbon trip and list all dining venues across all 4 days.
- Confirm **zero repeated canonical restaurant names**, including accent variants like `Fábrica` / `Fabrica`.
- Specifically confirm `Fábrica da Nata` appears at most once.
- If the AI still attempts a repeat, the logs should show the repeat warning and the existing validation/repair flow should catch it before persistence.
