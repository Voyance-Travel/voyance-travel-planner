-- ============================================================================
-- R1: customer_reviews PII — view + REVOKE
-- ============================================================================
DO $$
DECLARE pol_name TEXT;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='customer_reviews'
      AND 'anon' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customer_reviews', pol_name);
  END LOOP;
END$$;

DROP VIEW IF EXISTS public.public_customer_reviews;
CREATE VIEW public.public_customer_reviews
WITH (security_barrier = true) AS
SELECT
  cr.id,
  cr.name AS reviewer_name,
  cr.rating,
  cr.review_text,
  cr.trip_destination,
  cr.archetype,
  cr.is_featured,
  cr.photo_consent,
  cr.created_at
FROM public.customer_reviews cr
WHERE cr.is_approved = true;

GRANT SELECT ON public.public_customer_reviews TO anon, authenticated;

REVOKE SELECT ON public.customer_reviews FROM anon;
REVOKE SELECT ON public.customer_reviews FROM PUBLIC;

DROP POLICY IF EXISTS "customer_reviews_owner_read" ON public.customer_reviews;
CREATE POLICY "customer_reviews_owner_read" ON public.customer_reviews
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- R2: realtime.messages — topic-scoped subscription policy
-- ============================================================================
DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated subscriptions" ON realtime.messages;

CREATE POLICY "realtime_topic_scoped" ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'trip:%' THEN
      EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id::text = SUBSTRING(realtime.topic() FROM 6)
          AND (
            t.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.trip_collaborators tc
              WHERE tc.trip_id = t.id
                AND tc.user_id = auth.uid()
                AND tc.accepted_at IS NOT NULL
            )
          )
      )
    WHEN realtime.topic() LIKE 'user:%' THEN
      SUBSTRING(realtime.topic() FROM 6) = auth.uid()::text
    ELSE false
  END
);

-- ============================================================================
-- R4: trip_members email — PII-free view + owner/self read on base table
-- ============================================================================
DROP VIEW IF EXISTS public.public_trip_members;
CREATE VIEW public.public_trip_members
WITH (security_barrier = true) AS
SELECT
  tm.id,
  tm.trip_id,
  tm.user_id,
  tm.role,
  tm.accepted_at,
  tm.invited_at,
  tm.created_at,
  COALESCE(
    p.display_name,
    tm.name,
    'Member ' || SUBSTRING(COALESCE(tm.user_id::text, tm.id::text) FROM 1 FOR 8)
  ) AS member_display,
  p.avatar_url
FROM public.trip_members tm
LEFT JOIN public.profiles p ON p.id = tm.user_id;

GRANT SELECT ON public.public_trip_members TO authenticated;

DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_members;

DROP POLICY IF EXISTS "trip_members_owner_read" ON public.trip_members;
CREATE POLICY "trip_members_owner_read" ON public.trip_members
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_members.trip_id
      AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_members_self_read" ON public.trip_members;
CREATE POLICY "trip_members_self_read" ON public.trip_members
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- R6: SECURITY DEFINER — REVOKE FROM PUBLIC + selective re-GRANT
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  fn_signature TEXT;
  authed_funcs TEXT[] := ARRAY[
    'accept_trip_invite',
    'add_to_group_budget',
    'claim_first_trip_benefit',
    'complete_quiz',
    'consume_free_edit',
    'deduct_credits_fifo',
    'get_current_user_email',
    'get_journey_trips',
    'get_trip_invite_info',
    'get_trip_permission',
    'get_user_id_by_email',
    'get_user_info_by_email',
    'get_user_trip_ids',
    'is_trip_collaborator',
    'is_trip_member',
    'is_trip_owner',
    'optimistic_update_itinerary',
    'resolve_or_rotate_invite',
    'save_onboarding_dna',
    'spend_from_group_budget',
    'submit_client_intake',
    'toggle_consumer_trip_share',
    'transition_booking_state',
    'update_collaborator_permission'
  ];
  anon_funcs TEXT[] := ARRAY[
    'get_consumer_shared_trip',
    'get_shared_trip_payload',
    'get_founding_member_count',
    'get_platform_destination_count',
    'get_platform_trip_count',
    'get_intake_account'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    fn_signature := format('public.%I(%s)', r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn_signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn_signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn_signature);

    IF r.proname = ANY(authed_funcs) OR r.proname = ANY(anon_funcs) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_signature);
    END IF;
    IF r.proname = ANY(anon_funcs) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', fn_signature);
    END IF;
  END LOOP;
END$$;