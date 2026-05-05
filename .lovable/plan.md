## Goal

Stop unnamed wellness/spa items like "Private Wellness Refresh" ($261) and "Personalized Wellness Treatment" ($391) from reaching the user. The detection already exists in `fix-placeholders.ts` (`isPlaceholderWellness`) and the per-day repair path tries to swap them with real Paris/Rome/etc. venues — but items are still surfacing. We'll harden three layers so a wellness item without a real, named venue can never end up in the final itinerary with a non-zero cost.

## Why these still leak through

1. **Stage timing** — Smart Finish, weather-backup substitutions, and post-repair AI passes can introduce wellness items *after* `pipeline/repair-day.ts` runs for that day.
2. **No terminal sweep** — Dining has `nuclearPlaceholderSweep` running again in `universal-quality-pass.ts` Step 4b. Wellness has no equivalent last-mile catch.
3. **Cost-keeping** — When the per-day repair finds no fallback (e.g. unfamiliar city), it strips title/description but the *cost* may already have been written to `activity_costs` snapshot earlier. The user sees a $391 line for "Spa Time — find a venue".

## Changes

### 1. New terminal wellness sweep (`fix-placeholders.ts`)

Add a synchronous helper alongside `nuclearPlaceholderSweep`:

```ts
export function nuclearWellnessSweep(
  activities: any[],
  city: string,
  hotelName?: string,
): number
```

For each activity where `isPlaceholderWellness(act, city, hotelName)` is true:

1. Try `getRandomFallbackWellness(cityKey, usedSet)` — if hit, apply via `applyFallbackWellnessToActivity` (real venue + price). Stamp `act.source = 'wellness-nuclear-sweep-replaced'`.
2. Else if `hotelName` provided — downgrade to free `Spa Time at ${hotelName}`, cost forced to 0. Stamp `act.source = 'wellness-nuclear-sweep-downgraded'`. Mark `act.metadata.unverified_venue = true`.
3. Else — **strip the activity entirely** (filter out of array). High-cost-no-venue items must never ship. Log `[WELLNESS NUCLEAR] STRIPPED "<title>" — no venue, no hotel`.

Return number of items mutated/removed.

### 2. Wire the sweep into `universal-quality-pass.ts`

Right after the dining nuclear sweep at Step 4b (~line 172), call `nuclearWellnessSweep(result, city, hotelName)` and log the count. This guarantees every day passes through wellness sweep before the day is considered complete, regardless of which stage produced the item.

This requires `hotelName` — already available at the call sites (it's threaded through `processActivities` / quality-pass invocations). Plumb it as a new optional param on the existing `processActivities` signature; default to `undefined`. Existing callers pass it where they have it.

### 3. Pre-save guarantee in `generation-core.ts` / `action-save-itinerary.ts`

Before persisting the final `tripData.days`, walk every day's activities one last time and run the same `nuclearWellnessSweep`. This is belt-and-braces — if a future stage reintroduces a wellness placeholder, the save layer rejects it. The sweep mutates the array in place and returns count; if `count > 0`, log a warning with the trip id so we can spot regressions.

### 4. Cost guarantee — stop $391 phantom rows

In `action-repair-costs.ts` (and wherever activity costs are snapshotted into `activity_costs`), before writing a row check:

```ts
if ((category === 'wellness' || category === 'spa') &&
    isPlaceholderWellness(activity, city, hotelName)) {
  // Force $0; do not snapshot a cost for an unverified wellness slot.
  cost = 0;
  basis = 'unverified_venue';
}
```

Pair this with the existing `metadata.needs_venue_replacement` flag set in `sanitization.ts` line 1980 — treat that flag as another reason to force cost to 0.

This means if any future stage somehow lets the placeholder reach the save step, the *cost* still won't be charged to the budget — eliminating the misleading $652-in-one-session impact.

### 5. Tighten title patterns

Add two more patterns to `GENERIC_WELLNESS_TITLE_PATTERNS` in `fix-placeholders.ts`:

```ts
// Bare two/three-word titles like "Wellness Treatment", "Spa Refresh"
/^(wellness|spa)\s+(refresh|moment|break|session|time|experience|treatment|ritual|escape|visit)$/i,
// Adjective + noun without venue context, e.g. "Curated Spa Experience", "Bespoke Wellness Visit"
/^(curated|bespoke|signature|personalized|personalised|premium|luxury|private|exclusive)\s+(wellness|spa)\s+(visit|stop|appointment)\b/i,
```

These are belt-and-braces; the current patterns already match the two reported titles, but defending against minor variants is cheap.

### 6. Tests

Extend `fix-placeholders.test.ts` with cases covering:
- "Personalized Wellness Treatment" with empty venue — flagged.
- `nuclearWellnessSweep` with a Paris activity → replaced with a real Paris venue from the inline DB.
- `nuclearWellnessSweep` with no fallback DB hit + no hotel → activity removed entirely.
- Cost-snapshot path forces $0 when `metadata.needs_venue_replacement` is true.

## Files touched

- `supabase/functions/generate-itinerary/fix-placeholders.ts` — add `nuclearWellnessSweep`, extra title patterns.
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — invoke sweep at Step 4b.
- `supabase/functions/generate-itinerary/generation-core.ts` and/or `action-save-itinerary.ts` — final pre-save sweep.
- `supabase/functions/generate-itinerary/action-repair-costs.ts` — cost gate for unverified wellness/spa.
- `supabase/functions/generate-itinerary/fix-placeholders.test.ts` — tests.

## Memory update

Append a Core rule:

> **Wellness Venue Integrity:** Any wellness/spa activity must name a real venue from `INLINE_FALLBACK_WELLNESS` or live data. Placeholders are stripped or downgraded to free hotel-spa time before save; no unverified wellness item ever ships with a non-zero cost.

## Out of scope

- Expanding `INLINE_FALLBACK_WELLNESS` city coverage (separate content task; current strip-on-no-fallback behaviour is acceptable).
- Allowing the assistant to suggest a replacement spa from chat (future enhancement once stripping is in place).
