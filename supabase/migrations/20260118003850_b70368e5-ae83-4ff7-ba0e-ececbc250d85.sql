-- Update the SELECT policy on profiles to explicitly require authentication
-- First drop the existing policy and recreate it with explicit auth check
DROP POLICY IF EXISTS "Users can view own profile and friends profiles" ON profiles;

-- Create new policy that explicitly requires authentication first
CREATE POLICY "Users can view own profile and friends profiles"
ON profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = id 
    OR EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.status = 'accepted'::friendship_status
      AND (
        (friendships.requester_id = auth.uid() AND friendships.addressee_id = profiles.id)
        OR (friendships.addressee_id = auth.uid() AND friendships.requester_id = profiles.id)
      )
    )
  )
);