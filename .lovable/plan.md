## RS.M15 — Include travel date in attraction enrichment cache key

**File:** `supabase/functions/enrich-attraction/index.ts`, line 34.

This function uses the shared `perplexity-cache` (not a dedicated `attraction_enrichment_cache` table — that table doesn't exist). `buildCacheKey(prefix, ...parts)` is variadic, so we just append `travelDate` as another segment. No migration needed.

Today the cache key is `attractionName::destination`, so two requests for the same attraction on different travel dates collide and reuse stale "isOpen / openingHours / admissionPrice" data from another date — even though the prompt does include `dateContext`. The fix makes the cache match the prompt input.

### Change

```ts
// line 34
const cacheKey = buildCacheKey('attraction', attractionName, destination, travelDate || 'any');
```

That's the only line that changes. `setCache(cacheKey, …)` on line 123 already reuses the same variable.

### Verification

- `grep -c "travelDate\|travel_date" supabase/functions/enrich-attraction/index.ts` ≥ 2 (already 2 from existing usage; new line brings it to 3).
- Manual: two requests with same attraction+destination but different `travelDate` → second one is a cache miss (new Perplexity call); same attraction+destination+travelDate → second one is a cache hit.

### Out of scope

- Creating an `attraction_enrichment_cache` table or migrating storage layer
- Changing TTL (still 24h)
- Bucketing dates (e.g. by ISO week) — keep one entry per exact date for now
