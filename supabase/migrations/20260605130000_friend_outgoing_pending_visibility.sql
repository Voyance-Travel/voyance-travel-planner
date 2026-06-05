-- C-FRIEND-1: restore outgoing-pending profile visibility.
--
-- The "Sent" friend-requests tab showed a count (e.g. 3) but rendered the rows
-- as blank "Unknown" and they looked stuck "Pending". Root cause: the profiles
-- SELECT policies cover own / accepted-friends (both directions) / INCOMING
-- pending (addressee = auth.uid()) / trip co-members — but the OUTGOING-pending
-- branch was lost when an older, over-broad policy ("...friends and pending
-- requests", all statuses + both directions) was dropped in 20260126194323 and
-- never replaced for the requester direction. So a user could read the
-- friendship row (friendships RLS lets the requester see it) but NOT the
-- addressee's profile → PostgREST's to-one embed returned addressee: null →
-- getDisplayName(null) = "Unknown".
--
-- Fix: add a NARROW, additive SELECT policy (permissive policies OR together)
-- granting visibility of exactly the addressee of one's own still-pending
-- outgoing request. This restores symmetric pending visibility (incoming
-- already works) without re-introducing the over-broad dropped policy.

CREATE POLICY "Users can view profiles of outgoing pending requests"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.requester_id = auth.uid()
      AND f.addressee_id = profiles.id
      AND f.status = 'pending'
  )
);
