
-- Phase 2 & 4: Centralized invite resolution + structured error reasons

-- 1. resolve_or_rotate_invite: single canonical function for trip owners
CREATE OR REPLACE FUNCTION public.resolve_or_rotate_invite(
  p_trip_id uuid,
  p_force_rotate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_invite record;
  v_max_members integer;
  v_current_members integer;
  v_spots_remaining integer;
  v_token text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- Get trip
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trip_not_found');
  END IF;

  -- Only trip owner can resolve invites
  IF v_trip.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_owner');
  END IF;

  -- Check capacity
  v_max_members := GREATEST(COALESCE(v_trip.travelers, 1) - 1, 0);
  SELECT COUNT(*) INTO v_current_members
  FROM public.trip_collaborators
  WHERE trip_id = p_trip_id AND accepted_at IS NOT NULL;

  v_spots_remaining := GREATEST(v_max_members - v_current_members, 0);

  IF v_spots_remaining = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'trip_full',
      'maxMembers', v_max_members,
      'currentMembers', v_current_members
    );
  END IF;

  -- Get existing invite
  SELECT * INTO v_invite FROM public.trip_invites
  WHERE trip_id = p_trip_id
    AND invited_by = v_user_id
    AND email IS NULL
  LIMIT 1;

  -- Force rotate: delete old invite
  IF p_force_rotate AND v_invite.id IS NOT NULL THEN
    DELETE FROM public.trip_invites WHERE id = v_invite.id;
    v_invite := NULL;
  END IF;

  -- Refresh if expired or exhausted
  IF v_invite.id IS NOT NULL THEN
    IF (v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now())
       OR (v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses)
    THEN
      DELETE FROM public.trip_invites WHERE id = v_invite.id;
      v_invite := NULL;
    END IF;
  END IF;

  -- Create if needed
  IF v_invite.id IS NULL THEN
    INSERT INTO public.trip_invites (
      trip_id, invited_by, max_uses,
      expires_at
    ) VALUES (
      p_trip_id, v_user_id, v_max_members,
      now() + interval '7 days'
    )
    RETURNING * INTO v_invite;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_invite.token,
    'expiresAt', v_invite.expires_at,
    'usesCount', v_invite.uses_count,
    'maxUses', v_invite.max_uses,
    'spotsRemaining', v_spots_remaining,
    'rotated', p_force_rotate
  );
END;
$function$;

-- 2. Update accept_trip_invite to return structured reason codes
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
    RETURN jsonb_build_object('success', false, 'reason', 'requires_auth', 'error', 'Must be authenticated', 'requiresAuth', true);
  END IF;

  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_token', 'error', 'This invite link is not valid. It may have been reset by the trip owner.');
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invite_limit_reached', 'error', 'This invite link has reached its maximum number of uses.');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'expired', 'error', 'This invite link has expired. Ask the trip owner for a new link.');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trip_not_found', 'error', 'The trip associated with this invite no longer exists.');
  END IF;

  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_owner', 'error', 'You are already the owner of this trip.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = v_invite.trip_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_member', 'error', 'You are already a member of this trip.');
  END IF;

  SELECT COUNT(*) INTO v_current_members
  FROM public.trip_collaborators
  WHERE trip_id = v_invite.trip_id AND accepted_at IS NOT NULL;

  v_max_members := COALESCE(v_trip.travelers, 1) - 1;

  IF v_max_members > 0 AND v_current_members >= v_max_members THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trip_full', 'error', 'This trip has reached its maximum number of travelers. Ask the owner to increase the traveler count.');
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

  -- Create/accept friendship
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

  UPDATE public.trip_invites
  SET uses_count = uses_count + 1, accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'tripId', v_invite.trip_id,
    'tripName', v_trip.name,
    'destination', v_trip.destination
  );
END;
$function$;

-- 3. Update get_trip_invite_info to return structured reasons
CREATE OR REPLACE FUNCTION public.get_trip_invite_info(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_invite record;
  v_trip record;
  v_inviter record;
  v_current_members integer;
  v_max_members integer;
BEGIN
  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;
  
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_token', 'error', 'This invite link is not valid. It may have been reset by the trip owner.');
  END IF;
  
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invite_limit_reached', 'error', 'This invite link has reached its maximum number of uses.');
  END IF;
  
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'error', 'This invite link has expired. Ask the trip owner for a new link.');
  END IF;
  
  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'trip_not_found', 'error', 'The trip associated with this invite no longer exists.');
  END IF;
  
  SELECT display_name, avatar_url INTO v_inviter 
  FROM public.profiles WHERE id = v_invite.invited_by;
  
  SELECT COUNT(*) INTO v_current_members 
  FROM public.trip_collaborators 
  WHERE trip_id = v_invite.trip_id AND accepted_at IS NOT NULL;
  
  v_max_members := COALESCE(v_trip.travelers, 1) - 1;
  
  IF v_current_members >= v_max_members THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'trip_full', 'error', 'This trip has reached its maximum number of travelers. Ask the owner to increase the traveler count.');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'tripName', v_trip.name,
    'destination', v_trip.destination,
    'startDate', v_trip.start_date,
    'endDate', v_trip.end_date,
    'inviterName', v_inviter.display_name,
    'inviterAvatar', v_inviter.avatar_url,
    'spotsRemaining', v_max_members - v_current_members
  );
END;
$function$;
