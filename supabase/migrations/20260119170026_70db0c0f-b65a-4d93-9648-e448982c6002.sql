-- Revoke anon access from existing views (if they exist)
DO $$ 
BEGIN
  -- profiles_public
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'profiles_public' AND schemaname = 'public') THEN
    EXECUTE 'REVOKE ALL ON public.profiles_public FROM anon';
    EXECUTE 'GRANT SELECT ON public.profiles_public TO authenticated';
  END IF;
  
  -- trip_members_safe
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'trip_members_safe' AND schemaname = 'public') THEN
    EXECUTE 'REVOKE ALL ON public.trip_members_safe FROM anon';
    EXECUTE 'GRANT SELECT ON public.trip_members_safe TO authenticated';
  END IF;
  
  -- user_preferences_safe
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'user_preferences_safe' AND schemaname = 'public') THEN
    EXECUTE 'REVOKE ALL ON public.user_preferences_safe FROM anon';
    EXECUTE 'GRANT SELECT ON public.user_preferences_safe TO authenticated';
  END IF;
END $$;

-- Consolidate expense_splits policies
DROP POLICY IF EXISTS "Users can view splits they are involved in" ON public.expense_splits;
DROP POLICY IF EXISTS "Trip owners can manage expense splits" ON public.expense_splits;
DROP POLICY IF EXISTS "Expense splits access" ON public.expense_splits;

CREATE POLICY "Expense splits access"
  ON public.expense_splits FOR ALL
  USING (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM trip_expenses te
      JOIN trips t ON te.trip_id = t.id
      WHERE te.id = expense_splits.expense_id
      AND t.user_id = auth.uid()
    )
  );

-- Consolidate trip_settlements policies  
DROP POLICY IF EXISTS "Users can view settlements they are involved in" ON public.trip_settlements;
DROP POLICY IF EXISTS "Involved users can manage settlements" ON public.trip_settlements;
DROP POLICY IF EXISTS "Settlement access" ON public.trip_settlements;

CREATE POLICY "Settlement access"
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