
-- Step 1: Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_trip_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT trip_id FROM trip_members WHERE user_id = uid
  UNION
  SELECT id FROM trips WHERE user_id = uid
  UNION
  SELECT trip_id FROM trip_collaborators WHERE user_id = uid AND accepted_at IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_trip_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_trip_ids TO authenticated;

-- Step 2: Replace the broken RLS policy
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_members;
DROP POLICY IF EXISTS "Users can view members of their trips" ON public.trip_members;

CREATE POLICY "Users can view trip members"
ON public.trip_members FOR SELECT TO authenticated
USING (
  trip_id IN (SELECT public.get_user_trip_ids(auth.uid()))
);
