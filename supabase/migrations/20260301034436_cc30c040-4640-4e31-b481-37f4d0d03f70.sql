CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_trip record;
  v_current_members integer;
  v_max_members integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated', 'requiresAuth', true);
  END IF;

  -- Get the invite
  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite link');
  END IF;

  -- Check if already accepted
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has already been used');
  END IF;

  -- Check uses count
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite link has reached its maximum uses');
  END IF;

  -- Check expiration
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has expired');
  END IF;

  -- Get the trip
  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
  END IF;

  -- Check if user is already trip owner
  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the owner of this trip');
  END IF;

  -- Check current member count vs travelers limit
  SELECT COUNT(*) INTO v_current_members
  FROM public.trip_collaborators
  WHERE trip_id = v_invite.trip_id AND accepted_at IS NOT NULL;

  v_max_members := COALESCE(v_trip.travelers, 1) - 1; -- minus the owner

  IF v_current_members >= v_max_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'This trip has reached its maximum number of travelers');
  END IF;

  -- Check if already a collaborator
  IF EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = v_invite.trip_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this trip');
  END IF;

  -- Add as collaborator
  INSERT INTO public.trip_collaborators (trip_id, user_id, permission, invited_by, accepted_at)
  VALUES (v_invite.trip_id, v_user_id, 'view', v_invite.invited_by, now())
  ON CONFLICT (trip_id, user_id) DO UPDATE SET accepted_at = now();

  -- Also add as trip member
  INSERT INTO public.trip_members (trip_id, user_id, email, name, role, accepted_at)
  SELECT
    v_invite.trip_id,
    v_user_id,
    u.email,
    COALESCE(p.display_name, split_part(u.email, '@', 1)),
    'attendee',
    now()
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_user_id
  ON CONFLICT (trip_id, email) DO UPDATE SET
    user_id = v_user_id,
    accepted_at = now();

  -- Create/accept friendship if inviter exists
  IF v_invite.invited_by IS NOT NULL AND v_invite.invited_by <> v_user_id THEN
    UPDATE public.friendships
    SET status = 'accepted', updated_at = now()
    WHERE (requester_id = v_invite.invited_by AND addressee_id = v_user_id)
       OR (requester_id = v_user_id AND addressee_id = v_invite.invited_by);

    IF NOT FOUND THEN
      INSERT INTO public.friendships (requester_id, addressee_id, status)
      VALUES (v_invite.invited_by, v_user_id, 'accepted')
      ON CONFLICT (requester_id, addressee_id) DO UPDATE
      SET status = 'accepted', updated_at = now();
    END IF;
  END IF;

  -- Mark invite as used
  UPDATE public.trip_invites
  SET
    uses_count = uses_count + 1,
    accepted_at = now(),
    accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'tripId', v_invite.trip_id,
    'tripName', v_trip.name,
    'destination', v_trip.destination
  );
END;
$function$;