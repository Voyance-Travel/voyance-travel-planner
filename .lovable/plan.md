## Goal
Stop real restaurants from the wrong city/country from being inserted into itineraries, especially Venice runs showing Paris/SF/Florence venues.

## Root cause found
There are still client-side fallback pools that explicitly use country/global emergency restaurants:
- Italy emergency lunch: `All'Antico Vinaio` in Florence
- Global breakfast: `Tartine Bakery` in San Francisco
- Global dinner: `Le Comptoir du Relais` in Paris

The server fallback has been partially hardened, but the client mirror (`src/lib/fallbackRestaurants.ts`) still guarantees a real venue by falling through to regional/global venues. Several save/meal-guard paths can therefore persist a famous but foreign restaurant. The backend meal guard also accepts pre-fetched fallback venues without a cross-city filter before injection.

## Plan
1. **Harden the shared client fallback resolver**
   - Replace regional/global emergency behavior in `src/lib/fallbackRestaurants.ts` with city-matched fallback only.
   - If no city-matched venue exists, return a `$0` `needsVenuePick` sentinel instead of any foreign real venue.
   - Add Venice city-specific fallback entries mirroring the vetted server Venice pool so Venice never exhausts into Florence/Paris/SF.

2. **Add cross-city guards to client meal save paths**
   - Update `preSaveMealSweep` and `mealGuard` so they respect `needsVenuePick` sentinels: no paid cost, no false “real venue” treatment.
   - Add a client-side cross-city check for known city tokens in addresses/names before applying a fallback.

3. **Harden backend final meal guard injection**
   - In `day-validation.ts`, filter `fallbackVenues` by destination before using them.
   - Reject candidates whose address/name mentions another known city for that destination.
   - When no safe local candidate exists, use the existing server `resolveAnyMealFallback` sentinel path rather than forcing global real venues.

4. **Tighten verified venue prefetches**
   - In `action-generate-day.ts`, `action-generate-trip-day.ts`, and `action-save-itinerary.ts`, filter fetched venue candidates through the same destination-safe guard before passing them to the meal guard.
   - Keep this scoped to dining fallback injection only.

5. **Regression tests**
   - Update existing tests that currently expect country/global real fallbacks for uncovered cities.
   - Add explicit Venice tests proving `All'Antico Vinaio`, `Tartine Bakery`, and `Le Comptoir du Relais` cannot be returned or injected for Venice.
   - Add a backend meal-guard test proving wrong-city fallback candidates are ignored.

## Out of scope
- No itinerary UI redesign.
- No prompt rewrites.
- No regeneration/backfill of existing trips unless requested separately.