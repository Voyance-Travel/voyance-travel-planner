-- =====================================================
-- CRITICAL SECURITY FIX: Add RLS policies to all agency tables
-- This prevents unauthorized access via the anon key
-- =====================================================

-- 1. AGENCY_ACCOUNTS
ALTER TABLE public.agency_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own accounts" ON public.agency_accounts;
DROP POLICY IF EXISTS "Agents can insert own accounts" ON public.agency_accounts;
DROP POLICY IF EXISTS "Agents can update own accounts" ON public.agency_accounts;
DROP POLICY IF EXISTS "Agents can delete own accounts" ON public.agency_accounts;

CREATE POLICY "Agents can view own accounts" ON public.agency_accounts
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own accounts" ON public.agency_accounts
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own accounts" ON public.agency_accounts
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own accounts" ON public.agency_accounts
  FOR DELETE USING (agent_id = auth.uid());

-- 2. AGENCY_TRAVELERS (contains passport numbers, PII)
ALTER TABLE public.agency_travelers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own travelers" ON public.agency_travelers;
DROP POLICY IF EXISTS "Agents can insert own travelers" ON public.agency_travelers;
DROP POLICY IF EXISTS "Agents can update own travelers" ON public.agency_travelers;
DROP POLICY IF EXISTS "Agents can delete own travelers" ON public.agency_travelers;

CREATE POLICY "Agents can view own travelers" ON public.agency_travelers
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own travelers" ON public.agency_travelers
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own travelers" ON public.agency_travelers
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own travelers" ON public.agency_travelers
  FOR DELETE USING (agent_id = auth.uid());

-- 3. AGENCY_TRIPS
ALTER TABLE public.agency_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own trips" ON public.agency_trips;
DROP POLICY IF EXISTS "Agents can insert own trips" ON public.agency_trips;
DROP POLICY IF EXISTS "Agents can update own trips" ON public.agency_trips;
DROP POLICY IF EXISTS "Agents can delete own trips" ON public.agency_trips;

CREATE POLICY "Agents can view own trips" ON public.agency_trips
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own trips" ON public.agency_trips
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own trips" ON public.agency_trips
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own trips" ON public.agency_trips
  FOR DELETE USING (agent_id = auth.uid());

-- 4. AGENCY_BOOKING_SEGMENTS (contains confirmation numbers)
ALTER TABLE public.agency_booking_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own segments" ON public.agency_booking_segments;
DROP POLICY IF EXISTS "Agents can insert own segments" ON public.agency_booking_segments;
DROP POLICY IF EXISTS "Agents can update own segments" ON public.agency_booking_segments;
DROP POLICY IF EXISTS "Agents can delete own segments" ON public.agency_booking_segments;

CREATE POLICY "Agents can view own segments" ON public.agency_booking_segments
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own segments" ON public.agency_booking_segments
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own segments" ON public.agency_booking_segments
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own segments" ON public.agency_booking_segments
  FOR DELETE USING (agent_id = auth.uid());

-- 5. AGENCY_QUOTES
ALTER TABLE public.agency_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can insert own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can update own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can delete own quotes" ON public.agency_quotes;

CREATE POLICY "Agents can view own quotes" ON public.agency_quotes
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own quotes" ON public.agency_quotes
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own quotes" ON public.agency_quotes
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own quotes" ON public.agency_quotes
  FOR DELETE USING (agent_id = auth.uid());

-- 6. AGENCY_INVOICES
ALTER TABLE public.agency_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can insert own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can update own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can delete own invoices" ON public.agency_invoices;

CREATE POLICY "Agents can view own invoices" ON public.agency_invoices
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own invoices" ON public.agency_invoices
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own invoices" ON public.agency_invoices
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own invoices" ON public.agency_invoices
  FOR DELETE USING (agent_id = auth.uid());

-- 7. AGENCY_PAYMENTS (financial data)
ALTER TABLE public.agency_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own payments" ON public.agency_payments;
DROP POLICY IF EXISTS "Agents can insert own payments" ON public.agency_payments;
DROP POLICY IF EXISTS "Agents can update own payments" ON public.agency_payments;
DROP POLICY IF EXISTS "Agents can delete own payments" ON public.agency_payments;

CREATE POLICY "Agents can view own payments" ON public.agency_payments
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own payments" ON public.agency_payments
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own payments" ON public.agency_payments
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own payments" ON public.agency_payments
  FOR DELETE USING (agent_id = auth.uid());

