-- Fix the SECURITY DEFINER warning by setting SECURITY INVOKER on the view
-- This ensures the view respects RLS policies of the calling user, not the view creator

-- Recreate the view with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_friends;

CREATE VIEW public.profiles_friends 
WITH (security_invoker = on)
AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url,
  bio
FROM public.profiles
WHERE handle IS NOT NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_friends TO authenticated;

-- Add comment explaining purpose
COMMENT ON VIEW public.profiles_friends IS 
'Friend-safe profile view with security_invoker=on. Excludes sensitive fields. Respects RLS of the calling user.';