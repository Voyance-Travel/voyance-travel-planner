## Goal

Finish step 4 of the cross-city wrong-venue hardening: filter `verified_venues` prefetch results so meal-guard fallbacks can never inject a venue from a different city. Then run the test suite and confirm everything passes system-wide (not just Venice).

## Background

Steps 1–3 already shipped:
- Client `fallbackRestaurants.ts` rewritten — REGIONAL/GLOBAL country pools removed, Venice pool added, returns `needsVenuePick` $0 sentinel rather than a foreign real venue.
- `preSaveMealSweep.ts` + `mealGuard.ts` honor the sentinel.
- Backend `enforceRequiredMealsFinalGuard` (in `day-validation.ts`) filters cross-city candidates from its `fallbackVenues` parameter.

Remaining gap: three backend action files prefetch from the `verified_venues` table with an `ilike('%city%')` query and pass the raw results into the guard. The `ilike` is loose (substring), so when a city name is a substring of another city or when stale rows have wrong `city`, foreign venues can still leak in. We need a destination-aware filter on every prefetch site before it reaches the guard.

## Changes

### 1. Add a shared cross-city filter helper for backend prefetches

New file: `supabase/functions/_shared/verified-venues-filter.ts`
- Exports `filterVenuesByDestination(venues, destination)` that drops any row where `detectCrossCityMention(name)` or `detectCrossCityMention(address)` flags a different city, using the existing `supabase/functions/generate-itinerary/cross-city-filter.ts` (already imported by `venue-enrichment.ts` and `day-validation.ts`).
- Logs each drop with `[verified-venues-filter]` for observability.

### 2. Wire the filter into the three prefetch sites

Files:
- `supabase/functions/generate-itinerary/action-generate-day.ts` (around line 1465, both the primary and broadened query branches)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (around line 1797 + broadened branch around 1809)
- `supabase/functions/generate-itinerary/action-generate-trip.ts` (the meal-guard fallback path noted in the warning at line 644 — confirm whether it also reads `verified_venues`; if so, filter there too)

For each: after the `venues` array is loaded (and after the broadened retry), pass it through `filterVenuesByDestination(venues, destQuery)` before mapping into `mealFallbackVenues`. If filtering empties the result, log a warning so the guard cleanly falls back to the unverified $0 sentinel rather than a wrong-city pick.

### 3. Defense-in-depth: also filter inside `_shared/venue-cache.ts`

`venue-cache.ts` is the shared read path (used by enrichment and other features). Add the same `detectCrossCityMention` guard inside its `getCachedVenue` / `getCachedVenuesForDestination` exits so any caller — current or future — gets a city-safe result. Drops are logged but not deleted from the table (deletion is out of scope; we just refuse to return them).

### 4. Tests

- New test `supabase/functions/_shared/__tests__/verified-venues-filter.test.ts` covering: Venice destination drops a Florence/Paris/SF address; Bologna destination drops Rome and Florence; same-city rows pass through; unknown destination is permissive.
- Extend `src/utils/__tests__/preSaveMealSweep.test.ts` with one system-wide loop that iterates `['Venice','Florence','Lisbon','Tokyo','New York']` × 3 meals × 10 trials and asserts no cross-city leak.
- Run `bunx vitest run` to confirm the existing suites (the meal-sweep + Venice regression cases just added) still pass after the prefetch changes.

## Out of scope

- No changes to AI prompts or generation cadence.
- No deletion or rewrite of `verified_venues` rows.
- No UI changes.
- No edits to `useTripFinancialSnapshot` / payments — that fix is already shipped.

## Acceptance

- `bunx vitest run` is green.
- Grep confirms every `from('verified_venues')` call in `supabase/functions/**` either flows through `filterVenuesByDestination` or `venue-cache.ts`'s new guard.
- Memory entry `mem://technical/itinerary/cross-city-fallback-integrity` is updated with the new prefetch-filter layer and the `verified_venues` defense-in-depth note.
