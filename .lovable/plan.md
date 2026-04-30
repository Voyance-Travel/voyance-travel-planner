# Phase 2: Finish Google API Centralization

We already shipped `_shared/google-api.ts` and migrated `route-details`, `transit-estimate`, and `airport-transfers`. This phase eliminates the remaining direct `googleapis.com` fetches — the actual amplifiers behind the bill surprises.

## Files to migrate (11)

Ranked by estimated hidden-spend impact:

1. **`venue-enrichment.ts`** — per-activity Geocode + Places Text Search loop. Single biggest amplifier; one trip can fire 30–60 calls.
2. **`hotels/index.ts`** — 3 separate Places search paths + photo downloads in a loop. Currently logs once per request.
3. **`destination-images/index.ts`** — Places search + multi-photo download fan-out. Photos are the priciest SKU and are uncounted.
4. **`optimize-itinerary/index.ts`** — Geocode + Places Text Search + Routes + Directions + Distance Matrix. 5 distinct SKUs, all untracked.
5. **`recommend-restaurants/index.ts`** — Parallel Places search per cuisine; only one call counted.
6. **`fetch-reviews/index.ts`** — Places search + photo downloads; zero tracking.
7. **`transfer-pricing/index.ts`** — 3 parallel Distance Matrix calls; one counted.
8. **`generate-full-preview/index.ts`** — Legacy Place Text Search validation.
9. **`generate-itinerary/action-generate-trip-day.ts`**
10. **`generate-itinerary/action-generate-day.ts`**
11. **`generate-itinerary/pipeline/enrich-day.ts`**

For each: replace raw `fetch(...googleapis.com...)` with the matching wrapper (`googlePlacesTextSearch`, `googlePlacesPhoto`, `googleGeocode`, `googleRoutes`, `googleDistanceMatrix`), thread the existing `CostTracker` through (or pass `actionType` for lazy creation), and keep behavior identical.

## Photo handling — the biggest leak

Today, several functions return Google's `…/media?key=…` URL directly to the client. Every browser fetch of that URL is billed as a `places_photo` SKU, and we count zero of them.

Plan:
- For trip-critical photos (hotels, activities), download bytes server-side via `googlePlacesPhoto`, upload to our existing photo storage bucket, return the CDN URL. Each download is counted once; subsequent client views are free.
- For one-off previews (e.g. destination cover image), continue using a temporary Google URL **only** if we record one `places_photo` increment up front and add a `google_call_log` audit entry. Document this exception inline.

`_shared/photo-storage.ts` `getCachedPhotoUrl` will be updated so cache misses route through `googlePlacesPhoto`, attributing the SKU to the active tracker.

## Lint guard

Add `supabase/functions/_shared/no-direct-google.test.ts`:

```text
- Walk supabase/functions/**/*.ts
- For each file (except _shared/google-api.ts and the test itself),
  fail if the source contains:
    googleapis.com
    GOOGLE_PLACES_API_KEY  (raw header use)
    GOOGLE_MAPS_API_KEY    (raw header use, except in google-api.ts)
- Provide a clear failure message listing offenders.
```

This makes regressions impossible to merge silently.

## Reporting view

New SQL migration creating `public.v_google_spend_per_trip`:

```text
trip_id | total_calls | places | photos | geocoding | routes | distance_matrix | est_cost_usd | last_call_at
```

Sourced from `trip_cost_tracking` aggregated by `trip_id`. Plus a per-day view `v_google_spend_daily` for invoice reconciliation.

## Validation

- Run the full Deno + Vitest suite (currently 472 tests, 0 failing).
- Manually invoke `venue-enrichment` and `hotels` once each via the curl tool to confirm `trip_cost_tracking` rows now include `google_photos_calls > 0` and `google_call_log` audit entries.
- Spot-check a generated trip: every Google SKU in the audit log should match what the wrapper recorded.

## Out of scope (next phase)

- Migrating client-side direct Google calls (none remaining in edge functions, but worth a sweep on the React side).
- Daily Google invoice reconciliation cron (needs the reporting view first).

## Rollout

Single PR; all changes are behavior-preserving wrappers. If the lint test passes and the suite is green, we're done. Approve and I'll execute.
