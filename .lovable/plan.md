# S6.1 — Atomic counter RPCs

Three call sites do read-modify-write on counter columns from JS, which loses increments under concurrent calls (two requests both read N, both write N+1, true value should be N+2). Fix is one migration adding three `SECURITY DEFINER` RPCs that do the increment atomically inside Postgres, plus three small caller swaps.

## 1. Migration

`supabase/migrations/<timestamp>_atomic_counter_rpcs.sql` — three functions, all `SECURITY DEFINER`, `search_path = public`, `volatile`, granted to `authenticated` and `service_role`:

### a. `increment_user_usage(p_user_id uuid, p_metric_key text, p_period text, p_amount int)` returns `int`
```sql
INSERT INTO public.user_usage (user_id, metric_key, period, count, updated_at)
VALUES (p_user_id, p_metric_key, p_period, p_amount, now())
ON CONFLICT (user_id, metric_key, period)
DO UPDATE SET count = user_usage.count + EXCLUDED.count,
              updated_at = now()
RETURNING count;
```
Requires unique constraint on `(user_id, metric_key, period)` — verify it exists; add it in this migration if not.

### b. `bump_venue_usage(p_place_id text)` returns `void`
```sql
UPDATE public.verified_venues
SET usage_count = COALESCE(usage_count, 0) + 1,
    updated_at = now()
WHERE place_id = p_place_id;
```

### c. `bump_archetype_guide_usage(p_archetype text, p_destination_id uuid)` returns `void`
```sql
UPDATE public.archetype_destination_guides
SET usage_count = COALESCE(usage_count, 0) + 1
WHERE archetype = p_archetype AND destination_id = p_destination_id;
```

## 2. Caller swaps (no behaviour change)

- `supabase/functions/consume-usage/index.ts` (lines 47–72): replace the `select → if existing then update else insert` block with a single `supabase.rpc('increment_user_usage', { p_user_id, p_metric_key, p_period: currentPeriod, p_amount: amount })`. Use returned `count` for the response.
- `supabase/functions/generate-itinerary/attraction-matching.ts` (lines 189–200): replace the read/write with `supabase.rpc('bump_archetype_guide_usage', { p_archetype: archetype, p_destination_id: destinationId })`. Keep the try/catch (non-blocking).
- `supabase/functions/_shared/venue-cache.ts` (line 87 fire-and-forget): replace the `.update({ usage_count: ... })` with `supabase.rpc('bump_venue_usage', { p_place_id: row.place_id })`. Keep fire-and-forget pattern.

## 3. Verify

```
grep -nE "\.update\(\{[^}]*usage_count|user_usage'\)\s*\.(select|update|insert)" \
  supabase/functions/consume-usage/index.ts \
  supabase/functions/generate-itinerary/attraction-matching.ts \
  supabase/functions/_shared/venue-cache.ts
```
Expected: 0 hits. All three sites now go through `supabase.rpc(...)`.

## Notes

- Service-role bypasses RLS, so no policy changes needed; granting `EXECUTE` to `service_role` is belt-and-suspenders.
- `user_usage` upsert needs the unique index — the migration will add `CREATE UNIQUE INDEX IF NOT EXISTS user_usage_user_metric_period_uidx ON public.user_usage (user_id, metric_key, period);` defensively.
- No client-side / UI changes.
