## Problem

A meal slot is rendering as a stub like **"Breakfast — find a local spot"** / **"Breakfast at a café near your hotel"** — no real venue name, no address, just a "go figure it out" affordance. Per the Meal Rules core memory ("Generic stub names BANNED — recycle real fallback-DB venues or mark slot unverified") this should never reach the UI in a paid product.

## Root cause

There are **three independent code paths** that can emit a generic meal stub today, and only one of them is fully guarded:

1. **Server generation** (`nuclearPlaceholderSweep` in `fix-placeholders.ts`) — works correctly. Detects placeholder meals and force-replaces them from `INLINE_FALLBACK_RESTAURANTS` (Paris/Rome/Berlin/Barcelona/London/Lisbon …). This path is fine.

2. **Client meal guard** (`src/utils/mealGuard.ts` → `enforceItineraryMealComplianceAsync`) — runs before save in `itineraryActionExecutor.updateTripItinerary` and `itineraryAPI.regenerateDay`. It tries `verified_venues` first, but when that table has no match for the city, it falls back to **generic strings** with empty addresses:
   - `"Breakfast at a café near your hotel"` / address `""`
   - `"Lunch at a neighborhood restaurant"` / address `""`
   - `"Dinner at a restaurant"` / address `""`
   This is the most likely source of what the user is seeing — it ships unguarded straight into the trip JSON.

3. **Client name sanitizer** (`src/utils/activityNameSanitizer.ts` → `stubFallbackLabel`) — when an AI stub venue ("Café Matinal", "Bistrot du Marché") slips through, it rewrites the title to `"Breakfast — tap to choose a venue"` instead of fixing it with a real venue. Cosmetic mask, not a fix.

All three need to use the same fallback DB the server already trusts.

## Plan

### 1. Share `INLINE_FALLBACK_RESTAURANTS` with the client

Extract the fallback restaurant pool (currently Deno-only inside `supabase/functions/generate-itinerary/fix-placeholders.ts`) into a plain TS module that both runtimes import:

- New file: `src/lib/fallbackRestaurants.ts` — exports `INLINE_FALLBACK_RESTAURANTS`, `resolveAnyMealFallback`, `parseMealType`, `regionalEmergencyFallback`. Pure data + pure functions, no Deno APIs.
- Update `supabase/functions/generate-itinerary/fix-placeholders.ts` to re-export from the shared module via a thin Deno wrapper (or duplicate the import path). Keep the server's existing `nuclearPlaceholderSweep` behavior identical.

This guarantees client and server agree on which venue names are "real" for a given city/meal.

### 2. Rewrite the client meal-guard fallback

In `src/utils/mealGuard.ts`:

- When `verified_venues` returns nothing for a meal slot, call `resolveAnyMealFallback(destination, mealType, usedNames)` instead of building `"Breakfast at a ${venueSuffix}"`.
- The injected activity now carries a real name (`"Le Nemours"`), real address (`"2 Pl. Colette, 75001 Paris"`), real description, real price, and `cost.source: 'meal_guard_fallback_db'`.
- Remove the `DESTINATION_MEAL_HINTS` / `getClientMealHint` generic-suffix branch entirely — it's the source of the bad string.
- Drop `needsRefinement: true` for fallback-DB venues; only keep it when even the regional emergency pool misses (extremely rare; in that case, mark the slot **unverified** with a clear "Tap to pick a restaurant" CTA rather than a fake venue suffix).

### 3. Replace the sanitizer's cosmetic mask

In `src/utils/activityNameSanitizer.ts`:

- When `isAIStubVenueName` fires on a meal slot, instead of returning `stubFallbackLabel(meal)` ("Breakfast — tap to choose a venue"), look up the activity's city + meal type and return a real venue name from the shared fallback DB.
- Sanitizer is sync; the fallback DB is sync; this works without an async refactor.
- If (and only if) no city context is available, keep `stubFallbackLabel` as the absolute last resort and tag the activity `needsVenuePick: true` so the UI can show an explicit "Pick a restaurant" button instead of a sad title.

### 4. Add a save-time guard mirroring the server

In `src/services/itineraryActionExecutor.updateTripItinerary` and `src/services/itineraryAPI.regenerateDay`, after the meal guard but before the DB write, run a small sweep that:

- Iterates each day's activities,
- Detects any meal whose title still matches a generic stub pattern (reuse `isAIStubVenueName` + the `PLACEHOLDER_TITLE_PATTERNS` set),
- Replaces it from the shared fallback DB.

This is the client mirror of `nuclearPlaceholderSweep`, so the "no generic meals in saved JSON" invariant holds regardless of which path produced the activity.

### 5. UI fallback for the truly-unverified case

In the activity card rendering layer, when an activity carries `needsVenuePick: true`, show a clear inline CTA ("Pick a restaurant") rather than treating the placeholder string as a normal title. This is a visual-only change; no business-logic shift.

### 6. Tests

- Extend `src/utils/__tests__/stubVenueDetection.test.ts` to assert that, given a city with fallback-DB coverage, the sanitizer returns a real venue name (not "tap to choose a venue").
- Add a unit test for `mealGuard` proving that, with `verified_venues` empty, a Paris breakfast injection ships with `name: "Le Nemours"` (or any real entry from the pool), not `"Breakfast at a café near your hotel"`.
- Add a regression test confirming the save-time sweep replaces a manually-injected stub.

## Files touched

- `src/lib/fallbackRestaurants.ts` — **new**, shared pool + resolver.
- `supabase/functions/generate-itinerary/fix-placeholders.ts` — re-export shared pool; behavior unchanged.
- `src/utils/mealGuard.ts` — drop generic-suffix fallback, use shared resolver.
- `src/utils/activityNameSanitizer.ts` — call shared resolver before falling back to "tap to choose".
- `src/utils/stubVenueDetection.ts` — keep only as last-resort label; flag `needsVenuePick`.
- `src/services/itineraryActionExecutor.ts` — add pre-save sweep.
- `src/services/itineraryAPI.ts` — add pre-save sweep in `regenerateDay`.
- `src/components/itinerary/ActivityCard*.tsx` (whichever renders the title) — render "Pick a restaurant" CTA when `needsVenuePick` is set.
- `src/utils/__tests__/stubVenueDetection.test.ts` and a new `src/utils/__tests__/mealGuard.test.ts`.

## Out of scope

- Surfacing the fallback DB as an editable admin table.
- Expanding city coverage beyond the existing six. (We can add cities incrementally — the architecture won't change.)
- Touching the wellness placeholder path (already uses the same pattern via `INLINE_FALLBACK_WELLNESS`; only flag if you want me to audit that next).
