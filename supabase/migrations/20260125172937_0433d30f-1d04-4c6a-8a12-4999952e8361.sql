-- Allow users to view profiles of people they have friendships with (sent or received requests)
CREATE POLICY "Users can view profiles of friends and pending requests"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 FROM friendships 
    WHERE (
      (friendships.requester_id = auth.uid() AND friendships.addressee_id = profiles.id)
      OR 
      (friendships.addressee_id = auth.uid() AND friendships.requester_id = profiles.id)
    )
  )
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;