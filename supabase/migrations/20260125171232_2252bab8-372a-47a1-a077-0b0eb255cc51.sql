-- Update the RPC function to return user info including email for display purposes
CREATE OR REPLACE FUNCTION public.get_user_info_by_email(lookup_email text)
RETURNS TABLE(user_id uuid, user_email text, display_name text, first_name text, last_name text, handle text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lookup user by email (case-insensitive) and join with profile
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email as user_email,
    p.display_name,
    p.first_name,
    p.last_name,
    p.handle
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(lookup_email);
END;
$$;