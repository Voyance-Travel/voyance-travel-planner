
# CostTracker Accuracy Fixes

Make `trip_cost_tracking` rows the source of truth for the admin dashboard by closing four gaps: token-source provenance, cache-hit visibility, retry dedup, and per-SKU Google pricing.

## Scope

Single file (`supabase/functions/_shared/cost-tracker.ts`), one shared helper update (`supabase/functions/_shared/google-api.ts`), one migration (4 new columns + an index), zero behavior changes for non-admin paths.

## Schema migration

Add four nullable columns (no backfill — legacy rows stay `NULL`/default and the dashboard treats them as "unknown"):

```text
ALTER TABLE trip_cost_tracking
  ADD COLUMN IF NOT EXISTS token_source TEXT DEFAULT 'unknown',  -- 'api' | 'estimate' | 'unknown'
  ADD COLUMN IF NOT EXISTS is_cache_hit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS attempt_id   UUID    DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS retry_of     UUID    DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_cost_tracking_cache_hit
  ON trip_cost_tracking (is_cache_hit) WHERE is_cache_hit = true;
```

`gen_random_uuid()` — already enabled, no `uuid_generate_v4` extension needed.

## Fix 1 — Token-source provenance

`extractTokenUsage` returns whether the count came from the API or was estimated. `recordAiUsage` carries that into `entry.token_source`.

```text
extractTokenUsage(aiResponse) -> { inputTokens, outputTokens, source: 'api'|'estimate' }
  - 'api' when aiResponse.usage.{prompt_tokens,completion_tokens} OR
                aiResponse.usageMetadata.{promptTokenCount,candidatesTokenCount} present
  - 'estimate' otherwise (existing length/3.8 fallback)

CostTracker.recordAiUsage:
  - first call: set this.entry.token_source = source
  - subsequent calls: downgrade to 'estimate' if any call was estimated
                      ('api' AND 'api' -> 'api'; anything-else -> 'estimate')
```

The estimation heuristic stays — only its labeling changes.

## Fix 2 — Persist cache-hit rows

Replace the `billableUnits === 0 && estimatedCost === 0` early return at line 387 with explicit cache-hit tagging:

```text
const isCacheHit = billableUnits === 0 && estimatedCost === 0;
// no early return — always insert
.insert({ ...this.entry, estimated_cost_usd: estimatedCost, duration_ms, is_cache_hit })
```

A new opt-in `markCacheHit()` method lets callers (perplexity-cache `getCached`, `checkVenueCache` HIT, Viator LRU HIT) tag rows explicitly even when they did record some incidental work. The cache-hit branch in those callers is what the prompt's "$0 row dropped" memory referred to (`mem://technical/observability/cost-savings-pass-1`); we keep the volume-control intent by **only** writing cache-hit rows when a tracker was actually opened for that action — we don't synthesize new rows from nothing.

Volume note: this re-introduces ~850 rows/day of $0 traffic that was dropped in April. The `idx_trip_cost_tracking_cache_hit` partial index keeps "cache ROI" queries cheap; default dashboard queries should add `WHERE is_cache_hit = false` to keep cost totals clean.

## Fix 3 — Retry dedup

`trackCost` accepts an optional second arg:

```text
trackCost(actionType, model?, opts?: { retryOf?: string })
new CostTracker(actionType, model, { retryOf })
  -> entry.attempt_id = crypto.randomUUID()
  -> entry.retry_of   = opts.retryOf ?? null
```

`save()` returns `entry.attempt_id` so the caller can pass it as `retryOf` on the next attempt. Callers that don't pass `retryOf` (the vast majority) are unaffected — `retry_of` stays NULL and rows count as first attempts.

Wire-through: only the two retry sites in `enrichActivityWithRetry` and the slim-prompt retry in `action-generate-trip-day` need to pass `retryOf`. Out of scope for this prompt — schema + plumbing land here, callers opt in later.

Dashboard guidance documented in the file header:

```text
-- Cost totals (exclude retries):       WHERE retry_of IS NULL
-- Reliability (count all attempts):    no filter
-- Cache ROI:                            WHERE is_cache_hit = true
```

## Fix 4 — Per-SKU Google pricing

The current code already separates Places / Geocoding / Photos / Routes correctly. The real gap: **Place Details** (Basic SKU, $0.017) is not distinguished from **Text Search** (Advanced SKU, $0.032) — both fold into `google_places_calls` at the $0.032 rate, overstating cost on any future Place Details call.

Two changes:

1. Add `places_details` to `GoogleSku` in `_shared/google-api.ts` (currently only `places_text_search` is enumerated for Places). Add a new column `google_place_details_calls INTEGER NOT NULL DEFAULT 0` to `trip_cost_tracking` and a `recordGooglePlaceDetails(count)` method.
2. Replace the inline `0.032 / 0.005 / 0.007 / 0.005` literals in `save()` with lookups against `GOOGLE_API_PRICING` so a single source defines pricing:

```text
const googleCost =
  (places_calls          || 0) * GOOGLE_API_PRICING.places_text_search.perCall +
  (place_details_calls   || 0) * GOOGLE_API_PRICING.places_details.perCall +
  (geocoding_calls       || 0) * GOOGLE_API_PRICING.geocoding.perCall +
  (photos_calls          || 0) * GOOGLE_API_PRICING.photos.perCall +
  (routes_calls          || 0) * GOOGLE_API_PRICING.routes.perCall;
```

No call-site changes required today — every existing `recordGooglePlaces()` call really is a Text Search and stays correct. The Place Details path is wired but unused until the centralized wrapper grows a Place Details helper.

## Verification

1. Run a full trip generation against the preview backend.
2. `SELECT action_type, token_source, input_tokens, output_tokens, is_cache_hit, attempt_id, retry_of FROM trip_cost_tracking WHERE created_at > now() - interval '10 min' ORDER BY created_at DESC LIMIT 30;`
3. Confirm:
   - AI rows show `token_source = 'api'` with token counts matching the gateway's `usage` block.
   - Repeated lookups (advisory, activity URL, venue) write rows with `is_cache_hit = true` and `estimated_cost_usd = 0`.
   - All rows have a non-null `attempt_id`; `retry_of` is NULL for first attempts.
   - `SUM(estimated_cost_usd) FILTER (WHERE google_places_calls > 0)` matches expected $0.032 × calls (no double-billing).

## Out of scope

- Wiring `retryOf` into `enrichActivityWithRetry` and slim-prompt retry (separate prompt).
- Building the admin dashboard cards that consume the new columns.
- Backfilling legacy rows — they stay `unknown` / NULL deliberately so historical aggregates aren't reshaped.
- Any change to the existing Viator 24h LRU or perplexity `search_cache` — only the cost row written when those caches HIT.
