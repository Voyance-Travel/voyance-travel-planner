
-- Drop the overly permissive ALL policy
DROP POLICY "Service role can manage cache" ON public.destination_image_cache;

-- No INSERT/UPDATE/DELETE policies needed for regular users.
-- The edge function uses the service_role key which bypasses RLS entirely.
-- This means only the edge function can write, and anyone can read (via the SELECT policy).
