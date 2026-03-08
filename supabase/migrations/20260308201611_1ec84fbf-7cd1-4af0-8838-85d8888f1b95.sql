-- 1. Rewrite resolve_or_rotate_invite: more generous max_uses, 30-day expiry, no spotsRemaining
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

  -- More generous max_uses: at least 10, or triple the traveler count
  v_max_uses := GREATEST(10, COALESCE(v_trip.travelers, 1) * 3);

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

  -- Upgrade existing invite max_uses if below new threshold
  IF v_invite.id IS NOT NULL AND v_invite.max_uses IS NOT NULL AND v_invite.max_uses < v_max_uses THEN
    UPDATE public.trip_invites SET max_uses = v_max_uses WHERE id = v_invite.id;
    v_invite.max_uses := v_max_uses;
  END IF;

  -- Create if needed (30-day expiry)
  IF v_invite.id IS NULL THEN
    INSERT INTO public.trip_invites (
      trip_id, invited_by, max_uses, expires_at
    ) VALUES (
      p_trip_id, v_user_id, v_max_uses, now() + interval '30 days'
    )
    RETURNING * INTO v_invite;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_invite.token,
    'expiresAt', v_invite.expires_at,
    'usesCount', v_invite.uses_count,
    'maxUses', v_invite.max_uses,
    'rotated', p_force_rotate
  );
END;
$function$;

-- 2. Rewrite get_trip_invite_info: remove spotsRemaining
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
    'tripId', v_trip.id,
    'ownerId', v_trip.user_id,
    'tripName', v_trip.name,
    'destination', v_trip.destination,
    'startDate', v_trip.start_date,
    'endDate', v_trip.end_date,
    'inviterName', v_inviter.display_name,
    'inviterAvatar', v_inviter.avatar_url
  );
END;
$function$;

-- 3. Backfill: upgrade active invites to new minimums
UPDATE public.trip_invites
SET max_uses = GREATEST(10, max_uses)
WHERE expires_at > now()
  AND max_uses IS NOT NULL
  AND max_uses < 10;

-- Extend expiry of active invites that were ~7 days to 30 days from creation
UPDATE public.trip_invites
SET expires_at = created_at + interval '30 days'
WHERE expires_at > now()
  AND expires_at <= created_at + interval '8 days';