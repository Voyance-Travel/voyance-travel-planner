-- Fix infinite recursion in trip_members RLS policies
-- The issue: policy queries trip_members while evaluating access to trip_members

-- First, create a SECURITY DEFINER function to safely check trip membership
CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members 
    WHERE trip_id = p_trip_id AND user_id = p_user_id
  );
$$;

-- Drop the problematic SELECT policy on trip_members
DROP POLICY IF EXISTS "Users can view members of their trips" ON public.trip_members;

-- Create a non-recursive SELECT policy
-- Uses trips table (safe) and direct user_id check (safe), no self-reference
CREATE POLICY "Users can view members of their trips"
ON public.trip_members FOR SELECT
USING (
  -- User is the trip owner
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  -- OR user is this specific member record
  OR user_id = auth.uid()
);

-- Now fix the dependent policies on trip_expenses, expense_splits, trip_settlements
-- These policies reference trip_members which caused cascading issues

-- trip_expenses policies - use the safe function
DROP POLICY IF EXISTS "Trip participants can view expenses" ON public.trip_expenses;
DROP POLICY IF EXISTS "Trip participants can add expenses" ON public.trip_expenses;
DROP POLICY IF EXISTS "Trip participants can update expenses" ON public.trip_expenses;

CREATE POLICY "Trip participants can view expenses"
ON public.trip_expenses FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

CREATE POLICY "Trip participants can add expenses"
ON public.trip_expenses FOR INSERT
WITH CHECK (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

CREATE POLICY "Trip participants can update expenses"
ON public.trip_expenses FOR UPDATE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

-- expense_splits policies - use the safe function
DROP POLICY IF EXISTS "Trip participants can view splits" ON public.expense_splits;
DROP POLICY IF EXISTS "Trip participants can manage splits" ON public.expense_splits;

CREATE POLICY "Trip participants can view splits"
ON public.expense_splits FOR SELECT
USING (
  expense_id IN (
    SELECT id FROM public.trip_expenses 
    WHERE trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
    OR public.is_trip_member(trip_id, auth.uid())
  )
);

CREATE POLICY "Trip participants can manage splits"
ON public.expense_splits FOR ALL
USING (
  expense_id IN (
    SELECT id FROM public.trip_expenses 
    WHERE trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
    OR public.is_trip_member(trip_id, auth.uid())
  )
);

-- trip_settlements policies - use the safe function
DROP POLICY IF EXISTS "Trip participants can view settlements" ON public.trip_settlements;
DROP POLICY IF EXISTS "Trip participants can manage settlements" ON public.trip_settlements;

CREATE POLICY "Trip participants can view settlements"
ON public.trip_settlements FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

CREATE POLICY "Trip participants can manage settlements"
ON public.trip_settlements FOR ALL
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);