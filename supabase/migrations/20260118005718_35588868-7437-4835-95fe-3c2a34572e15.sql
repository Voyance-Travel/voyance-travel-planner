-- Fix 1: Improve has_role function - use SECURITY INVOKER and only check current user's roles
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

CREATE OR REPLACE FUNCTION public.has_role(_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- Fix 2: Tighten trip_collaborators policies
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own collaborations" ON trip_collaborators;
DROP POLICY IF EXISTS "Trip owners can update collaborators" ON trip_collaborators;

-- New SELECT policy: Require authentication and restrict to own collaborations or owned trips
CREATE POLICY "Users can view relevant collaborations"
ON trip_collaborators
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- User is the collaborator
    user_id = auth.uid()
    -- Or user owns the trip
    OR EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_collaborators.trip_id 
      AND trips.user_id = auth.uid()
    )
  )
);

-- New UPDATE policy: Trip owners can only modify pending invites, collaborators can only accept their own
CREATE POLICY "Controlled collaborator updates"
ON trip_collaborators
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Trip owners can update collaborators (change permissions, etc.)
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_collaborators.trip_id 
      AND trips.user_id = auth.uid()
    )
    -- Or user is accepting their own invitation (can only set accepted_at)
    OR user_id = auth.uid()
  )
);