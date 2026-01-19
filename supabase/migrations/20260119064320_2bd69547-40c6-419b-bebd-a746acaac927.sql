-- Fix trip_collaborators permission escalation vulnerability
-- Users should NOT be able to escalate their own permission level

-- Drop the existing update policy that allows self-updates
DROP POLICY IF EXISTS "Controlled collaborator updates" ON public.trip_collaborators;

-- Create a restrictive update policy: Only trip OWNERS can update collaborator permissions
-- Collaborators can only update non-permission fields on their own record
CREATE POLICY "Trip owners can update collaborator permissions" 
ON public.trip_collaborators 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = trip_collaborators.trip_id 
    AND trips.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = trip_collaborators.trip_id 
    AND trips.user_id = auth.uid()
  )
);

-- Add a separate policy for collaborators to update their own non-sensitive fields (like accepted_at)
-- but NOT permission - we'll use a trigger to enforce this
CREATE OR REPLACE FUNCTION public.prevent_permission_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user updating is the collaborator themselves (not the trip owner)
  IF NEW.user_id = auth.uid() THEN
    -- Check if they're trying to change the permission field
    IF OLD.permission IS DISTINCT FROM NEW.permission THEN
      -- Only allow if they're also the trip owner
      IF NOT EXISTS (
        SELECT 1 FROM trips 
        WHERE trips.id = NEW.trip_id 
        AND trips.user_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'Cannot escalate your own permissions';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to prevent permission self-escalation
DROP TRIGGER IF EXISTS prevent_permission_escalation ON public.trip_collaborators;
CREATE TRIGGER prevent_permission_escalation
  BEFORE UPDATE ON public.trip_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_permission_self_escalation();