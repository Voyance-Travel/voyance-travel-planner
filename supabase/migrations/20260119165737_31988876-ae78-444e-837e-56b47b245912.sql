-- ============================================
-- Security Fixes: Remove public access from sensitive views
-- ============================================

-- 1. FIX: profiles_public view - revoke anon access
REVOKE ALL ON public.profiles_public FROM anon;

-- 2. FIX: trip_members_safe view - revoke anon access (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trip_members_safe') THEN
    EXECUTE 'REVOKE ALL ON public.trip_members_safe FROM anon';
  END IF;
END $$;

-- 3. FIX: user_preferences_safe view - revoke anon access (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences_safe') THEN
    EXECUTE 'REVOKE ALL ON public.user_preferences_safe FROM anon';
  END IF;
END $$;

-- 4. FIX: Strengthen expense_splits RLS - users can only see splits they're directly involved in
DROP POLICY IF EXISTS "Trip members can view expense splits" ON public.expense_splits;
DROP POLICY IF EXISTS "Trip members can manage expense splits" ON public.expense_splits;

-- Create more restrictive policies for expense_splits
CREATE POLICY "Users can view splits they are involved in"
  ON public.expense_splits FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM trip_members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trip_expenses te
      JOIN trips t ON te.trip_id = t.id
      WHERE te.id = expense_splits.expense_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip owners can manage expense splits"
  ON public.expense_splits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM trip_expenses te
      JOIN trips t ON te.trip_id = t.id
      WHERE te.id = expense_splits.expense_id
      AND t.user_id = auth.uid()
    )
  );

-- 5. FIX: Strengthen trip_settlements RLS - only payer/payee can see their settlements
DROP POLICY IF EXISTS "Trip members can view settlements" ON public.trip_settlements;
DROP POLICY IF EXISTS "Trip members can manage settlements" ON public.trip_settlements;

CREATE POLICY "Users can view settlements they are involved in"
  ON public.trip_settlements FOR SELECT
  USING (
    from_member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR to_member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_settlements.trip_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Involved users can manage settlements"
  ON public.trip_settlements FOR ALL
  USING (
    from_member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR to_member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_settlements.trip_id
      AND t.user_id = auth.uid()
    )
  );

-- 6. Add comment for trip_expenses - this is intentional for group budgeting feature
COMMENT ON TABLE public.trip_expenses IS 
'Visible to all trip participants by design for group budgeting transparency. Trip owners have full management access.';