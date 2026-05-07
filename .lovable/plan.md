
## What's actually happening

Your Venice itinerary already has **164 cached Venice photos** in `curated_images` (103 google_places + 61 google_places_cached + 21 tripadvisor) — all stored in your Supabase storage bucket. Caching exists. The bug is that the **lookup misses** even though the photo is sitting right there, so the system pays Google again.

There are three concrete reasons a regeneration triggers fresh Google Photo calls instead of reusing what we already have:

### 1. Cache write key ≠ cache read key (the big one)

In `supabase/functions/destination-images/index.ts`:

- **Read** (line 1352): `checkCuratedCache(... entityType, cleanName, ...)` — uses the *cleaned* venue name (e.g. `"caffè florian"`).
- **Write** (line 1455): `cacheImage(... entityType, venueName, ...)` — uses the *original raw activity title* (e.g. `"breakfast at caff florian"`).

So the very first call writes a row keyed `breakfast at caff florian`. The second regeneration produces `"Morning coffee at Caffè Florian"` → cleans to `"caffè florian"` → looks up `caffè florian` → **miss** → Google call → write a *third* row keyed `morning coffee at caff florian`. Repeat forever.

This is exactly what's in your DB right now — same Florian photo stored under multiple verbose AI-generated titles.

### 2. Place-ID is the real identity, but we don't key on it

When Google returns a photo we already have a stable `place_id` (`ChIJk6IBp9eXfkcRkwd7q8UWAik` for Florian). Activities/attractions tables use it. But the curated_images cache key is the messy AI title. Two different titles → two Google calls for the same place.

### 3. Hero image goes through `getDestinationPOI` which returns different POIs

For destination hero, line 1704 picks an "iconic POI" (rotating list). On regen #1 it might pick "Doge's Palace", on regen #2 "Bridge of Sighs", on regen #3 "St Mark's Basilica" — each gets cached separately, and each rotation is a fresh Places + Photos call until that specific POI is in the cache.

Plus `useTripHeroImage` writes the picked URL back to `trips.metadata.hero_image` only if it isn't set — but only for that trip. A *new* Venice trip starts fresh and goes through the chain again.

---

## Plan

All changes are server-side in the image pipeline. No UI changes.

### Step 1 — Fix the read/write key mismatch in `destination-images/index.ts`

- In `fetchImageTiered`, write the cache row using `cleanName` (the same key used for reads), not the raw `venueName`.
- Additionally write a **second alias row** keyed by raw `venueName` only when it differs significantly, so legacy lookups still hit. (Cheaper alternative: don't bother — cleanName is canonical going forward.)
- Run a one-shot SQL migration to consolidate existing duplicate rows: for each `(destination, place_id)` group keep the newest row and rewrite its `entity_key` to the cleanName form. Delete the dupes.

### Step 2 — Add place_id-first lookup before any Google call

- Before TIER 2 (Google Places), if any prior cache row in the destination has a `place_id` whose canonical name fuzzy-matches `cleanName` (e.g. via `pg_trgm` similarity ≥ 0.6 on `entity_key` or `alt_text`), reuse that row's storage URL. This catches "Caffè Florian", "Cafe Florian", "Florian Caffè" → same place_id row.
- Add an index on `curated_images(destination, place_id)`.

### Step 3 — Stabilize the destination hero pick

- In `getDestinationPOI`, make the POI choice **deterministic per destination** (e.g. first POI by `popularity_score DESC, name ASC`) instead of rotating. One destination → one canonical hero POI → one cache row reused forever.
- Persist the resolved hero URL on `destinations.hero_image_url` (writeback already exists in `destinationImagesAPI.ts`; ensure the edge function also writes it on first resolution so anonymous users seed it too).

### Step 4 — Recent-lookup short circuit (the "have we looked this up in the last 6 months?" rule the user asked for)

Add an early guard in `fetchImageTiered`:

```ts
// Before any Google call, ask: has THIS destination resolved ANY image
// for a similar venue name in the last 180 days? If yes, reuse it.
```

Implementation: a single indexed query on `curated_images` filtered by `destination = $1 AND updated_at > now() - interval '180 days' AND (entity_key % $2 OR alt_text ILIKE $3)` using `pg_trgm`. Returns the highest-quality match. If found → reuse, log `[Images] 💰 6mo-window reuse hit`, zero cost.

### Step 5 — Add cost-saver telemetry

- Log every cache hit/miss with `{destination, key_used, source: 'curated' | 'place_id_alias' | '6mo_reuse' | 'shared_table' | 'google_places_fresh' | 'fallback'}`.
- Surface a dashboard query: count of `google_places_fresh` per destination per day. If Venice still shows fresh fetches after this lands, we know exactly which titles are slipping through.

### Step 6 — Validate

1. Run the consolidation migration (dry-run first, output how many rows collapse).
2. Deploy `destination-images` edge function.
3. Regenerate a Venice itinerary 3× and confirm log shows zero `google_places_fresh` hits and zero `Google Photos` cost-tracker increments after the first generation.
4. Repeat for a destination with no cache (e.g. Reykjavik) → confirm normal fresh fetch on regen #1, zero fresh on regen #2 and #3.

---

## Technical details

**Files touched**
- `supabase/functions/destination-images/index.ts` — fix write key, add place_id-first lookup, add 6-month reuse guard, deterministic POI pick.
- `supabase/functions/_shared/photo-storage.ts` — no change expected.
- New migration: 
  - Enable `pg_trgm` (probably already on).
  - `CREATE INDEX IF NOT EXISTS idx_curated_images_dest_place ON curated_images (destination, place_id) WHERE place_id IS NOT NULL;`
  - `CREATE INDEX IF NOT EXISTS idx_curated_images_dest_trgm ON curated_images USING gin (destination gin_trgm_ops, entity_key gin_trgm_ops);`
  - One-shot consolidation `UPDATE`/`DELETE` for duplicate Venice-style rows.

**What does NOT change**
- Hero image React hook fallback chain.
- Activity venue verification (`verifyVenueWithGooglePlaces`) still runs — that's a Places `searchText` call, not a Photo download, and it's already cached in `verified_venues` for 30 days.
- Generation pipeline contract is unchanged.

**Expected cost impact**
- Every Venice (and other already-warm destination) regeneration drops Google Photo calls to ~0.
- New destinations cost the same on the first generation, ~0 on every subsequent regeneration for 60-180 days.
