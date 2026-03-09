
-- 1. Add replaced_at column to trip_invites for soft-delete
ALTER TABLE public.trip_invites
ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ DEFAULT NULL;

-- Index for replaced token lookups
CREATE INDEX IF NOT EXISTS idx_trip_invites_replaced
ON public.trip_invites(token) WHERE replaced_at IS NOT NULL;

-- 2. Create invite_failure_log table
CREATE TABLE IF NOT EXISTS public.invite_failure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_token TEXT NOT NULL,
  reason TEXT NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_failure_log_created ON public.invite_failure_log(created_at);

ALTER TABLE public.invite_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts for logging" ON public.invite_failure_log
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role only for reads" ON public.invite_failure_log
FOR SELECT USING (false);

-- 3. Replace resolve_or_rotate_invite with soft-delete
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

  v_max_uses := GREATEST(10, COALESCE(v_trip.travelers, 1) * 3);

  -- Get existing ACTIVE invite (not replaced)
  SELECT * INTO v_invite FROM public.trip_invites
  WHERE trip_id = p_trip_id
    AND invited_by = v_user_id
    AND email IS NULL
    AND replaced_at IS NULL
  LIMIT 1;

  -- Force rotate: soft-delete old invite
  IF p_force_rotate AND v_invite.id IS NOT NULL THEN
    UPDATE public.trip_invites SET replaced_at = now() WHERE id = v_invite.id;
    v_invite := NULL;
  END IF;

  -- Refresh if expired or exhausted: soft-delete
  IF v_invite.id IS NOT NULL THEN
    IF (v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now())
       OR (v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses)
    THEN
      UPDATE public.trip_invites SET replaced_at = now() WHERE id = v_invite.id;
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

-- 4. Replace get_trip_invite_info with link_replaced + failure logging
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
    INSERT INTO public.invite_failure_log (attempted_token, reason)
    VALUES (p_token, 'token_not_found');
    RETURN jsonb_build_object('valid', false, 'reason', 'token_not_found', 'error', 'This invite link was not found. It may have been reset by the trip owner.');
  END IF;

  -- Check if this token was replaced by a newer one
  IF v_invite.replaced_at IS NOT NULL THEN
    INSERT INTO public.invite_failure_log (attempted_token, reason)
    VALUES (p_token, 'link_replaced');
    RETURN jsonb_build_object('valid', false, 'reason', 'link_replaced', 'error', 'This invite link has been replaced with a newer one. Ask the trip owner for the updated link.');
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    INSERT INTO public.invite_failure_log (attempted_token, reason)
    VALUES (p_token, 'invite_limit_reached');
    RETURN jsonb_build_object('valid', false, 'reason', 'invite_limit_reached', 'error', 'This invite link has reached its maximum number of uses.');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    INSERT INTO public.invite_failure_log (attempted_token, reason)
    VALUES (p_token, 'expired');
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'error', 'This invite link has expired. Ask the trip owner for a new link.');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;

  IF v_trip.id IS NULL THEN
    INSERT INTO public.invite_failure_log (attempted_token, reason)
    VALUES (p_token, 'trip_not_found');
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
