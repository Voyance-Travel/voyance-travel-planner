
-- Fix 1: Deny anon access to rate_limits table (contains IP addresses)
CREATE POLICY "Deny anon from accessing rate limits"
ON public.rate_limits
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Also revoke direct SELECT privilege from anon as defense in depth
REVOKE SELECT ON public.rate_limits FROM anon;

-- Fix 2: Recreate profiles_friends view with SECURITY INVOKER
-- so it respects RLS on the underlying profiles table
-- First, also restrict it to authenticated users only
DROP VIEW IF EXISTS public.profiles_friends;

CREATE VIEW public.profiles_friends
WITH (security_invoker = true)
AS
SELECT id, handle, display_name, avatar_url, bio
FROM public.profiles
WHERE handle IS NOT NULL;

-- Revoke anon access to the view - only authenticated users should use it
REVOKE ALL ON public.profiles_friends FROM anon;
GRANT SELECT ON public.profiles_friends TO authenticated;
