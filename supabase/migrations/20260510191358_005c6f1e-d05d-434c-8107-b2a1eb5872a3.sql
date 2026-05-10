-- Group B/C/D SECURITY DEFINER functions: revoke from PUBLIC/anon/authenticated, keep service_role.

-- B. Edge-function-only
REVOKE EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_founding_member(uuid, text)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_archetype_guide_usage(text, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_places_cache_hit(text)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits_fifo(uuid, integer)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fulfill_credit_purchase(uuid, integer, integer, text, text, integer, text, text, text)
                                                                                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_daily_usage(uuid, text, date)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(text, text, text, text, text, text, jsonb)
                                                                                 FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer)              TO service_role;
GRANT EXECUTE ON FUNCTION public.award_founding_member(uuid, text)               TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_archetype_guide_usage(text, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_places_cache_hit(text)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits_fifo(uuid, integer)              TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_credit_purchase(uuid, integer, integer, text, text, integer, text, text, text)
                                                                                 TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage(uuid, text, date)         TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(text, text, text, text, text, text, jsonb)
                                                                                 TO service_role;

-- C. Trigger-only
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_free_tier()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_trip_members_on_join()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_permission_self_escalation()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_collaboration()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_itinerary_versions_per_trip()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_itinerary_version()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_booking_reference()                   FROM PUBLIC, anon, authenticated;

-- D. Cron / admin-only
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_search_cache()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_itinerary_versions()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_intel_locks()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_credit_balances()                    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_search_cache()                  TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_itinerary_versions()                TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits()                           TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_intel_locks()                     TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_credit_balances()                     TO service_role;

-- Step 2: stop anonymous listing of public buckets (public URL fetches keep working).
DROP POLICY IF EXISTS "Avatar images are publicly accessible"      ON storage.objects;
DROP POLICY IF EXISTS "Destination images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for guide photos"        ON storage.objects;
DROP POLICY IF EXISTS "Public read access for site images"         ON storage.objects;
