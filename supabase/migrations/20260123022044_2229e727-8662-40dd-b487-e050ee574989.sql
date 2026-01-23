-- Add function for owner to update collaborator permissions
CREATE OR REPLACE FUNCTION public.update_collaborator_permission(
  p_collaborator_id uuid,
  p_permission text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_collaborator record;
  v_trip record;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
  END IF;
  
  -- Validate permission value
  IF p_permission NOT IN ('viewer', 'editor', 'contributor') THEN
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
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_collaborator_permission(uuid, text) TO authenticated;

-- Add function to get current user's trip permission
CREATE OR REPLACE FUNCTION public.get_trip_permission(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_collaborator record;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('isOwner', false, 'permission', null, 'canEdit', false);
  END IF;
  
  -- Check if owner
  SELECT * INTO v_trip FROM trips WHERE id = p_trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('isOwner', false, 'permission', null, 'canEdit', false);
  END IF;
  
  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('isOwner', true, 'permission', 'owner', 'canEdit', true);
  END IF;
  
  -- Check collaborator status
  SELECT * INTO v_collaborator 
  FROM trip_collaborators 
  WHERE trip_id = p_trip_id 
    AND user_id = v_user_id 
    AND accepted_at IS NOT NULL;
  
  IF v_collaborator.id IS NULL THEN
    RETURN jsonb_build_object('isOwner', false, 'permission', null, 'canEdit', false);
  END IF;
  
  RETURN jsonb_build_object(
    'isOwner', false, 
    'permission', v_collaborator.permission,
    'canEdit', v_collaborator.permission IN ('editor', 'contributor', 'edit', 'admin')
  );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_trip_permission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trip_permission(uuid) TO anon;