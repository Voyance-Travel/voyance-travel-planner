
-- Fix: Recreate profiles_friends and profiles_public views WITHOUT security_invoker
-- These views intentionally expose only safe fields (id, handle, display_name, avatar_url, bio)
-- and should be readable by any authenticated user for social features (friend lists, notifications).
-- The security_invoker=true setting caused RLS on profiles (own-profile-only) to block all cross-user lookups.

-- Fix profiles_friends view
DROP VIEW IF EXISTS public.profiles_friends;

CREATE VIEW public.profiles_friends AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url,
  bio
FROM public.profiles
WHERE handle IS NOT NULL;

-- Only authenticated users can query
REVOKE ALL ON public.profiles_friends FROM anon;
GRANT SELECT ON public.profiles_friends TO authenticated;

COMMENT ON VIEW public.profiles_friends IS 
'Friend-safe profile view. Excludes sensitive fields. No security_invoker so authenticated users can look up any profile with a handle.';

-- Fix profiles_public view (same issue)
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url
FROM public.profiles
WHERE handle IS NOT NULL;

REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;

COMMENT ON VIEW public.profiles_public IS 
'Public-safe profile view for discovery. Only exposes minimal fields. No security_invoker so authenticated users can search profiles.';
