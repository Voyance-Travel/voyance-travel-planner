-- Fix agent_clients table RLS to restrict access to owning agents only
-- This prevents competitors from stealing client data

-- First, ensure RLS is enabled on agent_clients
ALTER TABLE public.agent_clients ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies that might exist
DROP POLICY IF EXISTS "agent_clients_select_policy" ON public.agent_clients;
DROP POLICY IF EXISTS "agent_clients_insert_policy" ON public.agent_clients;
DROP POLICY IF EXISTS "agent_clients_update_policy" ON public.agent_clients;
DROP POLICY IF EXISTS "agent_clients_delete_policy" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can view their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can create their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can update their own clients" ON public.agent_clients;
DROP POLICY IF EXISTS "Agents can delete their own clients" ON public.agent_clients;

-- Create restrictive RLS policies - only the owning agent can access their clients
CREATE POLICY "Agents can view their own clients"
ON public.agent_clients
FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

CREATE POLICY "Agents can create their own clients"
ON public.agent_clients
FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own clients"
ON public.agent_clients
FOR UPDATE
TO authenticated
USING (agent_id = auth.uid())
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can delete their own clients"
ON public.agent_clients
FOR DELETE
TO authenticated
USING (agent_id = auth.uid());