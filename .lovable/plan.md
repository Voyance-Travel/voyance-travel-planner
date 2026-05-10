## RS.M10 — Cache lookup-destination-insights (90-day TTL)

The function currently calls Perplexity on every invocation. Sibling lookups (events, advisory) cache. Insights data (language, voltage, emergency #, timezone, water) is essentially static, so a 90-day cache is safe and a big cost win.

### 1. Migration: `destination_insights_cache`

```sql
CREATE TABLE IF NOT EXISTS public.destination_insights_cache (
  destination text PRIMARY KEY,
  insights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days'
);
ALTER TABLE public.destination_insights_cache ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.destination_insights_cache TO service_role;
```

No public RLS policy — only the edge function (service role) reads/writes. Authenticated/anon clients have no access by default once RLS is on, which is the desired posture.

Cache key: `${destination}|${country ?? ''}` lowercased — country is part of the request and changes the lookup, so it must be part of the key (different "Springfield"s).

### 2. Edge function changes — `supabase/functions/lookup-destination-insights/index.ts`

- Add Supabase admin client (using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, same pattern as the other lookup functions).
- Build `cacheKey = `${destination}|${country ?? ''}`.toLowerCase()`.
- **Cache read** before the Perplexity call: select `insights, expires_at` where `destination = cacheKey` and `expires_at > now()`. On hit, return the cached payload in the same shape the function currently emits (`{ success, data, destination, citations }`) with a `cached: true` flag, and skip cost tracking.
- **Cache write** after a successful Perplexity parse: upsert `{ destination: cacheKey, insights: <full success payload>, created_at, expires_at: now + 90d }`. Failures are logged and ignored — never block the response.
- Cost tracker still runs on cache miss only.

### Verification

- `grep -c "destination_insights_cache" supabase/functions/lookup-destination-insights/index.ts` ≥ 2 (read + upsert).
- Manually invoke twice for the same destination; second call returns `cached: true` with no Perplexity log line.

### Out of scope

- Backfilling existing destinations.
- Cache invalidation UI / admin tools.
- Touching the other lookup functions.
