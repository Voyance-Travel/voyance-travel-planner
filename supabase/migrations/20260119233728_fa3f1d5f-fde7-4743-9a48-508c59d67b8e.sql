-- Fix Security Definer View: Convert profiles_public to use security_invoker

-- Step 1: Drop the existing view
DROP VIEW IF EXISTS public.profiles_public;

-- Step 2: Recreate the view WITH security_invoker=on
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url
FROM public.profiles
WHERE handle IS NOT NULL;

-- Step 3: Add RLS policy to allow authenticated users to discover profiles with handles
-- First drop any conflicting policy
DROP POLICY IF EXISTS "Authenticated users discover profiles with handles" ON public.profiles;

-- Create the new policy that allows viewing own profile OR any profile with a handle set
CREATE POLICY "Authenticated users discover profiles with handles"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR handle IS NOT NULL);

-- Step 4: Grant access to authenticated users only
GRANT SELECT ON public.profiles_public TO authenticated;
REVOKE ALL ON public.profiles_public FROM anon;

-- Step 5: Add documentation
COMMENT ON VIEW public.profiles_public IS 
'Public-safe profile view for friend discovery. Uses security_invoker=on to respect RLS. Only exposes id, handle, display_name, and avatar_url for profiles with handles set.';