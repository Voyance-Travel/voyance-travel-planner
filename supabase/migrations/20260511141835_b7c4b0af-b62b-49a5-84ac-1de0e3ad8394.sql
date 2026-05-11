-- Tighten cross-member PII exposure on trip_members and trip_invites,
-- and restrict audit_logs INSERT to service_role only.

-- 1. trip_members: drop the broad collaborator-read policy that exposed
--    every member row (including email) to any same-trip user.
--    Owner-read and self-read policies remain. Cross-member listings must
--    now go through the existing `public.trip_members_safe` view, which
--    masks email for non-owners.
DROP POLICY IF EXISTS "trip_members_collab_read_nonpii" ON public.trip_members;

-- Defense in depth: revoke direct column access on email for client roles.
-- Service role bypasses grants and continues to work for invite acceptance
-- and other server-side flows. The `trip_members_safe` view exposes email
-- only via its CASE expression.
REVOKE SELECT (email) ON public.trip_members FROM anon, authenticated;

-- 2. trip_invites: drop the overlapping permissive policy that re-granted
--    SELECT on the email column to any invited_by/accepted_by/owner row.
--    The remaining policies already cover the legitimate paths:
--      - Trip owners can manage invites (FOR ALL) → owners see everything
--      - Users can view their own invites (email-match) → invitee sees own row
DROP POLICY IF EXISTS "Users can view relevant invites" ON public.trip_invites;

-- 3. audit_logs: the existing INSERT policy targets the {public} pg role
--    but only fires when auth.role()='service_role'. Re-create it scoped
--    explicitly TO service_role so the policy's intent matches its grant
--    and no authenticated client could trip the policy via a misconfigured
--    SECURITY DEFINER path.
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

REVOKE INSERT ON public.audit_logs FROM anon, authenticated;