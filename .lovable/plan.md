# Google API Centralization — Status

## Enforcement pass (latest)
- New `_shared/is-google-billable.ts` — single shared predicate (`isGoogleBillableUrl`) for "is this URL Google-billable?".
- `_shared/photo-storage.ts`:
  - Now records `places_photo` SKU on EVERY billable Google download, even when the caller didn't pass a tracker (lazy tracker is created + saved instead of just warning). This closes the historical "silent under-report" leak.
  - New `getCachedPlacesPhotoByResource(entityType, id, photoResource, opts)` helper takes a Places photo resource id and builds the Google URL internally — feature code never constructs a key-bearing URL.
- Migrated all remaining feature photo callers to the new helper:
  - `destination-images/index.ts`
  - `hotels/index.ts` (2 sites)
  - `recommend-restaurants/index.ts`
  - `fetch-reviews/index.ts`
- Removed every `googleapis.com` literal from feature files; predicate checks now use `isGoogleBillableUrl`.
- Lint guard (`_shared/no-direct-google.test.ts`):
  - Allowlist shrunk to `_shared/google-api.ts`, `_shared/is-google-billable.ts`, `_shared/photo-storage.ts`, and the test itself.
  - Added a second guard that fails CI if anyone passes a raw Google URL into `getCachedPhotoUrl` instead of using `getCachedPlacesPhotoByResource`.
- Both lint tests pass.

## Earlier passes (still in effect)
- `_shared/google-api.ts` wrapper with SKU recording + audit log.
- Migrated functions: `route-details`, `transit-estimate`, `airport-transfers`, `transfer-pricing`, `optimize-itinerary`, `generate-full-preview`, `generate-itinerary/venue-enrichment`, `recommend-restaurants`, `fetch-reviews`, `hotels`, `destination-images`.
- `public.v_google_spend_per_trip` view for per-trip / per-day SKU + USD reconciliation.

## Why the leak should stop recurring
- No path can fetch from Google without going through one of the wrappers OR `photo-storage.ts`.
- `photo-storage.ts` always records the `places_photo` SKU when a Google URL is fetched, with or without an explicit tracker.
- CI fails if someone re-introduces a direct Google URL or hand-builds one for the photo cache.
