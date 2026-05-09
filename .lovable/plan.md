## Fix 6.1 — Atomic counter increment RPCs

**Goal:** Replace 3 read-modify-write counter patterns with atomic SQL RPCs to eliminate races under concurrent calls. Same shape as `add_to_group_budget` (S1.2 round).

### 1. Migration: `<timestamp>_atomic_counter_rpcs.sql`

Three SECURITY DEFINER functions, service_role-only:

- **`increment_user_usage(p_user_id uuid, p_metric_key text, p_period text, p_amount int) → int`** — `INSERT … ON CONFLICT (user_id, metric_key, period) DO UPDATE SET count = count + EXCLUDED.count, updated_at = now() RETURNING count`. Unique constraint `user_usage_user_id_metric_key_period_key` already exists (verified) — no `ALTER TABLE` needed.
- **`increment_archetype_guide_usage(p_archetype text, p_destination_id uuid) → void`** — `UPDATE archetype_destination_guides SET usage_count = COALESCE(usage_count,0)+1 WHERE …`.
- **`increment_verified_venue_usage(p_place_id text) → void`** — `UPDATE verified_venues SET usage_count = COALESCE(usage_count,0)+1 WHERE place_id = $1`.

Each: `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO service_role;`.

### 2. Call site swaps

**a) `supabase/functions/consume-usage/index.ts`** (~lines 70–98)
Replace the `select id,count` + branching `update`/`insert` block with a single `supabaseClient.rpc('increment_user_usage', { p_user_id, p_metric_key, p_period, p_amount: amount })`. `supabaseClient` is already created with `SUPABASE_SERVICE_ROLE_KEY` — no new admin client needed. Use `rpcResult ?? amount` for `newCount`.

**b) `supabase/functions/generate-itinerary/attraction-matching.ts`** (~lines 188–200)
Replace `currentCount = cached.usage_count ?? 0; update({usage_count: currentCount+1})` with `supabase.rpc('increment_archetype_guide_usage', { p_archetype: archetype, p_destination_id: destinationId })`. Keep the existing try/catch + `console.warn` non-blocking shape. `supabase` here is the edge-function service-role client.

**c) `supabase/functions/_shared/venue-cache.ts`** (~lines 84–89)
Replace fire-and-forget `update({usage_count: row.usage_count+1 || 1})` with fire-and-forget `supabase.rpc('increment_verified_venue_usage', { p_place_id: row.place_id }).then(({error}) => { if (error) console.warn(...) })`. `getSupabase()` already uses `SUPABASE_SERVICE_ROLE_KEY`.

### Verification

```
ls supabase/migrations/ | grep atomic_counter
grep -n "increment_user_usage\b" supabase/functions/consume-usage/index.ts
grep -n "increment_archetype_guide_usage\b" supabase/functions/generate-itinerary/attraction-matching.ts
grep -n "increment_verified_venue_usage\b" supabase/functions/_shared/venue-cache.ts
```

All four expected to return 1+ hit.
