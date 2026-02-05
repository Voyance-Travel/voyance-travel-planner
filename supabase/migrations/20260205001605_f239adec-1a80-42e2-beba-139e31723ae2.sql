-- Fix agent_clients RLS - restrict to agent who owns the client
ALTER TABLE public.agent_clients ENABLE ROW LEVEL SECURITY;

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "agent_clients_select" ON public.agent_clients;
DROP POLICY IF EXISTS "agent_clients_insert" ON public.agent_clients;
DROP POLICY IF EXISTS "agent_clients_update" ON public.agent_clients;
DROP POLICY IF EXISTS "agent_clients_delete" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can view their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can create clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can update their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can delete their own clients" ON public.agent_clients;

-- Create proper RLS policies - only the agent who owns the client can access
CREATE POLICY "Agents can view their own clients"
ON public.agent_clients FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

CREATE POLICY "Agents can create clients"
ON public.agent_clients FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own clients"
ON public.agent_clients FOR UPDATE
TO authenticated
USING (agent_id = auth.uid())
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can delete their own clients"
ON public.agent_clients FOR DELETE
TO authenticated
USING (agent_id = auth.uid());

-- Fix agency_invoices RLS - restrict to agent who owns the invoice
ALTER TABLE public.agency_invoices ENABLE ROW LEVEL SECURITY;

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "agency_invoices_select" ON public.agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_insert" ON public.agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_update" ON public.agency_invoices;
DROP POLICY IF EXISTS "agency_invoices_delete" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can view their own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can create invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can update their own invoices" ON public.agency_invoices;
DROP POLICY IF EXISTS "Agents can delete their own invoices" ON public.agency_invoices;

-- Create proper RLS policies - only the agent who owns the invoice can access
CREATE POLICY "Agents can view their own invoices"
ON public.agency_invoices FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

CREATE POLICY "Agents can create invoices"
ON public.agency_invoices FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own invoices"
ON public.agency_invoices FOR UPDATE
TO authenticated
USING (agent_id = auth.uid())
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can delete their own invoices"
ON public.agency_invoices FOR DELETE
TO authenticated
USING (agent_id = auth.uid());

-- Verify agency_accounts has proper RLS (already has RLS enabled per scan)
-- Add explicit policies if missing
DROP POLICY IF EXISTS "Agents can view their own accounts" ON public.agency_accounts;
DROP POLICY IF EXISTS "Agents can create accounts" ON public.agency_accounts;
DROP POLICY IF EXISTS "Agents can update their own accounts" ON public.agency_accounts;
DROP POLICY IF EXISTS "Agents can delete their own accounts" ON public.agency_accounts;

CREATE POLICY "Agents can view their own accounts"
ON public.agency_accounts FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

CREATE POLICY "Agents can create accounts"
ON public.agency_accounts FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own accounts"
ON public.agency_accounts FOR UPDATE
TO authenticated
USING (agent_id = auth.uid())
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can delete their own accounts"
ON public.agency_accounts FOR DELETE
TO authenticated
USING (agent_id = auth.uid());