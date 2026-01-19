-- Drop the overly permissive profiles SELECT policy that exposes PII to all authenticated users
-- The profiles_public VIEW already provides safe friend discovery with minimal fields (id, handle, display_name, avatar_url)
DROP POLICY IF EXISTS "Authenticated users can view public profile fields for friend s" ON public.profiles;