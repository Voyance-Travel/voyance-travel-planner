## Lock down `route_cache` writes to service role only

**Current state:** `route_cache` has a single policy `"Service role full access"` targeting `{public}` with `USING (true)` for ALL commands — anon and authenticated can read AND write, enabling cache poisoning.

**Migration:**

```sql
-- Drop the misconfigured catch-all policy
DROP POLICY IF EXISTS "Service role full access" ON public.route_cache;

-- Ensure RLS is on (it is, but assert)
ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

-- Public read (cache values non-sensitive; lets edge + client reuse)
CREATE POLICY "route_cache_public_read"
  ON public.route_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Explicit service-role write policy (clears lint; service_role bypasses RLS anyway)
CREATE POLICY "route_cache_service_role_write"
  ON public.route_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Belt-and-suspenders: revoke table-level write grants from client roles
REVOKE INSERT, UPDATE, DELETE ON public.route_cache FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.route_cache FROM authenticated;
```

**Why this shape**
- The existing policy literally named "Service role full access" was applied to `{public}` (all roles) instead of `{service_role}` — the user-quoted exact bug. Replacing it removes the write path for anon/authenticated.
- No new write policy for anon/authenticated → all client writes denied by RLS.
- `REVOKE` adds a second gate at the GRANT layer in case a future policy is added by mistake.
- Service role bypasses RLS, so all edge functions using `SUPABASE_SERVICE_ROLE_KEY` continue to insert/update/delete cache entries unchanged.

**Verification after apply**
1. `SELECT count(*) FROM route_cache` as anon → succeeds.
2. `INSERT INTO route_cache ...` as anon/authenticated → 403 / RLS violation.
3. Run a trip generation that triggers route lookup → cache writes succeed via service role; cache hits work on subsequent client reads.
4. Re-check Supabase security panel → `route_cache_fully_public` / `route_cache_public` findings clear.

**No code changes needed** — `route_cache` is only written from edge functions using the service-role key.
