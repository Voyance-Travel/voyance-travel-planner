-- Collaborative share — Phase 1: bridge a public share token to a collaborator row.
--
-- An authenticated recipient who opens /trip-share/:token and clicks "Join"
-- calls this RPC. It validates the token + that sharing is enabled, then makes
-- the caller an accepted trip_collaborator at the owner's chosen permission
-- (trips.share_permission: 'view' or 'edit'). The existing RLS on trips /
-- itinerary_days already grants accepted collaborators the right access, so no
-- policy changes are needed.
--
-- Idempotent: re-joining is a no-op that just ensures accepted_at is set; it does
-- NOT change an existing collaborator's permission (so a separate grant — e.g.
-- 'admin' via invite — is never silently downgraded by re-opening a 'view' link).

CREATE OR REPLACE FUNCTION public.accept_shared_trip(p_share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_permission text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id, user_id, share_enabled, share_permission
    INTO v_trip
  FROM public.trips
  WHERE share_token = p_share_token;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF NOT COALESCE(v_trip.share_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sharing_disabled');
  END IF;

  -- The owner doesn't need to "join" their own trip.
  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', true, 'trip_id', v_trip.id, 'already_owner', true);
  END IF;

  -- Map the share permission to a collaborator permission ('edit' or 'view').
  v_permission := CASE
    WHEN COALESCE(v_trip.share_permission, 'view') = 'edit' THEN 'edit'
    ELSE 'view'
  END;

  INSERT INTO public.trip_collaborators (trip_id, user_id, permission, invited_by, accepted_at)
  VALUES (v_trip.id, v_user_id, v_permission, v_trip.user_id, now())
  ON CONFLICT (trip_id, user_id) DO UPDATE
    SET accepted_at = COALESCE(public.trip_collaborators.accepted_at, now());

  RETURN jsonb_build_object(
    'success', true,
    'trip_id', v_trip.id,
    'permission', v_permission
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_shared_trip(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_shared_trip(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
