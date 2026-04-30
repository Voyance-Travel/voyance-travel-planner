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
- Migrated Distance Matrix calls in `transfer-pricing/index.ts` (3 modes — driving / transit / walking, all now individually counted).
- Added `_shared/no-direct-google.test.ts` lint guard with explicit allowlist of remaining offenders. Currently green.
- 276 backend tests + 197 frontend tests passing.

## Remaining (Phase 2 — second pass)
1. `destination-images/index.ts` — Places search + multi-photo download fan-out.
2. `optimize-itinerary/index.ts` — Geocode + Places Text Search + Routes + Directions + Distance Matrix.
3. `generate-full-preview/index.ts` — Legacy Place Text Search validation.
4. `generate-itinerary/action-generate-trip-day.ts`
5. `generate-itinerary/action-generate-day.ts`
6. `generate-itinerary/pipeline/enrich-day.ts`
7. Pass `CostTracker` instances explicitly to `getCachedPhotoUrl` in hotels/recommend-restaurants/fetch-reviews so the warn-log goes silent and photo SKUs attribute to the right action.
8. SQL view `v_google_spend_per_trip` for invoice reconciliation.

Each pass should shrink `PENDING_MIGRATION_ALLOWLIST` in `no-direct-google.test.ts`. The list must only ever decrease.
