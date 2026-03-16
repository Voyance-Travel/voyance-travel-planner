

## Fix: Photo Caching Still Broken — Three Root Causes Found

### Investigation Results

I dug into the database and code extensively. Here's what the data shows:

**Last 7 days cost breakdown:**
- `destination_images` action: **$30.56** (769 photo downloads, 1,481 place searches)
- That's **80%** of all API costs, just from images
- Today alone: 374 Google Places calls + 194 photo downloads = ~$9.55

**The previous fix (writeback hook) is not working.** Out of 3,335 activities across recent trips:
- **0** have `image_url` set in `itinerary_data`
- Only **559** have a `photos` array (16%)
- The writeback is writing to the DB, but subsequent saves overwrite it

**1,423 "poisoned" cache entries** in `curated_images` contain raw Google API URLs with your API key embedded (`places.googleapis.com/v1/.../media?key=AIzaSy...`). Every time these are served to a browser or the heal mechanism retries them, it costs money.

---

### Root Cause 1: Writeback Gets Overwritten (Race Condition)

The `useActivityImageWriteback` hook writes photos to `itinerary_data` via a direct `.update()` call. But every other itinerary save (drag-drop, edit activity, add/remove) uses `optimistic_update_itinerary` RPC which sends the **full React state** — which doesn't include the photos the writeback just persisted. So the next user edit nukes all cached photos.

**Fix:** Instead of a separate write, merge resolved photos into the React state (`days` array) so they're included in every subsequent save. When `reportPhoto(activityId, url)` is called, update the in-memory `days` state to set `activity.image_url` and `activity.photos`. This way, when ANY save happens, the photos travel with the data.

### Root Cause 2: 1,423 Poisoned Cache Entries

Legacy `curated_images` rows with `source = 'google_places'` contain raw Google API URLs. The `shouldPersistInCuratedCache` guard was added later but didn't clean up old data. The heal mechanism (HEAD check → re-download) fires on every request but often fails (expired tokens), falling through to a fresh Google Places search ($0.024/hit).

**Fix:** 
- Delete all 1,423 poisoned rows where `image_url LIKE 'https://places.googleapis.com/%'`
- The next request for each venue will fetch fresh, and the current pipeline correctly persists to storage before caching

### Root Cause 3: ActiveTrip.tsx Has No Writeback

`ActiveTrip.tsx` line 110 calls `useActivityImage()` for every activity thumbnail but doesn't use the writeback hook. This is a separate page view that burns API calls without persisting results.

**Fix:** Thread the same photo-merge logic into ActiveTrip's rendering, or better — since the editorial view already resolves photos, ensure ActiveTrip reads from the same persisted `itinerary_data` photos.

---

### Implementation Plan

| # | File | Change |
|---|------|--------|
| 1 | **Database** | Delete 1,423 poisoned `curated_images` rows where `image_url LIKE 'https://places.googleapis.com/%'` |
| 2 | `src/hooks/useActivityImageWriteback.ts` | Rewrite: instead of writing directly to DB, update the parent component's `days` state via a callback. This ensures photos are included in ALL subsequent saves. |
| 3 | `src/components/itinerary/EditorialItinerary.tsx` | Pass a state-update callback to the writeback hook. When photos resolve, merge them into `days` state (which feeds into all save paths). Also do a one-time DB persist for photos that resolved. |
| 4 | `src/pages/ActiveTrip.tsx` | Read `image_url`/`photos` from `itinerary_data` activities and pass as `existingPhoto` to `useActivityImage`, so it short-circuits when photos are already persisted. |
| 5 | `supabase/functions/destination-images/index.ts` | Add a safety guard in `cacheImage()` to double-check no raw Google URLs slip through, even if `ensurePersistentStorageUrl` fails silently. |

### Expected Impact

- **Immediate**: Deleting poisoned cache entries stops ~$15-20/week in wasted heal attempts
- **After writeback fix**: Photos persist in `itinerary_data` and survive subsequent edits. Repeat page views = zero API calls
- **ActiveTrip fix**: Second biggest source of redundant calls eliminated
- **Combined**: ~90-95% cost reduction on image API calls

