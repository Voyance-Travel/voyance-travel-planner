## RLS audit — no tables found with RLS disabled

### Findings

Running the user's exact query against `pg_class` returned **0 rows** — every table in the `public` schema already has RLS enabled, including `generation_logs` (`relrowsecurity = true`). The two scanner findings reporting `generation_logs` as RLS-disabled are **stale** (already remediated in a prior migration).

### Adjacent issue worth fixing

The Supabase linter still reports 5 INFO-level `RLS Enabled No Policy` warnings. RLS is on, but no policies exist — i.e., the table is currently **deny-all** to anon/auth (only service role can read/write). That's safe but signals intent should be made explicit. The tables are:

| Table | Purpose | Recommended policy |
|---|---|---|
| `chat_idempotency_cache` | Server-side idempotency keys for chat actions | service-role only (explicit) |
| `destination_insights_cache` | Server-cached AI destination insights | service-role only |
| `google_places_search_cache` | Server-cached Google Places lookups | service-role only |
| `stripe_webhook_log` | Stripe webhook delivery log | service-role only |
| `travel_intel_locks` | Server-side mutex for travel-intel generation | service-role only |

All five are server-only caches/logs — no client code reads them. Adding an explicit `TO service_role USING (true) WITH CHECK (true)` policy clears the lint without loosening security (service role bypasses RLS anyway; this is purely documentation/lint silencing).

### Migration

```sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chat_idempotency_cache',
    'destination_insights_cache',
    'google_places_search_cache',
    'stripe_webhook_log',
    'travel_intel_locks'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "Service role full access" ON public.%I
         FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
```

### Verification

1. Re-run the user's RLS-disabled query → still 0 rows.
2. Re-run `supabase--linter` → the 5 `RLS Enabled No Policy` INFO warnings drop off.
3. App functions unchanged — no client code touches these tables, service role still has full access.

### Files

- New migration: `supabase/migrations/<ts>_explicit_service_role_policies.sql`

No code changes — these tables are read/written only by edge functions using the service role.

### Note on the stale scanner findings

The two `generation_logs` / `SUPA_rls_disabled_in_public` findings in the security panel are no longer accurate (DB state has been remediated). After this migration is applied, recommend running a fresh security scan so they clear out.
