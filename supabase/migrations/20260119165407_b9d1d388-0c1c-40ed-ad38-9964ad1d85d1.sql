-- ============================================
-- Security Fixes Migration
-- ============================================

-- 1. FIX: profiles_public_unauthenticated (ERROR)
-- Revoke anonymous access to prevent user enumeration attacks
REVOKE SELECT ON public.profiles_public FROM anon;

-- Keep authenticated access for friend discovery
-- GRANT SELECT ON public.profiles_public TO authenticated; (already granted)

-- 2. FIX: Strengthen service-role-only policies with auth.role() check
-- This adds defense-in-depth - policies only work when service_role is actually used

-- Fix credit_transactions insert policy
DROP POLICY IF EXISTS "Service role can insert credit transactions" ON public.credit_transactions;

CREATE POLICY "Service role can insert credit transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Fix user_credits policies - make them service_role only
DROP POLICY IF EXISTS "Service role can modify credits" ON public.user_credits;

CREATE POLICY "Service role can modify user credits"
  ON public.user_credits FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update user credits"
  ON public.user_credits FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Fix audit_logs insert policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Add documentation comments
COMMENT ON POLICY "Service role can insert credit transactions" ON credit_transactions IS 
'Restricted to service_role for edge function use only. Validates auth.role() for defense in depth.';

COMMENT ON POLICY "Service role can modify user credits" ON user_credits IS 
'Restricted to service_role for edge function use only.';

COMMENT ON POLICY "Service role can insert audit logs" ON audit_logs IS 
'Restricted to service_role for edge function use only.';