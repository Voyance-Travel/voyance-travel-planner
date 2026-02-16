-- Fix: trip_collaborators SELECT policy has infinite recursion
-- It self-references trip_collaborators in a subquery, causing postgres to error.
-- Replace with a policy that uses the existing SECURITY DEFINER function is_trip_collaborator()

DROP POLICY IF EXISTS "Users can view relevant collaborations" ON public.trip_collaborators;

CREATE POLICY "Users can view relevant collaborations"
ON public.trip_collaborators
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
  OR public.is_trip_collaborator(trip_collaborators.trip_id, auth.uid())
);

-- Also fix the travel_dna_profiles SELECT policy to use SECURITY DEFINER functions
-- instead of directly querying trip_collaborators (which was cascading the recursion)

DROP POLICY IF EXISTS "Users can view travel DNA" ON public.travel_dna_profiles;

CREATE POLICY "Users can view travel DNA"
ON public.travel_dna_profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM friendships
    WHERE friendships.status = 'accepted'
    AND (
      (friendships.requester_id = auth.uid() AND friendships.addressee_id = travel_dna_profiles.user_id)
      OR (friendships.addressee_id = auth.uid() AND friendships.requester_id = travel_dna_profiles.user_id)
    )
  )
);