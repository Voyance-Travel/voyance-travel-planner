-- 1. trip_notifications
DROP POLICY IF EXISTS "Service role can manage all notifications"
  ON public.trip_notifications;
CREATE POLICY "Service role can manage all notifications"
ON public.trip_notifications
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. credit_balances
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