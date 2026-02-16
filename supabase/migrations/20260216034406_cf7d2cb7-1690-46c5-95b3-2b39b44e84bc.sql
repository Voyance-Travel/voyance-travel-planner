
-- Add RLS policy allowing authenticated users to view profiles of their accepted friends
-- This fixes the "Unknown" friend name bug where FK joins on profiles return null
-- because the existing policy only allows viewing your own profile.

CREATE POLICY "Users can view accepted friends profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Own profile
    auth.uid() = id
    OR
    -- Accepted friend (I sent the request)
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.requester_id = auth.uid()
        AND friendships.addressee_id = profiles.id
        AND friendships.status = 'accepted'
    )
    OR
    -- Accepted friend (they sent the request)
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.addressee_id = auth.uid()
        AND friendships.requester_id = profiles.id
        AND friendships.status = 'accepted'
    )
    OR
    -- Pending request (I need to see who sent it)
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.addressee_id = auth.uid()
        AND friendships.requester_id = profiles.id
        AND friendships.status = 'pending'
    )
    OR
    -- Trip collaborators (I need to see who's on my trip)
    EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      JOIN public.trips t ON t.id = tc.trip_id
      WHERE (t.user_id = auth.uid() AND tc.user_id = profiles.id AND tc.accepted_at IS NOT NULL)
         OR (tc.user_id = auth.uid() AND t.user_id = profiles.id AND tc.accepted_at IS NOT NULL)
    )
  )
);

-- Drop the old overly restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