-- 8. AGENCY_PAYMENT_SCHEDULES
ALTER TABLE public.agency_payment_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own payment schedules" ON public.agency_payment_schedules;
DROP POLICY IF EXISTS "Agents can insert own payment schedules" ON public.agency_payment_schedules;
DROP POLICY IF EXISTS "Agents can update own payment schedules" ON public.agency_payment_schedules;
DROP POLICY IF EXISTS "Agents can delete own payment schedules" ON public.agency_payment_schedules;

CREATE POLICY "Agents can view own payment schedules" ON public.agency_payment_schedules
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own payment schedules" ON public.agency_payment_schedules
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own payment schedules" ON public.agency_payment_schedules
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own payment schedules" ON public.agency_payment_schedules
  FOR DELETE USING (agent_id = auth.uid());

-- 9. AGENCY_TASKS
ALTER TABLE public.agency_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own tasks" ON public.agency_tasks;
DROP POLICY IF EXISTS "Agents can insert own tasks" ON public.agency_tasks;
DROP POLICY IF EXISTS "Agents can update own tasks" ON public.agency_tasks;
DROP POLICY IF EXISTS "Agents can delete own tasks" ON public.agency_tasks;

CREATE POLICY "Agents can view own tasks" ON public.agency_tasks
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own tasks" ON public.agency_tasks
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own tasks" ON public.agency_tasks
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own tasks" ON public.agency_tasks
  FOR DELETE USING (agent_id = auth.uid());

-- 10. AGENCY_DOCUMENTS (contains file URLs)
ALTER TABLE public.agency_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own documents" ON public.agency_documents;
DROP POLICY IF EXISTS "Agents can insert own documents" ON public.agency_documents;
DROP POLICY IF EXISTS "Agents can update own documents" ON public.agency_documents;
DROP POLICY IF EXISTS "Agents can delete own documents" ON public.agency_documents;

CREATE POLICY "Agents can view own documents" ON public.agency_documents
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own documents" ON public.agency_documents
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own documents" ON public.agency_documents
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own documents" ON public.agency_documents
  FOR DELETE USING (agent_id = auth.uid());

-- 11. AGENCY_COMMUNICATIONS
ALTER TABLE public.agency_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own communications" ON public.agency_communications;
DROP POLICY IF EXISTS "Agents can insert own communications" ON public.agency_communications;
DROP POLICY IF EXISTS "Agents can update own communications" ON public.agency_communications;
DROP POLICY IF EXISTS "Agents can delete own communications" ON public.agency_communications;

CREATE POLICY "Agents can view own communications" ON public.agency_communications
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own communications" ON public.agency_communications
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own communications" ON public.agency_communications
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own communications" ON public.agency_communications
  FOR DELETE USING (agent_id = auth.uid());

-- 12. AGENCY_SUPPLIERS
ALTER TABLE public.agency_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own suppliers" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Agents can insert own suppliers" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Agents can update own suppliers" ON public.agency_suppliers;
DROP POLICY IF EXISTS "Agents can delete own suppliers" ON public.agency_suppliers;

CREATE POLICY "Agents can view own suppliers" ON public.agency_suppliers
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own suppliers" ON public.agency_suppliers
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own suppliers" ON public.agency_suppliers
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own suppliers" ON public.agency_suppliers
  FOR DELETE USING (agent_id = auth.uid());

-- 13. AGENT_CLIENTS
ALTER TABLE public.agent_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can insert own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can update own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can delete own clients" ON public.agent_clients;

CREATE POLICY "Agents can view own clients" ON public.agent_clients
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own clients" ON public.agent_clients
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own clients" ON public.agent_clients
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own clients" ON public.agent_clients
  FOR DELETE USING (agent_id = auth.uid());

-- 14. AGENT_ITINERARY_LIBRARY
ALTER TABLE public.agent_itinerary_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view own library" ON public.agent_itinerary_library;
DROP POLICY IF EXISTS "Agents can insert own library" ON public.agent_itinerary_library;
DROP POLICY IF EXISTS "Agents can update own library" ON public.agent_itinerary_library;
DROP POLICY IF EXISTS "Agents can delete own library" ON public.agent_itinerary_library;

CREATE POLICY "Agents can view own library" ON public.agent_itinerary_library
  FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own library" ON public.agent_itinerary_library
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own library" ON public.agent_itinerary_library
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own library" ON public.agent_itinerary_library
  FOR DELETE USING (agent_id = auth.uid());

