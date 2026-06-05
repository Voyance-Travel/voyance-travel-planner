-- Collaborative share — Phase 0: owner configures the share link.
--
-- The owner chooses, when enabling a /trip-share/:token link:
--   * share_permission   — what a recipient who JOINS can do: 'view' or 'edit'
--                          ('edit' = full collaborate, incl. add). A finer
--                          'add-only' tier (add but not delete) is a later phase.
--   * share_credit_policy — who pays when a collaborator triggers a paid AI/
--                          regenerate action: 'owner' | 'collaborator' | 'free'.
--                          Default 'collaborator' (no surprise spend on the owner;
--                          enforcement lands in the credit-attribution phase).
--
-- This migration only adds the columns and lets the owner persist the choice.
-- The recipient join-bridge + enforcement come in later phases.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS share_permission text NOT NULL DEFAULT 'view'
    CHECK (share_permission IN ('view', 'edit')),
  ADD COLUMN IF NOT EXISTS share_credit_policy text NOT NULL DEFAULT 'collaborator'
    CHECK (share_credit_policy IN ('owner', 'collaborator', 'free'));

-- Replace toggle_consumer_trip_share with a config-aware version. The two new
-- params default to NULL so existing 2-arg callers (publicShareLink service)
-- still resolve to this function and keep the trip's current config. We DROP the
-- old 2-arg signature first so there is exactly one overload (no ambiguity).
DROP FUNCTION IF EXISTS public.toggle_consumer_trip_share(uuid, boolean);

CREATE OR REPLACE FUNCTION public.toggle_consumer_trip_share(
  p_trip_id uuid,
  p_enabled boolean,
  p_permission text DEFAULT NULL,
  p_credit_policy text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_token text;
  v_day_count int;
  v_permission text;
  v_credit_policy text;
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

  -- Resolve config: caller override wins, else keep the trip's current value.
  v_permission := COALESCE(p_permission, v_trip.share_permission, 'view');
  v_credit_policy := COALESCE(p_credit_policy, v_trip.share_credit_policy, 'collaborator');

  IF v_permission NOT IN ('view', 'edit') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_permission');
  END IF;
  IF v_credit_policy NOT IN ('owner', 'collaborator', 'free') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_credit_policy');
  END IF;

  IF p_enabled THEN
    v_day_count := COALESCE(jsonb_array_length(v_trip.itinerary_data->'days'), 0);
    IF v_day_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'itinerary_not_ready');
    END IF;
  END IF;

  v_token := v_trip.share_token;
  IF p_enabled AND v_token IS NULL THEN
    v_token := encode(gen_random_bytes(12), 'hex');
  END IF;

  UPDATE public.trips
  SET share_enabled = p_enabled,
      share_token = v_token,
      share_permission = v_permission,
      share_credit_policy = v_credit_policy
  WHERE id = p_trip_id;

  RETURN jsonb_build_object(
    'success', true,
    'share_enabled', p_enabled,
    'share_token', v_token,
    'share_permission', v_permission,
    'share_credit_policy', v_credit_policy
  );
END;
$function$;

-- This DB revokes the default PUBLIC execute on functions, so grant explicitly.
REVOKE ALL ON FUNCTION public.toggle_consumer_trip_share(uuid, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_consumer_trip_share(uuid, boolean, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
