-- Change 4: Add FOR UPDATE to serialize concurrent accept calls
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

  -- Check 1: token exists — FOR UPDATE locks the row to prevent concurrent double-increment
  SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token FOR UPDATE;
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