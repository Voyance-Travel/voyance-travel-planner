-- Q43 watch-list — restore as admin-only after finding 2 callers
-- (SessionExplorer.tsx admin tool needs get_user_id_by_email; collab call was dead code being removed in TS).
-- Stronger than rate-limiting: only role=admin can enumerate, blocking authenticated user enumeration entirely.

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role('admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO found_user_id
  FROM auth.users
  WHERE lower(email) = lower(lookup_email);

  RETURN found_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_info_by_email(lookup_email text)
RETURNS TABLE(user_id uuid, user_email text, display_name text, first_name text, last_name text, handle text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role('admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, p.display_name, p.first_name, p.last_name, p.handle
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(lookup_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_info_by_email(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_id_by_email(text)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_info_by_email(text) TO authenticated;