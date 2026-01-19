-- Create enum for trip member roles
CREATE TYPE public.trip_member_role AS ENUM ('primary', 'attendee');

-- Create enum for expense split type
CREATE TYPE public.expense_split_type AS ENUM ('equal', 'manual', 'percentage');

-- Create enum for payment status
CREATE TYPE public.payment_status_enum AS ENUM ('pending', 'paid', 'partial');

-- Trip members table - tracks who is on each trip with their role
CREATE TABLE public.trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  role trip_member_role NOT NULL DEFAULT 'attendee',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, email)
);

-- Trip expenses table - individual expense items that can be assigned
CREATE TABLE public.trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'flight', 'hotel', 'activity', 'food', 'transport', 'other'
  description TEXT NOT NULL,
  planned_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  actual_amount DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  split_type expense_split_type NOT NULL DEFAULT 'equal',
  paid_by_member_id UUID REFERENCES public.trip_members(id) ON DELETE SET NULL,
  payment_status payment_status_enum NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  external_item_id TEXT, -- Link to flight_id, hotel_id, activity_id etc.
  external_item_type TEXT, -- 'flight', 'hotel', 'activity'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expense splits - how each expense is divided among members
CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.trip_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2), -- Optional: percentage of total
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(expense_id, member_id)
);

-- Settlements - track reimbursements between members
CREATE TABLE public.trip_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_settled BOOLEAN NOT NULL DEFAULT false,
  settled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_settlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trip_members
CREATE POLICY "Users can view members of their trips"
ON public.trip_members FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR user_id = auth.uid()
  OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
);

CREATE POLICY "Trip owners can manage members"
ON public.trip_members FOR INSERT
WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can update members"
ON public.trip_members FOR UPDATE
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete members"
ON public.trip_members FOR DELETE
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- RLS Policies for trip_expenses
CREATE POLICY "Trip participants can view expenses"
ON public.trip_expenses FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
);

CREATE POLICY "Trip participants can add expenses"
ON public.trip_expenses FOR INSERT
WITH CHECK (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
);

CREATE POLICY "Trip participants can update expenses"
ON public.trip_expenses FOR UPDATE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
);

CREATE POLICY "Trip owners can delete expenses"
ON public.trip_expenses FOR DELETE
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- RLS Policies for expense_splits
CREATE POLICY "Trip participants can view splits"
ON public.expense_splits FOR SELECT
USING (
  expense_id IN (
    SELECT id FROM public.trip_expenses 
    WHERE trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
    OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Trip participants can manage splits"
ON public.expense_splits FOR ALL
USING (
  expense_id IN (
    SELECT id FROM public.trip_expenses 
    WHERE trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
    OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
  )
);

-- RLS Policies for trip_settlements
CREATE POLICY "Trip participants can view settlements"
ON public.trip_settlements FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
);

CREATE POLICY "Trip participants can manage settlements"
ON public.trip_settlements FOR ALL
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_trip_members_updated_at
  BEFORE UPDATE ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trip_expenses_updated_at
  BEFORE UPDATE ON public.trip_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expense_splits_updated_at
  BEFORE UPDATE ON public.expense_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trip_settlements_updated_at
  BEFORE UPDATE ON public.trip_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();