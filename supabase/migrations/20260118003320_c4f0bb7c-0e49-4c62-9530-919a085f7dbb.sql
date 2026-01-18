-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a secure SELECT policy that allows:
-- 1. Users to view their own profile
-- 2. Users to view profiles of confirmed friends only
CREATE POLICY "Users can view own profile and friends profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id = profiles.id)
      OR (addressee_id = auth.uid() AND requester_id = profiles.id)
    )
  )
);