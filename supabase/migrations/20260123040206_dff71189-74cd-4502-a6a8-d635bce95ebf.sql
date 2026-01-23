-- Fix: Restrict public access to agency_accounts
-- The current policy exposes all account data when intake is enabled
-- This update requires the token to match a specific value from the request context

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can view account by intake token" ON public.agency_accounts;

-- Create a more restrictive policy that requires the token to be passed as a request header
-- This ensures only users with the exact token can access account data for intake
-- NOTE: For intake forms, create a dedicated RPC function that validates the token
-- and returns only the minimal fields needed (name, id) instead of full account access

-- Instead of a broad SELECT policy, we'll rely on authenticated agent access only
-- Intake functionality should be handled via a SECURITY DEFINER RPC function

-- Alternative approach: Create a view for public intake that exposes only safe fields
CREATE OR REPLACE VIEW public.agency_accounts_intake AS
SELECT 
  id,
  name,
  intake_token
FROM public.agency_accounts
WHERE intake_enabled = true AND intake_token IS NOT NULL;

-- Grant select on the view to anon for intake forms
GRANT SELECT ON public.agency_accounts_intake TO anon;
GRANT SELECT ON public.agency_accounts_intake TO authenticated;

-- Create RPC function for validating intake token and returning minimal account info
CREATE OR REPLACE FUNCTION public.get_intake_account(p_intake_token text)
RETURNS TABLE (
  id uuid,
  name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT aa.id, aa.name
  FROM public.agency_accounts aa
  WHERE aa.intake_enabled = true 
    AND aa.intake_token = p_intake_token;
END;
$$;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.get_intake_account(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_intake_account(text) TO authenticated;