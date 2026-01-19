
-- Create a secure user audit log function that uses auth.uid() server-side
-- This prevents user_id spoofing since the user_id is determined by the JWT

CREATE OR REPLACE FUNCTION public.insert_user_audit_log(
  p_action text,
  p_action_type text DEFAULT 'general',
  p_target text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
  current_user_id text;
BEGIN
  -- Get user_id from JWT - this is the secure way to determine user identity
  current_user_id := auth.uid()::text;
  
  -- If no authenticated user, still allow logging but mark as anonymous
  INSERT INTO public.audit_logs (action, user_id, actor, target, target_id, action_type, metadata)
  VALUES (
    p_action, 
    current_user_id, 
    COALESCE(current_user_id, 'anonymous'), 
    p_target, 
    p_target_id, 
    p_action_type, 
    p_metadata
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Grant execute to authenticated users (they can log their own actions)
GRANT EXECUTE ON FUNCTION public.insert_user_audit_log TO authenticated;

-- Revoke from anon to prevent unauthenticated logging abuse
REVOKE EXECUTE ON FUNCTION public.insert_user_audit_log FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_user_audit_log FROM public;

-- Add comment
COMMENT ON FUNCTION public.insert_user_audit_log IS 
'Secure audit logging function that uses auth.uid() to determine user_id server-side. Prevents user_id spoofing.';
