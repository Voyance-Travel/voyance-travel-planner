
-- Drop overly-permissive anon read policies on shared agency trips and cascading tables.
-- Anonymous shared-trip access must go exclusively through the SECURITY DEFINER RPC
-- public.get_shared_trip_payload(p_share_token), which validates the token server-side.
-- The previous USING (share_enabled = true ...) policies allowed any anon caller to
-- enumerate every shared trip via PostgREST without ever knowing the share token.

DROP POLICY IF EXISTS "Public can view shared trips by token" ON public.agency_trips;
DROP POLICY IF EXISTS "Anon can read suggestions for shared agency trips" ON public.trip_suggestions;
DROP POLICY IF EXISTS "Anon can read votes for shared agency trips" ON public.trip_suggestion_votes;
DROP POLICY IF EXISTS "Shared trip viewers can read chat" ON public.trip_chat_messages;

-- The shared agency trip suggestions branch in "Authenticated users can read suggestions for their trips"
-- also leaks via (at.share_enabled = true) for any authenticated user. Re-create without that branch.
DROP POLICY IF EXISTS "Authenticated users can read suggestions for their trips" ON public.trip_suggestions;
CREATE POLICY "Authenticated users can read suggestions for their trips"
ON public.trip_suggestions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_suggestions.trip_id
      AND trips.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_collaborators.trip_id = trip_suggestions.trip_id
      AND trip_collaborators.user_id = auth.uid()
      AND trip_collaborators.accepted_at IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.agency_trips
    WHERE agency_trips.id = trip_suggestions.trip_id
      AND agency_trips.agent_id = auth.uid()
  )
);

-- Same fix for votes — strip the share_enabled bypass branch.
DROP POLICY IF EXISTS "Trip members can read votes" ON public.trip_suggestion_votes;
CREATE POLICY "Trip members can read votes"
ON public.trip_suggestion_votes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trip_suggestions ts
    WHERE ts.id = trip_suggestion_votes.suggestion_id
      AND (
        EXISTS (
          SELECT 1 FROM public.trips t
          WHERE t.id = ts.trip_id AND t.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.trip_collaborators tc
          WHERE tc.trip_id = ts.trip_id
            AND tc.user_id = auth.uid()
            AND tc.accepted_at IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM public.agency_trips at
          WHERE at.id = ts.trip_id AND at.agent_id = auth.uid()
        )
      )
  )
);
