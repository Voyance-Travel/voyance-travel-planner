-- Remove client-side INSERT policy - audit logs should only be inserted server-side
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;

-- Create a security definer function for server-side audit log insertion
-- This function bypasses RLS and should only be called from edge functions with service role
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action TEXT,
  p_user_id TEXT DEFAULT NULL,
  p_actor TEXT DEFAULT NULL,
  p_target TEXT DEFAULT NULL,
  p_target_id TEXT DEFAULT NULL,
  p_action_type TEXT DEFAULT 'general',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.audit_logs (action, user_id, actor, target, target_id, action_type, metadata)
  VALUES (p_action, p_user_id, p_actor, p_target, p_target_id, p_action_type, p_metadata)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Revoke execute from public, only service role (edge functions) should call this
REVOKE EXECUTE ON FUNCTION public.insert_audit_log FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log FROM authenticated;

-- Add a comment explaining the security model
COMMENT ON FUNCTION public.insert_audit_log IS 'Server-side only audit log insertion. Call from edge functions with service role key.';