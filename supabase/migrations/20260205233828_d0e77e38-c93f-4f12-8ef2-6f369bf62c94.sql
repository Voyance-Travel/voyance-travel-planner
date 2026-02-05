-- =============================================================================
-- FIX: trip_payments - Allow trip owner AND collaborators to view
-- =============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can view payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip collaborators can view payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can insert payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can update payments" ON public.trip_payments;
DROP POLICY IF EXISTS "Trip owners can delete payments" ON public.trip_payments;

-- Ensure RLS is enabled
ALTER TABLE public.trip_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Trip owners can view their trip payments
CREATE POLICY "Trip owners can view payments"
  ON public.trip_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_payments.trip_id
      AND t.user_id = auth.uid()
    )
  );

-- Policy: Trip collaborators with accepted status can view payments
CREATE POLICY "Trip collaborators can view payments"
  ON public.trip_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = trip_payments.trip_id
      AND tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
    )
  );

-- Policy: Only trip owners can insert payments
CREATE POLICY "Trip owners can insert payments"
  ON public.trip_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_payments.trip_id
      AND t.user_id = auth.uid()
    )
  );

-- Policy: Only trip owners can update payments
CREATE POLICY "Trip owners can update payments"
  ON public.trip_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_payments.trip_id
      AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_payments.trip_id
      AND t.user_id = auth.uid()
    )
  );

-- Policy: Only trip owners can delete payments
CREATE POLICY "Trip owners can delete payments"
  ON public.trip_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_payments.trip_id
      AND t.user_id = auth.uid()
    )
  );