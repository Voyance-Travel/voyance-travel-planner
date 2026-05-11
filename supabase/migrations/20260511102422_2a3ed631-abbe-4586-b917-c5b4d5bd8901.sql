-- 1. Recreate the safe public view (security barrier + invoker, internally scoped)
DROP VIEW IF EXISTS public.public_trip_collaborators;

CREATE VIEW public.public_trip_collaborators
WITH (security_barrier = true, security_invoker = true) AS
SELECT
  tc.id,
  tc.trip_id,
  tc.user_id,
  tc.permission AS role,
  tc.accepted_at,
  tc.created_at,
  COALESCE(
    p.display_name,
    'Member ' || SUBSTRING(tc.id::text FROM 1 FOR 8)
  ) AS member_display,
  p.avatar_url
FROM public.trip_collaborators tc
LEFT JOIN public.profiles p ON p.id = tc.user_id
WHERE EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = tc.trip_id AND t.user_id = auth.uid()
      )
   OR EXISTS (
        SELECT 1 FROM public.trip_collaborators me
        WHERE me.trip_id = tc.trip_id
          AND me.user_id = auth.uid()
          AND me.accepted_at IS NOT NULL
      );

GRANT SELECT ON public.public_trip_collaborators TO authenticated;
REVOKE ALL ON public.public_trip_collaborators FROM anon, PUBLIC;

-- 2. Lock the base table down for anon / PUBLIC
REVOKE SELECT ON public.trip_collaborators FROM anon;
REVOKE SELECT ON public.trip_collaborators FROM PUBLIC;

-- 3. Re-state the two SELECT policies cleanly
DROP POLICY IF EXISTS "trip_owner_collaborator_read" ON public.trip_collaborators;
DROP POLICY IF EXISTS "self_collaborator_read" ON public.trip_collaborators;

CREATE POLICY "trip_owner_collaborator_read" ON public.trip_collaborators
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_collaborators.trip_id AND t.user_id = auth.uid()
  )
);

CREATE POLICY "self_collaborator_read" ON public.trip_collaborators
FOR SELECT TO authenticated
USING (user_id = auth.uid());