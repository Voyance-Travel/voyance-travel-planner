## Lock down `generation_logs`

Enable RLS on `public.generation_logs` so the existing SELECT policies start enforcing, and revoke direct write grants from `anon`/`authenticated` so only the service role (used by edge functions) can insert logs.

### Migration

```sql
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Owner read policy (idempotent — drop-if-exists then recreate to align with spec)
DROP POLICY IF EXISTS "generation_logs_owner_read" ON public.generation_logs;
CREATE POLICY "generation_logs_owner_read"
  ON public.generation_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Existing policies ("Admin can view all logs", "Users can view logs for their trips",
-- "Users can read own generation logs") remain and will now actually enforce.
-- No INSERT/UPDATE/DELETE policies for end users — service_role bypasses RLS.

REVOKE INSERT, UPDATE, DELETE ON public.generation_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.generation_logs FROM anon;
```

### Verification

1. Anonymous `SELECT * FROM generation_logs` via PostgREST → 0 rows.
2. Authenticated user `SELECT` → only rows where `user_id = auth.uid()` (and trip-collab rows via existing policy).
3. Edge functions writing with the service role key continue to insert successfully (service_role bypasses RLS and ignores the REVOKE).
4. Re-run Supabase linter — `generation_logs_norls` / `rls_disabled_in_public` findings clear.

### Notes

- No application code changes needed; edge functions already use the service role client for writes.
- Existing duplicate SELECT policies stay in place; they're additive and safe under RLS.
