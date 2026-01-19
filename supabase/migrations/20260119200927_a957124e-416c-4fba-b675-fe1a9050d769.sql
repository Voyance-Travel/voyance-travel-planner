-- Fix the profiles_public view - use security_invoker with a specific public profiles RLS policy
-- This is safer than security_definer as it respects RLS

-- Drop the current view
DROP VIEW IF EXISTS public.profiles_public;

-- Recreate with security_invoker (respects RLS)
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id, 
  handle, 
  display_name, 
  avatar_url
FROM public.profiles
WHERE handle IS NOT NULL;

-- Grant access to authenticated users for friend search
GRANT SELECT ON public.profiles_public TO authenticated;

-- Revoke anon access
REVOKE ALL ON public.profiles_public FROM anon;

-- Now add an RLS policy that allows authenticated users to see minimal public profile data
-- This is separate from the "view own profile" policy
CREATE POLICY "Authenticated users can view public profile fields for friend search"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing if profile has a public handle set
    handle IS NOT NULL
  );

COMMENT ON VIEW public.profiles_public IS 'Public profile fields for friend search. Uses security_invoker to respect RLS. Only exposes id, handle, display_name, avatar_url for profiles with handles.';