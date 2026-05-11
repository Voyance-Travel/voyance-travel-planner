DROP POLICY IF EXISTS "Users can view intents for their trips"   ON public.trip_intents;
DROP POLICY IF EXISTS "Users can update intents for their trips" ON public.trip_intents;
DROP POLICY IF EXISTS "Users can delete intents for their trips" ON public.trip_intents;

CREATE POLICY "Users can view intents for their trips"
ON public.trip_intents FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips
          WHERE trips.id = trip_intents.trip_id AND trips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_collaborators tc
             WHERE tc.trip_id = trip_intents.trip_id
               AND tc.user_id = auth.uid()
               AND tc.accepted_at IS NOT NULL)
);

CREATE POLICY "Users can update intents for their trips"
ON public.trip_intents FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips
          WHERE trips.id = trip_intents.trip_id AND trips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_collaborators tc
             WHERE tc.trip_id = trip_intents.trip_id
               AND tc.user_id = auth.uid()
               AND tc.accepted_at IS NOT NULL)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips
          WHERE trips.id = trip_intents.trip_id AND trips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_collaborators tc
             WHERE tc.trip_id = trip_intents.trip_id
               AND tc.user_id = auth.uid()
               AND tc.accepted_at IS NOT NULL)
);

CREATE POLICY "Users can delete intents for their trips"
ON public.trip_intents FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips
          WHERE trips.id = trip_intents.trip_id AND trips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_collaborators tc
             WHERE tc.trip_id = trip_intents.trip_id
               AND tc.user_id = auth.uid()
               AND tc.accepted_at IS NOT NULL)
);