

## Root Cause Analysis

After tracing through the code 4 times, here are the **two separate issues** and why previous fixes didn't fully work:

### Issue 1: React Error #310 — Production Site Running Stale Code

The error logs you shared are from `travelwithvoyance.com` with bundle hash `index-bqKQC1Ju.js`. The fixes we made (removing `useActivityImage` per-row calls, adding `useItineraryImages` batch hook) **are in the codebase** but the production/custom domain is still serving an older build. The preview URL should already work.

**Action needed:** Re-publish the app to your custom domain. No code change required for this.

### Issue 2: Dead Unsplash URLs Still Showing (404s)

Even with the batch image system, there's a gap in the fallback chain:

```text
ActivityRow (line 8732):
  thumbnailUrl = resolvedUrl || existingPhoto || fallback
                      ↑              ↑
                  batch hook    getActivityPhoto()
                  (may be null    returns raw Unsplash
                   if not yet     URL from activity.photos
                   resolved)      → 404!
```

`getActivityPhoto()` at line 1087 returns the raw photo URL from `activity.photos[0]` without any validation. If that's a dead Unsplash URL like `https://images.unsplash.com/photo-1596768651008-c3d3ef56c8cf`, it gets used as the fallback and 404s.

Meanwhile, `useItineraryImages` correctly rejects these URLs via `isValidPhotoUrl` and fetches replacements — but until the replacement arrives, the dead Unsplash URL shows.

### Issue 3: Remaining Re-render Risk

`useItineraryImages` calls `setImageMap` **once per activity** in Phase 2 (line 191). With 20+ activities, that's 20+ state updates, each triggering a full re-render of `EditorialItinerary` (9,694 lines, 177 useState calls). Combined with `onDaysChange` calling `setTrip` in the parent (which recreates `initialDays` via `parseEditorialDays` on every render at line 2091), there's still a re-render amplification risk.

## Fix Plan

### 1. Filter dead Unsplash URLs in `getActivityPhoto`
**File:** `src/components/itinerary/EditorialItinerary.tsx` (line ~1087)

Add URL validation so dead Unsplash URLs are treated as `null`, forcing the system to use the batch-resolved URL or fallback SVG instead.

### 2. Batch state updates in `useItineraryImages`
**File:** `src/hooks/useItineraryImages.ts`

Instead of calling `setImageMap` per activity in Phase 2, collect all fetched URLs and apply them in a single `setImageMap` call after all fetches complete. This reduces 20+ re-renders to 2 (Phase 1 cache hits + Phase 2 fetches).

### 3. Block Unsplash URLs in `normalizeUnsplashUrl`
**File:** `src/utils/unsplash.ts`

Remove the pass-through for `images.unsplash.com/photo-*` URLs at line 63. These URLs are unreliable and should return the placeholder instead.

### 4. Memoize `initialDays` in TripDetail
**File:** `src/pages/TripDetail.tsx` (line ~2091)

`parseEditorialDays()` is called inside an IIFE during render, creating new objects every render. Wrap it in `useMemo` so `EditorialItinerary` receives stable props.

### Files to Edit

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Validate URLs in `getActivityPhoto` — reject Unsplash |
| `src/hooks/useItineraryImages.ts` | Batch Phase 2 state updates into single `setImageMap` |
| `src/utils/unsplash.ts` | Stop passing through `images.unsplash.com` URLs |
| `src/pages/TripDetail.tsx` | Memoize `parseEditorialDays` call to stabilize props |

