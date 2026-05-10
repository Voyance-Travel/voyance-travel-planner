## Status: CL.4 already shipped

All 4 functions (`lookup-local-events`, `lookup-travel-advisory`, `lookup-activity-url`, `enrich-attraction`) already cache via `_shared/perplexity-cache.ts` against the existing `search_cache` table. Cache HIT short-circuits before the Perplexity call and returns `cached: true`. No new table needed.

## Two follow-ups

### 1. Bump TTLs on the two freshness-tolerant functions only

- `supabase/functions/lookup-travel-advisory/index.ts` — `TTL.SEVEN_DAYS` → `TTL.FOURTEEN_DAYS` (advisories change monthly at most)
- `supabase/functions/lookup-activity-url/index.ts` — `TTL.THIRTY_DAYS` → `TTL.NINETY_DAYS` (booking URLs are stable for established venues)

Add `FOURTEEN_DAYS: 14 * 24 * 60 * 60 * 1000` to the `TTL` map in `supabase/functions/_shared/perplexity-cache.ts` (`NINETY_DAYS` already exists).

**Leave alone:**
- `lookup-local-events` at 6h — events change weekly; longer TTL would hide newly-listed events
- `enrich-attraction` at 1d — hours / prices / closures shift; stale data here is worse than the cost saving

### 2. pg_cron daily cleanup on `search_cache`

Migration (idempotent):

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-search-cache') THEN
    PERFORM cron.schedule(
      'cleanup-search-cache',
      '0 4 * * *',
      $cmd$DELETE FROM search_cache WHERE expires_at < now()$cmd$
    );
  END IF;
END$$;
```

Prevents unbounded table / index bloat. `pg_cron` is already in use elsewhere in this project.

## Verify

- `grep -n "TTL\\.\\(SEVEN_DAYS\\|THIRTY_DAYS\\|FOURTEEN_DAYS\\|NINETY_DAYS\\)"` in the two changed files shows the bumped constants.
- `SELECT jobname, schedule FROM cron.job WHERE jobname = 'cleanup-search-cache'` returns 1 row (run via Lovable Cloud SQL).
- After 24h, `SELECT count(*) FROM search_cache WHERE expires_at < now()` ≈ 0.

## Out of scope

No code changes to the 4 function bodies — pattern is correct as-is. No new cache table. No cost-tracker changes (already records $0 on HIT path because Perplexity is never called).
