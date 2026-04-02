-- Drop the contradictory policy that can never match
DROP POLICY IF EXISTS "Service role can manage logs" ON public.generation_logs;

-- Authenticated users can read logs for their own trips (for progress polling)
-- Service role bypasses RLS entirely, so no explicit policy is needed for writes.
CREATE POLICY "Users can read own generation logs"
  ON public.generation_logs
  FOR SELECT
  TO authenticated
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
    OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)
  );