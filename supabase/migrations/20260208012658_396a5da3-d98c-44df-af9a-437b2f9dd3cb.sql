
-- Drop all existing policies on trip_payments
DROP POLICY IF EXISTS "Users can manage own trip payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Users can create payments for their trips" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can insert payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can update payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can delete payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can view payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip collaborators can view payments" ON public.trip_payments;

-- Clean, non-overlapping policies:

-- SELECT: Owner or accepted collaborator can view
CREATE POLICY "trip_payments_select" ON public.trip_payments
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_payments.trip_id AND t.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM trip_collaborators tc
    WHERE tc.trip_id = trip_payments.trip_id
    AND tc.user_id = auth.uid()
    AND tc.accepted_at IS NOT NULL
  )
);

-- INSERT: Trip owner can create payments (user_id must be themselves)
CREATE POLICY "trip_payments_insert" ON public.trip_payments
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_payments.trip_id AND t.user_id = auth.uid()
  )
);

-- UPDATE: Trip owner can update any payment on their trip
CREATE POLICY "trip_payments_update" ON public.trip_payments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_payments.trip_id AND t.user_id = auth.uid()
  )
);

-- DELETE: Trip owner can delete payments
CREATE POLICY "trip_payments_delete" ON public.trip_payments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_payments.trip_id AND t.user_id = auth.uid()
  )
);
