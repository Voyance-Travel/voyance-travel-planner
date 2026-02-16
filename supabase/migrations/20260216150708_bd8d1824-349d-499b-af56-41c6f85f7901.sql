
-- Fix: Allow trip collaborators to see all other collaborators on trips they belong to
-- Current policy only allows: own rows OR owner's view
-- New policy adds: accepted collaborators can see all collaborators on their trips

DROP POLICY IF EXISTS "Users can view relevant collaborations" ON public.trip_collaborators;

CREATE POLICY "Users can view relevant collaborations"
ON public.trip_collaborators
FOR SELECT
TO authenticated
USING (
  -- User can see their own collaborator rows
  user_id = auth.uid()
  -- Trip owner can see all collaborators
  OR EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
  -- Accepted collaborators can see all other collaborators on the same trip
  OR EXISTS (
    SELECT 1 FROM trip_collaborators tc2
    WHERE tc2.trip_id = trip_collaborators.trip_id
    AND tc2.user_id = auth.uid()
    AND tc2.accepted_at IS NOT NULL
  )
);
