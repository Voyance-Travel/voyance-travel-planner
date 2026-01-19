-- ============================================================================
-- SECURITY FIX: Remove email from profiles table (it belongs in auth.users only)
-- ============================================================================

-- Drop the email column from profiles - email is already stored in auth.users
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- ============================================================================
-- SECURITY FIX: Create masked view for trip_members to hide emails from non-owners
-- ============================================================================

-- Create a function to check if user is trip owner
CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips
    WHERE id = p_trip_id AND user_id = auth.uid()
  )
$$;

-- Create a safe view that masks emails for non-owners
CREATE OR REPLACE VIEW public.trip_members_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  trip_id,
  user_id,
  name,
  -- Only show email to trip owners, otherwise mask it
  CASE 
    WHEN public.is_trip_owner(trip_id) THEN email
    ELSE CONCAT(LEFT(email, 2), '***@***', SUBSTRING(email FROM POSITION('@' IN email) + 1 FOR 1), '***')
  END AS email,
  role,
  invited_at,
  accepted_at,
  created_at,
  updated_at
FROM public.trip_members;