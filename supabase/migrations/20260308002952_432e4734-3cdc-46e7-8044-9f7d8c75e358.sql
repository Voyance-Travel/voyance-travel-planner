DROP POLICY IF EXISTS "Service role can insert IAP transactions" ON public.iap_transactions;

-- Only service_role should insert (via edge function), no user-level insert policy needed.
-- The edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.