-- 15. AGENCY_TRIP_TRAVELERS (junction table - needs special handling)
-- Access via trip ownership
ALTER TABLE public.agency_trip_travelers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view trip travelers" ON public.agency_trip_travelers;
DROP POLICY IF EXISTS "Agents can insert trip travelers" ON public.agency_trip_travelers;
DROP POLICY IF EXISTS "Agents can delete trip travelers" ON public.agency_trip_travelers;

CREATE POLICY "Agents can view trip travelers" ON public.agency_trip_travelers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_trips t 
      WHERE t.id = trip_id AND t.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can insert trip travelers" ON public.agency_trip_travelers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_trips t 
      WHERE t.id = trip_id AND t.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can delete trip travelers" ON public.agency_trip_travelers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_trips t 
      WHERE t.id = trip_id AND t.agent_id = auth.uid()
    )
  );

-- 16. FINANCE_LEDGER_ENTRIES (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finance_ledger_entries') THEN
    ALTER TABLE public.finance_ledger_entries ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Agents can view own ledger entries" ON public.finance_ledger_entries;
    DROP POLICY IF EXISTS "Agents can insert own ledger entries" ON public.finance_ledger_entries;
    DROP POLICY IF EXISTS "Agents can update own ledger entries" ON public.finance_ledger_entries;
    DROP POLICY IF EXISTS "Agents can delete own ledger entries" ON public.finance_ledger_entries;
    
    CREATE POLICY "Agents can view own ledger entries" ON public.finance_ledger_entries
      FOR SELECT USING (agent_id = auth.uid());
    
    CREATE POLICY "Agents can insert own ledger entries" ON public.finance_ledger_entries
      FOR INSERT WITH CHECK (agent_id = auth.uid());
    
    CREATE POLICY "Agents can update own ledger entries" ON public.finance_ledger_entries
      FOR UPDATE USING (agent_id = auth.uid());
    
    CREATE POLICY "Agents can delete own ledger entries" ON public.finance_ledger_entries
      FOR DELETE USING (agent_id = auth.uid());
  END IF;
END $$;

-- 17. FINANCE_PAYOUT_RUNS (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finance_payout_runs') THEN
    ALTER TABLE public.finance_payout_runs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Agents can view own payout runs" ON public.finance_payout_runs;
    DROP POLICY IF EXISTS "Agents can insert own payout runs" ON public.finance_payout_runs;
    DROP POLICY IF EXISTS "Agents can update own payout runs" ON public.finance_payout_runs;
    
    CREATE POLICY "Agents can view own payout runs" ON public.finance_payout_runs
      FOR SELECT USING (agent_id = auth.uid());
    
    CREATE POLICY "Agents can insert own payout runs" ON public.finance_payout_runs
      FOR INSERT WITH CHECK (agent_id = auth.uid());
    
    CREATE POLICY "Agents can update own payout runs" ON public.finance_payout_runs
      FOR UPDATE USING (agent_id = auth.uid());
  END IF;
END $$;

-- 18. FINANCE_PAYOUT_LINES (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finance_payout_lines') THEN
    ALTER TABLE public.finance_payout_lines ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Agents can view own payout lines" ON public.finance_payout_lines;
    DROP POLICY IF EXISTS "Agents can insert own payout lines" ON public.finance_payout_lines;
    
    CREATE POLICY "Agents can view own payout lines" ON public.finance_payout_lines
      FOR SELECT USING (agent_id = auth.uid());
    
    CREATE POLICY "Agents can insert own payout lines" ON public.finance_payout_lines
      FOR INSERT WITH CHECK (agent_id = auth.uid());
  END IF;
END $$;

-- 19. FINANCE_COMMISSION_IMPORTS (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finance_commission_imports') THEN
    ALTER TABLE public.finance_commission_imports ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Agents can view own commission imports" ON public.finance_commission_imports;
    DROP POLICY IF EXISTS "Agents can insert own commission imports" ON public.finance_commission_imports;
    DROP POLICY IF EXISTS "Agents can update own commission imports" ON public.finance_commission_imports;
    
    CREATE POLICY "Agents can view own commission imports" ON public.finance_commission_imports
      FOR SELECT USING (agent_id = auth.uid());
    
    CREATE POLICY "Agents can insert own commission imports" ON public.finance_commission_imports
      FOR INSERT WITH CHECK (agent_id = auth.uid());
    
    CREATE POLICY "Agents can update own commission imports" ON public.finance_commission_imports
      FOR UPDATE USING (agent_id = auth.uid());
  END IF;
END $$;