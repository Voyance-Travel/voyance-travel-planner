-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage bonuses" ON public.user_credit_bonuses;

-- The service role bypasses RLS anyway, so we only need the SELECT policy for users
-- No INSERT/UPDATE/DELETE policies for regular users - only service role can modify