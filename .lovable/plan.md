## Problem

Day 2 of the active Venice luxury trip renders without an evening meal even though the meal guard fired. DB inspection of trip `38f81fab…` Day 2:

```
19:55 dining   Dinner at Dinner — pick a restaurant
```

This is the `GLOBAL_EMERGENCY_FALLBACK.dinner` sentinel from `supabase/functions/generate-itinerary/fix-placeholders.ts` (line 247) — a `needsVenuePick: true` stub that:

- Is masked by frontend sanitizers (`src/utils/activityNameSanitizer.ts`, `preSaveMealSweep.ts`) so it renders as "no venue" / hidden in some surfaces.
- Has `cost.amount = 0`, address `""`, no venue, no booking — so it visually disappears in dense day cards and budget rows.

To the user, Day 2 is "missing dinner entirely". Same root cause is hitting Day 2 breakfast (`Breakfast at Breakfast — pick a café`) and Day 3 lunch in this trip, and is broadly responsible for many "missing meal" complaints across cities not in `INLINE_FALLBACK_RESTAURANTS`.

## Root cause

`enforceRequiredMealsFinalGuard` (day-validation.ts §TRY 1-4) cascades:

1. `verified_venues` table → `INLINE_FALLBACK_RESTAURANTS` city pool → `INLINE_FALLBACK_RESTAURANTS` recycled pool → `regionalEmergencyFallback(city)` → `GLOBAL_EMERGENCY_FALLBACK`.
2. `regionalEmergencyFallback` accepts a city string and resolves the country via `CITY_COUNTRY_MAP`. Venice → italy → "Trattoria Sostanza" should be emitted.

The cascade is failing for two reasons:

### A. Destination string is lost before the guard runs

`action-save-itinerary.ts` line 303:
```ts
const destination = day.city || day.destination || 'the destination';
```
`day.city` and `day.destination` are not populated in the per-day shape that the save pipeline sees (trip-level `trips.destination` is). When `destination === 'the destination'`:

- `verified_venues` query is skipped (line 311 guard).
- `getRandomFallbackRestaurant('the destination', …)` returns `null` (no key match).
- `regionalEmergencyFallback('the destination', …)` falls through every entry in `CITY_COUNTRY_MAP` → returns `GLOBAL_EMERGENCY_FALLBACK` → emits the "Dinner — pick a restaurant" sentinel that looks like nothing to the user.

`action-generate-day.ts` and `action-generate-trip-day.ts` have similar pathways but get `destination` from a richer context, so this primarily affects the **save-side guard** (where the bug for the Venice trip surfaced).

### B. Venice (and many secondary cities) has no city-level fallback pool

`INLINE_FALLBACK_RESTAURANTS` only holds Paris, Rome, Berlin, Barcelona, London, Lisbon. Venice, Marrakech, Chengdu, Scottsdale, Palm Beach etc. all skip directly to `regionalEmergencyFallback`. When (A) is fixed, Venice → italy → Trattoria Sostanza will at least be a real venue — but it's a Florence dinner spot served as Venice's emergency. Acceptable as a *true* last resort, but not great for a luxury trip.

### C. The "Dinner at Dinner — pick a restaurant" double-label

`day-validation.ts` line 1094:
```ts
title: venueName!.startsWith(label) ? venueName! : `${label}: ${venueName}`,
```
When the GLOBAL sentinel `"Dinner — pick a restaurant"` is wrapped at line 1056 as `"Dinner at Dinner — pick a restaurant"` (resolveAnyMealFallback path emits the bare name; TRY 1/3/4 prepend `${label} at`), the duplicated "Dinner" leaks through visibly.

## Fix

### 1. Always pass a real destination into the meal guard

In `action-save-itinerary.ts` (and audit `action-generate-day.ts`, `action-generate-trip-day.ts`) — when computing `destination` for the guard, prefer the trip-level destination already loaded above the day loop:

```ts
const destination =
  day.city ||
  day.destination ||
  trip?.destination ||           // fall back to trip-level
  'the destination';
```

Add an assertion log when we still hit `'the destination'` so we catch any remaining gap in CI.

### 2. Add a regional pool for "luxury / Italy / Venice-tier" cities

Extend `REGIONAL_EMERGENCY_FALLBACK.italy` so its `dinner` entry is upgraded for Venice-context (or add a new top-level Venice pool with 4-6 vetted dinners — Osteria alle Testiere, Trattoria Da Romano, Antiche Carampane, Al Covo, Vini da Gigio, Venissa). Even one real Venice dinner in the city pool means the sentinel never fires for this destination again.

This is content-only and unblocks the active reproduction.

### 3. Eliminate the "Dinner at Dinner — pick a restaurant" double-label

In `day-validation.ts` line 1094, dedupe consecutive label words:

```ts
const rawTitle = venueName!.startsWith(label) ? venueName! : `${label}: ${venueName}`;
const title = rawTitle.replace(new RegExp(`^${label}\\s+at\\s+${label}\\b`, 'i'), `${label} —`);
```

So even if a `needsVenuePick` sentinel does survive, it reads `"Dinner — pick a restaurant"` without the doubled token.

### 4. Guarantee a visible dinner card

Two cheap defensive measures so a "needsVenuePick" placeholder never disappears silently in the UI:

- **Frontend (`src/utils/activityNameSanitizer.ts` + `preSaveMealSweep.ts`)**: when a meal slot has `needsVenuePick === true`, render a *visible* "Dinner — tap to pick a spot" pill with an explicit CTA to open the assistant. Today the sanitizer masks it down to nothing in dense day cards — that's why the user perceives "no dinner".
- **Editorial day card**: render a single-line amber placeholder card for `needsVenuePick` meals (mirroring the existing dead-gap nudge). Always visible. Counts as a "dinner exists" structurally, but visually flags itself as needing input.

### 5. Sweep existing trips that already have the sentinel

Run a one-time SQL update mirroring the prior ghost-activity scrub: for any persisted `*  — pick a restaurant` / `* — pick a café` activity, re-run `resolveAnyMealFallback` (or, in pure SQL, swap the title for the country-level emergency entry from a small mapping table). Skips locked / user-edited rows. Verify with the same query used in this investigation.

## Verification

- After edits: re-open the Venice trip, confirm Day 2 dinner renders with a real restaurant card (not the sentinel) and that breakfast and Day 3 lunch are real venues too.
- DB query: `select count(*) from trips, jsonb_array_elements(...) where title ilike '%pick a restaurant%' or title ilike '%pick a café%'` → should be 0 after scrub.
- Existing tests: `meal-policy.test.ts` and `fix-placeholders.test.ts` still pass; add a new test asserting that for Venice + dinner, `resolveAnyMealFallback` never returns `needsVenuePick: true`.

## Out of scope

- Wider expansion of `INLINE_FALLBACK_RESTAURANTS` to more cities (separate content task).
- Tying meal-guard output to live Google Places lookups for unverified destinations (architecture change).
