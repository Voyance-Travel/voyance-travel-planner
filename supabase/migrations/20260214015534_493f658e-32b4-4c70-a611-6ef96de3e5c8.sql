-- Fix: Remove overly permissive trip_invites SELECT policy and replace with scoped access.
-- The accept-invite flow uses SECURITY DEFINER RPCs (get_trip_invite_info, accept_trip_invite)
-- so no public SELECT access is needed.

DROP POLICY IF EXISTS "Anyone can view invites by token" ON public.trip_invites;

-- Only allow relevant users to see invites
CREATE POLICY "Users can view relevant invites"
ON public.trip_invites
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    invited_by = auth.uid() OR
    accepted_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_id AND trips.user_id = auth.uid())
  )
);
