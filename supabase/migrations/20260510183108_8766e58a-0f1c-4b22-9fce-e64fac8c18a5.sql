DROP POLICY IF EXISTS "Anon can read votes" ON public.trip_suggestion_votes;
DROP POLICY IF EXISTS "Authenticated users can read votes" ON public.trip_suggestion_votes;

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
            WHERE at.id = ts.trip_id
              AND (at.agent_id = auth.uid() OR at.share_enabled = true)
          )
        )
    )
  );

CREATE POLICY "Anon can read votes for shared agency trips"
  ON public.trip_suggestion_votes
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_suggestions ts
      JOIN public.agency_trips at ON at.id = ts.trip_id
      WHERE ts.id = trip_suggestion_votes.suggestion_id
        AND at.share_enabled = true
    )
  );