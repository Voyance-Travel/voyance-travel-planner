I found several restaurant deduplication layers, but there are two likely holes causing repeats to survive:

1. The chained `generate-trip-day` path builds `usedRestaurants` only from metadata, not robustly from the already-saved itinerary days. If metadata is stale, missing, or reset during retries, later days can reuse earlier restaurants.
2. The final meal guard can inject missing meals after deduplication, but it does not receive a trip-wide blocked restaurant set. That means a removed duplicate dinner can be reinserted from the same pool/verified fallback later.

Plan:

1. Strengthen restaurant history at the source
   - In `supabase/functions/generate-itinerary/action-generate-trip-day.ts`, derive a canonical `usedRestaurants` set from both:
     - `trip.metadata.used_restaurants`
     - all existing `itinerary_data.days[*].activities` dining entries
   - Extract from all venue-bearing fields: `title`, `name`, `venue_name`, `restaurant.name`, `location.name`.
   - Use the existing `extractRestaurantVenueName` + `venueNamesMatch` helpers so variants like `Dinner at X`, `X Restaurant`, and location-name-only versions match.

2. Pass restaurant pool and history into the deterministic repair pipeline
   - The current `repairDay` call in `action-generate-trip-day.ts` has fields for `restaurantPool` and `usedRestaurants`, but this call is not passing them.
   - Add them so duplicate dining validation can swap from the pool instead of keeping repeated primary meals.

3. Make the final meal guard trip-aware
   - Update `enforceRequiredMealsFinalGuard` in `day-validation.ts` to accept an optional blocked restaurant list.
   - When selecting fallback venues, skip anything matching blocked restaurants using the same canonical venue matching helpers.
   - Also seed the guard's internal used venue set with canonical location/name fields, not only raw activity titles.

4. Apply the guard fix in all callers
   - Update `action-generate-trip-day.ts`, `action-generate-day.ts`, `generation-core.ts`, and `action-save-itinerary.ts` call sites to pass known used restaurants where available.
   - For the chained full-trip save pass, update the blocked set as each day is processed so Day 3 cannot reuse a restaurant injected into Day 2 by the guard.

5. Add regression coverage
   - Add tests around `enforceRequiredMealsFinalGuard` proving it will not inject a fallback venue already used on prior days.
   - Add a repair-pipeline test proving duplicate primary meals are swapped when a replacement exists, rather than kept because meals are required.

6. Run the relevant tests
   - Run the edge function tests for the itinerary generation suite.
   - Run the frontend/unit tests if touched code affects shared TypeScript or UI behavior.