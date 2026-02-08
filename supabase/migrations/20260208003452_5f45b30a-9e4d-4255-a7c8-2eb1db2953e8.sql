
-- The existing FK points to auth.users, not public.profiles.
-- Add an explicit FK to profiles so PostgREST can resolve the relationship.
ALTER TABLE public.trip_collaborators
  ADD CONSTRAINT trip_collaborators_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.trip_collaborators
  ADD CONSTRAINT trip_collaborators_invited_by_profiles_fkey
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
