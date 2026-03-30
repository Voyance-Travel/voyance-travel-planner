
Root cause: this is not one issue, it is 3 compounding issues in the restaurant pipeline.

1. Pool sizing is too small
- In `action-generate-trip.ts`, the pool size is capped at 24:
  - `mealsNeeded = totalDays * 3`
  - `requestCount = Math.min(mealsNeeded + 6, 24)`
- So for a 6-day trip needing ~12–18 meals, we are often generating far too little slack after filtering, city splits, meal-type balancing, chain removal, and duplicates.
- That means the system is not actually giving itself the surplus it needs.

2. The prompt only exposes a small slice of the pool
- In `pipeline/compile-prompt.ts`, even when more venues exist, the AI only sees:
  - 8 breakfast
  - 8 lunch
  - 8 dinner
  - 6 flexible
- If the pool is weakly distributed by meal type, the usable visible list gets even smaller.
- So “we generated a pool” does not mean the model had enough distinct options in the prompt.

3. Used-restaurant tracking is inconsistent
- `action-generate-trip-day.ts` stores `used_restaurants` from dining activity titles after stripping only `Breakfast|Lunch|Dinner:`
- But many titles are formatted like:
  - `Lunch at X`
  - `Dinner - X`
  - `Breakfast at a café`
- Meanwhile filtering against the pool compares `used_restaurants` to raw venue names.
- That mismatch means a used restaurant often does NOT get recognized as used.
- Same bug exists in repair/swap logic: `repair-day.ts` seeds `usedSet` from full activity titles, not normalized venue names.

Why duplicates are still happening
- The AI may already pick the same place twice because the visible option set is too small.
- Validation catches some repeats, but repair swaps from a `usedSet` built from titles rather than actual venue names.
- Meal guard also filters with the same weak used-name logic.
- Result: the same restaurant can slip through multiple layers because each layer is comparing different string formats.

What I would change

1. Make the pool large enough
- Replace the hard cap logic in `action-generate-trip.ts`.
- Generate based on actual required meal count with real surplus, e.g.:
  - target per city = required meals for that city + 12 to 18 extra
  - also enforce per-meal minimums so breakfast/lunch/dinner each have healthy depth
- For multi-city trips, size per city instead of using global `totalDays * 3`.

2. Normalize restaurant identity everywhere
- Create one shared helper for restaurant identity, based on venue name only.
- Strip meal prefixes like:
  - `Breakfast:`
  - `Lunch:`
  - `Dinner:`
  - `Breakfast at`
  - `Lunch at`
  - `Dinner at`
- Then run through `normalizeVenueName(...)`.
- Use this same normalization in:
  - `action-generate-trip-day.ts` when writing `used_restaurants`
  - `compile-prompt.ts` when filtering available pool entries
  - `repair-day.ts` when swapping duplicates
  - meal guard fallback construction in both `action-generate-day.ts` and `action-generate-trip-day.ts`

3. Store structured used restaurants, not just freeform titles
- Keep `used_restaurants`, but make it venue-name-based only.
- Optionally add a richer structure like:
  - `used_restaurant_venues: [{ name, normalizedName, dayNumber, mealType }]`
- That makes de-dup deterministic instead of text-fragile.

4. Strengthen prompt exposure
- In `compile-prompt.ts`, stop slicing so aggressively if the pool is large.
- Show a larger candidate set per meal type, especially for longer trips.
- Add explicit rule:
  - never reuse any restaurant already listed in blocklist
  - never reuse the same venue for multiple meals in one trip unless explicitly user-requested

5. Fix repair-day swap logic
- In `repair-day.ts`, when a dining duplicate is detected, compare replacement candidates against normalized venue names only.
- Do not seed `usedSet` from full dining titles.
- Also exclude venues already present elsewhere in the current day by normalized `location.name`.

6. Add diagnostics so this never goes invisible again
- Log per run and per day:
  - pool size by city
  - pool size by meal type
  - visible candidates sent to prompt
  - normalized used restaurant count
  - duplicate swaps attempted / succeeded / failed
- If available unique restaurants for a city falls below required count + buffer, log a hard warning.

Files to update
- `supabase/functions/generate-itinerary/action-generate-trip.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- likely `supabase/functions/generate-itinerary/generation-utils.ts` for shared restaurant-name normalization

Expected result
- The system generates materially more restaurant candidates per city.
- Every layer uses the same canonical restaurant identity.
- Previously used restaurants are actually blocked.
- Duplicate meal swaps become reliable instead of cosmetic.
- If a city genuinely lacks enough unique candidates, we see that clearly in logs instead of discovering it from repeated restaurants later.
