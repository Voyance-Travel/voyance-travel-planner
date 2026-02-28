-- Fix the update_collaborator_permission function to use correct permission values
-- The table check constraint allows: 'view', 'edit', 'admin'
-- But the function was validating against: 'viewer', 'editor', 'contributor'

CREATE OR REPLACE FUNCTION public.update_collaborator_permission(p_collaborator_id uuid, p_permission text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_collaborator record;
  v_trip record;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
  END IF;
  
  -- Validate permission value — must match table check constraint
  IF p_permission NOT IN ('view', 'edit', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid permission level');
  END IF;
  
  -- Get the collaborator
  SELECT * INTO v_collaborator FROM trip_collaborators WHERE id = p_collaborator_id;
  
  IF v_collaborator.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Collaborator not found');
  END IF;
  
  -- Get the trip and verify ownership
  SELECT * INTO v_trip FROM trips WHERE id = v_collaborator.trip_id;
  
  IF v_trip.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can change permissions');
  END IF;
  
  -- Update the permission
  UPDATE trip_collaborators 
  SET permission = p_permission
  WHERE id = p_collaborator_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'collaborator_id', p_collaborator_id,
    'new_permission', p_permission
  );
END;
$function$;