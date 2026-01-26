-- Fix: Add ownership verification to transition_booking_state function
-- This prevents authenticated users from modifying booking states for trips they don't own or collaborate on

CREATE OR REPLACE FUNCTION public.transition_booking_state(
  p_activity_id uuid, 
  p_new_state booking_item_state, 
  p_trigger_source text DEFAULT 'user'::text, 
  p_trigger_reference text DEFAULT NULL::text, 
  p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_activity record;
  v_allowed boolean := false;
  v_user_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Require authentication
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Get current activity state
  SELECT * INTO v_activity FROM trip_activities WHERE id = p_activity_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found');
  END IF;
  
  -- SECURITY FIX: Verify user owns or collaborates on this trip
  -- Check if user is the trip owner
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = v_activity.trip_id
    AND t.user_id = v_user_id
  ) INTO v_is_authorized;
  
  -- If not owner, check if user is a collaborator with edit permissions
  IF NOT v_is_authorized THEN
    SELECT EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = v_activity.trip_id
      AND tc.user_id = v_user_id
      AND tc.accepted_at IS NOT NULL
      AND tc.permission IN ('edit', 'admin', 'editor', 'contributor')
    ) INTO v_is_authorized;
  END IF;
  
  -- Reject unauthorized access
  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not have permission to modify this booking');
  END IF;
  
  -- Define valid state transitions
  CASE v_activity.booking_state
    WHEN 'not_selected' THEN
      v_allowed := p_new_state IN ('selected_pending');
    WHEN 'selected_pending' THEN
      v_allowed := p_new_state IN ('not_selected', 'booked_confirmed');
    WHEN 'booked_confirmed' THEN
      v_allowed := p_new_state IN ('changed', 'cancelled', 'refunded');
    WHEN 'changed' THEN
      v_allowed := p_new_state IN ('booked_confirmed', 'cancelled', 'refunded');
    WHEN 'cancelled' THEN
      v_allowed := p_new_state IN ('refunded');
    WHEN 'refunded' THEN
      v_allowed := false; -- Terminal state
    ELSE
      v_allowed := p_new_state = 'selected_pending'; -- Default for NULL
  END CASE;
  
  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Invalid state transition from %s to %s', v_activity.booking_state, p_new_state)
    );
  END IF;
  
  -- Update the activity state
  UPDATE trip_activities
  SET 
    booking_state = p_new_state,
    updated_at = now(),
    booked_at = CASE WHEN p_new_state = 'booked_confirmed' THEN now() ELSE booked_at END,
    cancelled_at = CASE WHEN p_new_state = 'cancelled' THEN now() ELSE cancelled_at END,
    refunded_at = CASE WHEN p_new_state = 'refunded' THEN now() ELSE refunded_at END,
    state_history = COALESCE(state_history, '[]'::jsonb) || jsonb_build_object(
      'from', v_activity.booking_state,
      'to', p_new_state,
      'at', now(),
      'by', v_user_id
    )
  WHERE id = p_activity_id;
  
  -- Log the state change
  INSERT INTO booking_state_log (
    trip_activity_id,
    trip_id,
    user_id,
    previous_state,
    new_state,
    trigger_source,
    trigger_reference,
    metadata
  ) VALUES (
    p_activity_id,
    v_activity.trip_id,
    v_user_id,
    v_activity.booking_state,
    p_new_state,
    p_trigger_source,
    p_trigger_reference,
    p_metadata
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_state', v_activity.booking_state,
    'new_state', p_new_state
  );
END;
$$;