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
AS $function$
DECLARE
  v_activity record;
  v_allowed boolean := false;
  v_user_id uuid;
  v_is_authorized boolean := false;
  v_last jsonb;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_activity FROM trip_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found');
  END IF;

  -- Authorization: trip owner or accepted collaborator with edit-tier permission
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = v_activity.trip_id AND t.user_id = v_user_id
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    SELECT EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = v_activity.trip_id
        AND tc.user_id = v_user_id
        AND tc.accepted_at IS NOT NULL
        AND tc.permission IN ('edit', 'admin', 'editor', 'contributor')
    ) INTO v_is_authorized;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not have permission to modify this booking');
  END IF;

  -- IDEMPOTENCY: if the most recent state_history entry already records this exact
  -- (new_state, trigger_reference) pair, treat the call as a duplicate webhook and
  -- short-circuit. This prevents duplicate audit entries when Stripe replays events.
  IF p_trigger_reference IS NOT NULL
     AND v_activity.state_history IS NOT NULL
     AND jsonb_typeof(v_activity.state_history) = 'array'
     AND jsonb_array_length(v_activity.state_history) > 0 THEN
    v_last := v_activity.state_history -> (jsonb_array_length(v_activity.state_history) - 1);
    IF (v_last ->> 'to') = p_new_state::text
       AND (v_last ->> 'trigger_reference') = p_trigger_reference THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'previous_state', v_activity.booking_state,
        'new_state', p_new_state
      );
    END IF;
  END IF;

  -- Allowed transitions
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
      v_allowed := false;
    ELSE
      v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid transition from %s to %s', v_activity.booking_state, p_new_state)
    );
  END IF;

  UPDATE trip_activities
  SET
    booking_state = p_new_state,
    booked_at = CASE WHEN p_new_state = 'booked_confirmed' THEN now() ELSE booked_at END,
    cancelled_at = CASE WHEN p_new_state = 'cancelled' THEN now() ELSE cancelled_at END,
    refunded_at = CASE WHEN p_new_state = 'refunded' THEN now() ELSE refunded_at END,
    updated_at = now(),
    state_history = COALESCE(state_history, '[]'::jsonb) || jsonb_build_object(
      'from', v_activity.booking_state,
      'to', p_new_state,
      'at', now(),
      'by', v_user_id,
      'trigger_source', p_trigger_source,
      'trigger_reference', p_trigger_reference,
      'metadata', p_metadata
    )
  WHERE id = p_activity_id;

  -- NOTE: Legacy INSERT INTO booking_state_log removed. The table was dropped in
  -- migration 20260125212256; state_history JSONB on trip_activities is now the
  -- canonical audit trail.

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'previous_state', v_activity.booking_state,
    'new_state', p_new_state
  );
END;
$function$;