-- Fix RLS policy to be explicit about service role only
DROP POLICY IF EXISTS "System can manage verified venues" ON public.verified_venues;

-- No public INSERT/UPDATE/DELETE policies - only service role (edge functions) can modify
-- This is the secure pattern for system-managed reference data