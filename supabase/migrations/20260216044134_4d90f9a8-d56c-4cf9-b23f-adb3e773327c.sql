-- Allow authenticated users to insert notifications for trip members they share a trip with
CREATE POLICY "Trip members can create notifications"
ON public.trip_notifications FOR INSERT TO authenticated
WITH CHECK (
  -- User must be the trip owner or a collaborator on the trip
  EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_notifications.trip_id AND trips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM trip_collaborators WHERE trip_collaborators.trip_id = trip_notifications.trip_id AND trip_collaborators.user_id = auth.uid() AND trip_collaborators.accepted_at IS NOT NULL)
);