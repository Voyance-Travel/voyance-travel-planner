# Google API Centralization — Status

## Done (Phase 1)
- `_shared/google-api.ts` wrapper with SKU recording + audit log
- Migrated: `route-details`, `transit-estimate`, `airport-transfers`

## Done (Phase 2 — first pass)
- `_shared/photo-storage.ts` now records `places_photo` SKU on cache miss when a `CostTracker` is passed (warns when missing). New optional 5th arg + threaded through `batchCachePhotos`.
- Migrated Places Text Search calls in:
  - `generate-itinerary/venue-enrichment.ts` (geocode + verify)
  - `recommend-restaurants/index.ts`
  - `fetch-reviews/index.ts`
  - `hotels/index.ts` (3 search sites)
- Migrated Distance Matrix calls in `transfer-pricing/index.ts` (3 modes individually counted).
- Added `_shared/no-direct-google.test.ts` lint guard with allowlist.

## Done (Phase 2 — second pass)
- `destination-images/index.ts` — Places Text Search migrated; tracker threaded through `getGooglePlacesPhoto` → `getCachedPhotoUrl` so photo SKUs are attributed to the right action.
- `optimize-itinerary/index.ts` — was previously **completely untracked**. Now migrated:
  - geocode (2 sites) → `googleGeocode`
  - place verification text search → `googlePlacesTextSearch` (v1)
  - transit Routes API → `googleRoutes`
  - legacy Directions API fallback → new `googleDirections` wrapper (counted as routes SKU)
  - Distance Matrix → `googleDistanceMatrix`
- `generate-full-preview/index.ts` — venue validation Places search migrated.
- `_shared/google-api.ts` — added `googleDirections` wrapper for legacy Directions endpoint.
- Lint allowlist shrunk from 9 entries to 5 (only files left have `places.googleapis.com` photo URL strings or substring guards — no untracked fetch calls).
- SQL view `public.v_google_spend_per_trip` shipped — per-trip / per-day SKU counts and USD estimates using current Google list pricing. Admin-only via `security_invoker`.

## Verification
- 276 backend tests pass. 197 frontend tests pass. Lint guard `no-direct-google.test.ts` passes.

## Outstanding (low priority)
- `hotels` / `recommend-restaurants` / `fetch-reviews`: pass an explicit `CostTracker` to `getCachedPhotoUrl` so the wrapper's "lazy tracker" warn-log goes silent and photo SKUs attribute to the right action_type.
- `destination-images`: replace the literal `https://places.googleapis.com/...` photo URL builder with `googlePlacesPhoto` (download bytes server-side) so we never expose key-bearing URLs to clients. Net spend already tracked via `getCachedPhotoUrl` cache-miss accounting.
