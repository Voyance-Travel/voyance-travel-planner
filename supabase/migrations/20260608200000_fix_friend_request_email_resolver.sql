-- Fix: friend-request-by-email resolved to the WRONG user.
--
-- The `friend-request-by-email` edge function called `get_user_id_by_email`, which is
-- admin-gated (requires auth.uid() + admin role). The edge fn's service-role client has
-- no auth.uid(), so that RPC always threw "Not authenticated" and the code fell through to
-- `admin.auth.admin.listUsers({ filter: 'email.eq.<email>' })`. GoTrue's listUsers ignores
-- that `filter` param, so it returned the FIRST user in the list regardless of the email —
-- routing every friend request to the wrong person.
--
-- This service-role-only resolver does an exact lower(email) match. It is EXECUTE-granted
-- to service_role ONLY (revoked from public/anon/authenticated), so clients cannot call it
-- directly; enumeration safety is preserved by the edge function's identical ACK response.

CREATE OR REPLACE FUNCTION public.get_user_id_by_email_service(lookup_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(lookup_email) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email_service(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_id_by_email_service(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email_service(text) TO service_role;
