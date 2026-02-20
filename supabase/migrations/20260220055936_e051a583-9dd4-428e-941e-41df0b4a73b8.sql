-- Fix security definer views by setting security_invoker = on
-- This ensures RLS policies of the querying user are enforced

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on)
AS
SELECT id, handle, display_name, avatar_url
FROM profiles
WHERE handle IS NOT NULL;

CREATE OR REPLACE VIEW public.profiles_friends
WITH (security_invoker = on)
AS
SELECT id, handle, display_name, avatar_url, bio
FROM profiles
WHERE handle IS NOT NULL;