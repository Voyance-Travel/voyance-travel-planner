DROP VIEW IF EXISTS public.public_trip_members;

CREATE VIEW public.public_trip_members
WITH (security_barrier = true, security_invoker = on) AS
SELECT
  tm.id,
  tm.trip_id,
  tm.user_id,
  tm.name,
  tm.role,
  tm.invited_at,
  tm.accepted_at,
  COALESCE(
    p.display_name,
    tm.name,
    'Member ' || SUBSTRING(tm.id::text FROM 1 FOR 8)
  ) AS member_display,
  p.avatar_url
FROM public.trip_members tm
LEFT JOIN public.profiles p ON p.id = tm.user_id
WHERE EXISTS (
  SELECT 1 FROM public.trips t
  WHERE t.id = tm.trip_id AND t.user_id = auth.uid()
)
OR EXISTS (
  SELECT 1 FROM public.trip_members me
  WHERE me.trip_id = tm.trip_id AND me.user_id = auth.uid()
);

GRANT SELECT ON public.public_trip_members TO authenticated;
REVOKE ALL ON public.public_trip_members FROM anon, PUBLIC;

DROP POLICY IF EXISTS "Users can view members of their trips" ON public.trip_members;
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_members;
DROP POLICY IF EXISTS "Trip owner sees all members" ON public.trip_members;
DROP POLICY IF EXISTS "Self sees own membership row" ON public.trip_members;

CREATE POLICY "Trip owner sees all members" ON public.trip_members
FOR SELECT TO authenticated
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
);

CREATE POLICY "Self sees own membership row" ON public.trip_members
FOR SELECT TO authenticated
USING (user_id = auth.uid());