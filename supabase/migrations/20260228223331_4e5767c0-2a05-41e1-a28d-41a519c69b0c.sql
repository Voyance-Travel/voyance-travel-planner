DROP VIEW IF EXISTS public.profiles_friends;
CREATE VIEW public.profiles_friends WITH (security_invoker = on) AS
SELECT id, handle, display_name, avatar_url, bio
FROM profiles;