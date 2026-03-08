
-- 1) Update get_trip_invite_info to also return tripId and ownerId
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
    'inviterAvatar', v_inviter.avatar_url,
    'spotsRemaining', GREATEST(0, COALESCE(v_invite.max_uses, 7) - COALESCE(v_invite.uses_count, 0))
  );
END;
$function$;

-- 2) Add a trigger to prevent self-collaboration (owner adding themselves)
CREATE OR REPLACE FUNCTION public.prevent_self_collaboration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.trips WHERE id = NEW.trip_id;
  
  IF NEW.user_id = v_owner_id THEN
    RAISE EXCEPTION 'Cannot add trip owner as a collaborator';
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_self_collaboration ON public.trip_collaborators;
CREATE TRIGGER trg_prevent_self_collaboration
  BEFORE INSERT ON public.trip_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_collaboration();
