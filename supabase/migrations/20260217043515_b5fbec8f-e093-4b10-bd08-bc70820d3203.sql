
-- Allow users to view profiles of people who share a trip via trip_members
-- This complements the existing policy that covers trip_collaborators
CREATE POLICY "Users can view profiles of trip co-members"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT tm.user_id FROM public.trip_members tm
    WHERE tm.trip_id IN (
      SELECT tm2.trip_id FROM public.trip_members tm2 WHERE tm2.user_id = auth.uid()
    )
    AND tm.user_id IS NOT NULL
  )
);
