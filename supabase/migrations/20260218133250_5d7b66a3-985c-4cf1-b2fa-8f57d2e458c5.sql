
-- Fix: "permission denied for table users" in trip_invites RLS
-- The policy "Users can view their own invites" queries auth.users directly, which
-- the authenticated role cannot access. Replace it with a SECURITY DEFINER function.

-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view their own invites" ON public.trip_invites;

-- Create a security definer helper to get the current user's email
-- without the authenticated role needing direct auth.users SELECT
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Re-create the policy using the helper function instead of direct auth.users query
CREATE POLICY "Users can view their own invites"
  ON public.trip_invites
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      invited_by = auth.uid()
      OR accepted_by = auth.uid()
      OR email = public.get_current_user_email()
      OR EXISTS (
        SELECT 1 FROM public.trips
        WHERE trips.id = trip_invites.trip_id
          AND trips.user_id = auth.uid()
      )
    )
  );
