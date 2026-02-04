-- ============================================
-- RLS Policies for Agency/B2B Tables (12 tables)
-- ============================================

-- 1. agent_clients
ALTER TABLE public.agent_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own clients" ON public.agent_clients;
CREATE POLICY "Agents can manage own clients" ON public.agent_clients
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 2. agency_travelers
ALTER TABLE public.agency_travelers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own travelers" ON public.agency_travelers;
CREATE POLICY "Agents can manage own travelers" ON public.agency_travelers
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 3. agency_accounts
ALTER TABLE public.agency_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own accounts" ON public.agency_accounts;
CREATE POLICY "Agents can manage own accounts" ON public.agency_accounts
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 4. agency_invoices
ALTER TABLE public.agency_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own invoices" ON public.agency_invoices;
CREATE POLICY "Agents can manage own invoices" ON public.agency_invoices
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 5. agency_payments
ALTER TABLE public.agency_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own payments" ON public.agency_payments;
CREATE POLICY "Agents can manage own payments" ON public.agency_payments
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 6. agency_quotes
ALTER TABLE public.agency_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own quotes" ON public.agency_quotes;
CREATE POLICY "Agents can manage own quotes" ON public.agency_quotes
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 7. agency_booking_segments
ALTER TABLE public.agency_booking_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own booking segments" ON public.agency_booking_segments;
CREATE POLICY "Agents can manage own booking segments" ON public.agency_booking_segments
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 8. agency_communications
ALTER TABLE public.agency_communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own communications" ON public.agency_communications;
CREATE POLICY "Agents can manage own communications" ON public.agency_communications
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 9. agency_tasks
ALTER TABLE public.agency_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own tasks" ON public.agency_tasks;
CREATE POLICY "Agents can manage own tasks" ON public.agency_tasks
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 10. agency_documents
ALTER TABLE public.agency_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own documents" ON public.agency_documents;
CREATE POLICY "Agents can manage own documents" ON public.agency_documents
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 11. agency_suppliers
ALTER TABLE public.agency_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own suppliers" ON public.agency_suppliers;
CREATE POLICY "Agents can manage own suppliers" ON public.agency_suppliers
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 12. agency_payment_schedules
ALTER TABLE public.agency_payment_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own payment schedules" ON public.agency_payment_schedules;
CREATE POLICY "Agents can manage own payment schedules" ON public.agency_payment_schedules
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- ============================================
-- RLS Policies for Finance Tables (4 tables)
-- ============================================

-- 13. finance_ledger_entries
ALTER TABLE public.finance_ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own ledger entries" ON public.finance_ledger_entries;
CREATE POLICY "Agents can manage own ledger entries" ON public.finance_ledger_entries
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 14. finance_commission_imports
ALTER TABLE public.finance_commission_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own commission imports" ON public.finance_commission_imports;
CREATE POLICY "Agents can manage own commission imports" ON public.finance_commission_imports
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 15. finance_payout_runs
ALTER TABLE public.finance_payout_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own payout runs" ON public.finance_payout_runs;
CREATE POLICY "Agents can manage own payout runs" ON public.finance_payout_runs
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- 16. finance_payout_lines
ALTER TABLE public.finance_payout_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage own payout lines" ON public.finance_payout_lines;
CREATE POLICY "Agents can manage own payout lines" ON public.finance_payout_lines
  FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- ============================================
-- RLS Policies for Trip Tables (5 tables)
-- ============================================

-- 17. trip_members
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_members;
CREATE POLICY "Users can view trip members" ON public.trip_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Trip owners can insert members" ON public.trip_members;
CREATE POLICY "Trip owners can insert members" ON public.trip_members
  FOR INSERT WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Trip owners can update members" ON public.trip_members;
CREATE POLICY "Trip owners can update members" ON public.trip_members
  FOR UPDATE USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Trip owners can delete members" ON public.trip_members;
CREATE POLICY "Trip owners can delete members" ON public.trip_members
  FOR DELETE USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- 18. trip_payments
ALTER TABLE public.trip_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own trip payments" ON public.trip_payments;
CREATE POLICY "Users can manage own trip payments" ON public.trip_payments
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 19. trip_expenses
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members can view expenses" ON public.trip_expenses;
CREATE POLICY "Trip members can view expenses" ON public.trip_expenses
  FOR SELECT USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()) OR
    trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Trip owners can insert expenses" ON public.trip_expenses;
CREATE POLICY "Trip owners can insert expenses" ON public.trip_expenses
  FOR INSERT WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Trip owners can update expenses" ON public.trip_expenses;
CREATE POLICY "Trip owners can update expenses" ON public.trip_expenses
  FOR UPDATE USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Trip owners can delete expenses" ON public.trip_expenses;
CREATE POLICY "Trip owners can delete expenses" ON public.trip_expenses
  FOR DELETE USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- 20. expense_splits
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view expense splits" ON public.expense_splits;
CREATE POLICY "Users can view expense splits" ON public.expense_splits
  FOR SELECT USING (
    expense_id IN (
      SELECT te.id FROM public.trip_expenses te
      WHERE te.trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
         OR te.trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Trip owners can insert splits" ON public.expense_splits;
CREATE POLICY "Trip owners can insert splits" ON public.expense_splits
  FOR INSERT WITH CHECK (
    expense_id IN (SELECT te.id FROM public.trip_expenses te WHERE te.trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Trip owners can update splits" ON public.expense_splits;
CREATE POLICY "Trip owners can update splits" ON public.expense_splits
  FOR UPDATE USING (
    expense_id IN (SELECT te.id FROM public.trip_expenses te WHERE te.trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Trip owners can delete splits" ON public.expense_splits;
CREATE POLICY "Trip owners can delete splits" ON public.expense_splits
  FOR DELETE USING (
    expense_id IN (SELECT te.id FROM public.trip_expenses te WHERE te.trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()))
  );

-- 21. trip_settlements
ALTER TABLE public.trip_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view settlements" ON public.trip_settlements;
CREATE POLICY "Users can view settlements" ON public.trip_settlements
  FOR SELECT USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()) OR
    trip_id IN (SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Trip owners can insert settlements" ON public.trip_settlements;
CREATE POLICY "Trip owners can insert settlements" ON public.trip_settlements
  FOR INSERT WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Trip owners can update settlements" ON public.trip_settlements;
CREATE POLICY "Trip owners can update settlements" ON public.trip_settlements
  FOR UPDATE USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Trip owners can delete settlements" ON public.trip_settlements;
CREATE POLICY "Trip owners can delete settlements" ON public.trip_settlements
  FOR DELETE USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));