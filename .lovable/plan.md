

## Pre-Generate a Restaurant Pool Per City Before Day Generation

### Why the current approach fails

The AI is asked to simultaneously: plan activities, route between them, manage timing, AND pick unique real restaurants — all in one massive prompt. By day 5+, the "avoid these venues" list grows long and the AI takes the lazy path: "dinner spot", "local restaurant". The meal guard then fires but only has `verified_venues` (a cache of previously seen venues) as fallback — which may be empty for new destinations.

The core issue: **we're asking the AI to do restaurant discovery inside the itinerary prompt**, when we should be handing it a pre-curated menu of real restaurants to pick from.

### The fix: Restaurant Pool Pre-Generation

Before generating any days, make one dedicated AI call per city: "Give me 40+ real restaurants in [city] rated 4.5+, categorized by meal type and cuisine." Store these in a `restaurant_pool` that every day-generation call draws from.

### How it works

**1. New stage in the generation pipeline (`index.ts`, ~line 5915)**
- After building the system prompt but before day generation begins
- For each city in the trip, call a lightweight AI prompt:
  ```
  "List 40 real, highly-rated restaurants in [city] for a [budget] traveler.
   Include 10+ breakfast spots, 15+ lunch spots, 15+ dinner spots.
   For each: name, cuisine type, neighborhood, price range, one-line description.
   Only real restaurants that currently exist. 4.5+ stars preferred."
  ```
- Parse the response into a typed array and attach to the generation context as `restaurantPool`
- Also cache results in `verified_venues` for future trips

**2. Pass the pool into every day prompt (`index.ts` + `action-generate-trip-day.ts`)**
- Instead of saying "pick a restaurant", say "PICK FROM THIS LIST" with the pool filtered to exclude already-used names
- The AI's job becomes selection + scheduling, not discovery
- This is a much simpler task that the AI handles reliably even on day 10

**3. Update the meal guard to draw from the pool (`day-validation.ts`)**
- Replace the current `fallbackVenues` (from `verified_venues` query) with the pre-generated pool
- The guard always has 30+ real options to choose from, never falls back to generic text
- Remove the generic `DESTINATION_MEAL_HINTS` entirely — there's no scenario where we don't have real names

**4. Track used restaurants across days**
- Maintain a `usedRestaurants: Set<string>` in the generation context
- After each day is saved, add its dining venues to the set
- Pass the filtered (unused) pool to the next day
- This guarantees uniqueness without bloating the prompt with "avoid" lists

### Files to change

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add restaurant pool generation stage (~Stage 1.95); pass pool into day generation context; track used restaurants across days |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Accept restaurant pool from context; inject filtered pool into day prompt; mark used restaurants after generation |
| `supabase/functions/generate-itinerary/day-validation.ts` | Meal guard draws from restaurant pool instead of `verified_venues` query; remove generic fallback text entirely |

### Cost impact

One extra AI call per city (small prompt, ~500 tokens out). For a 3-city trip that's 3 calls. This replaces the current pattern of the AI failing + retrying + meal guard firing + injecting placeholders, so net cost is likely neutral or lower.

### Expected outcome

- Zero "dinner spot" / "lunch spot" / "breakfast spot" placeholders — ever
- Every meal is a real, named restaurant with cuisine and neighborhood
- Restaurant uniqueness is guaranteed by pool tracking, not prompt bloat
- Later days generate just as reliably as early days because the prompt stays the same size
- The meal guard becomes a safety net that always has real options, not a last resort generating generic text

