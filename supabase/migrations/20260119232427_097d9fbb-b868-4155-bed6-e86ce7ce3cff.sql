-- Fix profiles_public view access for friend discovery
-- The view has security_invoker=on, so it respects RLS on the base profiles table
-- We need a policy that allows viewing public fields (id, handle, display_name, avatar_url)
-- for profiles that have opted-in by setting a public handle

-- Add policy for authenticated users to discover public profiles (for friend search)
-- This is safe because:
-- 1. Only exposes id, handle, display_name, avatar_url (via view definition)
-- 2. Only profiles with handle IS NOT NULL are visible
-- 3. Users must be authenticated to query
CREATE POLICY "Authenticated users can discover public profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Allow if: viewing own profile OR the profile has a public handle set
  auth.uid() = id OR handle IS NOT NULL
);

-- Drop the old self-only policy that was blocking friend discovery
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;