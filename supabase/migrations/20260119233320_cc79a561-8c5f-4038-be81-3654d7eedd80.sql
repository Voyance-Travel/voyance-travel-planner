-- Fix profiles_handle_exposure: Restrict profiles to self-only access
-- Fix profiles_public_view_unrestricted: Enable proper access to safe view

-- Step 1: Drop the overly permissive policy that exposes all profile fields
DROP POLICY IF EXISTS "Authenticated users can discover public profiles" ON public.profiles;

-- Step 2: Create self-only access policy for profiles table
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Step 3: Recreate profiles_public view WITHOUT security_invoker
-- This allows it to bypass RLS but only expose safe fields
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
  SELECT 
    id,
    handle,
    display_name,
    avatar_url
  FROM public.profiles
  WHERE handle IS NOT NULL;

-- Step 4: Grant access to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Step 5: Revoke from anon to prevent unauthenticated enumeration
REVOKE ALL ON public.profiles_public FROM anon;

-- Add comment explaining the security model
COMMENT ON VIEW public.profiles_public IS 
'Public-safe profile view for friend discovery. Only exposes id, handle, display_name, and avatar_url for profiles with handles set. Accessible only to authenticated users.';