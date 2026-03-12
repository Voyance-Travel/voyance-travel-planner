

## Problem Analysis

You have 20 trips to New York, all showing the same 3 Unsplash photos. The root cause is a **client-side short-circuit**: when a destination has hardcoded curated images (like "new york" in `destinationImages.ts`), the code **never calls the backend** and **never checks the database cache tables** (`curated_images`, `destination_image_cache`). It just returns the same static URLs every time.

The infrastructure for DB-level caching exists (`curated_images` table, `destination_image_cache` table, `cache-destination-image` edge function) but is bypassed for all ~50 curated-only destinations.

## What needs to change

### 1. Prioritize DB cache over hardcoded images

**File: `src/services/destinationImagesAPI.ts`**

Currently lines 121-138 check `hasCuratedImages()` and return immediately with static URLs. Instead:

- Check `curated_images` DB table first (fast query, already indexed)
- If DB has valid non-expired entries, use those
- If DB has nothing, fall back to the hardcoded curated images
- After returning hardcoded images, fire-and-forget write them into the `curated_images` table so next time the DB is hit

This means the first trip to New York seeds the DB, and every subsequent trip reads from DB (which can be updated/expanded over time).

### 2. Seed curated images into DB on first use

**File: `src/services/destinationImagesAPI.ts`**

When falling back to hardcoded curated images, write them to `curated_images` with a 60-day `expires_at`. This is a fire-and-forget upsert — no blocking the UI. After 60 days, the entry expires, and the next request either refreshes from the edge function or re-seeds.

### 3. Make prefetch write to DB cache too

**File: `src/utils/imagePrefetch.ts`**

Currently `prefetchDestinationImages()` also short-circuits for curated destinations (lines 109-122), only writing to localStorage. Change it to also write fetched images to the `curated_images` table if they aren't already there.

### 4. Extend the `destination-images` edge function to cache with 60-day TTL

**File: `supabase/functions/destination-images/index.ts`**

After a successful Google Places fetch, the function already writes to `curated_images`. Verify that `expires_at` is set to 60 days from now (not null or 90 days). This ensures periodic refresh of images.

### 5. Remove the client-side curated-only bypass for DB-cached destinations

**File: `src/services/destinationImagesAPI.ts`**

The `CURATED_ONLY_DESTINATIONS` set prevents calling the edge function for major cities. Instead of blocking all API calls, change the logic to: if DB cache has images → use them; if not → use hardcoded curated → seed DB. Never call the external API for curated-only destinations (keep that safety), but do check the DB.

## Summary of changes

| Change | File | What |
|--------|------|------|
| Check DB before hardcoded | `destinationImagesAPI.ts` | Query `curated_images` table first |
| Seed DB from hardcoded | `destinationImagesAPI.ts` | Fire-and-forget upsert on fallback |
| Prefetch writes to DB | `imagePrefetch.ts` | Write fetched images to `curated_images` |
| 60-day TTL on cache | `destination-images/index.ts` | Ensure consistent expiry |
| Remove blind short-circuit | `destinationImagesAPI.ts` | DB cache > hardcoded > API |

This means: first trip to New York seeds the DB with 3 images. Trip 2-20 read from DB instantly — no API calls, no localStorage dependency, no rotation of the same 3. And every 60 days the images can be refreshed.

