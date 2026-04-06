
Goal: make Michelin floor enforcement deterministic, observable, and truly final so Eleven/Belcanto cannot slip through on either itinerary cards or the Payments data.

What I found
- `FINE_DINING_MIN_PRICE_BY_STARS` does not exist.
- `knownFineDiningStars` does not exist.
- The current code uses regex buckets in `sanitization.ts`:
  - `KNOWN_MICHELIN_HIGH`
  - `KNOWN_MICHELIN_MID`
  - `KNOWN_UPSCALE`
  - `MICHELIN_FLOOR = { high: 180, mid: 120, upscale: 60 }`
- `eleven` is already present, but only as a regex token, not as explicit aliases like `eleven restaurant`.
- The floor logic is duplicated inline in two places:
  - `supabase/functions/generate-itinerary/sanitization.ts`
  - `supabase/functions/generate-itinerary/action-repair-costs.ts`
- There is no single `enforceFineDiningPriceFloor` helper and no top-level `MICHELIN FLOOR CHECK` log.
- The day-chain does a lot of mutations after `sanitizeGeneratedDay()`:
  - `action-generate-day.ts` continues through enrichment, validate/repair, persist, meal guard
  - `action-generate-trip-day.ts` then does trip-level post-processing before final save
- So the current floor runs early, not at the true final stage.
- The prompt already has Michelin pricing rules, but not the explicit Eleven/Belcanto examples from your latest prompt.

Likely root cause
- The Michelin logic is scattered, regex-based, and not rerun on the final activity objects after later post-processing.
- Matching is too coarse because it uses broad regex groups instead of an explicit restaurant -> star map with aliases.
- Because there is no dedicated helper/log, it is hard to prove at runtime whether the floor executed and matched the final title/venue.

Implementation plan
1. Replace the coarse regex-only Michelin tiering with a shared explicit star map
- In `sanitization.ts`, keep the existing exports for compatibility if needed, but introduce a canonical shared map:
  - `belcanto: 2`
  - `alma: 2`
  - `eleven: 1`
  - `eleven restaurant: 1`
  - `feitoria: 1`
  - `feitoria restaurant: 1`
  - `cura: 1`
  - `loco: 1`
  - `fifty seconds: 1`
  - `eneko: 1`
  - `il gallo d'oro: 1`
  - `ocean: 2`
  - `vila joya: 2`
  - `the yeatman: 2`
- Add per-star floors:
  - 1-star = 120
  - 2-star = 180
  - 3-star = 250
- Keep a fallback non-star fine-dining floor for upscale venues.

2. Create one shared helper and use it everywhere
- Add a shared helper in `sanitization.ts`, e.g. `enforceMichelinPriceFloor(activity, logPrefix?)`.
- The helper should:
  - log `MICHELIN FLOOR CHECK` at entry for dining activities
  - resolve price from all supported fields
  - match aliases against title, venue name, restaurant name, and normalized meal titles
  - fall back to explicit Michelin/star keywords if present
  - write the corrected floor back to all price field shapes
  - log:
    - `MICHELIN FLOOR MATCH`
    - `MICHELIN PRICE FLOOR ENFORCED`

3. Replace duplicated inline logic with the shared helper
- Update `sanitization.ts` to remove the inline underpricing block and call the helper instead.
- Update `action-repair-costs.ts` to use the same helper logic for `activity_costs` instead of maintaining a second copy.
- Preserve `deduplicateEveningFineDining` exactly as-is.

4. Run the Michelin floor at the actual last pricing stage
- In `action-generate-day.ts`, run the shared helper after the meal guard and other post-processing, immediately before returning the day.
- In `action-generate-trip-day.ts`, run the same helper over the final `updatedDays` before saving the trip snapshot, since this file still performs last-minute trip-level mutations.
- This makes the final JSON itinerary authoritative even if a later step renamed or replaced a dining venue.

5. Tighten the prompt without removing the existing rules
- Update `pipeline/compile-prompt.ts` by extending the existing Michelin rules with explicit examples:
  - Eleven Restaurant in Lisbon must be >= €120/pp
  - Belcanto and Alma must be >= €180/pp
- Keep the single-dinner-per-evening language already present.

Files to update
- `supabase/functions/generate-itinerary/sanitization.ts`
- `supabase/functions/generate-itinerary/action-repair-costs.ts`
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

Verification
- Generate a 4-day Lisbon trip.
- Confirm in the itinerary itself:
  - Eleven >= €120/pp
  - Belcanto >= €180/pp
- Confirm in Payments / `activity_costs`:
  - same floors are preserved there too
- Confirm logs show:
  - `MICHELIN FLOOR CHECK`
  - `MICHELIN FLOOR MATCH`
  - `MICHELIN PRICE FLOOR ENFORCED`
- Confirm no regression to the existing evening fine-dining dedup behavior.

Technical note
- I would not anchor this fix on `generation-core.ts` first, because the live full-trip flow now goes through the day-chain (`generate-trip` -> `generate-trip-day` -> `generate-day`). The authoritative fix should target that path and the shared repair path.
