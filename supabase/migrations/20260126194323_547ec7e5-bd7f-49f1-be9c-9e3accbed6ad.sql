-- Fix profiles RLS policy to only allow viewing accepted friends, not pending requests
-- This prevents data harvesting by malicious actors sending friend requests

-- Drop the permissive policy
DROP POLICY IF EXISTS "Users can view profiles of friends and pending requests" ON public.profiles;

-- Create secure policy that only allows viewing accepted friendships
CREATE POLICY "Users can view own profile and accepted friends"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id)
  OR EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE friendships.status = 'accepted'
      AND (
        (friendships.requester_id = auth.uid() AND friendships.addressee_id = profiles.id)
        OR
        (friendships.addressee_id = auth.uid() AND friendships.requester_id = profiles.id)
      )
  )
);