GRANT SELECT ON public.public_trip_collaborators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_collaborators TO authenticated;
REVOKE SELECT ON public.trip_collaborators FROM anon, PUBLIC;
REVOKE SELECT ON public.public_trip_collaborators FROM anon, PUBLIC;