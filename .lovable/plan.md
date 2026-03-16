

## Fix: Runaway Google API Costs ($200/mo) and "Image Unavailable" Errors

### Root Cause — The Persist/Read Disconnect

This is a critical architectural bug. Here's what's happening:

1. **Every page view fires ~30-50 `useActivityImage` calls** (one per activity in the itinerary)
2. Each call checks localStorage cache (7-day TTL) → curated_images DB → `destination-images` edge function → Google Places API
3. The edge function downloads the photo, stores it in `trip-photos` storage bucket, and returns a URL
4. `persistPhotoToActivity` writes the URL to the `trip_activities` table
5. **BUT** EditorialItinerary reads activities from `itinerary_data` JSONB on the `trips` table — **a completely different data source**
6. `itinerary_data` has **zero photos stored** (confirmed: all activities have `photos: null, image_url: null`)
7. So `existingPhoto` is always `null`, and every render triggers a fresh fetch

The localStorage cache helps within one browser session, but:
- Clearing cache, new device, incognito = full re-fetch of every image
- The "image unavailable" errors are likely expired Google Places photo URLs that were cached in `curated_images` but the underlying Google token expired

**Cost math**: ~30 activities per trip × ~15 photo API calls/day (re-renders, page revisits) × 7 days = ~3,150 calls. At $0.007/photo + $0.017/place search = $30/week. Matches the data exactly: 769 photo calls + 1,481 places calls = $30.56.

### The Fix: Write Photos Back to `itinerary_data`

Instead of persisting to `trip_activities` (which nothing reads), persist resolved photo URLs directly into `itinerary_data.days[].activities[].photos` on the `trips` table. This way, on the next render, `getActivityPhoto()` returns the cached URL and `useActivityImage` short-circuits immediately.

### Changes

#### 1. Batch write-back of resolved photos to `itinerary_data` (NEW)
**File: `src/hooks/useActivityImageWriteback.ts`** (new file)
- Create a debounced write-back hook that collects resolved photo URLs from the render cycle
- After a 3-second debounce (all activities have resolved), batch-update `itinerary_data` on the `trips` table
- Uses `optimistic_update_itinerary` or direct update to write photos into the JSONB
- Only writes if there are new photos to persist (skip if all activities already have photos)

#### 2. Wire the write-back into EditorialItinerary
**File: `src/components/itinerary/EditorialItinerary.tsx`**
- At the itinerary level (not per-activity), collect resolved `{activityId, photoUrl}` pairs
- After all activity images resolve, trigger the batch write-back
- This replaces the per-activity `persistPhotoToActivity` which writes to the wrong table

#### 3. Fix `useActivityImage` to stop writing to `trip_activities`
**File: `src/hooks/useActivityImage.ts`**
- Remove `persistPhotoToActivity` — it writes to a table nothing reads from
- The hook's job is just: resolve URL from cache/API, return it. Persistence is handled by the write-back hook above

#### 4. Heal "image unavailable" — validate cached URLs on the edge function
**File: `supabase/functions/destination-images/index.ts`**
- When returning a cached image from `curated_images`, add a lightweight HEAD check for storage URLs to confirm they're still valid
- If a `trip-photos` storage URL returns 404, delete the cache entry and re-fetch
- For Google Places URLs that somehow leaked into the cache (they shouldn't — `shouldPersistInCuratedCache` blocks them), remove them

#### 5. Deduplicate edge function calls for same destination
**File: `src/hooks/useActivityImage.ts`**
- The current `pendingRequests` Map deduplicates by cache key (title+destination), but different activities at the same venue with slightly different titles generate different keys
- Normalize more aggressively: strip "Visit ", "Explore ", "Dinner at " prefixes before generating the cache key
- This reduces duplicate API calls for the same venue

### Expected Impact

- **Cost reduction: ~90%** — Photos are written into `itinerary_data` on first view. All subsequent views read from JSONB, zero API calls.
- **"Image unavailable" fix** — Stale cached URLs are detected and refreshed instead of served broken.
- **First-view cost stays the same** — We still need one Google Places call per unique venue on first ever view. But that's ~30 calls per trip, not ~30 calls per page view.

### Files to change

| File | Change |
|------|--------|
| `src/hooks/useActivityImageWriteback.ts` | NEW: Batch write-back of resolved photos to `itinerary_data` JSONB |
| `src/components/itinerary/EditorialItinerary.tsx` | Wire write-back hook; collect resolved photos at itinerary level |
| `src/hooks/useActivityImage.ts` | Remove `persistPhotoToActivity`; improve cache key normalization |
| `supabase/functions/destination-images/index.ts` | Add HEAD validation for cached storage URLs; purge stale entries |

