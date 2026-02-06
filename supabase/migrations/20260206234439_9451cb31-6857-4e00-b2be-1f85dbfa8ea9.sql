
-- =============================================
-- Clean up duplicate/insecure RLS policies
-- Problem: policies targeting 'public' role allow anon access
-- Fix: drop public-role policies, keep authenticated-only
-- =============================================

-- AGENT_CLIENTS: drop public-role policies
DROP POLICY IF EXISTS "Agents can manage own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can view own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can insert own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can update own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can delete own clients" ON public.agent_clients;

-- AGENT_CLIENTS: drop duplicate authenticated policies (keep one clean set)
DROP POLICY IF EXISTS "Agents can create their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can create own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can create clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can view their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can update their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can delete their own clients" ON public.agent_clients;

-- AGENT_CLIENTS: create clean restrictive policies
CREATE POLICY "agent_clients_select" ON public.agent_clients
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

CREATE POLICY "agent_clients_insert" ON public.agent_clients
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agent_clients_update" ON public.agent_clients
  FOR UPDATE TO authenticated USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agent_clients_delete" ON public.agent_clients
  FOR DELETE TO authenticated USING (agent_id = auth.uid());


-- AGENCY_INVOICES: drop public-role policies
DROP POLICY IF EXISTS "Agents can manage own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can manage their own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can view own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can insert own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can update own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can delete own invoices" ON public.agency_invoices;

-- AGENCY_INVOICES: drop authenticated duplicates
DROP POLICY IF EXISTS "Agents can view their own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can create invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can update their own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can delete their own invoices" ON public.agency_invoices;

-- AGENCY_INVOICES: create clean restrictive policies
CREATE POLICY "agency_invoices_select" ON public.agency_invoices
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

CREATE POLICY "agency_invoices_insert" ON public.agency_invoices
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agency_invoices_update" ON public.agency_invoices
  FOR UPDATE TO authenticated USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agency_invoices_delete" ON public.agency_invoices
  FOR DELETE TO authenticated USING (agent_id = auth.uid());


-- AGENCY_QUOTES: drop public-role policies
DROP POLICY IF EXISTS "Agents can manage their own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can manage own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can view own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can insert own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can update own quotes" ON public.agency_quotes;
DROP POLICY IF EXISTS "Agents can delete own quotes" ON public.agency_quotes;

-- AGENCY_QUOTES: create clean restrictive policies
CREATE POLICY "agency_quotes_select" ON public.agency_quotes
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

CREATE POLICY "agency_quotes_insert" ON public.agency_quotes
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agency_quotes_update" ON public.agency_quotes
  FOR UPDATE TO authenticated USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agency_quotes_delete" ON public.agency_quotes
  FOR DELETE TO authenticated USING (agent_id = auth.uid());
