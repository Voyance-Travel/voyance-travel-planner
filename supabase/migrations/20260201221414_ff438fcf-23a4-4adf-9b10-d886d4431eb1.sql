-- Add missing policy for viewing invites by token (needed for AcceptInvite page)
CREATE POLICY "Anyone can view invites by token"
ON public.trip_invites
FOR SELECT
USING (true);

-- Also ensure authenticated users can insert invites for their own trips
-- The existing "Trip owners can manage invites" should work, but let's add explicit INSERT
CREATE POLICY "Trip owners can insert invites"
ON public.trip_invites
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = trip_id 
    AND trips.user_id = auth.uid()
  )
  AND invited_by = auth.uid()
);