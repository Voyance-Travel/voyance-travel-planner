## CL.2 — Places Text Search cache layer

The 4 edge functions calling Google Places Text Search currently have no cache. Same query ("hotels in Venice", "Da Ivo Venice", etc.) re-bills $0.017 every time across users. We'll add a deterministic-key cache table and a thin wrapper, then alias-import in the 4 call sites — zero call-site code changes.

### Step 1 — Migration: cache table + race-safe hit bumper

New `google_places_search_cache` table keyed by `cache_key text PRIMARY KEY`. Stores `text_query`, `location_bias`, `included_type`, `field_mask`, `response_data jsonb`, `result_count`, `hit_count`, `last_hit_at`, `expires_at` (default `now() + 30 days`).

Indexes on `expires_at` and `text_query`. RLS enabled, all privileges revoked from PUBLIC/anon/authenticated, granted to `service_role` only — server-internal cost infrastructure, no client should read it.

`bump_places_cache_hit(p_cache_key text)` SECURITY DEFINER function for atomic `hit_count = hit_count + 1, last_hit_at = now()` updates. Execute granted to `service_role` only.

### Step 2 — Shared helper: `cachedGooglePlacesTextSearch`

Append to `supabase/functions/_shared/google-api.ts` alongside existing `googlePlacesTextSearch`. Same `(params, ctx)` signature → same `PlacesTextSearchResult` return shape, so it's a drop-in replacement.

Logic:
1. Build deterministic key from JSON of `{textQuery (lowercased+trimmed), locationBias, includedType, fieldMask, maxResultCount}`, hash via djb2, prefix `places_text:`.
2. Cache lookup: `select response_data where cache_key=? and expires_at > now()`. On hit → fire-and-forget `bump_places_cache_hit` RPC, return `{ok:true, status:200, data:cached}`.
3. Cache miss → call live `googlePlacesTextSearch`. On `result.ok` upsert response into cache. Return live result either way.
4. Cache lookup/store failures are warnings, never block the live result.

Logs `[places-cache] HIT` / `MISS` for visibility.

### Step 3 — Alias-swap 4 call sites

Pure import-line change; no call-site identifiers move:

```typescript
// Before
import { googlePlacesTextSearch } from "../_shared/google-api.ts";
// After
import { cachedGooglePlacesTextSearch as googlePlacesTextSearch } from "../_shared/google-api.ts";
```

Files (verified via grep):
- `supabase/functions/recommend-restaurants/index.ts:5` (1 call at L104)
- `supabase/functions/hotels/index.ts:5` (3 calls: L420, L624, L692)
- `supabase/functions/fetch-reviews/index.ts:5` (1 call at L143)
- `supabase/functions/generate-full-preview/index.ts:4` (1 call at L313)

### Verification

- `ls supabase/migrations/ | grep places_search_cache` → 1 file
- `grep -n "export async function cachedGooglePlacesTextSearch" supabase/functions/_shared/google-api.ts` → 1 hit
- `grep -rn "cachedGooglePlacesTextSearch as googlePlacesTextSearch" supabase/functions` → 4 hits
- Deploy the 4 affected functions
- Trigger a hotels search twice for the same city — second call should log `[places-cache] HIT`

### Cost-effectiveness query (run after a few days)

```sql
SELECT text_query, hit_count, result_count,
       (hit_count * 0.017)::numeric(10,2) AS dollars_saved
FROM public.google_places_search_cache
WHERE hit_count > 0
ORDER BY hit_count DESC LIMIT 20;
```

### Out of scope (intentionally)

- No caching for user-typed free-text search (every input is unique; would just bloat the table).
- No backfill of existing call patterns — cache warms naturally as users generate.
- Orphan cleanup of expired rows: skipped for now; 30-day TTL + low row volume = negligible. Add a cron later if `pg_total_relation_size` grows past ~100MB.

### Expected impact

After ~1 month of usage, the same-city hotel/restaurant queries should overlap heavily across users. Realistic estimate: 40–60% Places Text Search call reduction, dominated by `hotels in <city>` repeats.
