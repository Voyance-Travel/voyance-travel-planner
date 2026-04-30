# Make Google API spend impossible to under-count

## What I found

I traced every Google API call site against `trip_cost_tracking`. The picture is bad — about half of our Google spend is invisible to our own books.

### Tracking coverage today

| Edge function | Google fetches in code | trackCost? | Records Google calls? |
|---|---|---|---|
| `destination-images` | 4 | ✅ | ✅ (4) |
| `hotels` | 5 | ✅ | ⚠️ partial (3 of 5) |
| `recommend-restaurants` | 2 sites + **3 parallel queries × 20 results + photo proxy** | ✅ | ⚠️ records `1` total (drastically undercounts) |
| `transfer-pricing` | 3 (driving + transit + walking distance matrix) | ✅ | ⚠️ partial (1 of 3) |
| `generate-full-preview` | 1 | ✅ | ✅ |
| `fetch-reviews` | 2 | ❌ | ❌ |
| `transit-estimate` | 1 (called per leg, every gen) | ❌ | ❌ |
| `airport-transfers` | 2 | ❌ | ❌ |
| `optimize-itinerary` | 6 | ❌ | ❌ |
| `route-details` | 1 | ❌ | ❌ |
| `generate-itinerary/venue-enrichment.ts` | 2 (geocode + places search **per activity**) | ❌ | ❌ |

The 30-day production aggregate confirms it — only 4 action types report any Google spend, and `recommend_restaurants` shows literally 2 places calls in 30 days while we know it fans out 3 parallel `places:searchText` queries per request.

### The four hidden cost amplifiers

