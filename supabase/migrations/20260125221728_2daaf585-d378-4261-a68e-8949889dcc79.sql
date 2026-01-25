-- Create a friends-safe view for profile data that limits exposed columns
-- This view only exposes non-sensitive fields appropriate for friends to see
-- Sensitive fields like first_name, last_name, home_airport, travel_dna, travel_dna_overrides are excluded

-- Drop existing view if any
DROP VIEW IF EXISTS public.profiles_friends;

-- Create the friends view with only safe columns
CREATE VIEW public.profiles_friends AS
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
'Friend-safe profile view. Excludes sensitive fields like first_name, last_name, home_airport, travel_dna. Use for friend profile lookups instead of querying profiles table directly.';