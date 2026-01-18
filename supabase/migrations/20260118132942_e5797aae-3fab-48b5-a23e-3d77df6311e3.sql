-- Fix the audit_logs INSERT policy to be more restrictive
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Only authenticated users can insert their own audit logs
CREATE POLICY "Users can insert own audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);