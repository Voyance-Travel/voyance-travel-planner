-- Create a secure function to lookup user ID by email
-- This function runs with SECURITY DEFINER to access auth.users
-- but only returns the user ID, not any other data
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lookup user by email (case-insensitive)
  SELECT id INTO user_id
  FROM auth.users
  WHERE lower(email) = lower(lookup_email);

  RETURN user_id;
END;
$$;

-- Grant execute permission to authenticated users only
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;