1. **Per-activity venue verification** (`venue-enrichment`) runs Places Text Search + Geocoding for *every* generated activity. A 7-day trip = ~30+ untracked Places SKU hits per generation. This is almost certainly the largest invisible line item.
2. **Photo media URL leakage**. `getCachedPhotoUrl` caches into Supabase Storage on first download, but: (a) the *download itself* is never logged as a `google_photos_calls` increment, and (b) on the cold path / HEAD miss we still hit Google. We have no counter telling us how many photo SKU calls we paid for.
3. **Restaurant fan-out**. `recommend-restaurants` runs 3 parallel `places:searchText` per call (each is one billable SKU; up to 20 results doesn't multiply, but the 3 queries do) and only records `1`.
4. **Distance Matrix triple-call**. `transfer-pricing` calls Google three times (driving, transit, walking) and records one. `airport-transfers` does two and records zero.

### Why our bills are always higher than our estimates

We bill ourselves at $0.032/Places call, $0.005/Routes/Geocoding, $0.007/Photo. Even with correct per-SKU pricing, if we're missing 50–70% of the calls in the ledger (which the table above suggests), our internal estimate will systematically be **2–3× lower** than the Google invoice. That matches your reported feeling.

## The plan — one shared wrapper, zero call sites left untracked

We already have the `trip_cost_tracking` table and a `CostTracker` class. The fix is to make it impossible to call Google without logging.

### 1. Add `_shared/google-api.ts` — the only allowed way to call Google

A single wrapper module exporting:

- `googlePlacesTextSearch(params, ctx)` — wraps `https://places.googleapis.com/v1/places:searchText`
- `googlePlacesPhoto(photoResource, ctx)` — wraps the photo media URL (downloads bytes; never returns a URL containing the API key)
- `googleGeocode(address, ctx)` — wraps the geocoding endpoint
- `googleRoutes(payload, ctx)` — wraps the Routes API
- `googleDistanceMatrix(params, ctx)` — wraps the legacy Distance Matrix endpoint

Every wrapper:
- Reads `GOOGLE_MAPS_API_KEY` / `GOOGLE_ROUTES_API_KEY` internally so call sites can't bypass it.
- Accepts a `ctx: { tracker?: CostTracker; tripId?: string; userId?: string; actionType: string; reason?: string }`.
- Calls `tracker.recordGooglePlaces/Geocoding/Routes/Photos(1)` **before returning**.
- If no tracker is provided, lazily creates one (`trackCost(ctx.actionType)`), saves it on completion, and emits a `console.warn` so we can find the offender.
- Records `metadata.google_call_log` — an array of `{ sku, query, ts, durationMs, ok }` so we can audit per-trip.

### 2. Migrate every existing call site to the wrapper

In a single sweep, replace direct `fetch('https://...googleapis.com/...')` calls with the wrapper across:

- `destination-images`, `hotels`, `recommend-restaurants`, `transfer-pricing`, `generate-full-preview` (already tracking — just route through wrapper for consistency / per-call log)
- `fetch-reviews`, `transit-estimate`, `airport-transfers`, `optimize-itinerary`, `route-details`, `generate-itinerary/venue-enrichment.ts` (currently untracked — biggest impact)

Each migration is mechanical: replace the `fetch(...)` block with `await googlePlacesTextSearch(...)`, pass the existing `costTracker` if one exists, otherwise pass `{ actionType, tripId }`.

### 3. Lint guard so we don't regress

Add a Deno test (`supabase/functions/_shared/no-direct-google.test.ts`) that scans `supabase/functions/**/*.ts` for raw `googleapis.com` URLs in `fetch(...)` calls and fails CI if any appear outside `_shared/google-api.ts`. This is the systemic guarantee — same idea you asked for on the day-intent side: control the gate, not the consumers.

### 4. Photo SKU accounting

Update `getCachedPhotoUrl` to:
- Take the `ctx` so every cache-miss download increments `google_photos_calls`.
- Return `cacheHit: true|false` (already does) and the wrapper logs only on miss.
- Never embed the API key in a URL handed to the client (we already cache to Supabase Storage; tighten the fallback path so direct Google URLs are never returned to the browser — those silent hits are unbillable-by-us but billable-by-Google).

### 5. Per-trip + per-day spend view

Add a SQL view `v_google_spend_per_trip`:

```text
trip_id │ places │ geo │ photos │ routes │ est_google_usd │ last_call
```

And a tiny admin route already wired into the existing cost dashboard so you can pull up a trip and see exactly which SKUs fired. This is what you'll compare to the Google invoice each month.

### 6. Daily reconciliation log (optional but cheap)

A scheduled function that writes one row per day to `google_api_daily_totals` summing each SKU. When the Google bill arrives, you diff our totals vs theirs and the gap (if any) tells us either (a) we still have a leak or (b) Google's free-tier accounting differs from ours.

## Files touched

- **new** `supabase/functions/_shared/google-api.ts`
- **new** `supabase/functions/_shared/no-direct-google.test.ts`
- **edit** `supabase/functions/_shared/photo-storage.ts` (accept ctx, record photo SKU)
- **edit** 11 edge functions listed above (call-site migration)
- **new migration** `v_google_spend_per_trip` view + optional `google_api_daily_totals` table

## Risk / scope

- Pure refactor: behavior of each Google call is unchanged; we just funnel through the wrapper.
- Backward-compatible — existing trackers keep working.
- No schema-breaking changes to `trip_cost_tracking`; we only add a view.
- Test suite stays green; the new lint test will fail loudly the moment someone reintroduces a raw `fetch('...googleapis.com...')`.

## What you'll see after

- The 30-day report will start showing `google_places_calls` for `recommend_restaurants`, `fetch_reviews`, `venue_enrichment`, `transit_estimate`, `airport_transfers`, `optimize_itinerary`, `route_details` — all currently zero.
- `est_cost_usd` per trip will jump (because we'll finally be counting what we actually pay) and align with the Google invoice within free-tier tolerance.
- A single grep of `googleapis.com` in `fetch(` outside `_shared/` will return zero results — that's the systemic fix.

Approve and I'll build it in default mode.
