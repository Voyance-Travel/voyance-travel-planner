## Root cause

Both Copenhagen and Dublin trips have `trips.metadata.hero_image = null`. The hero resolver chain in `useTripHeroImage` then calls `getDestinationCanonicalImage`, which only reads `destinations.hero_image_url` — and that column is **null for 2,219 of 2,246 destinations** (only 1 destination has it set).

The chain therefore skips canonical → skips hardcoded curated (allowlist intentionally empty) → skips DB curated_images (no rows for these cities) → falls through to the `destination-images` edge function, which is returning a heavyweight base64 AI-generated image (`ai-amalienborg-palace-…`) that frequently fails to render in time, so the user sees the deterministic gradient fallback (purple for Copenhagen, blue for Dublin — both seeded from the destination string).

Meanwhile `destinations.stock_image_url` IS populated for both cities and points at the internal `site-images` bucket (HTTP 200, real JPEG). It's been sitting there unused.

## Fix

### 1. Resolver: consult `stock_image_url` as a canonical fallback

Update `getDestinationCanonicalImage` (`src/services/destinationImagesAPI.ts`) to select both `hero_image_url` and `stock_image_url`, return the first that passes `isUntrustedHeroUrl`. Single query, no extra round-trip.

```ts
.select('hero_image_url, stock_image_url')
```

Order: `hero_image_url` first (admin-curated), `stock_image_url` second (seeded). Both go through the existing trust policy gate in `useTripHeroImage`.

### 2. One-shot backfill migration

Promote `stock_image_url` → `hero_image_url` for the 2,219 affected rows so future reads short-circuit on the first column and other consumers (admin tools, future per-destination pages) also benefit:

```sql
UPDATE destinations
SET hero_image_url = stock_image_url
WHERE hero_image_url IS NULL
  AND stock_image_url LIKE '%/storage/v1/object/public/site-images/%';
```

Trusted-host filter mirrors the runtime policy so we don't promote any legacy Unsplash URLs.

### 3. Memory entry

Add `mem://constraints/visual/destination-canonical-stock-fallback` capturing: canonical resolver MUST consult `stock_image_url` when `hero_image_url` is null; backfill keeps both columns in sync; never resurrect Unsplash hosts via this path.

## Out of scope (intentionally not changing)

- The `destination-images` edge function's AI-generation behavior — leave it as the last-resort tier; once tiers 1–4 have real coverage it will be cold-pathed.
- `VERIFIED_CURATED` allowlist — staying empty per existing memory.
- The reload-overwrite work from prior turns (Dublin v1 restore still pending separate confirmation) — independent issue.

## Acceptance

- Copenhagen trip `61102b44-…` and Dublin trip `f13e2300-…` render the seeded `site-images` JPEG on next visit (no purple/blue gradient).
- `SELECT count(*) FROM destinations WHERE hero_image_url IS NULL` drops from 2,245 → ~27.
- No code path persists an `images.unsplash.com` URL into `hero_image_url` (write-back guard in `writeBackDestinationCanonicalImage` already enforces this).
