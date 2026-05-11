-- Q43 watch-list remediation
-- Approved-class accepted-finding rationale lives in @security-memory + mem://constraints/security/security-definer-accepted-class
-- Date: 2026-05-11

-- (1) Drop unused PII-enumeration vector. Zero callers in repo (src/, supabase/functions/, migrations).
-- auth.uid() IS NOT NULL guard is insufficient against authenticated enumeration at scale.
DROP FUNCTION IF EXISTS public.get_user_id_by_email(text);

-- (2) Same family, returns more PII (email, display_name, names, handle). Zero callers.
DROP FUNCTION IF EXISTS public.get_user_info_by_email(text);

-- (3) get_intake_account: keep, but lock to service_role. Token is a secret; should be validated
-- server-side via an edge function, not callable by anon/authenticated PostgREST clients.
REVOKE EXECUTE ON FUNCTION public.get_intake_account(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_intake_account(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_intake_account(text) TO service_role;