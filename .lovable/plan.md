# Wrong-City Hero Image — Madrid photo on Barcelona trip

## What's actually happening

Trip `66b74263…` (destination: Barcelona) has `metadata.hero_image` pointing at `site-images/photo-1539037116277-4db20889f2d4` — which is **Madrid's** canonical hero in the `destinations` table. The other two Barcelona trips correctly persist `destination-images/destination/barcelona-1.jpg`.

So one trip's hero was once written with Madrid's URL (likely a stale write before destination was edited, or an earlier canonical bug) and the **seeded tier** in `useTripHeroImage` happily returns it forever because the only guard on seeded URLs is `isUntrustedHeroUrl` — which checks host + people-content slugs, **not** whether the photo's city matches the trip's destination.

The canonical row for `Barcelona` in `destinations.hero_image_url` is `photo-1583422409516-2895a77efed6`. That's a separate question (it may also be wrong — needs visual QA) but it's not what's rendering for this user; the persisted trip metadata short-circuits the resolver at tier 1.

## Fix — two layers + one-time purge

### 1. Cross-city guard at the seeded/canonical tier (`src/hooks/useTripHeroImage.ts`)

Today `detectCrossCityMention` only runs on the API tier's `alt` text. Extend it to the **seeded** and **canonical** tiers using a URL→city map we already have visibility into:

- Build a small `urlCityHint(url)` helper that extracts the photo-id slug from `site-images/photo-XXXX…` and looks up which destination row's `hero_image_url`/`stock_image_url` points at that exact slug. If the hinted city ≠ the trip's destination city, treat the URL as broken (advance past tier).
- Wire it into `isBrokenSeededUrl(url, destination)` and into the `canonicalUrl` validation in the canonical effect (line ~148) and the seeded short-circuit (line ~252).
- Sentinel: `console.warn('[useTripHeroImage] cross-city hero blocked dest="…" hintedCity="…" url=…')`.

This is implemented client-side as a one-shot lookup on mount (cached in module scope so it doesn't re-query per render). For the steady-state case where the destinations row matches, it's a no-op.

### 2. Persistence write-back gate (same file, write-back effect ~L297)

Before the `update({ metadata.hero_image })` fires, re-run the same cross-city check on the URL we're about to write. If it fails, skip the write. Closes the loop so future canonical/db_curated drift can't repoison metadata.

### 3. One-shot SQL purge for already-poisoned trips

Clear `metadata.hero_image` from any trip where the persisted URL's photo-id slug belongs to a different destination than `trips.destination`. Conservative — only clears confirmed mismatches; the resolver will repopulate on next view.

```text
UPDATE trips t
SET metadata = t.metadata - 'hero_image'
WHERE EXISTS (
  SELECT 1 FROM destinations d
  WHERE (t.metadata->>'hero_image') LIKE '%' || split_part(d.hero_image_url, '/', -1) || '%'
    AND lower(d.city) <> lower(split_part(t.destination, ',', 1))
);
```

### 4. Memory entry

Add `mem://constraints/visual/hero-cross-city-guard` — the resolver MUST cross-check the photo's city hint against the trip's destination at every tier (seeded, canonical, db_curated, storage), not just the API tier's alt text.

## What this does NOT touch

- The canonical row for Barcelona itself (`photo-1583422409516-…`) — visual QA is a separate ticket. If it's also wrong, the admin curation flow + curated_images vote_score handles it; the guard here ensures it at least can't leak onto a non-Barcelona trip.
- Other tiers (curated storage map, gradient) — those are already city-keyed by slug at lookup time and can't cross-leak.

## Verification

- Reload trip `66b74263…` → hero falls through to `destination-images/destination/barcelona-1.jpg` (storage tier).
- Re-query `SELECT id, metadata->>'hero_image' FROM trips WHERE destination='Barcelona'` → all three rows match Barcelona's canonical or storage hero.
- Unit test in `src/hooks/__tests__/useTripHeroImage.test.ts`: seeded URL = Madrid's photo-id + destination = "Barcelona" → resolver advances to next tier, write-back skipped.
