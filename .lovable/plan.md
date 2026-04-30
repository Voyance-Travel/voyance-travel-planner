## Goal

Reduce daily API spend from ~$11.75 to under ~$3 by closing the leaks that today's `trip_cost_tracking` data exposed. Specifically: 850 of 1,111 `destination_images` invocations today did $0 of useful work but still ran; the 261 that did call Google represent fixable cache misses, not new venues.

## Current state (today's data, Apr 30)

- `destination_images`: $8.69, 1,111 invocations, 261 real Google calls, **0 trip_id / 0 user_id on 1,093 rows**
- `viator_search`: $2.68, 536 calls (vs 35 three days ago — 15× spike, unexplained)
- `lookup_restaurant_url`: $0.34
- `hotels_search` family: $0.26 (Places Advanced @ $0.032/call)

## Fix 1 — Edge-side DB cache before Google fallback

**File:** `supabase/functions/destination-images/index.ts` (`fetchImageTiered` and the BATCH branch)

Today the client checks `attractions`, `activities`, and `curated_images` first. When the client falls through, the edge function jumps straight to Google. Add the same DB lookups inside the edge function with **fuzzier matching** (Place ID, normalized name without prefixes, alt_text contains) so a venue that was resolved by *any* prior user is reused.

- New helper `resolveFromSharedDB(supabase, name, destination)` runs three queries in parallel: `curated_images.entity_key ILIKE`, `attractions.name ILIKE` + non-null image_url, `activities.name ILIKE` + non-null image_url.
- Run **before** any Google call in both single and BATCH paths.
- On Google success, write back to `curated_images` (already partially done) and to `attractions` if a name match exists.

Expected savings: ~50% of the 261 daily real calls become DB hits.

## Fix 2 — Hard negative cache + generic-name guard

**Files:** `destination-images/index.ts`, new column on `curated_images` (or reuse `source = 'no_result'` already present).

Today the function logs `negative cache hit` but the negative cache is per-route, not unified. Add:

- A 30-day negative-cache row in `curated_images` (`source='no_result'`) for any (venue+destination) where Google returned nothing.
- A pre-flight reject for clearly-generic strings: `Your Hotel`, `Hotel`, single-word destinations, strings ≤3 chars, strings starting with `Free Time` / `Downtime` / `Return to`. Return fallback immediately, no Google.
- A short `KNOWN_GENERIC` regex list shared with the client so it doesn't even enqueue them.

Expected savings: kills the recurring "Your Hotel hotel" / generic queries that today's logs show repeating.

## Fix 3 — Stop writing $0 cost-tracker rows

**File:** `supabase/functions/_shared/cost-tracker.ts`

In `CostTracker.save()`:

```text
const billable =
  (entry.input_tokens || 0) + (entry.output_tokens || 0) +
  (entry.google_places_calls || 0) +
  (entry.google_photos_calls || 0) +
  (entry.google_geocoding_calls || 0) +
  (entry.google_routes_calls || 0) +
  (entry.amadeus_calls || 0) +
  (entry.perplexity_calls || 0);
if (billable === 0) {
  // No-op: no cost incurred, no row written.
  return;
}
```

Today: 850 noise rows. After: those 850 rows simply don't exist. Visibility into "real spend" stays exact.

## Fix 4 — Viator spike investigation + caching

**Files:** `supabase/functions/viator-search/*`, plus a small `viator_search_cache` table.

- Add a `console.log` at function entry with `trip_id`, `user_id`, `query`, and a stack-style breadcrumb of who invoked it (referrer header), so we can see what drove 35 → 536.
- Add a 24-hour cache on (normalized_query + destination) keyed by hash, returning cached results without an API call.
- Wire `costTracker.setTripId()` / `setUserId()` so future spikes are attributable.

Expected savings: same query in same destination within 24h = $0.

## Order of work

1. Fix 3 (cost-tracker noise) — 5 minutes, zero behavior risk, immediately cleans data we depend on for the rest.
2. Fix 1 (edge-side DB cache) — biggest single $ win.
3. Fix 2 (negative cache + generic guard) — closes the long tail.
4. Fix 4 (Viator) — separate vendor, isolated change.

## Verification

After deploy I will:
- Run a query against `trip_cost_tracking` showing `destination_images` daily cost and call count for the last 3 days.
- Confirm tracker rows with $0 cost no longer appear.
- Tail edge logs for `[Images] DB-cache hit` vs `[Images] Google fetch` ratio.
- Report numbers back to you. If we don't see at least a 40% reduction in the `destination_images` line within the next active session, I'll keep iterating on the cache match logic.

## Out of scope

- Switching from Places Advanced ($0.032) to Places Essentials ($0.017). Possible follow-up; needs verification that Essentials returns photo references — some plans don't.
- Reducing `useActivityImage` usage on screens that don't need photos (would need product input).
- Pre-warming `curated_images` from `attractions` (one-time backfill, separate task).

## Memory updates

- Update `mem://technical/observability/google-api-centralization` to add the cost-tracker $0-skip rule and the edge-side shared-DB cache pattern.
