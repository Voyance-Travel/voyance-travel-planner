-- Fix profiles_public view to use security_definer instead of security_invoker
-- This allows friend search to work while still only exposing safe public fields

-- Drop the existing view
DROP VIEW IF EXISTS public.profiles_public;

-- Recreate with security_definer to bypass RLS (view only exposes safe fields)
CREATE VIEW public.profiles_public
WITH (security_barrier = true) AS
SELECT 
  id, 
  handle, 
  display_name, 
  avatar_url
FROM public.profiles
WHERE handle IS NOT NULL;  -- Only show profiles with public handles set

-- Grant access to authenticated users for friend search
GRANT SELECT ON public.profiles_public TO authenticated;

-- Revoke anon access - only logged in users should search for friends
REVOKE ALL ON public.profiles_public FROM anon;

COMMENT ON VIEW public.profiles_public IS 'Public profile fields for friend search. Uses security_barrier to prevent leaking private data through query optimization. Only exposes id, handle, display_name, avatar_url.';