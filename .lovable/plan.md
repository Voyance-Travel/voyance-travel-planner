

## Fix: Photo Caching — Save Fetched Photos to Activity Records

### Problem
Every page reload re-fetches ALL activity photos from the `destination-images` edge function because photo URLs are only cached in an in-memory `Map`. This accounts for 74.8% of API costs.

### Solution: 3 Layers in 2 Files

#### File 1: `src/hooks/useActivityImage.ts`

**Layer 1 — Write photo URL back to DB**
- Add `activityId?: string` as 6th parameter to `useActivityImage`
- Add `persistPhotoToActivity(activityId, url)` helper that does a fire-and-forget `supabase.from('trip_activities').update({ photos: [photoUrl] })` — using a plain string array since `getActivityPhoto` handles that format (line 1080: `if (typeof photo === 'string') return photo`)
- Call it after a successful fetch (line 156-159), only when `activityId` is provided and `source !== 'fallback'`

**Layer 2 — localStorage cache with 7-day TTL**
- Replace the bare `Map` with a dual-layer cache: in-memory `Map` (same-session) + `localStorage` (survives reload)
- Add `getFromLocalCache(key)` and `setLocalCache(key, url, source)` helpers with JSON serialization and 7-day TTL
- Cache check order: in-memory → localStorage → fetch
- On fetch success: write to both caches

#### File 2: `src/components/itinerary/EditorialItinerary.tsx`

**Layer 3 — Pass activity ID to hook**
- Line 8513-8519: add `activity.id` as 6th argument to `useActivityImage` (it's already passed as 5th arg `cacheId`, just add it again as `activityId`)

### Cache Priority (after fix)
1. `existingPhoto` from DB (already populated from previous write-back) → instant, no API call
2. In-memory `Map` → instant, same session
3. `localStorage` → instant, survives reload
4. Edge function fetch → API call, then writes back to all 3 layers

### Expected Result
- First visit: fetches photos, saves URLs to `trip_activities.photos` + localStorage
- Page reload: photos load from localStorage (no API calls)
- Different browser/device: photos load from DB via `existingPhoto` (no API calls)
- Cost reduction: ~98% fewer photo API calls

