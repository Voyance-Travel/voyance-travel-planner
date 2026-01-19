-- Fix security issues: profiles exposure, trip_members email exposure, profiles_public RLS

-- =========================================
-- FIX 1: profiles_table_public_exposure
-- The policy "Authenticated users discover profiles with handles" exposes FULL profile data
-- We need to restrict full profile access to self-only, discovery happens via profiles_public view
-- =========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users discover profiles with handles" ON public.profiles;

-- Keep only self-access for full profile data (should already exist, but ensure it)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- =========================================
-- FIX 2: Recreate profiles_public WITHOUT security_invoker
-- Since profiles now only allows self-access, security_invoker would block discovery
-- The view itself only exposes safe fields, so bypassing RLS is acceptable here
-- =========================================

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url
FROM public.profiles
WHERE handle IS NOT NULL;

-- Grant to authenticated only
GRANT SELECT ON public.profiles_public TO authenticated;
REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.profiles_public FROM public;

COMMENT ON VIEW public.profiles_public IS 
'Public-safe profile view for friend discovery. Only exposes id, handle, display_name, avatar_url for profiles with handles set. Accessible only to authenticated users. Does not use security_invoker because the base table restricts to self-only, but this view intentionally exposes minimal safe fields for discovery.';

-- =========================================
-- FIX 3: trip_members_email_exposure
-- Create a function to check if user is trip owner
-- Then update trip_members_safe view to mask emails for non-owners
-- =========================================

-- Recreate trip_members_safe view with proper email masking
DROP VIEW IF EXISTS public.trip_members_safe;

CREATE VIEW public.trip_members_safe
WITH (security_invoker = on) AS
SELECT 
  tm.id,
  tm.trip_id,
  tm.user_id,
  tm.name,
  -- Only show email to trip owner, mask for other participants
  CASE 
    WHEN public.is_trip_owner(tm.trip_id) THEN tm.email
    WHEN tm.user_id = auth.uid() THEN tm.email  -- Users can see their own email
    ELSE '***@***.***'  -- Masked for other participants
  END AS email,
  tm.role,
  tm.invited_at,
  tm.accepted_at,
  tm.created_at,
  tm.updated_at
FROM public.trip_members tm;

-- Grant access
GRANT SELECT ON public.trip_members_safe TO authenticated;
REVOKE ALL ON public.trip_members_safe FROM anon;
REVOKE ALL ON public.trip_members_safe FROM public;

COMMENT ON VIEW public.trip_members_safe IS 
'Safe view of trip_members that masks email addresses. Only trip owners and the member themselves can see full email addresses. Other participants see masked emails for privacy.';