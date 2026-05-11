DROP POLICY IF EXISTS "Users can insert intents for their trips" ON public.trip_intents;

CREATE POLICY "Users can insert intents for their trips"
ON public.trip_intents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_intents.trip_id
      AND trips.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators tc
    WHERE tc.trip_id = trip_intents.trip_id
      AND tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
  )
);