
Two breakfast issues, two fixes.

## Issue 1 — Day 1 has no breakfast on morning arrivals

`meal-policy.ts:143` only requires breakfast on Day 1 if `arrivalMins < 540` (i.e. before 9:00 AM). Most "morning arrivals" (9:00–12:00) drop straight into lunch + dinner.

**Fix:** raise the threshold to `arrivalMins < 630` (10:30 AM). Travelers arriving before 10:30 AM still have a real morning window for a café/coffee + croissant before checking in. After 10:30, keep current behavior (lunch + dinner only).

```ts
// meal-policy.ts ~line 143
const meals: RequiredMeal[] = arrivalMins < 630
  ? ['breakfast', 'lunch', 'dinner']
  : ['lunch', 'dinner'];
```

This keeps late-morning arrivals realistic (no forced breakfast at 11:30) but covers genuine early arrivals.

## Issue 2 — "Café Matinal" placeholder reached the user

Two emergency code paths ship stub names instead of real venues:

- `fix-placeholders.ts:269–296` — `GENERIC_VENUE_TEMPLATES` ("Café Matinal", "Bistrot du Marché", …) used by `nuclearPlaceholderSweep` when `getRandomFallbackRestaurant` returns null.
- `day-validation.ts:1066–1088` — TRY 3 falls to the same template pool, then to a hardcoded `emergencyNames.breakfast = 'Café Matinal'`.

For supported cities (Paris, Rome, Berlin, Barcelona, London, Lisbon) this should never trigger — but it does when the per-day `usedNames` Set overlaps the pool too aggressively, or when blocked-restaurants seeding exhausts the pool.

**Fix:** make both emergency paths recycle a real venue from the fallback DB before ever using a generic template name.

### A. `fix-placeholders.ts` — `nuclearPlaceholderSweep`

Already calls `getRandomFallbackRestaurant(..., ignoreUsed=true)` — but if the city isn't in the inline DB, falls to template. Add a second pass: if the template would name "Café Matinal" / "Bistrot du Marché" / etc., refuse and instead leave the activity flagged with `__needs_breakfast_swap = true` and mark `description` with a clear "We couldn't find a verified breakfast spot here — tap to suggest one." string. This keeps the UI honest rather than fake.

### B. `day-validation.ts` — TRY 3

Replace the GENERIC_VENUE_TEMPLATES fallback + hardcoded emergency block (lines 1066–1088) with:

```ts
// TRY 3: Recycle a fallback DB venue (allow repeats) before any generic template
if (!venueName) {
  const recycled = getRandomFallbackRestaurant(destination, mealType, new Set(), /*ignoreUsed*/ true);
  if (recycled) {
    venueName = `${label} at ${recycled.name}`;
    venueAddress = recycled.address || `${recycled.name}, ${destination}`;
    venueDescription = recycled.description || `${label} at ${recycled.name}`;
    usedRealVenue = true;
    console.warn(`[MEAL FINAL GUARD] Day ${dayNumber}: Recycling fallback DB venue "${recycled.name}" for ${mealType} (pool exhausted with unique names)`);
  }
}

// TRY 4 (true last resort, only if city has no DB at all): mark as unverified
if (!venueName) {
  venueName = `${label} — find a local spot`;
  venueAddress = destination;
  venueDescription = `We couldn't verify a ${mealType} venue in our local database. Tap to ask the assistant for a suggestion.`;
  console.error(`[MEAL FINAL GUARD] Day ${dayNumber}: NO fallback DB for ${destination} — left unverified slot for ${mealType}`);
}
```

This eliminates "Café Matinal" / "Bistrot du Marché" as user-visible names entirely.

### C. Deprecate `GENERIC_VENUE_TEMPLATES` (defensive)

Keep the export (test depends on it) but stop calling it from `nuclearPlaceholderSweep`. Replace template-pool use there with the same recycle-or-mark-unverified pattern. Add a comment marking the export deprecated.

## Files

- `supabase/functions/generate-itinerary/meal-policy.ts` — raise breakfast threshold to 10:30 AM
- `supabase/functions/generate-itinerary/day-validation.ts` — replace TRY 3 emergency block with recycle-then-unverified
- `supabase/functions/generate-itinerary/fix-placeholders.ts` — `nuclearPlaceholderSweep` no longer falls to templates; uses recycle-or-mark-unverified
- `mem://core` — update Meal Rules entry: "Arrival day breakfast required if arrival < 10:30; emergency template names ('Café Matinal' etc.) banned — recycle real venues."

## Out of scope

- No new fallback DB entries (Paris already has 10 breakfasts).
- No re-rendering of existing trips — applies to next regen only.
- Dinner / lunch fallbacks unchanged (same pattern works for them; same fix applies because both code paths handle all meal types — the fix is mealType-agnostic).

Approve?
