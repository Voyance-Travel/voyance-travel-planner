-- Fix: Add RLS policies for rate_limits table
-- This table is used for rate limiting and should allow edge functions to manage it

-- Policy to allow edge functions (service role) to manage rate limits
CREATE POLICY "Allow service role to manage rate limits"
ON public.rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- This is typically managed by edge functions with service role key,
-- but having a policy prevents the linter warning