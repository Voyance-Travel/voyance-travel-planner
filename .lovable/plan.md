

## Centralize Image Resolution: Fetch Once, Read Everywhere

### The Problem You Identified

Right now, **every component that shows an activity image calls `useActivityImage` independently**:
- `EditorialItinerary.tsx` → calls `useActivityImage` per `ActivityRow` (~20+ hooks per trip)
- `ActiveTrip.tsx` → reads `activity.imageUrl` (which is often an old/dead Unsplash URL from the DB)

This causes:
1. **Duplicate fetches** — the same Google Places API call fires from both views
2. **Render loops** — `useActivityImage` sets state inside `useEffect`, and when trip data refetches (budget sync, etc.), new activity objects trigger the hook again → React Error #310
3. **Dead Unsplash URLs** — old `images.unsplash.com` URLs stored in `itinerary_data` return 404

### The Fix: Resolve Images Once, Store in `itinerary_data`

Instead of each component fetching its own images, resolve all activity images **once** at the itinerary level and write them into `itinerary_data.days[].activities[].photos`. Then every view just reads `activity.photos[0]` — no hooks, no fetches, no loops.

### Implementation Plan

#### 1. Create a batch image resolution hook: `useItineraryImages`
**New file:** `src/hooks/useItineraryImages.ts`

- Takes the full itinerary days array + destination
- Iterates all activities, identifies which ones need images (no `photos` or dead Unsplash URL in `photos[0]`)
- Batches calls to the `destination-images` edge function (with dedup + localStorage cache from existing logic)
- Returns a `Map<activityId, imageUrl>` of resolved images
- Writes resolved URLs back into `itinerary_data` via a single trip update (not per-activity)

#### 2. Call it once in `EditorialItinerary` at the top level
**File:** `src/components/itinerary/EditorialItinerary.tsx`

- Call `useItineraryImages(days, destination)` once in the main component
- Pass resolved image URLs down to `ActivityRow` as a prop
- **Remove** the per-row `useActivityImage` hook call (line ~8728) — replace with a simple prop read
- This eliminates ~20 hook instances and their associated render-loop risk

#### 3. Filter out dead Unsplash URLs
**File:** `src/hooks/useItineraryImages.ts`

- Add `isValidPhotoUrl()` helper: returns `false` for bare `images.unsplash.com` URLs (unreliable, frequently 404)
- Only trust internal storage URLs, Google Places URLs, or other known-good sources
- Treat invalid URLs as "needs fetch"

#### 4. ActiveTrip reads from the same `activity.photos`
**File:** `src/pages/ActiveTrip.tsx`

- `ActivityImageThumb` already reads `activity.imageUrl` — update it to also check `activity.photos?.[0]`
- No hook needed — the image was already resolved and stored by the EditorialItinerary/batch resolver

#### 5. Clean dead Unsplash URLs from DB
**Database update:** Run a one-time query to null out `photos` entries in `itinerary_data` that contain `images.unsplash.com` — these will be re-resolved by the new batch hook on next view.

### Files to Edit

| File | Change |
|------|--------|
| `src/hooks/useItineraryImages.ts` | **New** — batch image resolution hook with localStorage cache |
| `src/components/itinerary/EditorialItinerary.tsx` | Replace per-row `useActivityImage` with single `useItineraryImages` call |
| `src/pages/ActiveTrip.tsx` | Read `activity.photos?.[0]` as fallback for `imageUrl` |
| `src/hooks/useActivityImage.ts` | Keep for standalone use but no longer called in itinerary views |
| Database | Clean dead Unsplash URLs from `itinerary_data` |

### Why This Fixes the Crash

- **No per-row hooks** = no render-loop risk from `useState` inside `useEffect`
- **Single batch fetch** = no concurrent state updates fighting each other
- **Images persisted in itinerary_data** = both EditorialItinerary and ActiveTrip read the same cached data
- **Dead URLs filtered** = no more 404s triggering error cascades

