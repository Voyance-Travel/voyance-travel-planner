

## Fix: Hero Image Keeps Changing on Itinerary Page

### Root Cause

**TripDetail.tsx** uses `DynamicDestinationPhotos` for its hero, which fetches images fresh from the API on every mount. It does NOT:
1. Check `trip.metadata.hero_image` (the persisted hero URL)
2. Persist the resolved image back to the trip record

Other pages (TripDashboard, ActiveTripCard, PastTripCard) correctly use the `useTripHeroImage` hook which checks `metadata.hero_image` first — but TripDetail doesn't.

The result: every time you navigate to the trip, a new API call may return a different Google Places photo.

### Fix (2 changes)

**Change 1 — Switch TripDetail hero from `DynamicDestinationPhotos` to `useTripHeroImage`**

File: `src/pages/TripDetail.tsx` (~line 1741-1751)

Replace the `DynamicDestinationPhotos` component with a simple `<img>` powered by `useTripHeroImage`, matching the pattern already used in ActiveTripCard and PastTripCard. This ensures the hero reads `metadata.hero_image` first, then curated, then DB, then API, with gradient fallback.

**Change 2 — Persist resolved hero URL back to trip metadata (write-back)**

File: `src/hooks/useTripHeroImage.ts`

After the hook resolves an image from a non-seeded source (curated, db_curated, or api), fire a one-time write-back to persist it into `trips.metadata.hero_image`. This ensures subsequent visits always use the same image without re-fetching. The write-back only fires when:
- `tripId` is provided
- The resolved source is not `'seeded'` or `'gradient'`
- The image hasn't already been persisted (guard via ref)

This is a fire-and-forget JSONB merge: `metadata = metadata || '{}' || jsonb_build_object('hero_image', url)` — or simpler, read current metadata, spread, set hero_image, update.

### Result
- First visit: resolves image via the fallback chain, persists to trip metadata
- Every subsequent visit: instant load from `metadata.hero_image` — no API call, no changing photos

