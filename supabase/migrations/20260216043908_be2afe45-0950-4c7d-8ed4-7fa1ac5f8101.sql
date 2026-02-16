-- Fix 1: trip_suggestions SELECT policy - collaborator check wrongly references trip_suggestions.status
DROP POLICY IF EXISTS "Authenticated users can read suggestions for their trips" ON public.trip_suggestions;
CREATE POLICY "Authenticated users can read suggestions for their trips"
ON public.trip_suggestions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_suggestions.trip_id AND trips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM trip_collaborators WHERE trip_collaborators.trip_id = trip_suggestions.trip_id AND trip_collaborators.user_id = auth.uid() AND trip_collaborators.accepted_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM agency_trips WHERE agency_trips.id = trip_suggestions.trip_id AND (agency_trips.agent_id = auth.uid() OR agency_trips.share_enabled = true))
);

-- Fix 2: trip_suggestions INSERT policy - same status bug
DROP POLICY IF EXISTS "Authenticated users can insert suggestions" ON public.trip_suggestions;
CREATE POLICY "Authenticated users can insert suggestions"
ON public.trip_suggestions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_suggestions.trip_id AND trips.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM trip_collaborators WHERE trip_collaborators.trip_id = trip_suggestions.trip_id AND trip_collaborators.user_id = auth.uid() AND trip_collaborators.accepted_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM agency_trips WHERE agency_trips.id = trip_suggestions.trip_id AND agency_trips.agent_id = auth.uid())
  )
);

-- Fix 3: trip_members SELECT - guests can see all members on their trip
DROP POLICY IF EXISTS "Users can view members of their trips" ON public.trip_members;
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_members;
CREATE POLICY "Users can view trip members"
ON public.trip_members FOR SELECT TO authenticated
USING (
  trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  OR user_id = auth.uid()
  OR trip_id IN (SELECT trip_id FROM trip_collaborators WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)
);

-- Fix 4: travel_dna_profiles SELECT - allow friends and trip collaborators to view DNA
DROP POLICY IF EXISTS "Users can view own travel DNA" ON public.travel_dna_profiles;
CREATE POLICY "Users can view travel DNA"
ON public.travel_dna_profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND ((requester_id = auth.uid() AND addressee_id = travel_dna_profiles.user_id)
      OR (addressee_id = auth.uid() AND requester_id = travel_dna_profiles.user_id))
  )
  OR EXISTS (
    SELECT 1 FROM trip_collaborators tc1
    JOIN trip_collaborators tc2 ON tc1.trip_id = tc2.trip_id
    WHERE tc1.user_id = auth.uid() AND tc2.user_id = travel_dna_profiles.user_id
    AND tc1.accepted_at IS NOT NULL AND tc2.accepted_at IS NOT NULL
  )
);