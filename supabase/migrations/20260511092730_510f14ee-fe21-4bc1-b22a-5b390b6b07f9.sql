-- PII-safe view for peer trip-collaborator reads
CREATE OR REPLACE VIEW public.public_trip_collaborators
WITH (security_barrier = true) AS
SELECT
  tc.id,
  tc.trip_id,
  tc.permission AS role,
  tc.accepted_at,
  tc.created_at,
  COALESCE(p.display_name, 'Member ' || SUBSTRING(tc.id::text FROM 1 FOR 8)) AS member_display,
  p.avatar_url
FROM public.trip_collaborators tc
LEFT JOIN public.profiles p ON p.id = tc.user_id;

GRANT SELECT ON public.public_trip_collaborators TO authenticated;
REVOKE SELECT ON public.public_trip_collaborators FROM anon, PUBLIC;

-- Lock base table from anon/public
REVOKE SELECT ON public.trip_collaborators FROM anon, PUBLIC;

-- Drop existing peer-readable SELECT policy + any stale variants
DROP POLICY IF EXISTS "Users can view relevant collaborations" ON public.trip_collaborators;
DROP POLICY IF EXISTS "trip_owner_collaborator_read" ON public.trip_collaborators;
DROP POLICY IF EXISTS "self_collaborator_read" ON public.trip_collaborators;

-- Owner reads all collaborators on their trips
CREATE POLICY "trip_owner_collaborator_read" ON public.trip_collaborators
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_collaborators.trip_id AND t.user_id = auth.uid()
  ));

-- Each user reads their own collaborator row
CREATE POLICY "self_collaborator_read" ON public.trip_collaborators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());