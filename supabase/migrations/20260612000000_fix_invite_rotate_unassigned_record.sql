-- Fix: resolve_or_rotate_invite threw 'record "v_invite" is not assigned yet'
-- whenever it took the rotate / expired / exhausted branch.
--
-- Root cause: in plpgsql, assigning `v_invite := NULL` to a RECORD variable
-- leaves the record UNASSIGNED, so the very next `v_invite.id IS NOT NULL`
-- read raised an error. The UI's normal "generate link" call uses
-- p_force_rotate=false and an unexpired invite, so it never hit the branch —
-- but explicit rotate (and any expired/exhausted invite) errored hard
-- (Collab QA X4).
--
-- Fix: track invite presence with a boolean flag instead of nulling the
-- record. The record's fields stay readable throughout; the flag governs the
-- create-if-needed logic. Behavior is otherwise identical.

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
  v_have_invite boolean := false;
  v_max_uses integer;
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
  v_have_invite := (v_invite.id IS NOT NULL);

  -- Force rotate: soft-delete old invite
  IF p_force_rotate AND v_have_invite THEN
    UPDATE public.trip_invites SET replaced_at = now() WHERE id = v_invite.id;
    v_have_invite := false;
  END IF;

  -- Refresh if expired or exhausted: soft-delete
  IF v_have_invite THEN
    IF (v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now())
       OR (v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses)
    THEN
      UPDATE public.trip_invites SET replaced_at = now() WHERE id = v_invite.id;
      v_have_invite := false;
    END IF;
  END IF;

  -- Upgrade existing invite max_uses if below new threshold
  IF v_have_invite AND v_invite.max_uses IS NOT NULL AND v_invite.max_uses < v_max_uses THEN
    UPDATE public.trip_invites SET max_uses = v_max_uses WHERE id = v_invite.id;
    v_invite.max_uses := v_max_uses;
  END IF;

  -- Create if needed (30-day expiry)
  IF NOT v_have_invite THEN
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
