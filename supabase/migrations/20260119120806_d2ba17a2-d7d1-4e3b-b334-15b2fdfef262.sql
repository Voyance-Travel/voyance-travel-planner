-- ============================================================================
-- Profiles Security Enhancement: Minimal Public Exposure
-- ============================================================================
-- This migration creates a profiles_public view for friend discovery
-- and tightens the profiles table RLS to prevent scraping sensitive data.

-- 1. Drop existing overly permissive policy
DROP POLICY IF EXISTS "Users can view own profile and friends profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 2. Create strict self-only policy for the full profiles table
-- Users can ONLY see their own complete profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 3. Create a public-safe view for friend discovery
-- This view exposes ONLY the minimum fields needed for friend search
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url
FROM public.profiles;

COMMENT ON VIEW public.profiles_public IS 
'Minimal public view for friend discovery. Exposes only: id, handle, display_name, avatar_url. Uses security_invoker=on so RLS is checked against the invoking user. This prevents scraping sensitive profile data while enabling friend search functionality.';

-- 4. Grant select on the view to authenticated and anon users
-- (The underlying RLS on profiles will control actual visibility)
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;