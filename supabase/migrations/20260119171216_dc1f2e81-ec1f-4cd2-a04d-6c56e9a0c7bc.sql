-- Create a safe profiles view that masks PII
-- This view excludes sensitive fields: first_name, last_name, bio, home_airport

-- Drop if exists to recreate cleanly
DROP VIEW IF EXISTS public.profiles_safe;

-- Create the safe view with security_invoker
CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url,
  preferred_currency,
  preferred_language,
  quiz_completed,
  travel_dna,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to authenticated users only
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Revoke from anon to prevent unauthenticated access
REVOKE ALL ON public.profiles_safe FROM anon;

-- Add comment documenting the security purpose
COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles excluding PII fields (first_name, last_name, bio, home_airport). Use this view for general profile queries. The profiles_public view is for friend discovery (minimal fields only).';