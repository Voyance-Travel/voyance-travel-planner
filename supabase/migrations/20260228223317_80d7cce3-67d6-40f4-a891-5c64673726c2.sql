CREATE OR REPLACE VIEW public.profiles_friends AS
SELECT id, handle, display_name, avatar_url, bio
FROM profiles;