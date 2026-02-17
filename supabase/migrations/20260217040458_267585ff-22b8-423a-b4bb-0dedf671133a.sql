
-- Fix: Allow trip members to see ALL members of trips they belong to
-- Uses the existing is_trip_member() SECURITY DEFINER function to avoid RLS recursion

DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_members;
DROP POLICY IF EXISTS "Users can view members of their trips" ON public.trip_members;

CREATE POLICY "Users can view members of their trips"
ON public.trip_members FOR SELECT
USING (
  -- User is the trip owner
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  -- OR user is a member of this trip (uses SECURITY DEFINER to avoid recursion)
  OR public.is_trip_member(trip_id, auth.uid())
);
