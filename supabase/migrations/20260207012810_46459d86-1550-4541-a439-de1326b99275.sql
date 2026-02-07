-- Clean up duplicate/overlapping ALL policies on agency tables
-- These overlap with the granular per-operation policies and can cause confusion

-- agency_travelers: drop redundant ALL policies
DROP POLICY IF EXISTS "Agents can manage own travelers" ON public.agency_travelers;
DROP POLICY IF EXISTS "Agents can manage their own travelers" ON public.agency_travelers;

-- agency_documents: drop redundant ALL policies  
DROP POLICY IF EXISTS "Agents can manage own documents" ON public.agency_documents;
DROP POLICY IF EXISTS "Agents can manage their own documents" ON public.agency_documents;

-- agency_tasks: drop redundant ALL policies
DROP POLICY IF EXISTS "Agents can manage own tasks" ON public.agency_tasks;
DROP POLICY IF EXISTS "Agents can manage their own tasks" ON public.agency_tasks;

-- Force RLS for table owners too (belt and suspenders)
ALTER TABLE public.agency_travelers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agency_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agency_tasks FORCE ROW LEVEL SECURITY;