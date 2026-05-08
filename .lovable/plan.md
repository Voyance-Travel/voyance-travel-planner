## Root cause

`ledger-check.ts` lines 295–312 (vibe-clash branch): when two splurge dinners land back-to-back, the second day's dinner is "downgraded" by overwriting only `title`, `name`, `description`, and zeroing `cost.amount`. **Every other field on the card is left untouched** — `venue_name`, `location.name`, `location.address`, `restaurant.*`, `place_id`, `googleMapsLink`, photos, reservationUrgency, etc. So the UI renders:

- Title: "Casual neighborhood dinner"
- Venue chip / address / map link: "Ristorante Da Ivo, San Marco 1809"

Because no downstream code consumes `needsRecommendation` / `placeholder: true`, the placeholder is what the user sees forever.

## Fix (single file: `ledger-check.ts`)

### A. Fully strip venue identity on downgrade

When mutating `nextDinner`, also clear:

- `venue_name`, `venueName`
- `location` → reset to `{ name: null, address: null, lat: null, lng: null, place_id: null }` (or delete address/place_id keys)
- `restaurant` → delete (or null out `name`, `address`, `place_id`, `rating`, `photos`)
- `place_id`, `placeId`, `googleMapsLink`, `mapsUrl`, `mapsLink`
- `photos`, `photo_url`, `imageUrl`, `image_url`, `heroImage`
- `reservationUrgency`, `bookingUrl`, `viatorUrl`, any booking metadata
- `metadata.venue_*`, `metadata.michelin_*`, `metadata.cost_floor_reason`

This guarantees the card no longer carries the Da Ivo identity.

### B. Resolve a real casual venue immediately

`ledgerCheck` already receives `{ supabase, tripId }`. Pull the trip's `destination` once at the top of the function (single SELECT) and reuse for vibe-clash branches. Then:

```ts
import { resolveAnyMealFallback } from './fix-placeholders.ts';
const usedNames = collectUsedVenueNames(out); // walk all days, lower-cased
const fallback = resolveAnyMealFallback(destination, 'dinner', usedNames);
```

- If `fallback` returns a real venue (city-keyed, cross-city safe per existing fallback integrity rules):
  - `nextDinner.title = `Dinner at ${fallback.name}`;`
  - `nextDinner.name = fallback.name;`
  - `nextDinner.venue_name = fallback.name;`
  - `nextDinner.location = { name: fallback.name, address: fallback.address ?? null, lat: fallback.lat ?? null, lng: fallback.lng ?? null };`
  - `nextDinner.description = 'Pacing break after a splurge dinner the night before — relaxed local choice near the hotel.';`
  - `nextDinner.cost = { amount: fallback.priceEur ?? 45, currency: 'EUR', basis: 'fallback' };`
  - `nextDinner.placeholder = false;` `delete nextDinner.needsRecommendation;`
  - Mark `metadata.vibe_clash_downgrade = true` for observability.

- If pool is exhausted (cross-city/destination has no fallback):
  - `nextDinner.title = 'Casual dinner near your hotel — find a venue';`
  - `nextDinner.venue_name = null;` (keep cleared)
  - `nextDinner.cost = { amount: 0, currency: 'EUR', basis: 'unverified' };`
  - `nextDinner.needsVenuePick = true;` (matches existing unverified-sentinel pattern)

In both cases, the leftover Da Ivo identity is gone before save.

### C. Sentinel + warning

Update the existing `vibe_clash` warning to include resolution outcome:

- `Replaced "Dinner at Da Ivo" on day 3 with "Dinner at Trattoria alla Madonna" (vibe-clash downgrade after "Dinner at Da Ivo" on day 2).`
- Or `... downgraded to unverified placeholder (no fallback available).`

Add `console.warn('[VIBE_CLASH_DOWNGRADE]' …)` so we can grep logs.

### D. Regression guard

Extend `supabase/functions/generate-itinerary/ledger-check.test.ts`:

- Two splurge dinners back-to-back → tomorrow's card has NO trace of yesterday's Michelin venue (no `venue_name`, `location.address`, `place_id`, `googleMapsLink`, `restaurant.name`).
- When fallback DB has a Venice casual dinner → resolved title is `Dinner at <venueName>`, `cost.basis === 'fallback'`.
- When fallback exhausted → `needsVenuePick === true`, `cost.amount === 0`, `venue_name === null`.

### E. Memory

Add `mem://constraints/itinerary/vibe-clash-full-identity-strip.md` and reference it in the index. Document that any vibe-clash / placeholder downgrade MUST clear the full venue identity, not just the title.

## Out of scope

- The luminary "1–3 Michelin dinners" planning rule itself is fine; this fix only makes the downgrade clean.
- No DB migration. No prompt change. No UI change. Single backend file + 1 test + memory.