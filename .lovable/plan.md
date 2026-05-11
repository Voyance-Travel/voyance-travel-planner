# R10: Harden Service-Role Policies (auth.jwt → auth.role)

## Problem
Three RLS policies gate service-role access via `auth.jwt() ->> 'role' = 'service_role'`, which reads the raw JWT claim and is forgeable if the JWT secret leaks. The verified pattern `auth.role() = 'service_role'` (used by 6 other migrations in the project) reads the GUC session context set by PostgREST after signature verification.

Confirmed via `pg_policies`:
- `credit_balances` → "Service role can manage credit balances" (qual: jwt())
- `credit_ledger` → "Service role can insert credit ledger entries" (with_check: jwt())
- `trip_notifications` → "Service role can manage all notifications" (qual: jwt())

No other policies on these tables would be affected; the surrounding owner/admin/collaborator policies are unchanged.

## Migration

```sql
-- 1. trip_notifications (FOR ALL)
DROP POLICY IF EXISTS "Service role can manage all notifications"
  ON public.trip_notifications;
CREATE POLICY "Service role can manage all notifications"
ON public.trip_notifications
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. credit_balances (FOR ALL)
DROP POLICY IF EXISTS "Service role can manage credit balances"
  ON public.credit_balances;
CREATE POLICY "Service role can manage credit balances"
ON public.credit_balances
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. credit_ledger (INSERT-only — WITH CHECK, no USING)
DROP POLICY IF EXISTS "Service role can insert credit ledger entries"
  ON public.credit_ledger;
CREATE POLICY "Service role can insert credit ledger entries"
ON public.credit_ledger
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');
```

## Verification (post-migration)

```sql
-- Expect: qual / with_check show "auth.role() = 'service_role'"
SELECT tablename, policyname, qual, with_check FROM pg_policies
WHERE tablename IN ('trip_notifications','credit_balances','credit_ledger')
  AND policyname LIKE 'Service role%';

-- Expect: 0 rows project-wide
SELECT tablename, policyname FROM pg_policies
WHERE qual LIKE '%auth.jwt() ->> ''role''%'
   OR with_check LIKE '%auth.jwt() ->> ''role''%';
```

## Service-role smoke tests (must pass — else roll back)

1. **Stripe** — test-mode purchase → `stripe-webhook` inserts `credit_ledger` row.
2. **Reminders** — manual invoke `send-trip-reminders` → `trip_notifications` insert succeeds.
3. **Spend** — in-app credit-spending action → `credit_balances` updates via service-role edge fn.

## Memory
On success, append a short Core entry referencing R10 and the `auth.role()` standard so future scanners and the agent never re-introduce `auth.jwt() ->> 'role'` for service-role checks.

## Out of scope
No frontend changes. No other policies altered. No code edits.
