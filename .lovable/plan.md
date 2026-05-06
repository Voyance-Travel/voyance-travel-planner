# Eliminate "Breakfast — find a local spot" Placeholders

## Root Cause

Three paths can ship a "Meal — find a local spot" stub mid-itinerary, despite extensive guards:

1. **Thin city pools.** `INLINE_FALLBACK_RESTAURANTS` for Rome has only **2 breakfasts, 3 lunches, 3 dinners** — an unlucky generation can run dedup-blocked across days. Even with `ignoreUsed=true` on the recycling step, dining-config blocking and per-day `usedVenueNamesForInjection` propagation can still land us in TRY-4 ("unverified") when the fallback DB lookup fails for any reason. Several major cities (Berlin, Barcelona, London) have only 2 entries per meal too.
2. **Category-gated detection.** `isPlaceholderMeal()` early-returns when `category !== 'DINING' && category !== 'RESTAURANT'`. If the model emits a meal-shaped activity with category `"experience"`, `"food"`, or empty, the placeholder sweep skips it — even though the title matches every "Breakfast at a …" pattern.
3. **Self-shipped stub.** Both `fix-placeholders.ts > nuclearPlaceholderSweep` (line 516) and `day-validation.ts > injectMissingMeals` TRY-4 (line 1083) intentionally **write the literal string** `"<Meal> — find a local spot"` to the activity title and ship it with `needsRefinement = true`. That's a content gap by design when no fallback exists.

For a luxury product, an unnamed mid-trip meal is unacceptable. The fix is twofold: (a) **never ship that string** by guaranteeing a real-named fallback always exists, and (b) **detect more aggressively** so the meal sweep can't be bypassed.

## What to Build

### 1. Expand the Rome fallback pool (and pad other thin cities)
Bump every meal slot in `INLINE_FALLBACK_RESTAURANTS` to **6 breakfasts / 6 lunches / 6 dinners minimum** for the cities currently shipped (Rome, Berlin, Barcelona, London, Lisbon already at 3). Use real, well-known but local-leaning venues — e.g. for Rome breakfast: Sciascia Caffè, Roscioli Caffè, Marigold (Ostiense), Faro – Caffè Specialty, Antico Forno Roscioli, Tiramisù Zum, Pergamino Caffè, Caffè Sant'Eustachio.

### 2. Region-tier emergency fallback (no more "find a local spot")
Add `REGIONAL_EMERGENCY_BREAKFAST` / `LUNCH` / `DINNER` constants in `fix-placeholders.ts` keyed by country/region (`'italy'`, `'france'`, `'spain'`, `'germany'`, `'portugal'`, `'uk'`, `'usa'`, `'japan'`, `'mexico'`). When `getRandomFallbackRestaurant(city, …)` returns null, walk **city → country → continent → global "international café"** until SOMETHING real is returned. The chain should always terminate at a real, named, generally-applicable venue type ("Local Specialty Café — pick a verified spot from the map").

Replace the current TRY-4 block (`day-validation.ts:1081-1087`) and the corresponding nuclear path (`fix-placeholders.ts:512-540`) with a call to this new resolver. The literal string `"— find a local spot"` should never be assigned to `activity.title` again.

### 3. Detect placeholders regardless of category
In `isPlaceholderMeal()`:
- Drop the early-return on `category !== 'DINING'`.
- Detect by **title shape** first: if `MEAL_LABEL_RE` matches AND (no real venue name OR matches placeholder/stub patterns), it's a placeholder regardless of category.
- After detection, force `category = 'DINING'` so downstream pricing and rendering handle it correctly.

### 4. Surface the gap when it still happens (logging only — gap should be impossible after #2)
- Add a single observability log `[PLACEHOLDER_GAP] city=<x> meal=<y> reason=<z>` whenever the regional/global fallback chain is hit. Append to `cost_change_log` `notes` field optional — purely so we can monitor any thin-pool city.

### 5. Update the client mirror
- `src/utils/stubVenueDetection.ts > stubFallbackLabel` is the source of the "find a local spot" UI copy. Once the server can no longer ship that title, this util becomes a defensive last-line for legacy data only — leave the function in place but rename `STUB_VENUE_DISPLAY` copy to "Tap to choose a venue" so legacy itineraries get a clearer CTA.
- `EditorialItinerary.tsx` lines 11189 and 11586 currently render "Get a restaurant recommendation". When `__needs_meal_swap` / `needsRefinement` is true on a meal card with no venue, change the CTA to **"Pick a {breakfast/lunch/dinner} spot →"** and have it open the assistant pre-loaded with `Suggest a {meal} near {nearby activity}` instead of a generic prompt.

## Files to Modify
- `supabase/functions/generate-itinerary/fix-placeholders.ts` — expand `INLINE_FALLBACK_RESTAURANTS`, add `getRegionalEmergencyFallback()`, drop the literal-string TRY-4, broaden `isPlaceholderMeal()`.
- `supabase/functions/generate-itinerary/day-validation.ts` — replace TRY-4 with the regional-emergency resolver.
- `src/utils/stubVenueDetection.ts` — update `STUB_VENUE_DISPLAY` copy.
- `src/components/itinerary/EditorialItinerary.tsx` — improve the "Get a restaurant recommendation" CTA copy + assistant pre-fill when a meal slot is unverified.

## Files NOT changed
- The DNA / personalization / repair pipeline. The bug is purely in the fallback content & detection paths — generation logic is fine.

## Verification
- Generate 5 fresh Rome itineraries with random configurations. Inspect every breakfast/lunch/dinner card: zero "find a local spot" titles, zero unverified-meal markers.
- Generate one trip in a city with no fallback DB entry (e.g., Reykjavik) — meal slots should resolve to the regional emergency café (a real Iceland venue) rather than the literal stub.
- Existing trips with stored stub strings still render with the new CTA copy and a working assistant pre-fill.
