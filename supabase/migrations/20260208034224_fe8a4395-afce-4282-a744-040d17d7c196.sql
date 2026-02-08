
-- Fix 1: Restrict profiles table SELECT to own profile + admins only
-- Friends should use profiles_friends view (which only exposes safe fields)
DROP POLICY IF EXISTS "Users can view own profile and accepted friends" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admin policy already exists, keeping it

-- Fix 2: Restrict rate_limits table - deny all access to authenticated users
-- Only service role should access this table
CREATE POLICY "Deny authenticated users from accessing rate limits"
ON public.rate_limits
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "Deny authenticated users from modifying rate limits"
ON public.rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
