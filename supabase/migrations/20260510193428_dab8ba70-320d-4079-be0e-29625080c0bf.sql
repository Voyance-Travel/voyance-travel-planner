-- ============================================================================
-- S2: generation_logs — explicit deny on user writes (defense in depth)
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.generation_logs FROM anon, authenticated;

CREATE POLICY "generation_logs_no_user_writes" ON public.generation_logs
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "generation_logs_no_user_updates" ON public.generation_logs
  FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "generation_logs_no_user_deletes" ON public.generation_logs
  FOR DELETE TO authenticated, anon USING (false);

-- ============================================================================
-- S5: voyance_picks — explicit RESTRICTIVE admin-only writes
-- (already had PERMISSIVE admin policy; add RESTRICTIVE to block any future
--  permissive policy from accidentally granting access)
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.voyance_picks FROM anon, authenticated;

CREATE POLICY "voyance_picks_restrict_writes_to_admins" ON public.voyance_picks
  AS RESTRICTIVE
  FOR ALL TO authenticated, anon
  USING (public.has_role('admin'::app_role))
  WITH CHECK (public.has_role('admin'::app_role));

-- voyance_events: also lock down (only owner inserts/reads own)
REVOKE UPDATE, DELETE ON public.voyance_events FROM anon, authenticated;

-- curated_images: drop the duplicate public-role service-role policy (uses {public} role incorrectly)
DROP POLICY IF EXISTS "Service role can manage curated images" ON public.curated_images;
CREATE POLICY "curated_images_service_role_manage" ON public.curated_images
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- S8: route_cache — explicit REVOKE + deny-write policies
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.route_cache FROM anon, authenticated, PUBLIC;

CREATE POLICY "route_cache_no_user_writes" ON public.route_cache
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "route_cache_no_user_updates" ON public.route_cache
  FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "route_cache_no_user_deletes" ON public.route_cache
  FOR DELETE TO authenticated, anon USING (false);

-- ============================================================================
-- S1: trip-photos collaborator read — JOIN to trips to verify path owner
-- ============================================================================
DROP POLICY IF EXISTS "trip_photos_collaborator_read" ON storage.objects;

CREATE POLICY "trip_photos_collaborator_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'trip-photos'
    AND EXISTS (
      SELECT 1
      FROM public.trip_collaborators tc
      JOIN public.trips t ON t.id = tc.trip_id
      WHERE tc.user_id = auth.uid()
        AND tc.accepted_at IS NOT NULL
        AND (tc.trip_id)::text = (storage.foldername(storage.objects.name))[2]
        AND (t.user_id)::text   = (storage.foldername(storage.objects.name))[1]
    )
  );

-- ============================================================================
-- S11: SECURITY DEFINER lockdown — revoke anon EXECUTE broadly,
-- revoke authenticated from internal/trigger-only functions.
-- Re-grant anon only to truly public RPCs.
-- ============================================================================

-- Trigger-only / system / cron — revoke from BOTH anon and authenticated.
-- (service_role bypasses grants for SECURITY DEFINER it owns.)
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'handle_new_user()',
    'handle_new_user_free_tier()',
    'notify_trip_members_on_join()',
    'prevent_permission_self_escalation()',
    'prevent_self_collaboration()',
    'prune_itinerary_versions_per_trip()',
    'increment_itinerary_version()',
    'cleanup_old_itinerary_versions()',
    'cleanup_expired_search_cache()',
    'cleanup_rate_limits()',
    'cleanup_stale_intel_locks()',
    'set_booking_reference()',
    'sync_activity_cost_to_itinerary_jsonb()',
    'award_founding_member(uuid, text)',
    'fulfill_credit_purchase(uuid, integer, integer, text, text, integer, text, text, text)',
    'reconcile_credit_balances()',
    'sync_expired_credit_balances()',
    'bump_archetype_guide_usage(text, uuid)',
    'bump_places_cache_hit(text)',
    'bump_venue_usage(text)',
    'add_to_group_budget(uuid, integer)',
    'spend_from_group_budget(uuid, integer)',
    'increment_daily_usage(uuid, text, date)',
    'increment_user_usage(uuid, text, text, integer)',
    'insert_audit_log(text, text, text, text, text, text, jsonb)',
    'generate_booking_reference()',
    'generate_invoice_number()',
    'rescue_orphan_cost_row(uuid, integer, text, uuid, uuid[])',
    'archive_orphan_trip_payments(uuid)',
    'expire_stale_trip_payments(uuid, integer)',
    'deduct_credits_fifo(uuid, integer)'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function not found, skipping: %', fn;
    END;
  END LOOP;
END $$;

-- Revoke anon EXECUTE from all remaining public SD functions, then re-grant to public-facing ones.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- Re-grant anon EXECUTE only on truly public RPCs (called by unauthenticated clients).
GRANT EXECUTE ON FUNCTION public.get_consumer_shared_trip(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_trip_payload(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_founding_member_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_platform_destination_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_platform_trip_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_intake_account(text) TO anon;

-- ============================================================================
-- S3: Realtime — require authentication for any channel subscription.
-- Underlying-table RLS still gates which row events the user receives;
-- this policy stops anonymous/unauthenticated users from opening subscriptions.
-- ============================================================================
DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;
CREATE POLICY "realtime_authenticated_only" ON realtime.messages
  FOR SELECT TO authenticated
  USING (true);