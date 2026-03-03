
-- Fix resolve_or_rotate_invite: spotsRemaining should reflect invite link capacity, not travelers-1
CREATE OR REPLACE FUNCTION public.resolve_or_rotate_invite(p_trip_id uuid, p_force_rotate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_invite record;
  v_max_uses integer;
  v_token text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trip_not_found');
  END IF;

  IF v_trip.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_owner');
  END IF;

  -- Calculate generous max_uses: at least 7, or double the traveler count
  v_max_uses := GREATEST(7, COALESCE(v_trip.travelers, 1) * 2);

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

  -- Upgrade existing invite max_uses if it's below the new threshold
  IF v_invite.id IS NOT NULL AND v_invite.max_uses IS NOT NULL AND v_invite.max_uses < v_max_uses THEN
    UPDATE public.trip_invites SET max_uses = v_max_uses WHERE id = v_invite.id;
    v_invite.max_uses := v_max_uses;
  END IF;

  -- Create if needed
  IF v_invite.id IS NULL THEN
    INSERT INTO public.trip_invites (
      trip_id, invited_by, max_uses, expires_at
    ) VALUES (
      p_trip_id, v_user_id, v_max_uses, now() + interval '7 days'
    )
    RETURNING * INTO v_invite;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_invite.token,
    'expiresAt', v_invite.expires_at,
    'usesCount', v_invite.uses_count,
    'maxUses', v_invite.max_uses,
    -- spotsRemaining = remaining invite uses, not travelers-based cap
    'spotsRemaining', GREATEST(0, COALESCE(v_invite.max_uses, v_max_uses) - COALESCE(v_invite.uses_count, 0)),
    'rotated', p_force_rotate
  );
END;
$function$;

-- Fix get_trip_invite_info: same spotsRemaining logic + don't block on travelers-1 cap
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
BEGIN
  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;
  
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'token_not_found', 'error', 'This invite link was not found. It may have been reset by the trip owner.');
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
  
  RETURN jsonb_build_object(
    'valid', true,
    'tripName', v_trip.name,
    'destination', v_trip.destination,
    'startDate', v_trip.start_date,
    'endDate', v_trip.end_date,
    'inviterName', v_inviter.display_name,
    'inviterAvatar', v_inviter.avatar_url,
    -- spotsRemaining = remaining invite link uses
    'spotsRemaining', GREATEST(0, COALESCE(v_invite.max_uses, 7) - COALESCE(v_invite.uses_count, 0))
  );
END;
$function$;

-- Fix accept_trip_invite: remove the travelers-based capacity block
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
  v_existing_collab record;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'requires_auth', 'error', 'You must be signed in to accept this invite.', 'requiresAuth', true);
  END IF;

  -- Check 1: token exists
  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'token_not_found', 'error', 'This invite link was not found. It may have been reset by the trip owner.');
  END IF;

  -- Check 2: uses_count < max_uses
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invite_limit_reached', 'error', 'This invite link has reached its maximum number of uses. Ask the trip owner for a new link.');
  END IF;

  -- Check 3: not expired
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'expired', 'error', 'This invite link has expired. Ask the trip owner for a new link.');
  END IF;

  -- Get trip
  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trip_not_found', 'error', 'The trip associated with this invite no longer exists.');
  END IF;

  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_owner', 'error', 'You are already the owner of this trip.');
  END IF;

  -- Check 4: user not already an active collaborator
  SELECT * INTO v_existing_collab
  FROM public.trip_collaborators
  WHERE trip_id = v_invite.trip_id AND user_id = v_user_id;

  IF v_existing_collab.id IS NOT NULL AND v_existing_collab.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'tripId', v_invite.trip_id,
      'tripName', v_trip.name,
      'destination', v_trip.destination,
      'alreadyMember', true
    );
  END IF;

  -- Capacity is governed by max_uses on the invite link, not travelers count.
  -- The travelers field is informational for trip planning, not a hard collaboration cap.

  -- Add or restore as collaborator
  INSERT INTO public.trip_collaborators (trip_id, user_id, permission, invited_by, accepted_at)
  VALUES (v_invite.trip_id, v_user_id, 'view', v_invite.invited_by, now())
  ON CONFLICT (trip_id, user_id) DO UPDATE SET accepted_at = now(), permission = 'view';

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

  -- Metadata update only
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
