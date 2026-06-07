


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."agency_account_type" AS ENUM (
    'individual',
    'household',
    'company'
);


ALTER TYPE "public"."agency_account_type" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'user',
    'admin',
    'moderator'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."booking_item_state" AS ENUM (
    'not_selected',
    'selected_pending',
    'booked_confirmed',
    'changed',
    'cancelled',
    'refunded'
);


ALTER TYPE "public"."booking_item_state" OWNER TO "postgres";


CREATE TYPE "public"."booking_product_type" AS ENUM (
    'activity',
    'hotel',
    'flight',
    'transfer',
    'package'
);


ALTER TYPE "public"."booking_product_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_segment_type" AS ENUM (
    'flight',
    'hotel',
    'transfer',
    'rail',
    'tour',
    'cruise',
    'insurance',
    'car_rental',
    'other'
);


ALTER TYPE "public"."booking_segment_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_settlement_type" AS ENUM (
    'arc_bsp',
    'supplier_direct',
    'commission_track'
);


ALTER TYPE "public"."booking_settlement_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_source" AS ENUM (
    'native_api',
    'imported',
    'client_booked',
    'manual'
);


ALTER TYPE "public"."booking_source" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'pending',
    'confirmed',
    'ticketed',
    'cancelled',
    'refunded',
    'no_show'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."booking_status_v2" AS ENUM (
    'pending',
    'confirmed',
    'ticketed',
    'cancelled',
    'refunded',
    'no_show',
    'completed'
);


ALTER TYPE "public"."booking_status_v2" OWNER TO "postgres";


CREATE TYPE "public"."booking_supplier" AS ENUM (
    'viator',
    'rapid_hotels',
    'amadeus',
    'direct',
    'manual'
);


ALTER TYPE "public"."booking_supplier" OWNER TO "postgres";


CREATE TYPE "public"."communication_type" AS ENUM (
    'email',
    'sms',
    'call',
    'note',
    'approval'
);


ALTER TYPE "public"."communication_type" OWNER TO "postgres";


CREATE TYPE "public"."cost_category" AS ENUM (
    'home_browse',
    'quiz',
    'explore',
    'itinerary_gen',
    'itinerary_edit',
    'booking_search',
    'recommendations',
    'enrichment',
    'other'
);


ALTER TYPE "public"."cost_category" OWNER TO "postgres";


CREATE TYPE "public"."document_type" AS ENUM (
    'passport',
    'visa',
    'insurance',
    'confirmation',
    'invoice',
    'receipt',
    'waiver',
    'itinerary',
    'other'
);


ALTER TYPE "public"."document_type" OWNER TO "postgres";


CREATE TYPE "public"."expense_split_type" AS ENUM (
    'equal',
    'manual',
    'percentage'
);


ALTER TYPE "public"."expense_split_type" OWNER TO "postgres";


CREATE TYPE "public"."feedback_prompt_type" AS ENUM (
    'quick_reaction',
    'day_summary',
    'restaurant_specific',
    'departure_summary',
    'one_week_followup'
);


ALTER TYPE "public"."feedback_prompt_type" OWNER TO "postgres";


CREATE TYPE "public"."feedback_question_type" AS ENUM (
    'emoji_scale',
    'single_select',
    'multi_select',
    'text',
    'activity_pick',
    'rating_scale'
);


ALTER TYPE "public"."feedback_question_type" OWNER TO "postgres";


CREATE TYPE "public"."finance_entry_source" AS ENUM (
    'stripe_webhook',
    'manual',
    'import',
    'system',
    'api'
);


ALTER TYPE "public"."finance_entry_source" OWNER TO "postgres";


CREATE TYPE "public"."finance_entry_type" AS ENUM (
    'client_charge',
    'client_payment',
    'client_refund',
    'client_credit',
    'supplier_payable',
    'supplier_payment',
    'commission_expected',
    'commission_received',
    'agent_earning',
    'agent_payout',
    'platform_fee',
    'stripe_fee',
    'adjustment'
);


ALTER TYPE "public"."finance_entry_type" OWNER TO "postgres";


CREATE TYPE "public"."friendship_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'blocked'
);


ALTER TYPE "public"."friendship_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'sent',
    'partially_paid',
    'paid',
    'overdue',
    'cancelled',
    'refunded'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."itinerary_status" AS ENUM (
    'not_started',
    'queued',
    'generating',
    'partial',
    'ready',
    'failed'
);


ALTER TYPE "public"."itinerary_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'credit_card',
    'bank_transfer',
    'check',
    'cash',
    'stripe',
    'other'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status_enum" AS ENUM (
    'pending',
    'paid',
    'partial'
);


ALTER TYPE "public"."payment_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."quote_status" AS ENUM (
    'draft',
    'sent',
    'viewed',
    'approved',
    'rejected',
    'expired'
);


ALTER TYPE "public"."quote_status" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE TYPE "public"."trip_member_role" AS ENUM (
    'primary',
    'attendee'
);


ALTER TYPE "public"."trip_member_role" OWNER TO "postgres";


CREATE TYPE "public"."trip_status" AS ENUM (
    'draft',
    'planning',
    'booked',
    'active',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."trip_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scrub_itinerary_prompt_artifacts"("p_itin" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  -- Two alternatives:
  --   (a) labelled prompt slots: "(... slot)" / "(... placeholder)"
  --   (b) bare ALLCAPS-with-underscore tokens: "(FLEX_WINDOW)", "(NARRATIVE_MOOD)"
  -- Underscore in (b) prevents stripping legit acronyms like (USA) / (NYC).
  artifact_re text := '\s*\(\s*(([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
BEGIN
  IF p_itin IS NULL OR jsonb_typeof(p_itin) <> 'object' THEN
    RETURN p_itin;
  END IF;
  IF p_itin->'days' IS NULL OR jsonb_typeof(p_itin->'days') <> 'array' THEN
    RETURN p_itin;
  END IF;

  RETURN jsonb_set(
    p_itin,
    '{days}',
    (
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN day ? 'activities' AND jsonb_typeof(day->'activities') = 'array' THEN
            jsonb_set(day, '{activities}', (
              SELECT coalesce(jsonb_agg(
                CASE
                  WHEN jsonb_typeof(act) = 'object' THEN
                    act
                    || (CASE WHEN act ? 'title' AND jsonb_typeof(act->'title') = 'string'
                             THEN jsonb_build_object('title', trim(regexp_replace(regexp_replace(act->>'title', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                             ELSE '{}'::jsonb END)
                    || (CASE WHEN act ? 'name' AND jsonb_typeof(act->'name') = 'string'
                             THEN jsonb_build_object('name', trim(regexp_replace(regexp_replace(act->>'name', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                             ELSE '{}'::jsonb END)
                    || (CASE WHEN act ? 'description' AND jsonb_typeof(act->'description') = 'string'
                             THEN jsonb_build_object('description', trim(regexp_replace(regexp_replace(act->>'description', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                             ELSE '{}'::jsonb END)
                  ELSE act
                END
              ), '[]'::jsonb)
              FROM jsonb_array_elements(day->'activities') act
            ))
          ELSE day
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(p_itin->'days') day
    )
  );
END;
$$;


ALTER FUNCTION "public"."_scrub_itinerary_prompt_artifacts"("p_itin" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_strip_prompt_artifacts_in_activities"("acts" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  artifact_re text := '\s*\(\s*(([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
BEGIN
  IF acts IS NULL OR jsonb_typeof(acts) <> 'array' THEN
    RETURN acts;
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(
      CASE
        WHEN jsonb_typeof(act) = 'object' THEN
          act
          || (CASE WHEN act ? 'title' AND jsonb_typeof(act->'title') = 'string'
                   THEN jsonb_build_object('title', trim(regexp_replace(regexp_replace(act->>'title', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                   ELSE '{}'::jsonb END)
          || (CASE WHEN act ? 'name' AND jsonb_typeof(act->'name') = 'string'
                   THEN jsonb_build_object('name', trim(regexp_replace(regexp_replace(act->>'name', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                   ELSE '{}'::jsonb END)
          || (CASE WHEN act ? 'description' AND jsonb_typeof(act->'description') = 'string'
                   THEN jsonb_build_object('description', trim(regexp_replace(regexp_replace(act->>'description', artifact_re, '', 'gi'), '\s+', ' ', 'g')))
                   ELSE '{}'::jsonb END)
        ELSE act
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(acts) act
  );
END;
$$;


ALTER FUNCTION "public"."_strip_prompt_artifacts_in_activities"("acts" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trips_scrub_itinerary_artifacts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.itinerary_data IS NOT NULL THEN
    NEW.itinerary_data := public._scrub_itinerary_prompt_artifacts(NEW.itinerary_data);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_trips_scrub_itinerary_artifacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_shared_trip"("p_share_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_shared_trip"("p_share_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_trip_invite"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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

  SELECT * INTO v_invite FROM public.trip_invites WHERE LOWER(token) = LOWER(p_token) FOR UPDATE;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'token_not_found', 'error', 'This invite link was not found. It may have been reset by the trip owner.');
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invite_limit_reached', 'error', 'This invite link has reached its maximum number of uses. Ask the trip owner for a new link.');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'expired', 'error', 'This invite link has expired. Ask the trip owner for a new link.');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trip_not_found', 'error', 'The trip associated with this invite no longer exists.');
  END IF;

  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_owner', 'error', 'You are already the owner of this trip.');
  END IF;

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

  INSERT INTO public.trip_collaborators (trip_id, user_id, permission, invited_by, accepted_at)
  VALUES (v_invite.trip_id, v_user_id, 'view', v_invite.invited_by, now())
  ON CONFLICT (trip_id, user_id) DO UPDATE SET accepted_at = now(), permission = 'view';

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
$$;


ALTER FUNCTION "public"."accept_trip_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_to_group_budget"("p_budget_id" "uuid", "p_credits" integer) RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.group_budgets
     SET remaining_credits = remaining_credits + p_credits,
         updated_at = now()
   WHERE id = p_budget_id
  RETURNING remaining_credits;
$$;


ALTER FUNCTION "public"."add_to_group_budget"("p_budget_id" "uuid", "p_credits" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_orphan_trip_payments"("p_trip_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_activity_ids text[];
  v_archived_count int;
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

  -- Collect every current activity id from itinerary_data.days[].activities[]
  SELECT COALESCE(array_agg(DISTINCT act->>'id'), ARRAY[]::text[])
  INTO v_activity_ids
  FROM jsonb_array_elements(COALESCE(v_trip.itinerary_data->'days', '[]'::jsonb)) day
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(day->'activities', '[]'::jsonb)) act
  WHERE act->>'id' IS NOT NULL;

  UPDATE public.trip_payments
  SET archived_at = now(),
      archived_reason = 'orphan_reconcile'
  WHERE trip_id = p_trip_id
    AND archived_at IS NULL
    AND item_type NOT IN ('flight', 'hotel')
    -- Manual rows have item_id like 'manual-<uuid>' and by design never
    -- match any itinerary activity_id. They must be excluded so they are
    -- not silently archived (which would drop their amount from the trip
    -- total and surface as a phantom "Trip total changed by -$X" toast).
    AND (item_id IS NULL OR lower(item_id) NOT LIKE 'manual-%')
    AND NOT (item_id = ANY(v_activity_ids));

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'archived_count', v_archived_count);
END;
$_$;


ALTER FUNCTION "public"."archive_orphan_trip_payments"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_founding_member"("p_user_id" "uuid", "p_stripe_session_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_count INT;
  v_purchase_number INT;
BEGIN
  -- Get current count
  SELECT COUNT(*)::INT INTO v_current_count FROM public.founding_member_tracker;
  
  -- Check if already awarded
  IF EXISTS (SELECT 1 FROM public.founding_member_tracker WHERE user_id = p_user_id) THEN
    RETURN json_build_object('awarded', false, 'reason', 'already_awarded', 'count', v_current_count);
  END IF;
  
  -- Check if cap reached
  IF v_current_count >= 1000 THEN
    RETURN json_build_object('awarded', false, 'reason', 'cap_reached', 'count', v_current_count);
  END IF;
  
  -- Award the badge
  v_purchase_number := v_current_count + 1;
  INSERT INTO public.founding_member_tracker (user_id, purchase_number, stripe_session_id)
  VALUES (p_user_id, v_purchase_number, p_stripe_session_id);
  
  RETURN json_build_object('awarded', true, 'purchase_number', v_purchase_number, 'count', v_purchase_number);
END;
$$;


ALTER FUNCTION "public"."award_founding_member"("p_user_id" "uuid", "p_stripe_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_archetype_guide_usage"("p_archetype" "text", "p_destination_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.archetype_destination_guides
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE archetype = p_archetype
    AND destination_id = p_destination_id;
$$;


ALTER FUNCTION "public"."bump_archetype_guide_usage"("p_archetype" "text", "p_destination_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_places_cache_hit"("p_cache_key" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.google_places_search_cache
  SET hit_count = hit_count + 1, last_hit_at = now()
  WHERE cache_key = p_cache_key;
$$;


ALTER FUNCTION "public"."bump_places_cache_hit"("p_cache_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_venue_usage"("p_place_id" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.verified_venues
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at = now()
  WHERE google_place_id = p_place_id;
$$;


ALTER FUNCTION "public"."bump_venue_usage"("p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_first_trip_benefit"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_was_unused boolean;
BEGIN
  -- Authorization: only the user themselves may claim their first-trip benefit
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller must be the target user' USING ERRCODE = '42501';
  END IF;

  -- Atomic check-and-set: only succeeds if first_trip_used is currently false
  UPDATE public.profiles
  SET first_trip_used = true
  WHERE id = p_user_id AND first_trip_used = false
  RETURNING true INTO v_was_unused;

  IF v_was_unused IS TRUE THEN
    RETURN jsonb_build_object('claimed', true);
  ELSE
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_used');
  END IF;
END;
$$;


ALTER FUNCTION "public"."claim_first_trip_benefit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_search_cache"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.search_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_search_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_venues"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.verified_venues
  WHERE expires_at < now()
  AND usage_count < 3; -- Keep frequently used venues even if "expired"
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_venues"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_itinerary_versions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.itinerary_versions
  WHERE id IN (
    SELECT id FROM public.itinerary_versions
    WHERE trip_id = NEW.trip_id AND day_number = NEW.day_number
    ORDER BY version_number DESC
    OFFSET 10
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_itinerary_versions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_rate_limits"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted_rl int := 0;
  v_deleted_du int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rate_limits'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limits_table_missing');
  END IF;

  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted_rl = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_usage'
  ) THEN
    DELETE FROM public.daily_usage
    WHERE usage_date < CURRENT_DATE - INTERVAL '7 days';
    GET DIAGNOSTICS v_deleted_du = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_rate_limits', v_deleted_rl,
    'deleted_daily_usage', v_deleted_du,
    'ran_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;


ALTER FUNCTION "public"."cleanup_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_stale_intel_locks"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DELETE FROM public.travel_intel_locks WHERE expires_at < now();
$$;


ALTER FUNCTION "public"."cleanup_stale_intel_locks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_quiz"("_prefs" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.user_preferences (
    user_id,
    quiz_completed,
    completed_at,
    budget_tier,
    travel_pace,
    accommodation_style,
    planning_preference,
    interests,
    travel_companions,
    travel_vibes,
    traveler_type,
    primary_goal
  )
  VALUES (
    uid,
    true,
    now(),
    NULLIF(_prefs->>'budget', ''),
    NULLIF(_prefs->>'pace', ''),
    NULLIF(_prefs->>'accommodation', ''),
    NULLIF(_prefs->>'planning', ''),
    CASE WHEN jsonb_typeof(_prefs->'interests') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(_prefs->'interests')) END,
    CASE WHEN jsonb_typeof(_prefs->'travel_companions') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(_prefs->'travel_companions')) END,
    CASE WHEN jsonb_typeof(_prefs->'travel_vibes') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(_prefs->'travel_vibes')) END,
    NULLIF(_prefs->>'traveler_type', ''),
    NULLIF(_prefs->>'primary_goal', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    quiz_completed       = true,
    completed_at         = now(),
    budget_tier          = COALESCE(EXCLUDED.budget_tier,          public.user_preferences.budget_tier),
    travel_pace          = COALESCE(EXCLUDED.travel_pace,          public.user_preferences.travel_pace),
    accommodation_style  = COALESCE(EXCLUDED.accommodation_style,  public.user_preferences.accommodation_style),
    planning_preference  = COALESCE(EXCLUDED.planning_preference,  public.user_preferences.planning_preference),
    interests            = COALESCE(EXCLUDED.interests,            public.user_preferences.interests),
    travel_companions    = COALESCE(EXCLUDED.travel_companions,    public.user_preferences.travel_companions),
    travel_vibes         = COALESCE(EXCLUDED.travel_vibes,         public.user_preferences.travel_vibes),
    traveler_type        = COALESCE(EXCLUDED.traveler_type,        public.user_preferences.traveler_type),
    primary_goal         = COALESCE(EXCLUDED.primary_goal,         public.user_preferences.primary_goal);

  INSERT INTO public.profiles (id, quiz_completed, updated_at)
  VALUES (uid, true, now())
  ON CONFLICT (id) DO UPDATE SET
    quiz_completed = true,
    updated_at     = now();
END;
$$;


ALTER FUNCTION "public"."complete_quiz"("_prefs" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_free_edit"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_remaining integer;
BEGIN
  UPDATE free_tier_status
  SET free_edits_remaining = GREATEST(0, free_edits_remaining - 1),
      updated_at = now()
  WHERE user_id = p_user_id
    AND free_edits_remaining > 0
  RETURNING free_edits_remaining INTO v_remaining;

  IF NOT FOUND THEN
    -- Either no row or already at 0
    SELECT free_edits_remaining INTO v_remaining
    FROM free_tier_status WHERE user_id = p_user_id;
    
    IF v_remaining IS NULL THEN
      RAISE EXCEPTION 'No free tier status found for user';
    END IF;
    
    RETURN jsonb_build_object(
      'success', false,
      'edits_remaining', 0,
      'limit_reached', true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'edits_remaining', v_remaining,
    'limit_reached', v_remaining <= 0
  );
END;
$$;


ALTER FUNCTION "public"."consume_free_edit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_google_budget"("p_cost" numeric DEFAULT 0, "p_limit" integer DEFAULT 200) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.google_api_budget (day, call_count, cost_usd)
  VALUES (CURRENT_DATE, 1, p_cost)
  ON CONFLICT (day) DO UPDATE
    SET call_count = public.google_api_budget.call_count + 1,
        cost_usd   = public.google_api_budget.cost_usd + p_cost,
        updated_at = now()
    WHERE public.google_api_budget.call_count < p_limit
  RETURNING call_count INTO v_count;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."consume_google_budget"("p_cost" numeric, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_credits_fifo"("p_user_id" "uuid", "p_cost" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row record;
  v_remaining integer := p_cost;
  v_take integer;
  v_total_available integer;
  v_deductions jsonb := '[]'::jsonb;
BEGIN
  IF p_cost <= 0 THEN
    RETURN jsonb_build_object('success', true, 'deducted', 0, 'purchases', '[]'::jsonb);
  END IF;

  -- Lock eligible rows first (FOR UPDATE cannot be combined with aggregates)
  -- Then compute the sum from the locked rows via a subquery
  SELECT COALESCE(SUM(remaining), 0)::integer INTO v_total_available
  FROM (
    SELECT remaining
    FROM credit_purchases
    WHERE user_id = p_user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > now())
    FOR UPDATE
  ) locked;

  IF v_total_available < p_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: required=%, available=%', p_cost, v_total_available;
  END IF;

  -- FIFO deduction loop (rows already locked above)
  FOR v_row IN
    SELECT id, remaining
    FROM credit_purchases
    WHERE user_id = p_user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY expires_at ASC NULLS LAST
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_row.remaining, v_remaining);

    UPDATE credit_purchases
    SET remaining = remaining - v_take,
        updated_at = now()
    WHERE id = v_row.id;

    v_deductions := v_deductions || jsonb_build_object('id', v_row.id, 'deducted', v_take);
    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deducted', p_cost,
    'purchases', v_deductions
  );
END;
$$;


ALTER FUNCTION "public"."deduct_credits_fifo"("p_user_id" "uuid", "p_cost" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_trip_payments"("p_trip_id" "uuid" DEFAULT NULL::"uuid", "p_max_age_minutes" integer DEFAULT 60) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_expired_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated', 'expired_count', 0);
  END IF;

  IF p_trip_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND user_id = v_user_id) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'not_owner', 'expired_count', 0);
    END IF;

    UPDATE public.trip_payments
    SET status = 'failed',
        updated_at = now()
    WHERE trip_id = p_trip_id
      AND status IN ('pending', 'processing')
      AND archived_at IS NULL
      AND created_at < now() - (p_max_age_minutes || ' minutes')::interval
      AND stripe_checkout_session_id IS NOT NULL
      AND paid_at IS NULL;
  ELSE
    UPDATE public.trip_payments
    SET status = 'failed',
        updated_at = now()
    WHERE user_id = v_user_id
      AND status IN ('pending', 'processing')
      AND archived_at IS NULL
      AND created_at < now() - (p_max_age_minutes || ' minutes')::interval
      AND stripe_checkout_session_id IS NOT NULL
      AND paid_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'expired_count', v_expired_count);
END;
$$;


ALTER FUNCTION "public"."expire_stale_trip_payments"("p_trip_id" "uuid", "p_max_age_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fulfill_credit_purchase"("p_user_id" "uuid", "p_credits" integer, "p_bonus_credits" integer, "p_credit_type" "text", "p_stripe_session_id" "text", "p_amount_cents" integer, "p_club_tier" "text" DEFAULT NULL::"text", "p_product_id" "text" DEFAULT NULL::"text", "p_price_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_bonus_expires timestamptz;
  v_flex_expires timestamptz;
  v_now timestamptz := now();
  v_ledger_action text;
  v_ledger_notes text;
  v_total_credits int;
BEGIN
  v_total_credits := p_credits + p_bonus_credits;

  IF p_credit_type IN ('club_base', 'club') AND p_club_tier IS NOT NULL THEN
    v_bonus_expires := v_now + interval '6 months';

    INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, stripe_session_id, club_tier)
    VALUES (p_user_id, 'club_base', p_credits, p_credits, NULL, 'stripe', p_stripe_session_id, p_club_tier);

    IF p_bonus_credits > 0 THEN
      INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, stripe_session_id, club_tier)
      VALUES (p_user_id, 'club_bonus', p_bonus_credits, p_bonus_credits, v_bonus_expires, 'stripe', p_stripe_session_id, p_club_tier);
    END IF;

    INSERT INTO public.user_badges (user_id, badge_type, source, metadata)
    VALUES (p_user_id, 'club_' || p_club_tier, 'purchase', jsonb_build_object('stripe_session_id', p_stripe_session_id, 'tier', p_club_tier))
    ON CONFLICT (user_id, badge_type) DO NOTHING;

    IF p_club_tier = 'adventurer' THEN
      PERFORM public.award_founding_member(p_user_id, p_stripe_session_id);
      INSERT INTO public.user_badges (user_id, badge_type, source, metadata)
      VALUES (p_user_id, 'founding_member', 'purchase', jsonb_build_object('stripe_session_id', p_stripe_session_id))
      ON CONFLICT (user_id, badge_type) DO NOTHING;
    END IF;

    v_ledger_action := 'club_purchase';
    v_ledger_notes := p_club_tier || ' club pack - ' || v_total_credits || ' credits (' || p_credits || ' base + ' || p_bonus_credits || ' bonus)';
  ELSE
    v_flex_expires := v_now + interval '12 months';

    INSERT INTO public.credit_purchases (user_id, credit_type, amount, remaining, expires_at, source, stripe_session_id)
    VALUES (p_user_id, 'flex', v_total_credits, v_total_credits, v_flex_expires, 'stripe', p_stripe_session_id);

    v_ledger_action := 'stripe_purchase';
    v_ledger_notes := 'Flex credit pack - ' || v_total_credits || ' credits';
  END IF;

  -- Ledger insert — unique index enforces idempotency at DB level
  BEGIN
    INSERT INTO public.credit_ledger (user_id, transaction_type, action_type, credits_delta, is_free_credit, stripe_session_id, stripe_product_id, price_id, amount_cents, notes)
    VALUES (p_user_id, 'purchase', v_ledger_action, v_total_credits, false, p_stripe_session_id, p_product_id, p_price_id, p_amount_cents, v_ledger_notes);
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent duplicate — roll back the whole transaction implicitly
    -- by raising and catching at the outer level
    RAISE NOTICE 'Duplicate stripe_session_id %, returning idempotent response', p_stripe_session_id;
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'already_fulfilled');
  END;

  -- Sync balance cache
  UPDATE public.credit_balances
  SET
    purchased_credits = (
      SELECT COALESCE(SUM(remaining), 0)::int
      FROM public.credit_purchases
      WHERE credit_purchases.user_id = p_user_id
        AND remaining > 0
        AND credit_type != 'free'
        AND (expires_at IS NULL OR expires_at > v_now)
    ),
    free_credits = (
      SELECT COALESCE(SUM(remaining), 0)::int
      FROM public.credit_purchases
      WHERE credit_purchases.user_id = p_user_id
        AND remaining > 0
        AND credit_type = 'free'
        AND (expires_at IS NULL OR expires_at > v_now)
    ),
    updated_at = v_now
  WHERE credit_balances.user_id = p_user_id;

  -- C-DATA-1: record the buyer's tier (covers the IAP path, which only calls this
  -- RPC). DO NOTHING so we never downgrade a higher tier — the Stripe webhook's
  -- rank-aware upsertUserTier() handles upgrades.
  INSERT INTO public.user_tiers (user_id, tier, first_purchase_at, highest_purchase, updated_at)
  VALUES (p_user_id, COALESCE(p_club_tier, 'flex'), v_now, COALESCE(p_club_tier, 'flex'), v_now)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'skipped', false,
    'credits', v_total_credits,
    'type', CASE WHEN p_club_tier IS NOT NULL THEN 'club' ELSE 'flex' END
  );
END;
$$;


ALTER FUNCTION "public"."fulfill_credit_purchase"("p_user_id" "uuid", "p_credits" integer, "p_bonus_credits" integer, "p_credit_type" "text", "p_stripe_session_id" "text", "p_amount_cents" integer, "p_club_tier" "text", "p_product_id" "text", "p_price_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_reference"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'VOY-';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_intake_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  token TEXT;
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  token := 'intake_';
  FOR i IN 1..10 LOOP
    token := token || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN token;
END;
$$;


ALTER FUNCTION "public"."generate_intake_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_num INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_num
  FROM agency_invoices
  WHERE invoice_number LIKE year_prefix || '-%';
  
  RETURN year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION "public"."generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_share_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  token TEXT;
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  token := '';
  FOR i IN 1..12 LOOP
    token := token || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN token;
END;
$$;


ALTER FUNCTION "public"."generate_share_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_share_token"("size" integer DEFAULT 16) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN substr(encode(gen_random_bytes(size), 'hex'), 1, size);
END;
$$;


ALTER FUNCTION "public"."generate_share_token"("size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_consumer_shared_trip"("p_share_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_sanitized_days jsonb;
BEGIN
  SELECT * INTO v_trip
  FROM public.trips
  WHERE share_token = p_share_token;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'This share link is invalid',
      'error_code', 'token_not_found'
    );
  END IF;

  IF v_trip.share_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'error', 'Sharing has been turned off for this link',
      'error_code', 'sharing_disabled'
    );
  END IF;

  IF v_trip.itinerary_data IS NULL
     OR v_trip.itinerary_data->'days' IS NULL
     OR jsonb_array_length(COALESCE(v_trip.itinerary_data->'days', '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object(
      'error', 'Trip is still being prepared',
      'error_code', 'trip_unavailable'
    );
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'dayNumber', day->'dayNumber',
      'date', day->'date',
      'theme', day->'theme',
      'description', day->'description',
      'weather', day->'weather',
      'activities', (
        SELECT COALESCE(jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'id', activity->>'id',
              'title', activity->>'title',
              'name', activity->>'name',
              'description', activity->>'description',
              'start_time', activity->>'start_time',
              'startTime', activity->>'startTime',
              'end_time', activity->>'end_time',
              'endTime', activity->>'endTime',
              'duration', activity->>'duration',
              'location', activity->'location',
              'address', activity->>'address',
              'category', activity->>'category',
              'type', activity->>'type',
              'cost', activity->'cost',
              'booking_required', activity->'booking_required',
              'bookingRequired', activity->'bookingRequired',
              'booking_url', activity->>'booking_url',
              'bookingUrl', activity->>'bookingUrl',
              'image_url', activity->>'image_url',
              'imageUrl', activity->>'imageUrl',
              'tags', activity->'tags',
              'rating', activity->'rating',
              'venue_name', activity->>'venue_name'
            )
          )
        ORDER BY a_ord), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(day->'activities', '[]'::jsonb)) WITH ORDINALITY AS a(activity, a_ord)
      )
    )
  ORDER BY (day->>'dayNumber')::int NULLS LAST, d_ord) INTO v_sanitized_days
  FROM jsonb_array_elements(v_trip.itinerary_data->'days') WITH ORDINALITY AS d(day, d_ord);

  RETURN jsonb_build_object(
    'id', v_trip.id,
    'name', v_trip.name,
    'destination', v_trip.destination,
    'start_date', v_trip.start_date,
    'end_date', v_trip.end_date,
    'travelers', v_trip.travelers,
    'itinerary_data', jsonb_build_object(
      'days', COALESCE(v_sanitized_days, '[]'::jsonb)
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_consumer_shared_trip"("p_share_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_email"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;


ALTER FUNCTION "public"."get_current_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_founding_member_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(COUNT(*)::INT, 0) FROM public.founding_member_tracker;
$$;


ALTER FUNCTION "public"."get_founding_member_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_intake_account"("p_intake_token" "text") RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT aa.id, aa.name
  FROM public.agency_accounts aa
  WHERE aa.intake_enabled = true 
    AND aa.intake_token = p_intake_token;
END;
$$;


ALTER FUNCTION "public"."get_intake_account"("p_intake_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."trips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "origin_city" "text",
    "destination" "text" NOT NULL,
    "destination_country" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "travelers" integer DEFAULT 1,
    "trip_type" "text" DEFAULT 'vacation'::"text",
    "budget_tier" "text" DEFAULT 'moderate'::"text",
    "status" "public"."trip_status" DEFAULT 'draft'::"public"."trip_status" NOT NULL,
    "itinerary_status" "public"."itinerary_status" DEFAULT 'not_started'::"public"."itinerary_status",
    "itinerary_data" "jsonb",
    "flight_selection" "jsonb",
    "hotel_selection" "jsonb",
    "price_lock_expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_plan_tier" "text" DEFAULT 'free'::"text",
    "transportation_preferences" "jsonb",
    "abandoned_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "is_agent_trip" boolean DEFAULT false,
    "agent_notes" "text",
    "destinations" "jsonb",
    "is_multi_city" boolean DEFAULT false,
    "budget_total_cents" integer,
    "budget_currency" character varying(3) DEFAULT 'USD'::character varying,
    "budget_input_mode" character varying(20) DEFAULT 'total'::character varying,
    "budget_include_hotel" boolean DEFAULT true,
    "budget_include_flight" boolean DEFAULT false,
    "budget_warnings_enabled" boolean DEFAULT true,
    "budget_warning_threshold" character varying(20) DEFAULT 'yellow'::character varying,
    "budget_allocations" "jsonb" DEFAULT '{}'::"jsonb",
    "guest_edit_mode" "text" DEFAULT 'propose_approve'::"text" NOT NULL,
    "is_free_tier_trip" boolean DEFAULT false NOT NULL,
    "smart_finish_purchased" boolean DEFAULT false NOT NULL,
    "smart_finish_purchased_at" timestamp with time zone,
    "gap_analysis_result" "jsonb",
    "creation_source" "text" DEFAULT 'single_city'::"text",
    "unlocked_day_count" integer DEFAULT 0,
    "budget_individual_cents" "jsonb",
    "dna_snapshot" "jsonb",
    "arrival_transfer" "jsonb",
    "departure_transfer" "jsonb",
    "flight_intelligence" "jsonb",
    "blended_dna" "jsonb",
    "itinerary_version" integer DEFAULT 1 NOT NULL,
    "journey_id" "uuid",
    "journey_name" "text",
    "journey_order" integer,
    "journey_total_legs" integer,
    "transition_mode" "text",
    "transition_departure_time" timestamp with time zone,
    "transition_arrival_time" timestamp with time zone,
    "share_token" "text",
    "share_enabled" boolean DEFAULT false,
    "coach_protected_categories" "text"[],
    "last_cost_repair_at" timestamp with time zone,
    "itinerary_sync_status" "text" DEFAULT 'synced'::"text" NOT NULL,
    "itinerary_synced_at" timestamp with time zone,
    "share_permission" "text" DEFAULT 'view'::"text" NOT NULL,
    "share_credit_policy" "text" DEFAULT 'collaborator'::"text" NOT NULL,
    CONSTRAINT "trips_budget_input_mode_check" CHECK ((("budget_input_mode")::"text" = ANY ((ARRAY['total'::character varying, 'per_person'::character varying])::"text"[]))),
    CONSTRAINT "trips_budget_warning_threshold_check" CHECK ((("budget_warning_threshold")::"text" = ANY ((ARRAY['yellow'::character varying, 'red_only'::character varying, 'off'::character varying])::"text"[]))),
    CONSTRAINT "trips_guest_edit_mode_check" CHECK (("guest_edit_mode" = ANY (ARRAY['free_edit'::"text", 'propose_approve'::"text"]))),
    CONSTRAINT "trips_itinerary_sync_status_check" CHECK (("itinerary_sync_status" = ANY (ARRAY['synced'::"text", 'pending'::"text", 'failed'::"text"]))),
    CONSTRAINT "trips_share_credit_policy_check" CHECK (("share_credit_policy" = ANY (ARRAY['owner'::"text", 'collaborator'::"text", 'free'::"text"]))),
    CONSTRAINT "trips_share_permission_check" CHECK (("share_permission" = ANY (ARRAY['view'::"text", 'edit'::"text"])))
);


ALTER TABLE "public"."trips" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trips"."owner_plan_tier" IS 'Plan tier of the owner when trip was created. Determines collaboration capabilities for all users on this trip.';



COMMENT ON COLUMN "public"."trips"."abandoned_at" IS 'Timestamp when trip was marked as abandoned (null = not abandoned)';



COMMENT ON COLUMN "public"."trips"."last_activity_at" IS 'Last user interaction with this trip, used to detect stale drafts';



COMMENT ON COLUMN "public"."trips"."destinations" IS 'Array of destinations for multi-city trips: [{city: string, country?: string, nights: number, order: number, arrivalDate?: string, departureDate?: string}]';



COMMENT ON COLUMN "public"."trips"."budget_total_cents" IS 'Total trip budget in cents (for the whole party)';



COMMENT ON COLUMN "public"."trips"."budget_input_mode" IS 'Whether user entered total or per_person amount';



COMMENT ON COLUMN "public"."trips"."budget_include_hotel" IS 'Include hotel costs in budget tracking';



COMMENT ON COLUMN "public"."trips"."budget_include_flight" IS 'Include flight costs in budget tracking (tracking only)';



COMMENT ON COLUMN "public"."trips"."budget_allocations" IS 'Category allocations: {food_percent, activities_percent, transit_percent, misc_percent, buffer_percent}';



COMMENT ON COLUMN "public"."trips"."creation_source" IS 'How the trip was created: single_city, multi_city, chat, manual_paste';



COMMENT ON COLUMN "public"."trips"."dna_snapshot" IS 'Snapshot of user Travel DNA profile at last generation time';



COMMENT ON COLUMN "public"."trips"."arrival_transfer" IS 'Selected airport-to-hotel transfer option with mode, duration, cost, route details';



COMMENT ON COLUMN "public"."trips"."departure_transfer" IS 'Selected hotel-to-airport transfer option for departure day';



COMMENT ON COLUMN "public"."trips"."blended_dna" IS 'Snapshot of blended Travel DNA when trip has multiple travelers with include_preferences enabled. Contains blendedTraits, travelers array, blendMethod, and generatedAt timestamp.';



CREATE OR REPLACE FUNCTION "public"."get_journey_trips"("p_journey_id" "uuid") RETURNS SETOF "public"."trips"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT * FROM public.trips WHERE journey_id = p_journey_id ORDER BY journey_order ASC;
$$;


ALTER FUNCTION "public"."get_journey_trips"("p_journey_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_destination_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::int FROM public.destinations;
$$;


ALTER FUNCTION "public"."get_platform_destination_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_trip_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::int FROM public.trips;
$$;


ALTER FUNCTION "public"."get_platform_trip_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_trip_payload"("p_share_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_trip public.agency_trips%ROWTYPE;
  v_result jsonb;
  v_sanitized_days jsonb;
  v_segments jsonb;
BEGIN
  -- Validate token and get trip (schema-qualified)
  SELECT * INTO v_trip
  FROM public.agency_trips
  WHERE share_token = p_share_token
    AND share_enabled = true;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Trip not found or sharing is disabled');
  END IF;

  -- Sanitize itinerary_data.days - filter out internal activities
  -- WHITELIST activity fields to prevent internal data leakage
  -- ORDER BY dayNumber for deterministic output
  IF v_trip.itinerary_data IS NOT NULL AND v_trip.itinerary_data->'days' IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'dayNumber', day->'dayNumber',
        'date', day->'date',
        'theme', day->'theme',
        'description', day->'description',
        'weather', day->'weather',
        'activities', (
          SELECT COALESCE(jsonb_agg(
            jsonb_strip_nulls(
              jsonb_build_object(
                'id', activity->>'id',
                'title', activity->>'title',
                'name', activity->>'name',
                'description', activity->>'description',
                'start_time', activity->>'start_time',
                'end_time', activity->>'end_time',
                'duration', activity->>'duration',
                'location', activity->'location',
                'address', activity->>'address',
                'category', activity->>'category',
                'price', activity->'price',
                'booking_required', activity->'booking_required',
                'booking_state', activity->>'booking_state',
                'booking_url', activity->>'booking_url',
                'vendor', activity->'vendor',
                'image_url', activity->>'image_url',
                'tags', activity->'tags',
                'accessibility_info', activity->'accessibility_info'
              )
            )
          ORDER BY a_ord), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(day->'activities', '[]'::jsonb)) WITH ORDINALITY AS a(activity, a_ord)
          WHERE NOT (
            activity ? 'is_client_visible'
            AND lower(coalesce(activity->>'is_client_visible', '')) IN ('false', 'f', '0', 'no', 'n', 'off')
          )
        )
      )
    ORDER BY (day->>'dayNumber')::int NULLS LAST, d_ord) INTO v_sanitized_days
    FROM jsonb_array_elements(v_trip.itinerary_data->'days') WITH ORDINALITY AS d(day, d_ord);
  ELSE
    v_sanitized_days := '[]'::jsonb;
  END IF;

  -- Get sanitized booking segments (only client-safe fields, schema-qualified)
  -- Filter to confirmed/ticketed status only for client-facing view
  -- ORDER BY start_date for deterministic output
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'segment_type', s.segment_type,
      'vendor_name', s.vendor_name,
      'confirmation_number', s.confirmation_number,
      'origin', s.origin,
      'destination', s.destination,
      'start_date', s.start_date,
      'start_time', s.start_time,
      'end_date', s.end_date,
      'end_time', s.end_time,
      'flight_number', s.flight_number,
      'room_type', s.room_type,
      'cabin_class', s.cabin_class,
      'baggage_allowance', s.baggage_allowance,
      'check_in_time', s.check_in_time,
      'check_out_time', s.check_out_time,
      'status', s.status
    )
  ORDER BY s.start_date, s.start_time), '[]'::jsonb) INTO v_segments
  FROM public.agency_booking_segments s
  WHERE s.trip_id = v_trip.id
    AND COALESCE(s.is_informational_only, false) = false
    AND s.status IN ('confirmed', 'ticketed', 'pending');

  -- Build sanitized response (exclude internal_notes, commissions, costs, etc.)
  v_result := jsonb_build_object(
    'id', v_trip.id,
    'name', v_trip.name,
    'destination', v_trip.destination,
    'start_date', v_trip.start_date,
    'end_date', v_trip.end_date,
    'traveler_count', v_trip.traveler_count,
    'notes', v_trip.notes,
    'itinerary_data', jsonb_build_object(
      'days', COALESCE(v_sanitized_days, '[]'::jsonb),
      'status', v_trip.itinerary_data->'status'
    ),
    'segments', v_segments
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_shared_trip_payload"("p_share_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trip_invite_info"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_invite record;
  v_trip record;
  v_inviter record;
BEGIN
  SELECT * INTO v_invite FROM public.trip_invites WHERE LOWER(token) = LOWER(p_token);

  IF v_invite.id IS NULL THEN
    INSERT INTO public.invite_failure_log (attempted_token, reason)
    VALUES (p_token, 'token_not_found');
    RETURN jsonb_build_object('valid', false, 'reason', 'token_not_found', 'error', 'This invite link was not found. It may have been reset by the trip owner.');
  END IF;

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
$$;


ALTER FUNCTION "public"."get_trip_invite_info"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trip_permission"("p_trip_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_collaborator record;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('isOwner', false, 'permission', null, 'canEdit', false);
  END IF;
  
  -- Check if owner
  SELECT * INTO v_trip FROM trips WHERE id = p_trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('isOwner', false, 'permission', null, 'canEdit', false);
  END IF;
  
  IF v_trip.user_id = v_user_id THEN
    RETURN jsonb_build_object('isOwner', true, 'permission', 'owner', 'canEdit', true);
  END IF;
  
  -- Check collaborator status
  SELECT * INTO v_collaborator 
  FROM trip_collaborators 
  WHERE trip_id = p_trip_id 
    AND user_id = v_user_id 
    AND accepted_at IS NOT NULL;
  
  IF v_collaborator.id IS NULL THEN
    RETURN jsonb_build_object('isOwner', false, 'permission', null, 'canEdit', false);
  END IF;
  
  RETURN jsonb_build_object(
    'isOwner', false, 
    'permission', v_collaborator.permission,
    'canEdit', v_collaborator.permission IN ('editor', 'contributor', 'edit', 'admin')
  );
END;
$$;


ALTER FUNCTION "public"."get_trip_permission"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unit_economics_summary"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
BEGIN
  -- Require admin role — use the canonical check (consistent with every other
  -- admin gate) and allow the service role for internal/background callers.
  IF NOT (
    public.has_role('admin'::public.app_role)
    OR coalesce((auth.jwt() ->> 'role'), '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT json_build_object(
    'date_range', json_build_object(
      'start', MIN(created_at),
      'end_date', MAX(created_at)
    ),
    'total_cost_usd', COALESCE(SUM(estimated_cost_usd), 0),
    'total_records', COUNT(*),
    -- Service call totals
    'google_places_calls', COALESCE(SUM(google_places_calls), 0),
    'google_geocoding_calls', COALESCE(SUM(google_geocoding_calls), 0),
    'google_photos_calls', COALESCE(SUM(google_photos_calls), 0),
    'google_routes_calls', COALESCE(SUM(google_routes_calls), 0),
    'perplexity_calls', COALESCE(SUM(perplexity_calls), 0),
    'amadeus_calls', COALESCE(SUM(amadeus_calls), 0),
    'total_input_tokens', COALESCE(SUM(input_tokens), 0),
    'total_output_tokens', COALESCE(SUM(output_tokens), 0),
    'ai_call_count', COUNT(*) FILTER (WHERE input_tokens > 0 OR output_tokens > 0),
    -- Unique counts
    'unique_users', COUNT(DISTINCT user_id),
    'unique_trips', COUNT(DISTINCT trip_id),
    -- Cost by date
    'cost_by_date', (
      SELECT COALESCE(json_agg(daily ORDER BY daily->>'date'), '[]'::json)
      FROM (
        SELECT json_build_object(
          'date', created_at::DATE,
          'cost', SUM(estimated_cost_usd),
          'records', COUNT(*)
        ) AS daily
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY created_at::DATE
      ) d
    ),
    -- Cost by action type
    'cost_by_action', (
      SELECT COALESCE(json_agg(by_action), '[]'::json)
      FROM (
        SELECT json_build_object(
          'action_type', action_type,
          'cost', SUM(estimated_cost_usd),
          'count', COUNT(*)
        ) AS by_action
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY action_type
      ) a
    ),
    -- Cost by category
    'cost_by_category', (
      SELECT COALESCE(json_agg(by_cat), '[]'::json)
      FROM (
        SELECT json_build_object(
          'category', cost_category,
          'cost', SUM(estimated_cost_usd),
          'count', COUNT(*),
          'google_places', COALESCE(SUM(google_places_calls), 0),
          'google_photos', COALESCE(SUM(google_photos_calls), 0),
          'perplexity', COALESCE(SUM(perplexity_calls), 0),
          'amadeus', COALESCE(SUM(amadeus_calls), 0)
        ) AS by_cat
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY cost_category
      ) c
    ),
    -- Cost by model
    'cost_by_model', (
      SELECT COALESCE(json_agg(by_model), '[]'::json)
      FROM (
        SELECT json_build_object(
          'model', model,
          'count', COUNT(*),
          'input_tokens', SUM(input_tokens),
          'output_tokens', SUM(output_tokens)
        ) AS by_model
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY model
      ) m
    )
  ) INTO result
  FROM trip_cost_tracking
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_unit_economics_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("lookup_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  found_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role('admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO found_user_id
  FROM auth.users
  WHERE lower(email) = lower(lookup_email);

  RETURN found_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_id_by_email"("lookup_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_info_by_email"("lookup_email" "text") RETURNS TABLE("user_id" "uuid", "user_email" "text", "display_name" "text", "first_name" "text", "last_name" "text", "handle" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role('admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, p.display_name, p.first_name, p.last_name, p.handle
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(lookup_email);
END;
$$;


ALTER FUNCTION "public"."get_user_info_by_email"("lookup_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_trip_ids"("uid" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT trip_id FROM trip_members WHERE user_id = uid
  UNION
  SELECT id FROM trips WHERE user_id = uid
  UNION
  SELECT trip_id FROM trip_collaborators WHERE user_id = uid AND accepted_at IS NOT NULL
$$;


ALTER FUNCTION "public"."get_user_trip_ids"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  raw_first_name text;
  raw_last_name text;
  computed_display_name text;
BEGIN
  raw_first_name := NEW.raw_user_meta_data->>'first_name';
  raw_last_name := NEW.raw_user_meta_data->>'last_name';
  
  IF raw_first_name IS NOT NULL AND raw_last_name IS NOT NULL THEN
    computed_display_name := raw_first_name || ' ' || raw_last_name;
  ELSE
    computed_display_name := COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, display_name, avatar_url)
  VALUES (
    NEW.id,
    raw_first_name,
    raw_last_name,
    computed_display_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.travel_dna_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  -- Create credit_balances row with 0 credits.
  -- Set last_free_credit_at to NOW() to prevent the monthly grant from firing on signup month.
  -- The welcome bonus edge function handles the actual initial credit grant (+150).
  INSERT INTO public.credit_balances (user_id, free_credits, purchased_credits, free_credits_expires_at, last_free_credit_at)
  VALUES (NEW.id, 0, 0, now() + interval '2 months', now())
  ON CONFLICT (user_id) DO NOTHING;

  -- NO ledger entry here — the welcome bonus edge function will create one.

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_free_tier"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.free_tier_status (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_free_tier"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_daily_usage"("p_user_id" "uuid", "p_action_type" "text", "p_usage_date" "date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.daily_usage (user_id, action_type, usage_date, count)
  VALUES (p_user_id, p_action_type, p_usage_date, 1)
  ON CONFLICT (user_id, action_type, usage_date)
  DO UPDATE SET 
    count = daily_usage.count + 1,
    updated_at = NOW()
  RETURNING count INTO new_count;
  
  RETURN new_count;
END;
$$;


ALTER FUNCTION "public"."increment_daily_usage"("p_user_id" "uuid", "p_action_type" "text", "p_usage_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_itinerary_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Get the next version number for this trip/day
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM public.itinerary_versions
  WHERE trip_id = NEW.trip_id AND day_number = NEW.day_number;
  
  -- Mark previous versions as not current
  UPDATE public.itinerary_versions
  SET is_current = false
  WHERE trip_id = NEW.trip_id AND day_number = NEW.day_number;
  
  -- Mark this one as current
  NEW.is_current := true;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_itinerary_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_user_usage"("p_user_id" "uuid", "p_metric_key" "text", "p_period" "text", "p_amount" integer DEFAULT 1) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.user_usage (user_id, metric_key, period, count, updated_at)
  VALUES (p_user_id, p_metric_key, p_period, p_amount, now())
  ON CONFLICT (user_id, metric_key, period)
  DO UPDATE SET
    count = public.user_usage.count + EXCLUDED.count,
    updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."increment_user_usage"("p_user_id" "uuid", "p_metric_key" "text", "p_period" "text", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_audit_log"("p_action" "text", "p_user_id" "text" DEFAULT NULL::"text", "p_actor" "text" DEFAULT NULL::"text", "p_target" "text" DEFAULT NULL::"text", "p_target_id" "text" DEFAULT NULL::"text", "p_action_type" "text" DEFAULT 'general'::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.audit_logs (action, user_id, actor, target, target_id, action_type, metadata)
  VALUES (p_action, p_user_id, p_actor, p_target, p_target_id, p_action_type, p_metadata)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."insert_audit_log"("p_action" "text", "p_user_id" "text", "p_actor" "text", "p_target" "text", "p_target_id" "text", "p_action_type" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_user_id" "text", "p_actor" "text", "p_target" "text", "p_target_id" "text", "p_action_type" "text", "p_metadata" "jsonb") IS 'Server-side only audit log insertion. Call from edge functions with service role key.';



CREATE OR REPLACE FUNCTION "public"."insert_user_audit_log"("p_action" "text", "p_action_type" "text" DEFAULT 'general'::"text", "p_target" "text" DEFAULT NULL::"text", "p_target_id" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_id uuid;
  current_user_id text;
BEGIN
  -- Get user_id from JWT - this is the secure way to determine user identity
  current_user_id := auth.uid()::text;
  
  -- If no authenticated user, still allow logging but mark as anonymous
  INSERT INTO public.audit_logs (action, user_id, actor, target, target_id, action_type, metadata)
  VALUES (
    p_action, 
    current_user_id, 
    COALESCE(current_user_id, 'anonymous'), 
    p_target, 
    p_target_id, 
    p_action_type, 
    p_metadata
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."insert_user_audit_log"("p_action" "text", "p_action_type" "text", "p_target" "text", "p_target_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."insert_user_audit_log"("p_action" "text", "p_action_type" "text", "p_target" "text", "p_target_id" "text", "p_metadata" "jsonb") IS 'Secure audit logging function that uses auth.uid() to determine user_id server-side. Prevents user_id spoofing.';



CREATE OR REPLACE FUNCTION "public"."is_trip_collaborator"("p_trip_id" "uuid", "p_user_id" "uuid", "p_require_edit" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_collaborators tc
    WHERE tc.trip_id = p_trip_id
      AND tc.user_id = p_user_id
      AND tc.accepted_at IS NOT NULL
      AND (
        p_require_edit = false
        OR tc.permission = ANY (ARRAY['edit'::text, 'admin'::text])
      )
  );
$$;


ALTER FUNCTION "public"."is_trip_collaborator"("p_trip_id" "uuid", "p_user_id" "uuid", "p_require_edit" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_trip_member"("p_trip_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members 
    WHERE trip_id = p_trip_id AND user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_trip_member"("p_trip_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips
    WHERE id = p_trip_id AND user_id = auth.uid()
  )
$$;


ALTER FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."itinerary_days_scrub_activities"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.activities IS NOT NULL AND jsonb_typeof(NEW.activities) = 'array' THEN
    NEW.activities := public._strip_prompt_artifacts_in_activities(NEW.activities);
    NEW.activities := public.scrub_itinerary_activities(NEW.activities);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."itinerary_days_scrub_activities"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_trip_members_on_join"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_trip record;
  v_new_member_name text;
  v_member record;
BEGIN
  -- Only fire when accepted_at is set (not on initial insert without acceptance)
  IF NEW.accepted_at IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip if this is an update and accepted_at didn't change
  IF TG_OP = 'UPDATE' AND OLD.accepted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get trip info
  SELECT id, name, destination, user_id INTO v_trip
  FROM public.trips WHERE id = NEW.trip_id;
  
  IF v_trip.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get new member's name
  SELECT COALESCE(display_name, split_part(u.email, '@', 1)) INTO v_new_member_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = NEW.user_id;

  v_new_member_name := COALESCE(v_new_member_name, 'A new traveler');

  -- Notify trip owner
  IF v_trip.user_id != NEW.user_id THEN
    INSERT INTO public.trip_notifications (trip_id, user_id, notification_type, scheduled_for, metadata)
    VALUES (
      NEW.trip_id,
      v_trip.user_id,
      'member_joined',
      now(),
      jsonb_build_object(
        'title', 'New trip member',
        'message', v_new_member_name || ' joined your trip to ' || COALESCE(v_trip.destination, v_trip.name) || '.',
        'memberName', v_new_member_name,
        'memberId', NEW.user_id,
        'tripName', v_trip.name
      )
    );
  END IF;

  -- Notify existing collaborators
  FOR v_member IN
    SELECT tc.user_id FROM public.trip_collaborators tc
    WHERE tc.trip_id = NEW.trip_id
      AND tc.accepted_at IS NOT NULL
      AND tc.user_id != NEW.user_id
      AND tc.user_id != v_trip.user_id
  LOOP
    INSERT INTO public.trip_notifications (trip_id, user_id, notification_type, scheduled_for, metadata)
    VALUES (
      NEW.trip_id,
      v_member.user_id,
      'member_joined',
      now(),
      jsonb_build_object(
        'title', 'New trip member',
        'message', v_new_member_name || ' joined the trip to ' || COALESCE(v_trip.destination, v_trip.name) || '.',
        'memberName', v_new_member_name,
        'memberId', NEW.user_id,
        'tripName', v_trip.name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_trip_members_on_join"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."optimistic_update_itinerary"("p_trip_id" "uuid", "p_expected_version" integer, "p_itinerary_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_version integer;
  v_actual_version integer;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Allow if owner OR accepted collaborator with edit permission
  IF NOT EXISTS (
    SELECT 1 FROM public.trips WHERE id = p_trip_id AND user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = p_trip_id 
      AND user_id = v_user_id 
      AND accepted_at IS NOT NULL
      AND permission IN ('edit', 'admin', 'editor', 'contributor')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Attempt atomic compare-and-swap
  UPDATE public.trips
  SET 
    itinerary_data = p_itinerary_data,
    itinerary_version = itinerary_version + 1,
    updated_at = now()
  WHERE id = p_trip_id
    AND itinerary_version = p_expected_version
  RETURNING itinerary_version INTO v_new_version;

  -- If no row was updated, version mismatch (conflict)
  IF v_new_version IS NULL THEN
    SELECT itinerary_version INTO v_actual_version
    FROM public.trips WHERE id = p_trip_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'expected_version', p_expected_version,
      'actual_version', v_actual_version
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_version', v_new_version
  );
END;
$$;


ALTER FUNCTION "public"."optimistic_update_itinerary"("p_trip_id" "uuid", "p_expected_version" integer, "p_itinerary_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_permission_self_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If the user updating is the collaborator themselves (not the trip owner)
  IF NEW.user_id = auth.uid() THEN
    -- Check if they're trying to change the permission field
    IF OLD.permission IS DISTINCT FROM NEW.permission THEN
      -- Only allow if they're also the trip owner
      IF NOT EXISTS (
        SELECT 1 FROM trips 
        WHERE trips.id = NEW.trip_id 
        AND trips.user_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'Cannot escalate your own permissions';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_permission_self_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_self_collaboration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.trips WHERE id = NEW.trip_id;
  
  IF NEW.user_id = v_owner_id THEN
    RAISE EXCEPTION 'Cannot add trip owner as a collaborator';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_self_collaboration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_itinerary_versions_per_trip"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pruned int := 0;
BEGIN
  WITH ranked AS (
    SELECT id,
           is_current,
           row_number() OVER (PARTITION BY trip_id ORDER BY created_at DESC) AS rn
    FROM public.itinerary_versions
  )
  DELETE FROM public.itinerary_versions
  WHERE id IN (
    SELECT id FROM ranked
    WHERE rn > 30 AND COALESCE(is_current, false) = false
  );
  GET DIAGNOSTICS v_pruned = ROW_COUNT;
  RETURN jsonb_build_object('pruned', v_pruned, 'ran_at', now());
END $$;


ALTER FUNCTION "public"."prune_itinerary_versions_per_trip"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_credit_balances"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_drift_count int := 0;
  v_total_count int := 0;
  v_user record;
  v_actual_purchased bigint;
  v_actual_free bigint;
  v_cached record;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id FROM public.credit_purchases WHERE remaining > 0
  LOOP
    v_total_count := v_total_count + 1;

    SELECT
      COALESCE(SUM(CASE
        WHEN credit_type IN ('flex','club_base','topup','migration','manual_grant')
        THEN remaining ELSE 0 END), 0),
      COALESCE(SUM(CASE
        WHEN credit_type IN ('free_monthly','signup_bonus','referral_bonus','club_bonus','refund')
        THEN remaining ELSE 0 END), 0)
    INTO v_actual_purchased, v_actual_free
    FROM public.credit_purchases
    WHERE user_id = v_user.user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > now());

    SELECT * INTO v_cached
    FROM public.credit_balances
    WHERE user_id = v_user.user_id;

    IF v_cached.user_id IS NULL OR
       COALESCE(v_cached.purchased_credits, 0) != v_actual_purchased OR
       COALESCE(v_cached.free_credits, 0) != v_actual_free THEN
      v_drift_count := v_drift_count + 1;

      INSERT INTO public.credit_balances (user_id, purchased_credits, free_credits, updated_at)
      VALUES (v_user.user_id, v_actual_purchased, v_actual_free, now())
      ON CONFLICT (user_id) DO UPDATE
        SET purchased_credits = EXCLUDED.purchased_credits,
            free_credits = EXCLUDED.free_credits,
            updated_at = now();
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_users_checked', v_total_count,
    'drift_corrected', v_drift_count,
    'ran_at', now()
  );
END $$;


ALTER FUNCTION "public"."reconcile_credit_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rescue_orphan_cost_row"("p_trip_id" "uuid", "p_day_number" integer, "p_category" "text", "p_new_activity_id" "uuid", "p_live_activity_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_target_id uuid;
BEGIN
  SELECT id INTO v_target_id
  FROM public.activity_costs
  WHERE trip_id = p_trip_id
    AND day_number = p_day_number
    AND lower(category) = lower(p_category)
    AND COALESCE(source, '') <> 'logistics-sync'
    AND activity_id <> p_new_activity_id
    AND NOT (activity_id = ANY(p_live_activity_ids))
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_candidate');
  END IF;

  UPDATE public.activity_costs
     SET activity_id = p_new_activity_id,
         updated_at = now()
   WHERE id = v_target_id;

  RETURN jsonb_build_object('success', true, 'rescued_row_id', v_target_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'reason', 'already_rescued');
END $$;


ALTER FUNCTION "public"."rescue_orphan_cost_row"("p_trip_id" "uuid", "p_day_number" integer, "p_category" "text", "p_new_activity_id" "uuid", "p_live_activity_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_or_rotate_invite"("p_trip_id" "uuid", "p_force_rotate" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."resolve_or_rotate_invite"("p_trip_id" "uuid", "p_force_rotate" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller must be the target user' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.travel_dna_profiles (
    user_id, primary_archetype_name, secondary_archetype_name,
    dna_confidence_score, trait_scores, calculated_at, updated_at
  )
  VALUES (
    p_user_id, p_primary_archetype, p_secondary_archetype,
    p_confidence, p_trait_scores, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    primary_archetype_name = EXCLUDED.primary_archetype_name,
    secondary_archetype_name = EXCLUDED.secondary_archetype_name,
    dna_confidence_score = EXCLUDED.dna_confidence_score,
    trait_scores = EXCLUDED.trait_scores,
    calculated_at = v_now,
    updated_at = v_now;

  INSERT INTO public.profiles (id, quiz_completed, updated_at)
  VALUES (p_user_id, true, v_now)
  ON CONFLICT (id) DO UPDATE SET
    quiz_completed = true,
    updated_at = v_now;

  INSERT INTO public.user_preferences (
    user_id, travel_pace, travel_companions, planning_preference,
    budget_tier, quiz_completed, updated_at
  )
  VALUES (
    p_user_id,
    p_preferences->>'travel_pace',
    ARRAY[p_preferences->>'travel_companion']::text[],
    p_preferences->>'planning_preference',
    p_preferences->>'budget_tier',
    true,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    travel_pace = COALESCE(EXCLUDED.travel_pace, public.user_preferences.travel_pace),
    travel_companions = COALESCE(EXCLUDED.travel_companions, public.user_preferences.travel_companions),
    planning_preference = COALESCE(EXCLUDED.planning_preference, public.user_preferences.planning_preference),
    budget_tier = COALESCE(EXCLUDED.budget_tier, public.user_preferences.budget_tier),
    quiz_completed = true,
    updated_at = v_now;

  RETURN jsonb_build_object('success', true, 'saved_at', v_now);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;


ALTER FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb", "p_derivation_source" "text" DEFAULT 'conversation'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller must be the target user' USING ERRCODE = '42501';
  END IF;

  IF p_derivation_source NOT IN ('quiz', 'conversation', 'merged') THEN
    p_derivation_source := 'conversation';
  END IF;

  INSERT INTO public.travel_dna_profiles (
    user_id, primary_archetype_name, secondary_archetype_name,
    dna_confidence_score, trait_scores, derivation_source, calculated_at, updated_at
  )
  VALUES (
    p_user_id, p_primary_archetype, p_secondary_archetype,
    p_confidence, p_trait_scores, p_derivation_source, v_now, v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    primary_archetype_name = EXCLUDED.primary_archetype_name,
    secondary_archetype_name = EXCLUDED.secondary_archetype_name,
    dna_confidence_score = EXCLUDED.dna_confidence_score,
    -- JSONB shallow merge: preserve quiz-only keys (~17), override 8 same-named with conversation values.
    trait_scores = COALESCE(public.travel_dna_profiles.trait_scores, '{}'::jsonb) || EXCLUDED.trait_scores,
    derivation_source = CASE
      WHEN public.travel_dna_profiles.derivation_source IS NULL THEN EXCLUDED.derivation_source
      WHEN public.travel_dna_profiles.derivation_source = EXCLUDED.derivation_source THEN EXCLUDED.derivation_source
      ELSE 'merged'
    END,
    calculated_at = v_now,
    updated_at = v_now;

  INSERT INTO public.profiles (id, quiz_completed, updated_at)
  VALUES (p_user_id, true, v_now)
  ON CONFLICT (id) DO UPDATE SET
    quiz_completed = true,
    updated_at = v_now;

  INSERT INTO public.user_preferences (
    user_id, travel_pace, travel_companions, planning_preference,
    budget_tier, quiz_completed, updated_at
  )
  VALUES (
    p_user_id,
    p_preferences->>'travel_pace',
    ARRAY[p_preferences->>'travel_companion']::text[],
    p_preferences->>'planning_preference',
    p_preferences->>'budget_tier',
    true,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    travel_pace = COALESCE(EXCLUDED.travel_pace, public.user_preferences.travel_pace),
    travel_companions = COALESCE(EXCLUDED.travel_companions, public.user_preferences.travel_companions),
    planning_preference = COALESCE(EXCLUDED.planning_preference, public.user_preferences.planning_preference),
    budget_tier = COALESCE(EXCLUDED.budget_tier, public.user_preferences.budget_tier),
    quiz_completed = true,
    updated_at = v_now;

  RETURN jsonb_build_object('success', true, 'saved_at', v_now);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;


ALTER FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb", "p_derivation_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scrub_itinerary_activities"("acts" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  out_acts jsonb := '[]'::jsonb;
  el jsonb;
  id_blob text;
  full_blob text;
  title text;
  cat text;
  start_time text;
  hh int;
  mm int;
  is_locked boolean;
  src text;
  is_predawn boolean;
  is_ghost_cat boolean;
BEGIN
  IF acts IS NULL OR jsonb_typeof(acts) <> 'array' THEN
    RETURN acts;
  END IF;

  FOR el IN SELECT * FROM jsonb_array_elements(acts)
  LOOP
    is_locked := COALESCE((el->>'locked')::boolean, false)
              OR COALESCE((el->>'is_locked')::boolean, false)
              OR COALESCE((el->>'isLocked')::boolean, false)
              OR (el->>'lock_state') = 'locked';
    src := lower(COALESCE(el->>'source', ''));
    IF is_locked OR src IN ('user','manual','extracted','pinned') THEN
      out_acts := out_acts || jsonb_build_array(el);
      CONTINUE;
    END IF;

    title := COALESCE(el->>'title', el->>'name', '');
    cat   := lower(COALESCE(el->>'category', el->>'type', ''));

    -- IDENTIFIER fields only — description must NEVER be scanned for
    -- placeholder prose ("find a cafe nearby" / "pick a restaurant"
    -- are normal descriptions and were dropping every activity).
    id_blob := concat_ws(' | ',
                el->>'title', el->>'name', el->>'venue_name',
                el#>>'{venue,name}', el#>>'{restaurant,name}', el#>>'{location,name}');

    -- Prompt artifacts may legitimately appear in description, so check
    -- description for those (narrow set: "(slot)", "(<TAG> slot)",
    -- "(placeholder)" — NOT bare "(name)" / "(venue)").
    full_blob := concat_ws(' | ', id_blob, el->>'description');

    IF full_blob ~* '\(\s*([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)\s*\)' THEN
      CONTINUE;
    END IF;

    -- Placeholder PROSE — identifier blob only.
    IF id_blob ~* '(find\s+(a\s+)?(venue|local\s+spot|restaurant|cafe|café|bar|spot))'
       OR id_blob ~* '(pick\s+(a\s+)?(venue|local\s+spot|restaurant|cafe|café|bar|spot))'
       OR id_blob ~* '\bplaceholder\b'
       OR id_blob ~* '\bneeds\s*venue\b'
       OR id_blob ~* 'needsvenuepick'
       OR id_blob ~* 'spa\s+time\s*[—\-:]\s*find'
       OR id_blob ~* '\btbd\b|t\.b\.d\.'
    THEN
      CONTINUE;
    END IF;

    -- Pre-dawn ghost rows.
    start_time := COALESCE(el->>'startTime', el->>'start_time', el->>'time', '');
    IF start_time ~ '^\d{1,2}:\d{2}' THEN
      hh := substring(start_time from '^(\d{1,2}):')::int;
      mm := substring(start_time from '^\d{1,2}:(\d{2})')::int;
      IF lower(start_time) ~ 'pm' AND hh < 12 THEN hh := hh + 12; END IF;
      IF lower(start_time) ~ 'am' AND hh = 12 THEN hh := 0; END IF;
      is_predawn := (hh * 60 + mm) < 300;
    ELSE
      is_predawn := false;
    END IF;

    is_ghost_cat := cat IN (
      'accommodation','hotel','lodging','stay',
      'wellness','spa','relaxation',
      'logistics','transport','transportation','transfer','transit'
    );

    IF is_predawn AND (
      is_ghost_cat
      OR title ~* '(return\s+to|back\s+(to|at)|head\s+back\s+to|head\s+to|wind\s+down\s+at)\s+(your\s+|the\s+|our\s+)?[^,.\n]{0,60}hotel'
      OR title ~* 'hotel\s+(check[-\s]?in|settle\s+in|wind[-\s]?down|nightcap)'
      OR title ~* 'find\s+a\s+venue\s*$'
    ) THEN
      CONTINUE;
    END IF;

    out_acts := out_acts || jsonb_build_array(el);
  END LOOP;

  RETURN out_acts;
END;
$_$;


ALTER FUNCTION "public"."scrub_itinerary_activities"("acts" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scrub_itinerary_meal_suffix"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  meal_re text := '\s*\((?:breakfast|lunch|dinner|brunch)\)\s*$';
  new_days jsonb;
BEGIN
  IF NEW.itinerary_data IS NULL THEN RETURN NEW; END IF;
  IF NEW.itinerary_data->'days' IS NULL OR jsonb_typeof(NEW.itinerary_data->'days') <> 'array' THEN
    RETURN NEW;
  END IF;

  WITH days_array AS (
    SELECT ordinality - 1 AS day_idx, value AS day_obj
    FROM jsonb_array_elements(NEW.itinerary_data->'days') WITH ORDINALITY
  ),
  scrubbed AS (
    SELECT day_idx,
      CASE
        WHEN day_obj->'activities' IS NULL OR jsonb_typeof(day_obj->'activities') <> 'array'
          THEN day_obj
        ELSE jsonb_set(day_obj, '{activities}', (
          SELECT jsonb_agg(
            CASE WHEN jsonb_typeof(act) <> 'object' THEN act ELSE
              (CASE
                WHEN act ? 'location' AND jsonb_typeof(act->'location') = 'object'
                     AND act->'location' ? 'name'
                     AND jsonb_typeof(act->'location'->'name') = 'string'
                     AND (act->'location'->>'name') ~* meal_re
                THEN jsonb_set(act, '{location,name}',
                       to_jsonb(btrim(regexp_replace(act->'location'->>'name', meal_re, '', 'i'))))
                ELSE act
              END)
              || jsonb_build_object(
                   'title',
                   CASE WHEN act ? 'title' AND jsonb_typeof(act->'title') = 'string'
                        THEN to_jsonb(btrim(regexp_replace(act->>'title', meal_re, '', 'i')))
                        ELSE act->'title' END,
                   'name',
                   CASE WHEN act ? 'name' AND jsonb_typeof(act->'name') = 'string'
                        THEN to_jsonb(btrim(regexp_replace(act->>'name', meal_re, '', 'i')))
                        ELSE act->'name' END
                 )
            END
          )
          FROM jsonb_array_elements(day_obj->'activities') AS act
        ))
      END AS new_day_obj
    FROM days_array
  )
  SELECT jsonb_agg(new_day_obj ORDER BY day_idx) INTO new_days FROM scrubbed;

  NEW.itinerary_data := jsonb_set(NEW.itinerary_data, '{days}', COALESCE(new_days, '[]'::jsonb));
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."scrub_itinerary_meal_suffix"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scrub_itinerary_prompt_artifacts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  artifact_re text :=
    '\s*\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)';
  label_re text :=
    '\m(?:reservation[_[:space:]]?urgency|booking[_[:space:]]?(?:urgency|window)|lead[_[:space:]]?time)[[:space:]]*:[[:space:]]*[^.\n]*\.?';
  scrubbed_count int := 0;
  new_days jsonb;
BEGIN
  IF NEW.itinerary_data IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.itinerary_data->'days' IS NULL OR jsonb_typeof(NEW.itinerary_data->'days') <> 'array' THEN
    RETURN NEW;
  END IF;

  WITH days_array AS (
    SELECT ordinality - 1 AS day_idx, value AS day_obj
    FROM jsonb_array_elements(NEW.itinerary_data->'days') WITH ORDINALITY
  ),
  scrubbed_days AS (
    SELECT
      day_idx,
      CASE
        WHEN day_obj->'activities' IS NULL OR jsonb_typeof(day_obj->'activities') <> 'array'
          THEN day_obj
        ELSE jsonb_set(
          day_obj,
          '{activities}',
          (
            SELECT jsonb_agg(
              CASE WHEN jsonb_typeof(act) <> 'object' THEN act ELSE
                act
                  || jsonb_build_object(
                       'title',
                       CASE WHEN act ? 'title' AND jsonb_typeof(act->'title') = 'string'
                            THEN to_jsonb(regexp_replace(regexp_replace(act->>'title', artifact_re, '', 'gi'), label_re, '', 'gi'))
                            ELSE act->'title' END,
                       'name',
                       CASE WHEN act ? 'name' AND jsonb_typeof(act->'name') = 'string'
                            THEN to_jsonb(regexp_replace(regexp_replace(act->>'name', artifact_re, '', 'gi'), label_re, '', 'gi'))
                            ELSE act->'name' END,
                       'description',
                       CASE WHEN act ? 'description' AND jsonb_typeof(act->'description') = 'string'
                            THEN to_jsonb(regexp_replace(regexp_replace(act->>'description', artifact_re, '', 'gi'), label_re, '', 'gi'))
                            ELSE act->'description' END
                     )
              END
            )
            FROM jsonb_array_elements(day_obj->'activities') AS act
          )
        )
      END AS new_day_obj,
      (
        SELECT count(*)::int
        FROM jsonb_array_elements(COALESCE(day_obj->'activities', '[]'::jsonb)) AS act
        WHERE jsonb_typeof(act) = 'object' AND (
          (act->>'title') ~* artifact_re OR (act->>'title') ~* label_re OR
          (act->>'name') ~* artifact_re OR (act->>'name') ~* label_re OR
          (act->>'description') ~* artifact_re OR (act->>'description') ~* label_re
        )
      ) AS hits
    FROM days_array
  )
  SELECT
    jsonb_agg(new_day_obj ORDER BY day_idx),
    COALESCE(SUM(hits), 0)::int
  INTO new_days, scrubbed_count
  FROM scrubbed_days;

  IF scrubbed_count > 0 THEN
    RAISE NOTICE '[scrub_itinerary_prompt_artifacts] trip=% scrubbed % field(s)', NEW.id, scrubbed_count;
    NEW.itinerary_data := jsonb_set(NEW.itinerary_data, '{days}', new_days);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."scrub_itinerary_prompt_artifacts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."scrub_itinerary_prompt_artifacts"() IS 'Last-gate scrub of prompt-artifact tokens (FLEX_WINDOW, INTEREST_SLOT, (slot), (AESTHETIC slot), etc.) from trips.itinerary_data.days[].activities[]. Belt-and-braces complement to the client-side persistTripItinerary boundary; never blocks a write, only mutates dirty strings in place.';



CREATE OR REPLACE FUNCTION "public"."set_booking_reference"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.booking_reference IS NULL THEN
    NEW.booking_reference := generate_booking_reference();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."spend_from_group_budget"("p_budget_id" "uuid", "p_cost" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new int;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_cost');
  END IF;

  UPDATE public.group_budgets
     SET remaining_credits = remaining_credits - p_cost,
         updated_at = now()
   WHERE id = p_budget_id
     AND remaining_credits >= p_cost
  RETURNING remaining_credits INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient');
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining_credits', v_new);
END;
$$;


ALTER FUNCTION "public"."spend_from_group_budget"("p_budget_id" "uuid", "p_cost" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."strip_verified_venue_meal_suffix"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := btrim(regexp_replace(
      NEW.name,
      '\s*\((?:breakfast|lunch|dinner|brunch)\)\s*$',
      '',
      'i'
    ));
  END IF;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."strip_verified_venue_meal_suffix"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_client_intake"("p_intake_token" "text", "p_legal_first_name" "text", "p_legal_last_name" "text", "p_preferred_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_date_of_birth" "date" DEFAULT NULL::"date", "p_gender" "text" DEFAULT NULL::"text", "p_passport_country" "text" DEFAULT NULL::"text", "p_passport_expiry" "date" DEFAULT NULL::"date", "p_seat_preference" "text" DEFAULT NULL::"text", "p_meal_preference" "text" DEFAULT NULL::"text", "p_dietary_restrictions" "text"[] DEFAULT NULL::"text"[], "p_allergies" "text"[] DEFAULT NULL::"text"[], "p_mobility_needs" "text" DEFAULT NULL::"text", "p_medical_notes" "text" DEFAULT NULL::"text", "p_emergency_contact" "jsonb" DEFAULT NULL::"jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_account RECORD;
  v_traveler_id UUID;
BEGIN
  -- Find the account by intake token
  SELECT id, agent_id, name INTO v_account
  FROM public.agency_accounts
  WHERE intake_token = p_intake_token
    AND intake_enabled = true;
  
  IF v_account.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired intake link');
  END IF;
  
  -- Check if traveler with same email already exists for this account
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_traveler_id
    FROM public.agency_travelers
    WHERE account_id = v_account.id AND email = p_email;
    
    IF v_traveler_id IS NOT NULL THEN
      -- Update existing traveler
      UPDATE public.agency_travelers SET
        legal_first_name = COALESCE(p_legal_first_name, legal_first_name),
        legal_last_name = COALESCE(p_legal_last_name, legal_last_name),
        preferred_name = COALESCE(p_preferred_name, preferred_name),
        phone = COALESCE(p_phone, phone),
        date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
        gender = COALESCE(p_gender, gender),
        passport_country = COALESCE(p_passport_country, passport_country),
        passport_expiry = COALESCE(p_passport_expiry, passport_expiry),
        seat_preference = COALESCE(p_seat_preference, seat_preference),
        meal_preference = COALESCE(p_meal_preference, meal_preference),
        dietary_restrictions = COALESCE(p_dietary_restrictions, dietary_restrictions),
        allergies = COALESCE(p_allergies, allergies),
        mobility_needs = COALESCE(p_mobility_needs, mobility_needs),
        medical_notes = COALESCE(p_medical_notes, medical_notes),
        emergency_contact = COALESCE(p_emergency_contact, emergency_contact),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
      WHERE id = v_traveler_id;
      
      RETURN jsonb_build_object('success', true, 'traveler_id', v_traveler_id, 'updated', true);
    END IF;
  END IF;
  
  -- Insert new traveler
  INSERT INTO public.agency_travelers (
    account_id, agent_id, legal_first_name, legal_last_name, preferred_name,
    email, phone, date_of_birth, gender, passport_country, passport_expiry,
    seat_preference, meal_preference, dietary_restrictions, allergies,
    mobility_needs, medical_notes, emergency_contact, notes, is_primary_contact
  ) VALUES (
    v_account.id, v_account.agent_id, p_legal_first_name, p_legal_last_name, p_preferred_name,
    p_email, p_phone, p_date_of_birth, p_gender, p_passport_country, p_passport_expiry,
    p_seat_preference, p_meal_preference, p_dietary_restrictions, p_allergies,
    p_mobility_needs, p_medical_notes, p_emergency_contact, p_notes, false
  ) RETURNING id INTO v_traveler_id;
  
  RETURN jsonb_build_object('success', true, 'traveler_id', v_traveler_id, 'updated', false);
END;
$$;


ALTER FUNCTION "public"."submit_client_intake"("p_intake_token" "text", "p_legal_first_name" "text", "p_legal_last_name" "text", "p_preferred_name" "text", "p_email" "text", "p_phone" "text", "p_date_of_birth" "date", "p_gender" "text", "p_passport_country" "text", "p_passport_expiry" "date", "p_seat_preference" "text", "p_meal_preference" "text", "p_dietary_restrictions" "text"[], "p_allergies" "text"[], "p_mobility_needs" "text", "p_medical_notes" "text", "p_emergency_contact" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sweep_stale_pending_charges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row record;
  v_swept int := 0;
  v_skipped int := 0;
  v_func_url text;
  v_service_key text;
BEGIN
  v_func_url := current_setting('supabase.functions_url', true);
  v_service_key := current_setting('supabase.service_role_key', true);

  IF v_func_url IS NULL OR v_service_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_settings');
  END IF;

  FOR v_row IN
    SELECT id, user_id, trip_id, action, credits_amount, refund_attempts
    FROM public.pending_credit_charges
    WHERE status = 'pending'
      AND created_at < now() - interval '5 minutes'
      AND refund_attempts < 3
    ORDER BY created_at ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Optimistic increment (race-safe vs client hook firing simultaneously)
    UPDATE public.pending_credit_charges
       SET refund_attempts = refund_attempts + 1
     WHERE id = v_row.id
       AND refund_attempts = v_row.refund_attempts;

    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_func_url || '/spend-credits',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'action', 'REFUND',
        'tripId', v_row.trip_id,
        'userId', v_row.user_id,
        'creditsAmount', v_row.credits_amount,
        'metadata', jsonb_build_object(
          'reason', 'cron_stale_pending_sweeper',
          'originalAction', v_row.action,
          'pendingChargeId', v_row.id,
          'source', 'cron'
        )
      )
    );

    v_swept := v_swept + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'swept', v_swept,
    'skipped', v_skipped,
    'ran_at', now()
  );
END;
$$;


ALTER FUNCTION "public"."sweep_stale_pending_charges"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sweep_stale_pending_charges"() IS 'pg_cron sweeper: refunds pending_credit_charges rows >5min old via spend-credits REFUND. Uses optimistic refund_attempts increment to race-safely cooperate with the client useStalePendingChargeRefund hook (which has a 2min threshold, so client always gets first shot). Max 3 attempts per charge; spend-credits handles idempotency via pendingChargeId.';



CREATE OR REPLACE FUNCTION "public"."sync_activity_cost_to_itinerary_jsonb"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_trip_id   uuid;
  v_act_id    text;
  v_total     numeric;
  v_per_pp    numeric;
  v_source    text;
  v_cost_obj  jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_trip_id := OLD.trip_id;
    v_act_id  := OLD.activity_id;
    v_cost_obj := jsonb_build_object(
      'amount', 0,
      'currency', 'USD',
      'perPerson', 0,
      'basis', 'ledger',
      'source', 'deleted',
      'synced_at', to_jsonb(now())
    );
  ELSE
    v_trip_id := NEW.trip_id;
    v_act_id  := NEW.activity_id;
    v_per_pp  := COALESCE(NEW.cost_per_person_usd, 0);
    v_total   := v_per_pp * COALESCE(NEW.num_travelers, 1);
    v_source  := COALESCE(NEW.source, 'unknown');
    v_cost_obj := jsonb_build_object(
      'amount', v_total,
      'currency', 'USD',
      'perPerson', v_per_pp,
      'basis', 'ledger',
      'source', v_source,
      'synced_at', to_jsonb(now())
    );
  END IF;

  IF v_trip_id IS NULL OR v_act_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Walk days[].activities[] and rewrite the cost on the matching activity.
  -- jsonb_set on a deeply-nested array element with an unknown index is
  -- awkward, so we rebuild the days array. This runs once per cost write
  -- (small N) and stays inside the same transaction.
  UPDATE public.trips t
  SET itinerary_data = jsonb_set(
    t.itinerary_data,
    '{days}',
    COALESCE((
      SELECT jsonb_agg(
        CASE
          WHEN day ? 'activities' AND jsonb_typeof(day->'activities') = 'array' THEN
            jsonb_set(
              day,
              '{activities}',
              COALESCE((
                SELECT jsonb_agg(
                  CASE
                    WHEN act->>'id' = v_act_id
                      THEN jsonb_set(jsonb_set(act, '{cost}', v_cost_obj, true), '{estimatedCost}', v_cost_obj, true)
                    ELSE act
                  END
                  ORDER BY a_ord
                )
                FROM jsonb_array_elements(day->'activities') WITH ORDINALITY AS a(act, a_ord)
              ), '[]'::jsonb)
            )
          ELSE day
        END
        ORDER BY d_ord
      )
      FROM jsonb_array_elements(t.itinerary_data->'days') WITH ORDINALITY AS d(day, d_ord)
    ), '[]'::jsonb)
  )
  WHERE t.id = v_trip_id
    AND t.itinerary_data IS NOT NULL
    AND t.itinerary_data ? 'days'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(t.itinerary_data->'days') AS d(day),
           jsonb_array_elements(COALESCE(d.day->'activities', '[]'::jsonb)) AS a(act)
      WHERE a.act->>'id' = v_act_id
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."sync_activity_cost_to_itinerary_jsonb"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_expired_credit_balances"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.credit_balances cb
  SET 
    free_credits = (
      SELECT COALESCE(SUM(cp.remaining), 0)::int
      FROM public.credit_purchases cp
      WHERE cp.user_id = cb.user_id
        AND cp.remaining > 0
        AND cp.credit_type IN ('free_monthly', 'signup_bonus', 'referral_bonus')
        AND (cp.expires_at IS NULL OR cp.expires_at > now())
    ),
    purchased_credits = (
      SELECT COALESCE(SUM(cp.remaining), 0)::int
      FROM public.credit_purchases cp
      WHERE cp.user_id = cb.user_id
        AND cp.remaining > 0
        AND cp.credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')
        AND (cp.expires_at IS NULL OR cp.expires_at > now())
    ),
    updated_at = now()
  WHERE cb.free_credits > 0
    AND cb.free_credits_expires_at IS NOT NULL
    AND cb.free_credits_expires_at < now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."sync_expired_credit_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_consumer_trip_share"("p_trip_id" "uuid", "p_enabled" boolean, "p_permission" "text" DEFAULT NULL::"text", "p_credit_policy" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."toggle_consumer_trip_share"("p_trip_id" "uuid", "p_enabled" boolean, "p_permission" "text", "p_credit_policy" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_booking_state"("p_activity_id" "uuid", "p_new_state" "public"."booking_item_state", "p_trigger_source" "text" DEFAULT 'user'::"text", "p_trigger_reference" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_activity record;
  v_allowed boolean := false;
  v_user_id uuid;
  v_is_authorized boolean := false;
  v_last jsonb;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_activity FROM trip_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found');
  END IF;

  -- Authorization: trip owner or accepted collaborator with edit-tier permission
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = v_activity.trip_id AND t.user_id = v_user_id
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    SELECT EXISTS (
      SELECT 1 FROM public.trip_collaborators tc
      WHERE tc.trip_id = v_activity.trip_id
        AND tc.user_id = v_user_id
        AND tc.accepted_at IS NOT NULL
        AND tc.permission IN ('edit', 'admin', 'editor', 'contributor')
    ) INTO v_is_authorized;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not have permission to modify this booking');
  END IF;

  -- IDEMPOTENCY: if the most recent state_history entry already records this exact
  -- (new_state, trigger_reference) pair, treat the call as a duplicate webhook and
  -- short-circuit. This prevents duplicate audit entries when Stripe replays events.
  IF p_trigger_reference IS NOT NULL
     AND v_activity.state_history IS NOT NULL
     AND jsonb_typeof(v_activity.state_history) = 'array'
     AND jsonb_array_length(v_activity.state_history) > 0 THEN
    v_last := v_activity.state_history -> (jsonb_array_length(v_activity.state_history) - 1);
    IF (v_last ->> 'to') = p_new_state::text
       AND (v_last ->> 'trigger_reference') = p_trigger_reference THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'previous_state', v_activity.booking_state,
        'new_state', p_new_state
      );
    END IF;
  END IF;

  -- Allowed transitions
  CASE v_activity.booking_state
    WHEN 'not_selected' THEN
      v_allowed := p_new_state IN ('selected_pending');
    WHEN 'selected_pending' THEN
      v_allowed := p_new_state IN ('not_selected', 'booked_confirmed');
    WHEN 'booked_confirmed' THEN
      v_allowed := p_new_state IN ('changed', 'cancelled', 'refunded');
    WHEN 'changed' THEN
      v_allowed := p_new_state IN ('booked_confirmed', 'cancelled', 'refunded');
    WHEN 'cancelled' THEN
      v_allowed := p_new_state IN ('refunded');
    WHEN 'refunded' THEN
      v_allowed := false;
    ELSE
      v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid transition from %s to %s', v_activity.booking_state, p_new_state)
    );
  END IF;

  UPDATE trip_activities
  SET
    booking_state = p_new_state,
    booked_at = CASE WHEN p_new_state = 'booked_confirmed' THEN now() ELSE booked_at END,
    cancelled_at = CASE WHEN p_new_state = 'cancelled' THEN now() ELSE cancelled_at END,
    refunded_at = CASE WHEN p_new_state = 'refunded' THEN now() ELSE refunded_at END,
    updated_at = now(),
    state_history = COALESCE(state_history, '[]'::jsonb) || jsonb_build_object(
      'from', v_activity.booking_state,
      'to', p_new_state,
      'at', now(),
      'by', v_user_id,
      'trigger_source', p_trigger_source,
      'trigger_reference', p_trigger_reference,
      'metadata', p_metadata
    )
  WHERE id = p_activity_id;

  -- NOTE: Legacy INSERT INTO booking_state_log removed. The table was dropped in
  -- migration 20260125212256; state_history JSONB on trip_activities is now the
  -- canonical audit trail.

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'previous_state', v_activity.booking_state,
    'new_state', p_new_state
  );
END;
$$;


ALTER FUNCTION "public"."transition_booking_state"("p_activity_id" "uuid", "p_new_state" "public"."booking_item_state", "p_trigger_source" "text", "p_trigger_reference" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trips_scrub_itinerary_days"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  days jsonb;
  new_days jsonb := '[]'::jsonb;
  d jsonb;
  cleaned jsonb;
BEGIN
  IF NEW.itinerary_data IS NULL OR jsonb_typeof(NEW.itinerary_data) <> 'object' THEN
    RETURN NEW;
  END IF;
  days := NEW.itinerary_data->'days';
  IF days IS NULL OR jsonb_typeof(days) <> 'array' THEN
    RETURN NEW;
  END IF;
  FOR d IN SELECT * FROM jsonb_array_elements(days)
  LOOP
    IF d ? 'activities' AND jsonb_typeof(d->'activities') = 'array' THEN
      cleaned := public.scrub_itinerary_activities(d->'activities');
      new_days := new_days || jsonb_build_array(jsonb_set(d, '{activities}', cleaned));
    ELSE
      new_days := new_days || jsonb_build_array(d);
    END IF;
  END LOOP;
  NEW.itinerary_data := jsonb_set(NEW.itinerary_data, '{days}', new_days);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trips_scrub_itinerary_days"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_budget_ledger_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_budget_ledger_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_collaborator_permission"("p_collaborator_id" "uuid", "p_permission" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_collaborator record;
  v_trip record;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
  END IF;
  
  -- Validate permission value — must match table check constraint
  IF p_permission NOT IN ('view', 'edit', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid permission level');
  END IF;
  
  -- Get the collaborator
  SELECT * INTO v_collaborator FROM trip_collaborators WHERE id = p_collaborator_id;
  
  IF v_collaborator.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Collaborator not found');
  END IF;
  
  -- Get the trip and verify ownership
  SELECT * INTO v_trip FROM trips WHERE id = v_collaborator.trip_id;
  
  IF v_trip.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can change permissions');
  END IF;
  
  -- Update the permission
  UPDATE trip_collaborators 
  SET permission = p_permission
  WHERE id = p_collaborator_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'collaborator_id', p_collaborator_id,
    'new_permission', p_permission
  );
END;
$$;


ALTER FUNCTION "public"."update_collaborator_permission"("p_collaborator_id" "uuid", "p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_itinerary_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_itinerary_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_travel_guides_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_travel_guides_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_verified_venues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_verified_venues_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_activity_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  ref RECORD;
  max_allowed NUMERIC;
  original_cost NUMERIC;
  warning_threshold NUMERIC;
BEGIN
  IF NEW.cost_per_person_usd < 0 THEN
    NEW.cost_per_person_usd := 0;
  END IF;

  IF NEW.notes IS NOT NULL AND NEW.notes ILIKE '%free venue%' THEN
    IF NEW.cost_per_person_usd <> 0 THEN
      NEW.cost_per_person_usd := 0;
      NEW.source := COALESCE(NEW.source, 'free_venue');
    END IF;
  END IF;

  IF NEW.source = 'user_override' THEN
    CASE NEW.category
      WHEN 'dining' THEN warning_threshold := 500;
      WHEN 'transport' THEN warning_threshold := 300;
      WHEN 'activity' THEN warning_threshold := 1000;
      WHEN 'nightlife' THEN warning_threshold := 200;
      ELSE warning_threshold := 2000;
    END CASE;

    IF NEW.cost_per_person_usd > warning_threshold THEN
      NEW.notes := COALESCE(NEW.notes, '') || ' [User override: above typical range for ' || NEW.category || ']';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Skip the 3x cap when the price was intentionally floored by repair logic
  -- (Michelin venue, acclaimed bistro, ticketed attraction, etc.) — otherwise
  -- the cap silently clips €120 splurge dinners to ~€65 and erases the user's
  -- splurge-forward intent.
  IF NEW.source IN ('michelin_floor', 'ticketed_attraction_floor', 'acclaimed_bistro') THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.cost_reference_id IS NOT NULL THEN
    SELECT * INTO ref FROM public.cost_reference WHERE id = NEW.cost_reference_id;
    IF FOUND THEN
      max_allowed := ref.cost_high_usd * 3;
      IF NEW.cost_per_person_usd > max_allowed THEN
        original_cost := NEW.cost_per_person_usd;
        NEW.cost_per_person_usd := ref.cost_high_usd;
        NEW.notes := COALESCE(NEW.notes, '') || ' [Auto-corrected from $' || original_cost || ', exceeded 3x ref high $' || ref.cost_high_usd || ']';
        NEW.source := 'auto_corrected';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."validate_activity_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_travel_guide_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_travel_guide_status"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."achievement_unlocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_id" "text" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "progress" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "notified" boolean DEFAULT false
);


ALTER TABLE "public"."achievement_unlocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."achievements" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "icon" "text" DEFAULT 'trophy'::"text" NOT NULL,
    "points" integer DEFAULT 10 NOT NULL,
    "tier" "text" DEFAULT 'bronze'::"text" NOT NULL,
    "requirement_type" "text" NOT NULL,
    "requirement_value" integer DEFAULT 1,
    "requirement_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "is_hidden" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "duration_minutes" integer,
    "price_range" "jsonb" DEFAULT '{}'::"jsonb",
    "booking_required" boolean DEFAULT false,
    "booking_url" "text",
    "best_times" "jsonb" DEFAULT '{}'::"jsonb",
    "crowd_levels" "text",
    "coordinates" "jsonb" DEFAULT '{"lat": 0, "lng": 0}'::"jsonb",
    "accessibility_info" "jsonb" DEFAULT '{}'::"jsonb",
    "tags" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text"
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "cost_usd" numeric,
    "estimated_duration_hours" numeric,
    "location" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_generated" boolean DEFAULT false,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "activity_id" "text" NOT NULL,
    "day_number" integer NOT NULL,
    "cost_reference_id" "uuid",
    "cost_per_person_usd" numeric(10,2) NOT NULL,
    "cost_per_person_local" numeric(10,2),
    "local_currency" "text",
    "num_travelers" integer DEFAULT 1 NOT NULL,
    "total_cost_usd" numeric(10,2) GENERATED ALWAYS AS (("cost_per_person_usd" * ("num_travelers")::numeric)) STORED,
    "category" "text" NOT NULL,
    "source" "text" DEFAULT 'reference'::"text" NOT NULL,
    "confidence" "text" DEFAULT 'medium'::"text",
    "is_paid" boolean DEFAULT false,
    "paid_amount_usd" numeric(10,2),
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "paid_amount_local" numeric(10,2),
    "refunded_at" timestamp with time zone,
    "refund_amount_cents" integer,
    "currency" "text" DEFAULT 'USD'::"text"
);


ALTER TABLE "public"."activity_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "activity_id" "text" NOT NULL,
    "rating" "text" NOT NULL,
    "feedback_text" "text",
    "feedback_tags" "text"[] DEFAULT '{}'::"text"[],
    "activity_type" "text",
    "activity_category" "text",
    "destination" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "personalization_tags" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "activity_feedback_rating_check" CHECK (("rating" = ANY (ARRAY['loved'::"text", 'liked'::"text", 'neutral'::"text", 'disliked'::"text"])))
);


ALTER TABLE "public"."activity_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_quality_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid",
    "venue_id" "text",
    "venue_name" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "category" "text",
    "total_ratings" integer DEFAULT 0 NOT NULL,
    "average_rating" numeric(3,2),
    "rating_distribution" "jsonb" DEFAULT '{"meh": 0, "good": 0, "skip": 0, "loved": 0}'::"jsonb" NOT NULL,
    "worth_price_score" numeric(3,2),
    "archetype_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "common_tips" "text"[],
    "last_updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_quality_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "account_type" "public"."agency_account_type" DEFAULT 'individual'::"public"."agency_account_type" NOT NULL,
    "name" "text" NOT NULL,
    "company_name" "text",
    "billing_email" "text",
    "billing_phone" "text",
    "billing_address" "jsonb",
    "notes" "text",
    "tags" "text"[],
    "total_trips" integer DEFAULT 0,
    "total_revenue_cents" bigint DEFAULT 0,
    "lifetime_value_cents" bigint DEFAULT 0,
    "referral_source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "intake_token" "text",
    "intake_enabled" boolean DEFAULT false
);


ALTER TABLE "public"."agency_accounts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."agency_accounts_intake" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "intake_token"
   FROM "public"."agency_accounts"
  WHERE (("intake_enabled" = true) AND ("intake_token" IS NOT NULL));


ALTER VIEW "public"."agency_accounts_intake" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_booking_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "segment_type" "public"."booking_segment_type" NOT NULL,
    "status" "public"."booking_status" DEFAULT 'pending'::"public"."booking_status",
    "vendor_name" "text",
    "vendor_code" "text",
    "confirmation_number" "text",
    "booking_reference" "text",
    "start_date" "date",
    "start_time" time without time zone,
    "end_date" "date",
    "end_time" time without time zone,
    "origin" "text",
    "origin_code" "text",
    "destination" "text",
    "destination_code" "text",
    "flight_number" "text",
    "cabin_class" "text",
    "aircraft_type" "text",
    "room_type" "text",
    "room_count" integer,
    "check_in_time" "text",
    "check_out_time" "text",
    "net_cost_cents" bigint DEFAULT 0,
    "sell_price_cents" bigint DEFAULT 0,
    "commission_cents" bigint DEFAULT 0,
    "commission_rate" numeric(5,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "ticketing_deadline" timestamp with time zone,
    "payment_deadline" timestamp with time zone,
    "cancellation_deadline" timestamp with time zone,
    "cancellation_policy" "text",
    "penalty_amount_cents" bigint,
    "is_refundable" boolean DEFAULT true,
    "supplier_id" "uuid",
    "supplier_contact" "text",
    "travelers_on_segment" "uuid"[],
    "segment_details" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settlement_type" "public"."booking_settlement_type" DEFAULT 'supplier_direct'::"public"."booking_settlement_type",
    "supplier_paid_cents" bigint DEFAULT 0,
    "supplier_paid_at" timestamp with time zone,
    "commission_expected_cents" bigint DEFAULT 0,
    "commission_received_cents" bigint DEFAULT 0,
    "commission_received_at" timestamp with time zone,
    "arc_submission_date" "date",
    "arc_settlement_date" "date",
    "arc_report_number" "text",
    "booking_source" "public"."booking_source" DEFAULT 'manual'::"public"."booking_source",
    "baggage_allowance" "text",
    "terminal_info" "jsonb",
    "timezone_info" "text",
    "support_instructions" "text",
    "is_informational_only" boolean DEFAULT false
);


ALTER TABLE "public"."agency_booking_segments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agency_booking_segments"."settlement_type" IS 'How this booking is financially processed: arc_bsp (airline reporting), supplier_direct (we pay supplier), commission_track (client pays supplier, we get commission)';



COMMENT ON COLUMN "public"."agency_booking_segments"."booking_source" IS 'How this booking was created: native_api (Viator etc), imported (agent booked elsewhere), client_booked (informational), manual';



COMMENT ON COLUMN "public"."agency_booking_segments"."is_informational_only" IS 'True for segments where agent is not managing the booking, just tracking for itinerary purposes';



CREATE TABLE IF NOT EXISTS "public"."agency_communications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "trip_id" "uuid",
    "account_id" "uuid",
    "traveler_id" "uuid",
    "communication_type" "public"."communication_type" NOT NULL,
    "subject" "text",
    "body" "text",
    "from_address" "text",
    "to_addresses" "text"[],
    "cc_addresses" "text"[],
    "is_incoming" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "is_approval" boolean DEFAULT false,
    "approval_response" "text",
    "approved_item_reference" "text",
    "external_message_id" "text",
    "template_used" "text",
    "attachments" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_communications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "trip_id" "uuid",
    "account_id" "uuid",
    "traveler_id" "uuid",
    "document_type" "public"."document_type" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "file_url" "text" NOT NULL,
    "file_name" "text",
    "file_size_bytes" bigint,
    "mime_type" "text",
    "expires_at" "date",
    "is_client_visible" boolean DEFAULT false,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."agency_documents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "agent_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'draft'::"public"."invoice_status",
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "paid_date" "date",
    "subtotal_cents" bigint DEFAULT 0,
    "agency_fee_cents" bigint DEFAULT 0,
    "discount_cents" bigint DEFAULT 0,
    "tax_cents" bigint DEFAULT 0,
    "total_cents" bigint DEFAULT 0,
    "amount_paid_cents" bigint DEFAULT 0,
    "balance_due_cents" bigint DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text",
    "line_items" "jsonb",
    "payment_instructions" "text",
    "stripe_invoice_id" "text",
    "notes" "text",
    "internal_notes" "text",
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_payment_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "agent_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "due_date" "date" NOT NULL,
    "is_paid" boolean DEFAULT false,
    "paid_at" timestamp with time zone,
    "payment_id" "uuid",
    "reminder_sent_at" timestamp with time zone,
    "reminder_count" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_payment_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "payment_method" "public"."payment_method" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_charge_id" "text",
    "transaction_reference" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "refund_amount_cents" bigint DEFAULT 0,
    "refunded_at" timestamp with time zone,
    "notes" "text",
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "is_current_version" boolean DEFAULT true,
    "parent_quote_id" "uuid",
    "name" "text",
    "description" "text",
    "status" "public"."quote_status" DEFAULT 'draft'::"public"."quote_status",
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "text",
    "expires_at" timestamp with time zone,
    "subtotal_cents" bigint DEFAULT 0,
    "agency_fee_cents" bigint DEFAULT 0,
    "discount_cents" bigint DEFAULT 0,
    "tax_cents" bigint DEFAULT 0,
    "total_cents" bigint DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text",
    "line_items" "jsonb",
    "terms_and_conditions" "text",
    "notes" "text",
    "internal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "supplier_type" "text",
    "code" "text",
    "primary_contact_name" "text",
    "primary_contact_email" "text",
    "primary_contact_phone" "text",
    "website" "text",
    "default_commission_rate" numeric(5,2),
    "payment_terms" "text",
    "notes" "text",
    "is_preferred" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "trip_id" "uuid",
    "account_id" "uuid",
    "traveler_id" "uuid",
    "booking_segment_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "public"."task_priority" DEFAULT 'medium'::"public"."task_priority",
    "status" "public"."task_status" DEFAULT 'pending'::"public"."task_status",
    "due_date" "date",
    "due_time" time without time zone,
    "completed_at" timestamp with time zone,
    "task_type" "text",
    "is_system_generated" boolean DEFAULT false,
    "reminder_date" timestamp with time zone,
    "reminder_sent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."agency_tasks" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_travelers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "legal_first_name" "text" NOT NULL,
    "legal_middle_name" "text",
    "legal_last_name" "text" NOT NULL,
    "preferred_name" "text",
    "date_of_birth" "date",
    "gender" "text",
    "email" "text",
    "phone" "text",
    "passport_number" "text",
    "passport_country" "text",
    "passport_expiry" "date",
    "known_traveler_number" "text",
    "redress_number" "text",
    "global_entry_number" "text",
    "seat_preference" "text",
    "meal_preference" "text",
    "hotel_preferences" "jsonb",
    "airline_loyalty" "jsonb",
    "hotel_loyalty" "jsonb",
    "dietary_restrictions" "text"[],
    "allergies" "text"[],
    "mobility_needs" "text",
    "medical_notes" "text",
    "emergency_contact" "jsonb",
    "notes" "text",
    "is_primary_contact" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."agency_travelers" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_travelers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_trip_travelers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "traveler_id" "uuid" NOT NULL,
    "is_lead_traveler" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_trip_travelers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_trips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "destination" "text",
    "destinations" "jsonb",
    "start_date" "date",
    "end_date" "date",
    "status" "text" DEFAULT 'inquiry'::"text",
    "pipeline_stage" integer DEFAULT 1,
    "total_cost_cents" bigint DEFAULT 0,
    "total_paid_cents" bigint DEFAULT 0,
    "total_commission_cents" bigint DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text",
    "trip_type" "text",
    "traveler_count" integer DEFAULT 1,
    "notes" "text",
    "internal_notes" "text",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "share_token" "text",
    "share_enabled" boolean DEFAULT false,
    "linked_trip_id" "uuid",
    "itinerary_data" "jsonb"
);


ALTER TABLE "public"."agency_trips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "travel_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "total_trips" integer DEFAULT 0,
    "total_revenue_cents" integer DEFAULT 0,
    "last_trip_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_itinerary_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "item_type" "text" NOT NULL,
    "tags" "text"[],
    "destination_hint" "text",
    "content" "jsonb" NOT NULL,
    "usage_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_itinerary_library_item_type_check" CHECK (("item_type" = ANY (ARRAY['activity'::"text", 'day'::"text", 'trip_template'::"text"])))
);


ALTER TABLE "public"."agent_itinerary_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."airport_transfer_fares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city" "text" NOT NULL,
    "airport_code" "text",
    "airport_name" "text",
    "taxi_duration_min" integer,
    "taxi_duration_max" integer,
    "taxi_cost_min" numeric(10,2),
    "taxi_cost_max" numeric(10,2),
    "taxi_is_fixed_price" boolean DEFAULT false,
    "taxi_notes" "text",
    "train_duration_min" integer,
    "train_duration_max" integer,
    "train_cost" numeric(10,2),
    "train_line" "text",
    "train_notes" "text",
    "bus_duration_min" integer,
    "bus_duration_max" integer,
    "bus_cost" numeric(10,2),
    "bus_notes" "text",
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "currency_symbol" "text" DEFAULT '$'::"text" NOT NULL,
    "destination_zone" "text",
    "last_verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "confidence_score" numeric(3,2) DEFAULT 0.8,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."airport_transfer_fares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."airports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'international'::"text",
    "city" "text",
    "country" "text",
    "latitude" numeric,
    "longitude" numeric,
    "distance_km" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."airports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archetype_destination_guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "archetype" "text" NOT NULL,
    "destination_id" "uuid" NOT NULL,
    "guide" "jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    "usage_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."archetype_destination_guides" OWNER TO "postgres";


COMMENT ON TABLE "public"."archetype_destination_guides" IS 'Cached AI-generated travel guides for archetype × destination combinations';



CREATE TABLE IF NOT EXISTS "public"."archetype_pacing_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "archetype" "text" NOT NULL,
    "trip_type" "text",
    "total_responses" integer DEFAULT 0 NOT NULL,
    "pacing_distribution" "jsonb" DEFAULT '{"too_slow": 0, "just_right": 0, "too_rushed": 0}'::"jsonb" NOT NULL,
    "recommended_adjustment" numeric(3,2) DEFAULT 0,
    "sample_size_threshold" integer DEFAULT 20,
    "last_calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."archetype_pacing_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attractions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "category" "text",
    "subcategory" "text",
    "visit_duration_mins" integer,
    "price_range" "jsonb" DEFAULT '{}'::"jsonb",
    "opening_hours" "jsonb",
    "peak_hours" "jsonb",
    "crowd_patterns" "jsonb",
    "average_rating" numeric,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "experience_categories" "text"[] DEFAULT '{}'::"text"[],
    "vibe" "text"[] DEFAULT '{}'::"text"[],
    "crowd_level" "text" DEFAULT 'moderate'::"text",
    "physical_intensity" "text" DEFAULT 'moderate'::"text",
    "requires_reservation" boolean DEFAULT false,
    "budget_level" "text" DEFAULT 'moderate'::"text",
    "best_time_of_day" "text"[] DEFAULT '{}'::"text"[],
    "indoor_outdoor" "text" DEFAULT 'both'::"text",
    "typical_duration_minutes" integer,
    "family_friendly" boolean DEFAULT false,
    "romantic" boolean DEFAULT false,
    "solo_friendly" boolean DEFAULT true,
    "group_friendly" boolean DEFAULT true,
    "enriched_at" timestamp with time zone,
    "image_url" "text"
);


ALTER TABLE "public"."attractions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."attractions"."experience_categories" IS 'Array of experience category tags (e.g., museum, street_food, viewpoint)';



COMMENT ON COLUMN "public"."attractions"."vibe" IS 'Array of vibe descriptors (e.g., touristy, local, hidden_gem, romantic)';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "action" "text" NOT NULL,
    "target" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action_type" "text" DEFAULT 'general'::"text",
    "actor" "text",
    "target_id" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_idempotency_cache" (
    "idempotency_key" "text" NOT NULL,
    "conversation_id" "uuid",
    "user_id" "uuid",
    "trip_id" "uuid",
    "input_hash" "text" NOT NULL,
    "response_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."chat_idempotency_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_landmarks_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city" "text" NOT NULL,
    "country" "text",
    "landmarks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL
);


ALTER TABLE "public"."city_landmarks_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "error_message" "text" NOT NULL,
    "stack_trace" "text",
    "page_path" "text",
    "component_name" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "destination" "text",
    "destination_country" "text",
    "cover_image_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "slug" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "view_count" integer DEFAULT 0,
    "like_count" integer DEFAULT 0,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "moderation_status" "text" DEFAULT 'approved'::"text",
    "editorial_content" "jsonb",
    "editorial_version" integer DEFAULT 0,
    "editorial_generated_at" timestamp with time zone,
    CONSTRAINT "community_guides_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."community_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consent_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "consent_type" "text" NOT NULL,
    "consent_version" "text" NOT NULL,
    "preferences" "jsonb",
    "consented_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "ip_hash" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."consent_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."consent_records" IS 'Stores user consent records for GDPR/CCPA compliance. Tracks cookie preferences, marketing consent, etc.';



CREATE TABLE IF NOT EXISTS "public"."cost_change_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "activity_id" "text" NOT NULL,
    "previous_cents" integer NOT NULL,
    "new_cents" integer NOT NULL,
    "reason" "text" NOT NULL,
    "activity_title" "text",
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cost_change_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_reference" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_city" "text" NOT NULL,
    "destination_country" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text",
    "item_name" "text",
    "cost_low_usd" numeric(10,2) NOT NULL,
    "cost_mid_usd" numeric(10,2) NOT NULL,
    "cost_high_usd" numeric(10,2) NOT NULL,
    "local_currency" "text",
    "cost_low_local" numeric(10,2),
    "cost_mid_local" numeric(10,2),
    "cost_high_local" numeric(10,2),
    "exchange_rate" numeric(10,4),
    "source" "text" DEFAULT 'ai_seeded'::"text" NOT NULL,
    "confidence" "text" DEFAULT 'medium'::"text" NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."cost_reference" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."creator_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "purchased_credits" bigint DEFAULT 0 NOT NULL,
    "free_credits" bigint DEFAULT 0 NOT NULL,
    "free_credits_expires_at" timestamp with time zone,
    "last_free_credit_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credit_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "credits_delta" integer NOT NULL,
    "is_free_credit" boolean DEFAULT false NOT NULL,
    "action_type" "text",
    "trip_id" "uuid",
    "activity_id" "uuid",
    "stripe_session_id" "text",
    "stripe_product_id" "text",
    "price_id" "text",
    "amount_cents" integer,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idempotency_key" "text"
);


ALTER TABLE "public"."credit_ledger" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."credit_ledger_safe" WITH ("security_invoker"='on') AS
 SELECT "id",
    "user_id",
    "transaction_type",
    "credits_delta",
    "is_free_credit",
    "action_type",
    "trip_id",
    "activity_id",
    "notes",
    "metadata",
    "created_at"
   FROM "public"."credit_ledger";


ALTER VIEW "public"."credit_ledger_safe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "remaining" integer NOT NULL,
    "expires_at" timestamp with time zone,
    "source" "text",
    "stripe_session_id" "text",
    "club_tier" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_purchases_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "credit_purchases_credit_type_check" CHECK (("credit_type" = ANY (ARRAY['flex'::"text", 'club_base'::"text", 'club_bonus'::"text", 'free_monthly'::"text", 'signup_bonus'::"text", 'referral_bonus'::"text", 'migration'::"text", 'topup'::"text", 'manual_grant'::"text", 'refund'::"text"]))),
    CONSTRAINT "credit_purchases_remaining_check" CHECK (("remaining" >= 0))
);


ALTER TABLE "public"."credit_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "action_key" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_transactions_type_check" CHECK (("type" = ANY (ARRAY['topup'::"text", 'spend'::"text"])))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curated_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_key" "text" NOT NULL,
    "destination" "text",
    "source" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "alt_text" "text",
    "attribution" "text",
    "quality_score" double precision,
    "photo_reference" "text",
    "place_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "vote_score" integer DEFAULT 0,
    "vote_count" integer DEFAULT 0,
    "is_blacklisted" boolean DEFAULT false,
    "user_report_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."curated_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_review_contacts" (
    "review_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_review_contacts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customer_review_contacts"."email" IS 'PII — never expose via any anon-readable policy, view, or RPC. Owner-only access via RLS.';



CREATE TABLE IF NOT EXISTS "public"."customer_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "rating" integer NOT NULL,
    "review_text" "text" NOT NULL,
    "trip_destination" "text",
    "archetype" "text",
    "is_featured" boolean DEFAULT false,
    "is_approved" boolean DEFAULT false,
    "photo_consent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."customer_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."day_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "purchased_days" integer DEFAULT 0 NOT NULL,
    "free_days" integer DEFAULT 0 NOT NULL,
    "free_days_expires_at" timestamp with time zone,
    "active_tier" "text",
    "swaps_remaining" integer,
    "regenerates_remaining" integer,
    "monthly_swaps_used" integer DEFAULT 0 NOT NULL,
    "monthly_regenerates_used" integer DEFAULT 0 NOT NULL,
    "monthly_reset_at" timestamp with time zone DEFAULT ("date_trunc"('month'::"text", "now"()) + '1 mon'::interval) NOT NULL,
    "last_free_day_earned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "day_balances_active_tier_check" CHECK (("active_tier" = ANY (ARRAY['essential'::"text", 'complete'::"text"])))
);


ALTER TABLE "public"."day_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."day_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "days_delta" integer NOT NULL,
    "is_free_day" boolean DEFAULT false NOT NULL,
    "stripe_session_id" "text",
    "stripe_product_id" "text",
    "price_id" "text",
    "amount_cents" integer,
    "package_tier" "text",
    "package_days" integer,
    "trip_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "day_ledger_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['purchase'::"text", 'free_monthly'::"text", 'free_expired'::"text", 'consumed'::"text", 'refund'::"text", 'migration'::"text"])))
);


ALTER TABLE "public"."day_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destination_cost_index" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city" "text" NOT NULL,
    "country" "text" NOT NULL,
    "cost_multiplier" numeric(4,2) DEFAULT 1.0 NOT NULL,
    "breakfast_base_usd" numeric(8,2) DEFAULT 15.00,
    "lunch_base_usd" numeric(8,2) DEFAULT 25.00,
    "dinner_base_usd" numeric(8,2) DEFAULT 45.00,
    "coffee_base_usd" numeric(8,2) DEFAULT 5.00,
    "activity_base_usd" numeric(8,2) DEFAULT 30.00,
    "museum_base_usd" numeric(8,2) DEFAULT 20.00,
    "tour_base_usd" numeric(8,2) DEFAULT 75.00,
    "transport_base_usd" numeric(8,2) DEFAULT 15.00,
    "tax_tip_buffer" numeric(4,2) DEFAULT 0.18,
    "source" "text" DEFAULT 'manual'::"text",
    "confidence_score" numeric(3,2) DEFAULT 0.7,
    "last_verified_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."destination_cost_index" OWNER TO "postgres";


COMMENT ON TABLE "public"."destination_cost_index" IS 'Cost-of-living multipliers and base prices for defensible activity/dining pricing estimates';



CREATE TABLE IF NOT EXISTS "public"."destination_fallbacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "tagline" "text" NOT NULL,
    "description" "text" NOT NULL,
    "preview_days" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."destination_fallbacks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destination_image_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination_slug" "text" NOT NULL,
    "image_type" "text" DEFAULT 'hero'::"text" NOT NULL,
    "original_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "storage_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval) NOT NULL
);


ALTER TABLE "public"."destination_image_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destination_insights_cache" (
    "destination" "text" NOT NULL,
    "insights" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval) NOT NULL
);


ALTER TABLE "public"."destination_insights_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city" "text" NOT NULL,
    "country" "text" NOT NULL,
    "region" "text",
    "timezone" "text",
    "currency_code" "text",
    "description" "text",
    "temperature_range" "text",
    "seasonality" "text",
    "best_time_to_visit" "text",
    "cost_tier" "text",
    "known_for" "jsonb" DEFAULT '[]'::"jsonb",
    "points_of_interest" "jsonb" DEFAULT '[]'::"jsonb",
    "stock_image_url" "text",
    "featured" boolean DEFAULT false,
    "tier" integer DEFAULT 1,
    "alternative_names" "jsonb" DEFAULT '[]'::"jsonb",
    "safe_search_keywords" "jsonb" DEFAULT '[]'::"jsonb",
    "default_transport_modes" "jsonb" DEFAULT '[]'::"jsonb",
    "dynamic_weather" "jsonb",
    "dynamic_currency_conversion" "jsonb",
    "seasonal_events" "jsonb" DEFAULT '{}'::"jsonb",
    "last_content_update" timestamp with time zone,
    "last_weather_update" timestamp with time zone,
    "last_currency_update" timestamp with time zone,
    "population" integer DEFAULT 0,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "google_place_id" "text",
    "airport_codes" "jsonb",
    "currency_data" "jsonb",
    "weather_data" "jsonb",
    "enrichment_status" "jsonb" DEFAULT '{}'::"jsonb",
    "last_enriched" timestamp with time zone,
    "enrichment_priority" integer DEFAULT 0,
    "coordinates" "jsonb",
    "airport_lookup_codes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "airport_transfer_minutes" integer DEFAULT 45,
    "local_tips" "jsonb" DEFAULT '[]'::"jsonb",
    "safety_tips" "jsonb" DEFAULT '[]'::"jsonb",
    "getting_around" "text",
    "best_neighborhoods" "jsonb" DEFAULT '[]'::"jsonb",
    "food_scene" "text",
    "nightlife_info" "text",
    "dress_code" "text",
    "tipping_custom" "text",
    "common_scams" "jsonb" DEFAULT '[]'::"jsonb",
    "emergency_numbers" "jsonb",
    "last_local_knowledge_update" timestamp with time zone,
    "enriched_at" timestamp with time zone,
    "hero_image_url" "text",
    "enrichment_expires_at" timestamp with time zone
);


ALTER TABLE "public"."destinations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."destinations"."airport_transfer_minutes" IS 'Estimated transfer time from main airport to city center in minutes';



CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "currency_code" "text" NOT NULL,
    "rate_to_usd" numeric(12,6) NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_splits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "percentage" numeric(5,2),
    "is_paid" boolean DEFAULT false NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_via_settlement" "uuid"
);


ALTER TABLE "public"."expense_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "value_type" "text" DEFAULT 'boolean'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_prompt_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "prompt_id" "uuid",
    "prompt_type" "public"."feedback_prompt_type" NOT NULL,
    "activity_id" "uuid",
    "day_number" integer,
    "shown_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_prompt_log_action_check" CHECK (("action" = ANY (ARRAY['shown'::"text", 'dismissed'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."feedback_prompt_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prompt_type" "public"."feedback_prompt_type" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "archetype_relevance" "text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feedback_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_commission_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "source_reference" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_amount_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "line_count" integer DEFAULT 0 NOT NULL,
    "matched_count" integer DEFAULT 0 NOT NULL,
    "unmatched_count" integer DEFAULT 0 NOT NULL,
    "file_name" "text",
    "file_url" "text",
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_data" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "finance_commission_imports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."finance_commission_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_ledger_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "trip_id" "uuid",
    "segment_id" "uuid",
    "invoice_id" "uuid",
    "entry_type" "public"."finance_entry_type" NOT NULL,
    "entry_source" "public"."finance_entry_source" DEFAULT 'manual'::"public"."finance_entry_source" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "memo" "text",
    "stripe_payment_intent_id" "text",
    "stripe_charge_id" "text",
    "stripe_refund_id" "text",
    "stripe_transfer_id" "text",
    "stripe_payout_id" "text",
    "stripe_dispute_id" "text",
    "external_reference" "text",
    "effective_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."finance_ledger_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_payout_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payout_run_id" "uuid",
    "agent_id" "uuid" NOT NULL,
    "trip_id" "uuid",
    "segment_id" "uuid",
    "ledger_entry_id" "uuid",
    "description" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "source_type" "text",
    "source_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_payout_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_payout_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_amount_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "line_count" integer DEFAULT 0 NOT NULL,
    "stripe_transfer_id" "text",
    "stripe_payout_id" "text",
    "scheduled_for" "date",
    "initiated_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "finance_payout_runs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."finance_payout_runs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."finance_trip_profit_summary" WITH ("security_invoker"='true') AS
 SELECT "t"."id" AS "trip_id",
    "t"."agent_id",
    "t"."name" AS "trip_name",
    "t"."currency",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'client_charge'::"public"."finance_entry_type") THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint) AS "total_client_charges_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'client_payment'::"public"."finance_entry_type") THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint) AS "total_client_payments_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = ANY (ARRAY['client_refund'::"public"."finance_entry_type", 'client_credit'::"public"."finance_entry_type"])) THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint) AS "total_refunds_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'supplier_payable'::"public"."finance_entry_type") THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint) AS "total_supplier_costs_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'supplier_payment'::"public"."finance_entry_type") THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint) AS "total_supplier_paid_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'commission_expected'::"public"."finance_entry_type") THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint) AS "commission_expected_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'commission_received'::"public"."finance_entry_type") THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint) AS "commission_received_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'platform_fee'::"public"."finance_entry_type") THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint) AS "platform_fees_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'stripe_fee'::"public"."finance_entry_type") THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint) AS "stripe_fees_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'agent_earning'::"public"."finance_entry_type") THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint) AS "agent_earnings_cents",
    COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'agent_payout'::"public"."finance_entry_type") THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint) AS "agent_paid_out_cents",
    ((((COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'client_payment'::"public"."finance_entry_type") THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint) - COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'supplier_payment'::"public"."finance_entry_type") THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint)) - COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = ANY (ARRAY['client_refund'::"public"."finance_entry_type", 'client_credit'::"public"."finance_entry_type"])) THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint)) + COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'commission_received'::"public"."finance_entry_type") THEN "e"."amount_cents"
            ELSE 0
        END), (0)::bigint)) - COALESCE("sum"(
        CASE
            WHEN ("e"."entry_type" = 'stripe_fee'::"public"."finance_entry_type") THEN "abs"("e"."amount_cents")
            ELSE 0
        END), (0)::bigint)) AS "trip_gross_profit_cents"
   FROM ("public"."agency_trips" "t"
     LEFT JOIN "public"."finance_ledger_entries" "e" ON (("e"."trip_id" = "t"."id")))
  GROUP BY "t"."id", "t"."agent_id", "t"."name", "t"."currency";


ALTER VIEW "public"."finance_trip_profit_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."founding_member_tracker" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "purchase_number" integer NOT NULL,
    "awarded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_session_id" "text"
);


ALTER TABLE "public"."founding_member_tracker" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."free_tier_status" (
    "user_id" "uuid" NOT NULL,
    "free_trip_used" boolean DEFAULT false NOT NULL,
    "free_edits_remaining" integer DEFAULT 5 NOT NULL,
    "free_trip_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."free_tier_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "status" "public"."friendship_status" DEFAULT 'pending'::"public"."friendship_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "friendships_check" CHECK (("requester_id" <> "addressee_id"))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "total_duration_ms" integer,
    "status" "text",
    "phase_timings" "jsonb" DEFAULT '{}'::"jsonb",
    "day_timings" "jsonb" DEFAULT '[]'::"jsonb",
    "errors" "jsonb" DEFAULT '[]'::"jsonb",
    "num_days" integer,
    "num_guests" integer,
    "destination" "text",
    "model_used" "text",
    "prompt_token_count" integer,
    "completion_token_count" integer,
    "current_phase" "text",
    "progress_pct" integer DEFAULT 0,
    CONSTRAINT "generation_logs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."generation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."geocoding_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "query_key" "text" NOT NULL,
    "address" "text" NOT NULL,
    "destination" "text",
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "formatted_address" "text",
    "place_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval) NOT NULL
);


ALTER TABLE "public"."geocoding_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."geocoding_cache" IS 'Caches Google Geocoding API responses to reduce API costs. Entries expire after 90 days.';



CREATE TABLE IF NOT EXISTS "public"."google_api_budget" (
    "day" "date" DEFAULT CURRENT_DATE NOT NULL,
    "call_count" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric DEFAULT 0 NOT NULL,
    "breaker_open" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."google_api_budget" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_places_search_cache" (
    "cache_key" "text" NOT NULL,
    "text_query" "text" NOT NULL,
    "location_bias" "jsonb",
    "included_type" "text",
    "field_mask" "text" NOT NULL,
    "response_data" "jsonb" NOT NULL,
    "result_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "hit_count" integer DEFAULT 0 NOT NULL,
    "last_hit_at" timestamp with time zone
);


ALTER TABLE "public"."google_places_search_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_budget_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_budget_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "credits_spent" integer NOT NULL,
    "was_free" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_budget_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "initial_credits" integer NOT NULL,
    "remaining_credits" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "group_budgets_tier_check" CHECK (("tier" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text"])))
);


ALTER TABLE "public"."group_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_unlocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "purchased_by" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "stripe_session_id" "text",
    "caps" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "usage" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_unlocks_tier_check" CHECK (("tier" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text"])))
);


ALTER TABLE "public"."group_unlocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_activity_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_name" "text" NOT NULL,
    "activity_category" "text",
    "destination_city" "text" NOT NULL,
    "rating" integer,
    "recommended" boolean,
    "experience_text" "text",
    "photo_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "guide_activity_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."guide_activity_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_content_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "day_number" integer,
    "activity_id" "text",
    "activity_name" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guide_content_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "activity_id" "text" NOT NULL,
    "note" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guide_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "followed_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "guide_follows_check" CHECK (("follower_id" <> "followed_id"))
);


ALTER TABLE "public"."guide_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_manual_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'activity'::"text" NOT NULL,
    "description" "text",
    "external_url" "text",
    "day_number" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guide_manual_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "reporter_id" "uuid",
    "reason" "text" NOT NULL,
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guide_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "section_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "linked_day_number" integer,
    "linked_activity_id" "uuid",
    "activity_title" "text",
    "activity_category" "text",
    "activity_location" "text",
    "activity_tips" "text",
    "activity_rating" numeric,
    "activity_cost" "text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_experience" "text",
    "user_rating" integer,
    "recommended" "text",
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "guide_sections_section_type_check" CHECK (("section_type" = ANY (ARRAY['day_overview'::"text", 'activity'::"text", 'recommendation'::"text", 'tip'::"text", 'freeform'::"text"])))
);


ALTER TABLE "public"."guide_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "author" "text",
    "image_url" "text",
    "excerpt" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "category" "text",
    "reading_time" integer,
    "destination_city" "text",
    "destination_country" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "featured" boolean DEFAULT false,
    "published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "trip_id" "uuid",
    "guide_type" "text" DEFAULT 'editorial'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "archetype" "text",
    "vibe_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "duration_days" integer,
    "like_count" integer DEFAULT 0,
    "view_count" integer DEFAULT 0,
    CONSTRAINT "guides_guide_type_check" CHECK (("guide_type" = ANY (ARRAY['editorial'::"text", 'user'::"text"]))),
    CONSTRAINT "guides_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'flagged'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."iap_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_id" "text" NOT NULL,
    "product_id" "text" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "verified_at" timestamp with time zone,
    "credits_granted" integer,
    "raw_receipt" "jsonb"
);


ALTER TABLE "public"."iap_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_quality_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination" "text",
    "image_url" "text" NOT NULL,
    "source" "text",
    "rejected_reason" "text",
    "llm_score" numeric,
    "basic_check_result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."image_quality_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "entity_type" "text" DEFAULT 'destination'::"text" NOT NULL,
    "entity_key" "text" NOT NULL,
    "vote" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "image_votes_vote_check" CHECK (("vote" = ANY (ARRAY['good'::"text", 'bad'::"text"])))
);


ALTER TABLE "public"."image_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_failure_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempted_token" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "user_agent" "text",
    "referrer" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invite_failure_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itinerary_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "itinerary_day_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "title" "text" NOT NULL,
    "name" "text",
    "description" "text",
    "category" "text",
    "start_time" "text",
    "end_time" "text",
    "duration_minutes" integer,
    "location" "jsonb",
    "cost" "jsonb",
    "tags" "text"[],
    "is_locked" boolean DEFAULT false NOT NULL,
    "booking_required" boolean DEFAULT false,
    "tips" "text",
    "photos" "jsonb",
    "walking_distance" "text",
    "walking_time" "text",
    "transportation" "jsonb",
    "rating" "jsonb",
    "website" "text",
    "viator_product_code" "text",
    "extra_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_id" "text",
    "suggested_for" "text"
);


ALTER TABLE "public"."itinerary_activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."itinerary_activities"."suggested_for" IS 'Comma-separated user IDs of travelers whose DNA most influenced this activity';



CREATE TABLE IF NOT EXISTS "public"."itinerary_customization_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "user_message" "text" NOT NULL,
    "extracted_preferences" "jsonb",
    "action_taken" "text",
    "activity_id" "uuid",
    "conversation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."itinerary_customization_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itinerary_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "day_number" integer NOT NULL,
    "date" "date" NOT NULL,
    "title" "text",
    "theme" "text",
    "description" "text",
    "narrative" "jsonb",
    "weather" "jsonb",
    "estimated_walking_time" "text",
    "estimated_distance" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activities" "jsonb" DEFAULT '[]'::"jsonb",
    "day_brief" "jsonb"
);


ALTER TABLE "public"."itinerary_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itinerary_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "source_destination" "text",
    "source_trip_id" "uuid",
    "template_data" "jsonb" NOT NULL,
    "day_count" integer DEFAULT 1 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "trip_type" "text",
    "pace" "text",
    "use_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."itinerary_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itinerary_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "day_number" integer NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "activities" "jsonb" NOT NULL,
    "day_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_action" "text",
    "is_current" boolean DEFAULT false,
    "dna_snapshot" "jsonb"
);


ALTER TABLE "public"."itinerary_versions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."itinerary_versions"."dna_snapshot" IS 'Snapshot of user Travel DNA profile used for this specific generation';



CREATE TABLE IF NOT EXISTS "public"."page_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "page_path" "text" NOT NULL,
    "page_title" "text",
    "referrer" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "element_id" "text",
    "element_text" "text",
    "scroll_depth" integer,
    "time_on_page_ms" integer,
    "viewport_width" integer,
    "viewport_height" integer,
    "device_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."page_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_credit_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "credits_amount" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    "refund_attempts" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "pending_credit_charges_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'refunded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."pending_credit_charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personalization_tag_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag" "text" NOT NULL,
    "destination" "text",
    "shown_count" integer DEFAULT 0,
    "saved_count" integer DEFAULT 0,
    "completed_count" integer DEFAULT 0,
    "swapped_count" integer DEFAULT 0,
    "skipped_count" integer DEFAULT 0,
    "retention_rate" numeric(5,4) DEFAULT 0,
    "rejection_rate" numeric(5,4) DEFAULT 0,
    "first_seen_at" timestamp with time zone DEFAULT "now"(),
    "last_updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."personalization_tag_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."personalization_tag_stats" IS 'Aggregated statistics on personalization tag effectiveness based on user behavior';



COMMENT ON COLUMN "public"."personalization_tag_stats"."retention_rate" IS 'Percentage of activities with this tag that were kept (saved + completed)';



COMMENT ON COLUMN "public"."personalization_tag_stats"."rejection_rate" IS 'Percentage of activities with this tag that were rejected (swapped + skipped)';



CREATE TABLE IF NOT EXISTS "public"."plan_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "text" NOT NULL,
    "flag_id" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "value_number" integer,
    "value_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."plan_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "stripe_price_id" "text",
    "is_addon" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "handle" "text",
    "display_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "home_airport" "text",
    "preferred_currency" "text" DEFAULT 'USD'::"text",
    "preferred_language" "text" DEFAULT 'en'::"text",
    "quiz_completed" boolean DEFAULT false,
    "travel_dna" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "travel_dna_overrides" "jsonb",
    "first_trip_used" boolean DEFAULT false NOT NULL,
    "onboarding_state" "jsonb" DEFAULT '{}'::"jsonb",
    "pattern_group" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profiles linked to auth.users. The id column matches auth.users.id. Email is denormalized here for display purposes.';



COMMENT ON COLUMN "public"."profiles"."travel_dna_overrides" IS 'User-specified trait overrides from refinement UI';



COMMENT ON COLUMN "public"."profiles"."first_trip_used" IS 'Set to true only after first trip generation completes successfully. Prevents crashed trips from consuming the first-trip free benefit.';



COMMENT ON COLUMN "public"."profiles"."pattern_group" IS 'DNA pattern group: packed, social, balanced, indulgent, gentle. Set on quiz completion.';



CREATE OR REPLACE VIEW "public"."profiles_friends" WITH ("security_invoker"='on') AS
 SELECT "id",
    "handle",
    "display_name",
    "avatar_url",
    "bio"
   FROM "public"."profiles";


ALTER VIEW "public"."profiles_friends" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_public" WITH ("security_invoker"='on') AS
 SELECT "id",
    "handle",
    "display_name",
    "avatar_url"
   FROM "public"."profiles"
  WHERE ("handle" IS NOT NULL);


ALTER VIEW "public"."profiles_public" OWNER TO "postgres";


COMMENT ON VIEW "public"."profiles_public" IS 'Public-safe profile view for discovery. Only exposes minimal fields. No security_invoker so authenticated users can search profiles.';



CREATE OR REPLACE VIEW "public"."profiles_safe" WITH ("security_invoker"='on') AS
 SELECT "id",
    "handle",
    "display_name",
    "avatar_url",
    "preferred_currency",
    "preferred_language",
    "quiz_completed",
    "travel_dna",
    "created_at",
    "updated_at"
   FROM "public"."profiles";


ALTER VIEW "public"."profiles_safe" OWNER TO "postgres";


COMMENT ON VIEW "public"."profiles_safe" IS 'Safe view of profiles excluding PII fields (first_name, last_name, bio, home_airport). Use this view for general profile queries. The profiles_public view is for friend discovery (minimal fields only).';



CREATE OR REPLACE VIEW "public"."public_customer_reviews" WITH ("security_barrier"='true', "security_invoker"='on') AS
 SELECT "id",
    "name" AS "reviewer_name",
    "rating",
    "review_text",
    "trip_destination",
    "archetype",
    "is_featured",
    "photo_consent",
    "created_at"
   FROM "public"."customer_reviews" "cr"
  WHERE ("is_approved" = true);


ALTER VIEW "public"."public_customer_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission" "text" DEFAULT 'view'::"text" NOT NULL,
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "include_preferences" boolean DEFAULT true,
    CONSTRAINT "trip_collaborators_permission_check" CHECK (("permission" = ANY (ARRAY['view'::"text", 'edit'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."trip_collaborators" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trip_collaborators"."include_preferences" IS 'Whether to include this collaborator preferences in itinerary generation blending';



CREATE OR REPLACE VIEW "public"."public_trip_collaborators" WITH ("security_barrier"='true', "security_invoker"='true') AS
 SELECT "tc"."id",
    "tc"."trip_id",
    "tc"."user_id",
    "tc"."permission" AS "role",
    "tc"."accepted_at",
    "tc"."created_at",
    COALESCE("p"."display_name", ('Member '::"text" || SUBSTRING(("tc"."id")::"text" FROM 1 FOR 8))) AS "member_display",
    "p"."avatar_url"
   FROM ("public"."trip_collaborators" "tc"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "tc"."user_id")))
  WHERE ((EXISTS ( SELECT 1
           FROM "public"."trips" "t"
          WHERE (("t"."id" = "tc"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."trip_collaborators" "me"
          WHERE (("me"."trip_id" = "tc"."trip_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."accepted_at" IS NOT NULL)))));


ALTER VIEW "public"."public_trip_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "role" "public"."trip_member_role" DEFAULT 'attendee'::"public"."trip_member_role" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_trip_members" WITH ("security_barrier"='true', "security_invoker"='on') AS
 SELECT "tm"."id",
    "tm"."trip_id",
    "tm"."user_id",
    "tm"."name",
    "tm"."role",
    "tm"."invited_at",
    "tm"."accepted_at",
    COALESCE("p"."display_name", "tm"."name", ('Member '::"text" || SUBSTRING(("tm"."id")::"text" FROM 1 FOR 8))) AS "member_display",
    "p"."avatar_url"
   FROM ("public"."trip_members" "tm"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "tm"."user_id")))
  WHERE ((EXISTS ( SELECT 1
           FROM "public"."trips" "t"
          WHERE (("t"."id" = "tm"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."trip_members" "me"
          WHERE (("me"."trip_id" = "tm"."trip_id") AND ("me"."user_id" = "auth"."uid"())))));


ALTER VIEW "public"."public_trip_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" DEFAULT 'ios'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "quiz_version" "text" DEFAULT 'v3'::"text",
    "field_id" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "answer_value" "text" NOT NULL,
    "display_label" "text",
    "step_id" "text",
    "question_prompt" "text",
    "response_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quiz_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quiz_version" "text" DEFAULT 'v3'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "current_step" integer DEFAULT 1,
    "total_steps" integer DEFAULT 11,
    "completion_percentage" integer DEFAULT 0,
    "status" "text" DEFAULT 'in_progress'::"text",
    "user_agent" "text",
    "device_type" "text",
    "is_complete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quiz_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_address" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_limits" IS 'Rate limiting table with intentionally permissive service role policies to support edge function rate limiting for anonymous users';



CREATE TABLE IF NOT EXISTS "public"."referral_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "trip_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."referral_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "referee_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "referrer_credited" boolean DEFAULT false NOT NULL,
    "referee_credited" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referrals_no_self_referral" CHECK (("referrer_id" <> "referee_id"))
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."route_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "origin_lat" numeric(9,6) NOT NULL,
    "origin_lng" numeric(9,6) NOT NULL,
    "dest_lat" numeric(9,6) NOT NULL,
    "dest_lng" numeric(9,6) NOT NULL,
    "travel_mode" "text" DEFAULT 'TRANSIT'::"text" NOT NULL,
    "cache_key" "text" GENERATED ALWAYS AS (((((((((("round"(("origin_lat")::numeric, 3))::"text" || ','::"text") || ("round"(("origin_lng")::numeric, 3))::"text") || '→'::"text") || ("round"(("dest_lat")::numeric, 3))::"text") || ','::"text") || ("round"(("dest_lng")::numeric, 3))::"text") || ':'::"text") || "travel_mode")) STORED,
    "distance_meters" integer,
    "duration_text" "text",
    "duration_seconds" integer,
    "steps_json" "jsonb",
    "transit_details_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval),
    "hit_count" integer DEFAULT 0
);


ALTER TABLE "public"."route_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "text" NOT NULL,
    "item_data" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "saved_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['destination'::"text", 'experience'::"text", 'itinerary'::"text", 'activity'::"text"])))
);


ALTER TABLE "public"."saved_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "search_type" "text" NOT NULL,
    "search_key" "text" NOT NULL,
    "origin" "text",
    "destination" "text" NOT NULL,
    "depart_date" "date",
    "return_date" "date",
    "adults" integer DEFAULT 1,
    "cabin_class" "text",
    "result_count" integer DEFAULT 0,
    "results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'amadeus'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '04:00:00'::interval) NOT NULL,
    CONSTRAINT "search_cache_search_type_check" CHECK (("search_type" = ANY (ARRAY['flight'::"text", 'hotel'::"text"])))
);


ALTER TABLE "public"."search_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_cache" IS 'Search caching table with service role access for edge function caching';



COMMENT ON COLUMN "public"."search_cache"."search_key" IS 'SHA-256 hash of normalized search parameters for deduplication';



COMMENT ON COLUMN "public"."search_cache"."results" IS 'JSONB array of flight or hotel results from Amadeus';



CREATE TABLE IF NOT EXISTS "public"."site_image_mappings" (
    "photo_id" "text" NOT NULL,
    "original_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "storage_url" "text" NOT NULL,
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_image_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb",
    "result" "text",
    "error_message" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_webhook_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suggestion_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "suggestion_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suggestion_votes_vote_check" CHECK (("vote" = ANY (ARRAY['for'::"text", 'against'::"text"])))
);


ALTER TABLE "public"."suggestion_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trait_drift_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ran_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sample_size" integer NOT NULL,
    "deltas" "jsonb" NOT NULL,
    "before_scores" "jsonb",
    "after_scores" "jsonb"
);


ALTER TABLE "public"."trait_drift_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travel_dna_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_snapshot" "jsonb" NOT NULL,
    "quiz_session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."travel_dna_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travel_dna_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "primary_archetype_name" "text",
    "secondary_archetype_name" "text",
    "dna_confidence_score" integer,
    "dna_rarity" "text",
    "trait_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "tone_tags" "text"[] DEFAULT '{}'::"text"[],
    "emotional_drivers" "text"[] DEFAULT '{}'::"text"[],
    "summary" "text",
    "calculated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "travel_dna_v2" "jsonb",
    "dna_version" smallint DEFAULT 1,
    "trait_contributions" "jsonb",
    "archetype_matches" "jsonb",
    "perfect_trip_preview" "text",
    "derivation_source" "text" DEFAULT 'quiz'::"text" NOT NULL,
    "disambiguation_resolved_at" timestamp with time zone,
    "disambiguation_question_id" "text",
    "disambiguation_answer_id" "text",
    "dna_recalc_needed_at" timestamp with time zone,
    CONSTRAINT "travel_dna_profiles_derivation_source_chk" CHECK (("derivation_source" = ANY (ARRAY['quiz'::"text", 'conversation'::"text", 'merged'::"text"])))
);


ALTER TABLE "public"."travel_dna_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."travel_dna_profiles"."travel_dna_v2" IS 'Full Travel DNA v2 output including raw scores, contributions, and archetype blends';



COMMENT ON COLUMN "public"."travel_dna_profiles"."dna_version" IS 'Version of DNA calculation algorithm: 1=legacy, 2=v2 with blends';



COMMENT ON COLUMN "public"."travel_dna_profiles"."trait_contributions" IS 'Array of answer contributions to each trait for transparency';



COMMENT ON COLUMN "public"."travel_dna_profiles"."archetype_matches" IS 'Top 5 archetype matches with scores and percentages';



COMMENT ON COLUMN "public"."travel_dna_profiles"."disambiguation_resolved_at" IS 'Timestamp when user resolved the DNA disambiguation question. NULL = not yet resolved or not needed.';



COMMENT ON COLUMN "public"."travel_dna_profiles"."dna_recalc_needed_at" IS 'When non-null, client should re-run recalculateArchetype() on next load and clear this. Set by gate-change rollouts.';



CREATE TABLE IF NOT EXISTS "public"."travel_guides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "cover_image_url" "text",
    "destination" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "selected_activities" "jsonb" DEFAULT '[]'::"jsonb",
    "selected_photos" "text"[] DEFAULT '{}'::"text"[],
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."travel_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travel_intel_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "destination" "text" NOT NULL,
    "start_date" "text" NOT NULL,
    "end_date" "text" NOT NULL,
    "request_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "intel_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."travel_intel_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travel_intel_locks" (
    "lock_key" "text" NOT NULL,
    "locked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."travel_intel_locks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_action_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_action_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid",
    "itinerary_day_id" "uuid",
    "type" "text" DEFAULT 'activity'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "venue_id" "uuid",
    "location" "text",
    "address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "place_id" "text",
    "block_order" integer DEFAULT 0,
    "locked" boolean DEFAULT false,
    "recommendation_score" numeric,
    "added_by_user" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "booking_status" "text" DEFAULT 'not_booked'::"text",
    "booking_required" boolean DEFAULT false,
    "cost" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "operating_hours" "jsonb",
    "transportation" "jsonb",
    "verified" boolean DEFAULT false,
    "verification_confidence" integer,
    "rating_value" numeric,
    "rating_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text",
    "external_booking_url" "text",
    "external_booking_id" "text",
    "booking_state" "public"."booking_item_state" DEFAULT 'not_selected'::"public"."booking_item_state",
    "quote_id" "text",
    "quote_price_cents" integer,
    "quote_expires_at" timestamp with time zone,
    "quote_locked" boolean DEFAULT false,
    "confirmation_number" "text",
    "voucher_url" "text",
    "voucher_data" "jsonb",
    "cancellation_policy" "jsonb",
    "modification_policy" "jsonb",
    "booked_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "refund_amount_cents" integer,
    "traveler_data" "jsonb",
    "vendor_name" "text",
    "vendor_booking_id" "text",
    "state_history" "jsonb" DEFAULT '[]'::"jsonb",
    "is_client_visible" boolean DEFAULT true,
    "user_rating" "text",
    "user_feedback_at" timestamp with time zone
);


ALTER TABLE "public"."trip_activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trip_activities"."is_client_visible" IS 'When false, activity is hidden from client/shared views';



CREATE TABLE IF NOT EXISTS "public"."trip_blogs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "cover_image_url" "text",
    "content" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "social_links" "jsonb" DEFAULT '[]'::"jsonb",
    "slug" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "destination" "text",
    "trip_dates" "text",
    "traveler_count" integer DEFAULT 1,
    "trip_duration_days" integer,
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_blogs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_budget_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "category" character varying(50) NOT NULL,
    "entry_type" character varying(20) NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "description" "text",
    "day_number" integer,
    "activity_id" "text",
    "external_booking_id" "text",
    "confidence" character varying(10) DEFAULT 'medium'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_budget_ledger_confidence_check" CHECK ((("confidence")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::"text"[]))),
    CONSTRAINT "trip_budget_ledger_entry_type_check" CHECK ((("entry_type")::"text" = ANY ((ARRAY['committed'::character varying, 'planned'::character varying, 'adjustment'::character varying])::"text"[])))
);


ALTER TABLE "public"."trip_budget_ledger" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."trip_budget_summary" WITH ("security_invoker"='on') AS
 SELECT "t"."id" AS "trip_id",
    "t"."budget_total_cents",
    "t"."budget_currency",
    "t"."travelers",
        CASE
            WHEN ("t"."travelers" > 0) THEN ("t"."budget_total_cents" / "t"."travelers")
            ELSE "t"."budget_total_cents"
        END AS "budget_per_person_cents",
    "t"."budget_include_hotel",
    "t"."budget_include_flight",
    "t"."budget_allocations",
    COALESCE("sum"(
        CASE
            WHEN ((("l"."entry_type")::"text" = 'committed'::"text") AND (("l"."category")::"text" = 'hotel'::"text")) THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "committed_hotel_cents",
    COALESCE("sum"(
        CASE
            WHEN ((("l"."entry_type")::"text" = 'committed'::"text") AND (("l"."category")::"text" = 'flight'::"text")) THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "committed_flight_cents",
    COALESCE("sum"(
        CASE
            WHEN ((("l"."entry_type")::"text" = 'committed'::"text") AND (("l"."category")::"text" <> ALL ((ARRAY['hotel'::character varying, 'flight'::character varying])::"text"[]))) THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "committed_other_cents",
    COALESCE("sum"(
        CASE
            WHEN (("l"."entry_type")::"text" = 'planned'::"text") THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "planned_total_cents",
    COALESCE("sum"(
        CASE
            WHEN ((("l"."entry_type")::"text" = 'planned'::"text") AND (("l"."category")::"text" = 'food'::"text")) THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "planned_food_cents",
    COALESCE("sum"(
        CASE
            WHEN ((("l"."entry_type")::"text" = 'planned'::"text") AND (("l"."category")::"text" = 'activities'::"text")) THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "planned_activities_cents",
    COALESCE("sum"(
        CASE
            WHEN ((("l"."entry_type")::"text" = 'planned'::"text") AND (("l"."category")::"text" = 'transit'::"text")) THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "planned_transit_cents",
    COALESCE("sum"(
        CASE
            WHEN (("l"."entry_type")::"text" = 'committed'::"text") THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint) AS "total_committed_cents",
    ("t"."budget_total_cents" - ((
        CASE
            WHEN "t"."budget_include_hotel" THEN COALESCE("sum"(
            CASE
                WHEN ((("l"."entry_type")::"text" = 'committed'::"text") AND (("l"."category")::"text" = 'hotel'::"text")) THEN "l"."amount_cents"
                ELSE NULL::integer
            END), (0)::bigint)
            ELSE (0)::bigint
        END +
        CASE
            WHEN "t"."budget_include_flight" THEN COALESCE("sum"(
            CASE
                WHEN ((("l"."entry_type")::"text" = 'committed'::"text") AND (("l"."category")::"text" = 'flight'::"text")) THEN "l"."amount_cents"
                ELSE NULL::integer
            END), (0)::bigint)
            ELSE (0)::bigint
        END) + COALESCE("sum"(
        CASE
            WHEN ((("l"."entry_type")::"text" = 'committed'::"text") AND (("l"."category")::"text" <> ALL ((ARRAY['hotel'::character varying, 'flight'::character varying])::"text"[]))) THEN "l"."amount_cents"
            ELSE NULL::integer
        END), (0)::bigint))) AS "remaining_cents"
   FROM ("public"."trips" "t"
     LEFT JOIN "public"."trip_budget_ledger" "l" ON (("l"."trip_id" = "t"."id")))
  WHERE ("t"."budget_total_cents" IS NOT NULL)
  GROUP BY "t"."id", "t"."budget_total_cents", "t"."budget_currency", "t"."travelers", "t"."budget_include_hotel", "t"."budget_include_flight", "t"."budget_allocations";


ALTER VIEW "public"."trip_budget_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "trip_type" "text" DEFAULT 'consumer'::"text" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_chat_messages_trip_type_check" CHECK (("trip_type" = ANY (ARRAY['consumer'::"text", 'agency'::"text"])))
);


ALTER TABLE "public"."trip_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "city_order" integer DEFAULT 0 NOT NULL,
    "city_name" "text" NOT NULL,
    "country" "text",
    "destination_id" "uuid",
    "slug" "text",
    "arrival_date" "date",
    "departure_date" "date",
    "nights" integer,
    "hotel_selection" "jsonb",
    "hotel_cost_cents" integer DEFAULT 0,
    "transport_type" "text",
    "transport_details" "jsonb",
    "transport_cost_cents" integer DEFAULT 0,
    "transport_currency" "text" DEFAULT 'USD'::"text",
    "generation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "days_generated" integer DEFAULT 0,
    "days_total" integer DEFAULT 0,
    "itinerary_data" "jsonb",
    "activity_cost_cents" integer DEFAULT 0,
    "dining_cost_cents" integer DEFAULT 0,
    "misc_cost_cents" integer DEFAULT 0,
    "total_cost_cents" integer GENERATED ALWAYS AS (((((COALESCE("hotel_cost_cents", 0) + COALESCE("transport_cost_cents", 0)) + COALESCE("activity_cost_cents", 0)) + COALESCE("dining_cost_cents", 0)) + COALESCE("misc_cost_cents", 0))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transition_day_mode" "text" DEFAULT 'half_and_half'::"text",
    "arrival_transfer" "jsonb",
    "departure_transfer" "jsonb",
    "allocated_budget_cents" integer DEFAULT 0,
    CONSTRAINT "trip_cities_transition_day_mode_check" CHECK (("transition_day_mode" = ANY (ARRAY['half_and_half'::"text", 'skip'::"text"])))
);


ALTER TABLE "public"."trip_cities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trip_cities"."arrival_transfer" IS 'Selected arrival transfer for this city in a multi-city trip';



COMMENT ON COLUMN "public"."trip_cities"."departure_transfer" IS 'Selected departure transfer for this city in a multi-city trip';



CREATE TABLE IF NOT EXISTS "public"."trip_complexity" (
    "trip_id" "uuid" NOT NULL,
    "factor_count" integer DEFAULT 0 NOT NULL,
    "tier" "text" DEFAULT 'standard'::"text" NOT NULL,
    "multiplier" numeric(3,2) DEFAULT 1.00 NOT NULL,
    "factors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "base_credits" integer DEFAULT 0 NOT NULL,
    "multi_city_fee" integer DEFAULT 0 NOT NULL,
    "total_credits" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_complexity_tier_check" CHECK (("tier" = ANY (ARRAY['standard'::"text", 'custom'::"text", 'highly_curated'::"text"])))
);


ALTER TABLE "public"."trip_complexity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_cost_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid",
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "model" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "google_places_calls" integer DEFAULT 0 NOT NULL,
    "google_geocoding_calls" integer DEFAULT 0 NOT NULL,
    "google_photos_calls" integer DEFAULT 0 NOT NULL,
    "google_routes_calls" integer DEFAULT 0 NOT NULL,
    "amadeus_calls" integer DEFAULT 0 NOT NULL,
    "perplexity_calls" integer DEFAULT 0 NOT NULL,
    "estimated_cost_usd" numeric(10,6),
    "duration_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cost_category" "public"."cost_category" DEFAULT 'other'::"public"."cost_category",
    "token_source" "text" DEFAULT 'unknown'::"text",
    "is_cache_hit" boolean DEFAULT false NOT NULL,
    "attempt_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "retry_of" "uuid",
    "google_place_details_calls" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."trip_cost_tracking" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."trip_cost_summary" WITH ("security_invoker"='true') AS
 SELECT "action_type",
    "model",
    "count"(*) AS "total_calls",
    "avg"("input_tokens") AS "avg_input_tokens",
    "avg"("output_tokens") AS "avg_output_tokens",
    "avg"("google_places_calls") AS "avg_google_places",
    "avg"("google_geocoding_calls") AS "avg_google_geocoding",
    "avg"("google_photos_calls") AS "avg_google_photos",
    "avg"("google_routes_calls") AS "avg_google_routes",
    "avg"("amadeus_calls") AS "avg_amadeus",
    "avg"("perplexity_calls") AS "avg_perplexity",
    "avg"("estimated_cost_usd") AS "avg_cost_usd",
    "sum"("estimated_cost_usd") AS "total_cost_usd",
    "avg"("duration_ms") AS "avg_duration_ms",
    "min"("created_at") AS "first_call",
    "max"("created_at") AS "last_call"
   FROM "public"."trip_cost_tracking"
  GROUP BY "action_type", "model";


ALTER VIEW "public"."trip_cost_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_date_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "start_date" "text" NOT NULL,
    "end_date" "text" NOT NULL,
    "day_count" integer NOT NULL,
    "itinerary_data" "jsonb",
    "hotel_selection" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by_action" "text" DEFAULT 'date_change'::"text",
    "restored_at" timestamp with time zone,
    "times_restored" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "label" "text"
);


ALTER TABLE "public"."trip_date_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_day_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "day_number" integer,
    "date" "date",
    "destination" "text",
    "source_entry_point" "text" NOT NULL,
    "intent_kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "raw_text" "text",
    "start_time" "text",
    "end_time" "text",
    "priority" "text" DEFAULT 'should'::"text" NOT NULL,
    "locked" boolean DEFAULT false NOT NULL,
    "locked_source" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "fulfilled_activity_id" "text",
    "fulfilled_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_day_intents_kind_chk" CHECK (("intent_kind" = ANY (ARRAY['restaurant'::"text", 'dinner'::"text", 'lunch'::"text", 'breakfast'::"text", 'drinks'::"text", 'activity'::"text", 'event'::"text", 'spa'::"text", 'transport'::"text", 'avoid'::"text", 'constraint'::"text", 'note'::"text"]))),
    CONSTRAINT "trip_day_intents_priority_chk" CHECK (("priority" = ANY (ARRAY['must'::"text", 'should'::"text", 'avoid'::"text"]))),
    CONSTRAINT "trip_day_intents_source_chk" CHECK (("source_entry_point" = ANY (ARRAY['chat_planner'::"text", 'fine_tune'::"text", 'manual_paste'::"text", 'manual_add'::"text", 'assistant_chat'::"text", 'pin'::"text", 'edit'::"text", 'system'::"text"]))),
    CONSTRAINT "trip_day_intents_status_chk" CHECK (("status" = ANY (ARRAY['active'::"text", 'fulfilled'::"text", 'superseded'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."trip_day_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_day_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "day_number" integer NOT NULL,
    "day_date" "date" NOT NULL,
    "pacing_rating" "text",
    "highlight_activity_id" "uuid",
    "highlight_text" "text",
    "energy_level" integer,
    "overall_rating" integer,
    "notes" "text",
    "weather_experience" "text",
    "unexpected_discoveries" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_day_summaries_energy_level_check" CHECK ((("energy_level" >= 1) AND ("energy_level" <= 5))),
    CONSTRAINT "trip_day_summaries_overall_rating_check" CHECK ((("overall_rating" >= 1) AND ("overall_rating" <= 5))),
    CONSTRAINT "trip_day_summaries_pacing_rating_check" CHECK (("pacing_rating" = ANY (ARRAY['too_rushed'::"text", 'just_right'::"text", 'too_slow'::"text"])))
);


ALTER TABLE "public"."trip_day_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_departure_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "archetype_fit" "text",
    "highlight_activities" "uuid"[],
    "would_change" "text"[],
    "best_meal_activity_id" "uuid",
    "best_experience_activity_id" "uuid",
    "overall_trip_rating" integer,
    "would_recommend" boolean,
    "recommend_score" integer,
    "final_thoughts" "text",
    "suggestions_for_destination" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_departure_summaries_archetype_fit_check" CHECK (("archetype_fit" = ANY (ARRAY['nailed_it'::"text", 'mostly'::"text", 'somewhat'::"text", 'missed_the_mark'::"text"]))),
    CONSTRAINT "trip_departure_summaries_overall_trip_rating_check" CHECK ((("overall_trip_rating" >= 1) AND ("overall_trip_rating" <= 5))),
    CONSTRAINT "trip_departure_summaries_recommend_score_check" CHECK ((("recommend_score" >= 0) AND ("recommend_score" <= 10)))
);


ALTER TABLE "public"."trip_departure_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "planned_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "actual_amount" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "split_type" "public"."expense_split_type" DEFAULT 'equal'::"public"."expense_split_type" NOT NULL,
    "paid_by_member_id" "uuid",
    "payment_status" "public"."payment_status_enum" DEFAULT 'pending'::"public"."payment_status_enum" NOT NULL,
    "paid_at" timestamp with time zone,
    "external_item_id" "text",
    "external_item_type" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."trip_expenses" IS 'Visible to all trip participants by design for group budgeting transparency. Trip owners have full management access.';



CREATE TABLE IF NOT EXISTS "public"."trip_feedback_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "prompt_id" "uuid",
    "prompt_type" "public"."feedback_prompt_type" NOT NULL,
    "activity_id" "uuid",
    "day_number" integer,
    "responses" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "location" "jsonb",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dismissed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_feedback_responses" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."trip_finance_ledger" WITH ("security_invoker"='on') AS
 SELECT "trip_id",
    "agent_id",
    COALESCE("sum"("sell_price_cents"), (0)::numeric) AS "total_client_charges_cents",
    COALESCE("sum"(
        CASE
            WHEN ("settlement_type" = 'supplier_direct'::"public"."booking_settlement_type") THEN "net_cost_cents"
            ELSE (0)::bigint
        END), (0)::numeric) AS "total_supplier_owed_cents",
    COALESCE("sum"(
        CASE
            WHEN ("settlement_type" = 'supplier_direct'::"public"."booking_settlement_type") THEN "supplier_paid_cents"
            ELSE (0)::bigint
        END), (0)::numeric) AS "total_supplier_paid_cents",
    COALESCE("sum"("commission_expected_cents"), (0)::numeric) AS "total_commission_expected_cents",
    COALESCE("sum"("commission_received_cents"), (0)::numeric) AS "total_commission_received_cents",
    "count"(
        CASE
            WHEN ("settlement_type" = 'arc_bsp'::"public"."booking_settlement_type") THEN 1
            ELSE NULL::integer
        END) AS "arc_bsp_count",
    "count"(
        CASE
            WHEN ("settlement_type" = 'supplier_direct'::"public"."booking_settlement_type") THEN 1
            ELSE NULL::integer
        END) AS "supplier_direct_count",
    "count"(
        CASE
            WHEN ("settlement_type" = 'commission_track'::"public"."booking_settlement_type") THEN 1
            ELSE NULL::integer
        END) AS "commission_track_count"
   FROM "public"."agency_booking_segments"
  GROUP BY "trip_id", "agent_id";


ALTER VIEW "public"."trip_finance_ledger" OWNER TO "postgres";


COMMENT ON VIEW "public"."trip_finance_ledger" IS 'Aggregated financial ledger by trip showing A/R, A/P, and commission balances - uses security_invoker for RLS';



CREATE TABLE IF NOT EXISTS "public"."trip_generation_llm_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trace_id" "uuid" NOT NULL,
    "day_number" integer,
    "call_purpose" "text",
    "model" "text",
    "temperature" numeric,
    "prompt_text" "text",
    "response_text" "text",
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "latency_ms" integer,
    "finish_reason" "text",
    "retry_count" integer DEFAULT 0,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_generation_llm_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_generation_mutations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trace_id" "uuid" NOT NULL,
    "day_number" integer,
    "activity_external_id" "text",
    "activity_title" "text",
    "field" "text" NOT NULL,
    "before_value" "jsonb",
    "after_value" "jsonb",
    "stage" "text",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_generation_mutations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_generation_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trace_id" "uuid" NOT NULL,
    "day_number" integer,
    "stage_name" "text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_ms" integer,
    "status" "text" DEFAULT 'ok'::"text" NOT NULL,
    "inputs" "jsonb",
    "outputs" "jsonb",
    "notes" "text"[],
    "error" "text"
);


ALTER TABLE "public"."trip_generation_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_generation_traces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "trigger_source" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "total_duration_ms" integer,
    "final_status" "text",
    "user_request_snapshot" "jsonb",
    "resolved_profile" "jsonb",
    "match_verdict" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_generation_traces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_go_back_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "category" "text" DEFAULT 'activity'::"text" NOT NULL,
    "notes" "text",
    "is_completed" boolean DEFAULT false NOT NULL,
    "reminder_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_go_back_list_category_check" CHECK (("category" = ANY (ARRAY['restaurant'::"text", 'activity'::"text", 'place'::"text", 'event'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."trip_go_back_list" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "intent_type" "text" NOT NULL,
    "intent_value" "text" NOT NULL,
    "confidence" "text" DEFAULT 'explicit'::"text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "token" "text" DEFAULT "public"."generate_share_token"() NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'attendee'::"text" NOT NULL,
    "max_uses" integer DEFAULT 1,
    "uses_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "replaced_at" timestamp with time zone
);


ALTER TABLE "public"."trip_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_learnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "destination" "text",
    "overall_rating" integer,
    "would_return" boolean,
    "highlights" "jsonb" DEFAULT '[]'::"jsonb",
    "pacing_feedback" "text",
    "accommodation_feedback" "text",
    "pain_points" "jsonb" DEFAULT '[]'::"jsonb",
    "skipped_activities" "jsonb" DEFAULT '[]'::"jsonb",
    "discovered_likes" "text"[],
    "discovered_dislikes" "text"[],
    "lessons_summary" "text",
    "travel_party_notes" "text",
    "best_time_of_day" "text",
    "would_change" "text",
    "tips_for_others" "text",
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "summary_source" "text" DEFAULT 'ai'::"text",
    CONSTRAINT "trip_learnings_accommodation_feedback_check" CHECK (("accommodation_feedback" = ANY (ARRAY['loved_it'::"text", 'good_location'::"text", 'would_change'::"text", 'too_far'::"text"]))),
    CONSTRAINT "trip_learnings_best_time_of_day_check" CHECK (("best_time_of_day" = ANY (ARRAY['morning_person'::"text", 'afternoon_explorer'::"text", 'evening_adventurer'::"text", 'flexible'::"text"]))),
    CONSTRAINT "trip_learnings_overall_rating_check" CHECK ((("overall_rating" >= 1) AND ("overall_rating" <= 5))),
    CONSTRAINT "trip_learnings_pacing_feedback_check" CHECK (("pacing_feedback" = ANY (ARRAY['too_rushed'::"text", 'perfect'::"text", 'too_slow'::"text", 'varied_needs'::"text"])))
);


ALTER TABLE "public"."trip_learnings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."trip_members_safe" WITH ("security_invoker"='on') AS
 SELECT "id",
    "trip_id",
    "user_id",
    "name",
        CASE
            WHEN "public"."is_trip_owner"("trip_id") THEN "email"
            WHEN ("user_id" = "auth"."uid"()) THEN "email"
            ELSE '***@***.***'::"text"
        END AS "email",
    "role",
    "invited_at",
    "accepted_at",
    "created_at",
    "updated_at"
   FROM "public"."trip_members" "tm";


ALTER VIEW "public"."trip_members_safe" OWNER TO "postgres";


COMMENT ON VIEW "public"."trip_members_safe" IS 'Safe view of trip_members that masks email addresses. Only trip owners and the member themselves can see full email addresses. Other participants see masked emails for privacy.';



CREATE TABLE IF NOT EXISTS "public"."trip_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "activity_id" "text",
    "activity_name" "text",
    "image_url" "text" NOT NULL,
    "caption" "text",
    "location_name" "text",
    "taken_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "day_number" integer
);


ALTER TABLE "public"."trip_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "note_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "location" "text",
    "day_number" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_notes_note_type_check" CHECK (("note_type" = ANY (ARRAY['memory'::"text", 'tip'::"text", 'saved_place'::"text", 'regret'::"text", 'discovery'::"text"])))
);


ALTER TABLE "public"."trip_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "sent" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read" boolean DEFAULT false,
    "scheduled_for" timestamp with time zone DEFAULT "now"(),
    "sent_date" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."trip_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "text" NOT NULL,
    "item_name" "text" NOT NULL,
    "external_provider" "text",
    "external_booking_id" "text",
    "external_booking_url" "text",
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_checkout_session_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_member_id" "uuid",
    "archived_at" timestamp with time zone,
    "archived_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "trip_payments_item_type_check" CHECK (("item_type" = ANY (ARRAY['flight'::"text", 'hotel'::"text", 'activity'::"text", 'dining'::"text", 'transport'::"text", 'shopping'::"text", 'other'::"text"]))),
    CONSTRAINT "trip_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."trip_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."trip_payments" IS 'Tracks payment status for all trip components (flights, hotels, activities)';



COMMENT ON COLUMN "public"."trip_payments"."item_type" IS 'Type of item: flight, hotel, or activity';



COMMENT ON COLUMN "public"."trip_payments"."status" IS 'Payment status: pending, processing, paid, failed, refunded, cancelled';



COMMENT ON COLUMN "public"."trip_payments"."assigned_member_id" IS 'The trip member responsible for paying this item';



CREATE TABLE IF NOT EXISTS "public"."trip_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size_bytes" integer,
    "mime_type" "text",
    "caption" "text",
    "taken_at" timestamp with time zone,
    "day_number" integer,
    "activity_id" "uuid",
    "location" "jsonb",
    "is_favorite" boolean DEFAULT false,
    "is_cover" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_rental_cars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rental_company" "text",
    "car_type" "text",
    "pickup_location" "text",
    "pickup_date" "date",
    "pickup_time" time without time zone,
    "dropoff_location" "text",
    "dropoff_date" "date",
    "dropoff_time" time without time zone,
    "daily_rate" numeric(10,2),
    "total_cost" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "confirmation_number" "text",
    "booking_url" "text",
    "insurance_included" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_rental_cars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "overall_rating" smallint NOT NULL,
    "value_rating" smallint,
    "experience_rating" smallint,
    "location_rating" smallint,
    "food_rating" smallint,
    "highlight_label" "text",
    "highlight_text" "text",
    "review_text" "text",
    "photo_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_reviews_experience_rating_check" CHECK ((("experience_rating" >= 1) AND ("experience_rating" <= 5))),
    CONSTRAINT "trip_reviews_food_rating_check" CHECK ((("food_rating" >= 1) AND ("food_rating" <= 5))),
    CONSTRAINT "trip_reviews_location_rating_check" CHECK ((("location_rating" >= 1) AND ("location_rating" <= 5))),
    CONSTRAINT "trip_reviews_overall_rating_check" CHECK ((("overall_rating" >= 1) AND ("overall_rating" <= 5))),
    CONSTRAINT "trip_reviews_value_rating_check" CHECK ((("value_rating" >= 1) AND ("value_rating" <= 5)))
);


ALTER TABLE "public"."trip_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "from_member_id" "uuid" NOT NULL,
    "to_member_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "is_settled" boolean DEFAULT false NOT NULL,
    "settled_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settled_split_ids" "uuid"[]
);


ALTER TABLE "public"."trip_settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_suggestion_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "suggestion_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "voter_name" "text" NOT NULL,
    "vote_type" "text" DEFAULT 'up'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_suggestion_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "trip_type" "text" DEFAULT 'consumer'::"text" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "suggestion_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "target_activity_id" "text",
    "target_activity_title" "text",
    "replacement_reason" "text",
    "vote_deadline" timestamp with time zone,
    "owner_decision" "text",
    "owner_decided_at" timestamp with time zone,
    "votes_for" integer DEFAULT 0 NOT NULL,
    "votes_against" integer DEFAULT 0 NOT NULL,
    "auto_applied" boolean DEFAULT false NOT NULL,
    CONSTRAINT "trip_suggestions_owner_decision_check" CHECK (("owner_decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text", NULL::"text"])))
);


ALTER TABLE "public"."trip_suggestions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."trip_suggestions"."target_activity_id" IS 'ID of the itinerary activity being proposed for replacement';



COMMENT ON COLUMN "public"."trip_suggestions"."target_activity_title" IS 'Title of the activity being replaced (for display)';



COMMENT ON COLUMN "public"."trip_suggestions"."replacement_reason" IS 'Reason the proposer wants to replace this activity';



COMMENT ON COLUMN "public"."trip_suggestions"."vote_deadline" IS 'Optional deadline by which group members should vote on this suggestion';



CREATE OR REPLACE VIEW "public"."trips_with_audit_violations" WITH ("security_invoker"='true') AS
 SELECT "t"."id" AS "trip_id",
    "t"."user_id",
    "t"."destination",
    (((("t"."metadata" -> 'quality'::"text") -> 'read_time_audit'::"text") ->> 'at'::"text"))::timestamp with time zone AS "audited_at",
    "v"."code",
    "v"."severity",
    "v"."day_number",
    "v"."detail",
    COALESCE("v"."activity_ids", '[]'::"jsonb") AS "activity_ids",
    (NULLIF(((("t"."metadata" -> 'quality'::"text") -> 'read_time_audit'::"text") ->> 'parity_delta'::"text"), ''::"text"))::integer AS "parity_delta",
    (NULLIF(((("t"."metadata" -> 'quality'::"text") -> 'read_time_audit'::"text") ->> 'json_activity_count'::"text"), ''::"text"))::integer AS "json_activity_count",
    (NULLIF(((("t"."metadata" -> 'quality'::"text") -> 'read_time_audit'::"text") ->> 'table_activity_count'::"text"), ''::"text"))::integer AS "table_activity_count"
   FROM ("public"."trips" "t"
     CROSS JOIN LATERAL ( SELECT ("elem"."value" ->> 'code'::"text") AS "code",
            ("elem"."value" ->> 'severity'::"text") AS "severity",
            (NULLIF(("elem"."value" ->> 'dayNumber'::"text"), ''::"text"))::integer AS "day_number",
            ("elem"."value" ->> 'detail'::"text") AS "detail",
            ("elem"."value" -> 'activityIds'::"text") AS "activity_ids"
           FROM "jsonb_array_elements"(COALESCE(((("t"."metadata" -> 'quality'::"text") -> 'read_time_audit'::"text") -> 'violations'::"text"), '[]'::"jsonb")) "elem"("value")) "v")
  WHERE (("t"."metadata" ? 'quality'::"text") AND (("t"."metadata" -> 'quality'::"text") ? 'read_time_audit'::"text"));


ALTER VIEW "public"."trips_with_audit_violations" OWNER TO "postgres";


COMMENT ON VIEW "public"."trips_with_audit_violations" IS 'One row per timing audit violation. Sourced from trips.metadata.quality.read_time_audit (audit-trip-timing edge fn). security_invoker=true so RLS on trips applies to caller.';



CREATE OR REPLACE VIEW "public"."trips_with_chronology_issues" WITH ("security_invoker"='true') AS
 SELECT "id" AS "trip_id",
    "user_id",
    "destination",
    "itinerary_status",
    (((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") ->> 'at'::"text"))::timestamp with time zone AS "traced_at",
    (((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") ->> 'issues_pre'::"text"))::integer AS "issues_pre",
    (((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") ->> 'issues_post'::"text"))::integer AS "issues_post",
    (((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") ->> 'sorted_days'::"text"))::integer AS "sorted_days",
    (((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") ->> 'dropped'::"text"))::integer AS "dropped",
    (((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") ->> 'critical_after_heal'::"text"))::boolean AS "critical_after_heal",
    ((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") -> 'sample'::"text") AS "sample"
   FROM "public"."trips"
  WHERE (((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") IS NOT NULL) AND ((((("metadata" -> 'quality'::"text") -> 'chronology_trace'::"text") ->> 'critical_after_heal'::"text"))::boolean = true));


ALTER VIEW "public"."trips_with_chronology_issues" OWNER TO "postgres";


COMMENT ON VIEW "public"."trips_with_chronology_issues" IS 'Trips whose last persist boundary recorded a critical chronology issue (predawn non-bookend / backward jump) that survived auto-heal. Target: 0 rows.';



CREATE OR REPLACE VIEW "public"."trips_with_orphan_preferences" WITH ("security_invoker"='true') AS
 SELECT "id" AS "trip_id",
    "user_id",
    "destination",
    "start_date",
    "itinerary_status",
    ("metadata" ->> 'additionalNotes'::"text") AS "additional_notes",
    "jsonb_array_length"(COALESCE(("metadata" -> 'mustDoActivities'::"text"), '[]'::"jsonb")) AS "must_do_count",
    "jsonb_array_length"(COALESCE(("metadata" -> 'perDayActivities'::"text"), '[]'::"jsonb")) AS "per_day_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."trip_day_intents" "tdi"
          WHERE (("tdi"."trip_id" = "t"."id") AND ("tdi"."status" = 'active'::"text"))) AS "active_intents_count",
    "updated_at"
   FROM "public"."trips" "t"
  WHERE (("status" <> 'cancelled'::"public"."trip_status") AND ((COALESCE(NULLIF(("metadata" ->> 'additionalNotes'::"text"), ''::"text"), ''::"text") <> ''::"text") OR ("jsonb_array_length"(COALESCE(("metadata" -> 'mustDoActivities'::"text"), '[]'::"jsonb")) > 0) OR ("jsonb_array_length"(COALESCE(("metadata" -> 'perDayActivities'::"text"), '[]'::"jsonb")) > 0)) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."trip_day_intents" "tdi"
          WHERE (("tdi"."trip_id" = "t"."id") AND ("tdi"."status" = 'active'::"text"))))));


ALTER VIEW "public"."trips_with_orphan_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_type" "text" NOT NULL,
    "awarded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credit_bonuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bonus_type" "text" NOT NULL,
    "credits_granted" integer NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_credit_bonuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_credit_bonuses" IS 'Tracks credit bonuses claimed by users. bonus_type values: welcome, launch, quiz_completion, preferences_completion, first_share, second_itinerary';



CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "user_id" "uuid" NOT NULL,
    "balance_cents" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_enrichment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enrichment_type" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "text",
    "entity_name" "text",
    "feedback_reason" "text",
    "feedback_tags" "text"[],
    "decline_count" integer DEFAULT 1,
    "suppress_until" timestamp with time zone,
    "is_permanent_suppress" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "interaction_count" integer DEFAULT 1,
    "action_type" "text"
);


ALTER TABLE "public"."user_enrichment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_entitlement_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "flag_id" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "value_number" integer,
    "value_json" "jsonb",
    "reason" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_entitlement_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preference_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "loved_activity_types" "jsonb" DEFAULT '{}'::"jsonb",
    "disliked_activity_types" "jsonb" DEFAULT '{}'::"jsonb",
    "loved_categories" "jsonb" DEFAULT '{}'::"jsonb",
    "disliked_categories" "jsonb" DEFAULT '{}'::"jsonb",
    "preferred_times" "jsonb" DEFAULT '{}'::"jsonb",
    "preferred_pace" "text",
    "feedback_count" integer DEFAULT 0,
    "last_analysis_at" timestamp with time zone,
    "insights_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_preference_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "travel_pace" "text" DEFAULT 'moderate'::"text",
    "budget_tier" "text" DEFAULT 'moderate'::"text",
    "accommodation_style" "text" DEFAULT 'standard_hotel'::"text",
    "dietary_restrictions" "text"[] DEFAULT '{}'::"text"[],
    "mobility_needs" "text",
    "interests" "text"[] DEFAULT '{}'::"text"[],
    "home_airport" "text",
    "preferred_airlines" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quiz_completed" boolean DEFAULT false,
    "quiz_version" "text" DEFAULT 'v3'::"text",
    "completed_at" timestamp with time zone,
    "primary_goal" "text",
    "traveler_type" "text",
    "travel_vibes" "text"[] DEFAULT '{}'::"text"[],
    "emotional_drivers" "text"[] DEFAULT '{}'::"text"[],
    "travel_style" "text",
    "travel_frequency" "text",
    "trip_duration" "text",
    "schedule_flexibility" "text",
    "trip_structure_preference" "text",
    "travel_companions" "text"[] DEFAULT '{}'::"text"[],
    "preferred_group_size" "text",
    "communication_style" "text",
    "hotel_style" "text",
    "hotel_vs_flight" "text",
    "flight_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "loyalty_programs" "text"[] DEFAULT '{}'::"text"[],
    "direct_flights_only" boolean DEFAULT true,
    "airport_radius_miles" integer,
    "preferred_regions" "text"[] DEFAULT '{}'::"text"[],
    "climate_preferences" "text"[] DEFAULT '{}'::"text"[],
    "weather_preferences" "text"[] DEFAULT '{}'::"text"[],
    "mobility_level" "text",
    "accessibility_needs" "text"[] DEFAULT '{}'::"text"[],
    "dining_style" "text",
    "food_likes" "text"[] DEFAULT '{}'::"text"[],
    "food_dislikes" "text"[] DEFAULT '{}'::"text"[],
    "budget_range" "jsonb" DEFAULT '{}'::"jsonb",
    "personal_notes" "text",
    "eco_friendly" boolean DEFAULT false,
    "vibe" "text",
    "activity_weights" "jsonb" DEFAULT '{}'::"jsonb",
    "sleep_schedule" "text",
    "daytime_bias" "text",
    "downtime_ratio" "text",
    "seat_preference" "text",
    "flight_time_preference" "text",
    "planning_preference" "text",
    "activity_level" "text",
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT false,
    "marketing_emails" boolean DEFAULT false,
    "trip_reminders" boolean DEFAULT true,
    "price_alerts" boolean DEFAULT true,
    "phone_number" "text",
    "enable_gap_filling" boolean DEFAULT true,
    "enable_route_optimization" boolean DEFAULT true,
    "enable_real_transport" boolean DEFAULT true,
    "enable_geocoding" boolean DEFAULT false,
    "enable_venue_verification" boolean DEFAULT false,
    "enable_cost_lookup" boolean DEFAULT true,
    "preferred_downtime_minutes" integer DEFAULT 30,
    "max_activities_per_day" integer DEFAULT 6,
    "budget_alerts" boolean DEFAULT true,
    "travel_agent_mode" boolean DEFAULT false,
    "agent_business_name" "text",
    "agent_business_email" "text",
    "stripe_connect_account_id" "text",
    "stripe_connect_status" "text" DEFAULT 'not_started'::"text",
    "stripe_connect_onboarding_complete" boolean DEFAULT false,
    "stripe_payout_schedule" "text" DEFAULT 'manual'::"text",
    "commission_split_config" "jsonb" DEFAULT '{"payout_method": "via_host", "is_host_agency": false, "split_applies_to": "all", "agent_split_percent": 80, "host_agency_split_percent": 20}'::"jsonb",
    "preferred_cabin_class" "text",
    "social_energy" "text",
    "timezone" "text",
    "avoid_categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "avoid_venues" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_preferences"."stripe_connect_account_id" IS 'Stripe Connect Express account ID for agent payouts';



COMMENT ON COLUMN "public"."user_preferences"."stripe_connect_status" IS 'Onboarding status: not_started, pending, complete, restricted';



COMMENT ON COLUMN "public"."user_preferences"."stripe_connect_onboarding_complete" IS 'Whether agent has completed Stripe identity verification';



COMMENT ON COLUMN "public"."user_preferences"."stripe_payout_schedule" IS 'Payout frequency: manual, daily, weekly, monthly';



CREATE OR REPLACE VIEW "public"."user_preferences_safe" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "travel_pace",
    "budget_tier",
    "activity_level",
    "travel_style",
    "interests",
    "travel_vibes",
    "traveler_type",
    "dietary_restrictions",
    "food_likes",
    "food_dislikes",
    "dining_style",
    "mobility_level",
    "accessibility_needs",
    "eco_friendly",
    "climate_preferences",
    "weather_preferences",
    "preferred_regions",
    "accommodation_style",
    "hotel_style",
    "planning_preference",
    "trip_structure_preference",
    "social_energy",
    "quiz_completed",
    "created_at",
    "updated_at"
   FROM "public"."user_preferences";


ALTER VIEW "public"."user_preferences_safe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'user'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_social_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_social_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_tiers" (
    "user_id" "uuid" NOT NULL,
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "first_purchase_at" timestamp with time zone,
    "highest_purchase" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_subscription_id" "text",
    "subscription_status" "text",
    "current_period_end" timestamp with time zone,
    CONSTRAINT "user_tiers_tier_check" CHECK (("tier" = ANY (ARRAY['free'::"text", 'flex'::"text", 'voyager'::"text", 'explorer'::"text", 'adventurer'::"text"])))
);


ALTER TABLE "public"."user_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metric_key" "text" NOT NULL,
    "period" "text" NOT NULL,
    "count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_usage" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_budget_by_category" WITH ("security_invoker"='on') AS
 SELECT "trip_id",
    "category",
    "sum"("cost_per_person_usd") AS "category_total_per_person_usd",
    "sum"("total_cost_usd") AS "category_total_all_travelers_usd",
    "count"(*) AS "item_count"
   FROM "public"."activity_costs"
  GROUP BY "trip_id", "category";


ALTER VIEW "public"."v_budget_by_category" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_day_totals" WITH ("security_invoker"='on') AS
 SELECT "trip_id",
    "day_number",
    "sum"("cost_per_person_usd") AS "day_total_per_person_usd",
    "sum"("total_cost_usd") AS "day_total_all_travelers_usd",
    "count"(*) AS "activity_count"
   FROM "public"."activity_costs"
  GROUP BY "trip_id", "day_number";


ALTER VIEW "public"."v_day_totals" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_google_spend_per_trip" WITH ("security_invoker"='true') AS
 SELECT "trip_id",
    "user_id",
    ("date_trunc"('day'::"text", "created_at"))::"date" AS "spend_date",
    ("sum"("google_places_calls"))::integer AS "places_calls",
    ("sum"("google_photos_calls"))::integer AS "photos_calls",
    ("sum"("google_geocoding_calls"))::integer AS "geocoding_calls",
    ("sum"("google_routes_calls"))::integer AS "routes_calls",
    "round"((("sum"("google_places_calls"))::numeric * 0.032), 4) AS "places_usd",
    "round"((("sum"("google_photos_calls"))::numeric * 0.007), 4) AS "photos_usd",
    "round"((("sum"("google_geocoding_calls"))::numeric * 0.005), 4) AS "geocoding_usd",
    "round"((("sum"("google_routes_calls"))::numeric * 0.005), 4) AS "routes_usd",
    "round"(((((("sum"("google_places_calls"))::numeric * 0.032) + (("sum"("google_photos_calls"))::numeric * 0.007)) + (("sum"("google_geocoding_calls"))::numeric * 0.005)) + (("sum"("google_routes_calls"))::numeric * 0.005)), 4) AS "total_google_usd",
    ("count"(*))::integer AS "tracking_records"
   FROM "public"."trip_cost_tracking"
  WHERE (("google_places_calls" > 0) OR ("google_photos_calls" > 0) OR ("google_geocoding_calls" > 0) OR ("google_routes_calls" > 0))
  GROUP BY "trip_id", "user_id", ("date_trunc"('day'::"text", "created_at"));


ALTER VIEW "public"."v_google_spend_per_trip" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_google_spend_per_trip" IS 'Per-trip, per-day Google API spend reconciliation view. Backed by trip_cost_tracking. Dollar values use current Google list prices and may drift from the actual invoice.';



CREATE OR REPLACE VIEW "public"."v_payments_summary" WITH ("security_invoker"='on') AS
 SELECT "trip_id",
    "sum"("total_cost_usd") AS "total_estimated_usd",
    "sum"(
        CASE
            WHEN "is_paid" THEN COALESCE("paid_amount_usd", "total_cost_usd")
            ELSE (0)::numeric
        END) AS "total_paid_usd",
    "sum"(
        CASE
            WHEN (NOT "is_paid") THEN "total_cost_usd"
            ELSE (0)::numeric
        END) AS "total_remaining_usd",
    "count"(
        CASE
            WHEN "is_paid" THEN 1
            ELSE NULL::integer
        END) AS "paid_count",
    "count"(
        CASE
            WHEN (NOT "is_paid") THEN 1
            ELSE NULL::integer
        END) AS "unpaid_count"
   FROM "public"."activity_costs"
  GROUP BY "trip_id";


ALTER VIEW "public"."v_payments_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_trip_total" WITH ("security_invoker"='on') AS
 SELECT "trip_id",
    "count"(*) AS "activity_count",
    "sum"("cost_per_person_usd") AS "total_per_person_usd",
    "sum"("total_cost_usd") AS "total_all_travelers_usd",
    "count"(DISTINCT "day_number") AS "days_with_costs"
   FROM "public"."activity_costs"
  GROUP BY "trip_id";


ALTER VIEW "public"."v_trip_total" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verified_venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "category" "text",
    "address" "text",
    "coordinates" "jsonb",
    "google_place_id" "text",
    "foursquare_id" "text",
    "viator_product_code" "text",
    "rating" numeric(2,1),
    "total_reviews" integer,
    "price_level" integer,
    "website" "text",
    "phone_number" "text",
    "opening_hours" "jsonb",
    "verification_source" "text" DEFAULT 'ai_verified'::"text" NOT NULL,
    "verification_confidence" numeric(3,2) DEFAULT 0.8,
    "last_verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verification_count" integer DEFAULT 1,
    "usage_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL
);


ALTER TABLE "public"."verified_venues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voyance_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "properties" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voyance_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."voyance_events" IS 'Analytics events for accuracy tracking and user behavior';



CREATE TABLE IF NOT EXISTS "public"."voyance_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destination" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'dining'::"text" NOT NULL,
    "description" "text",
    "why_essential" "text" NOT NULL,
    "insider_tip" "text",
    "neighborhood" "text",
    "price_range" "text",
    "best_time" "text",
    "address" "text",
    "coordinates" "jsonb",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "added_by" "text" DEFAULT 'founder'::"text",
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."voyance_picks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."achievement_unlocks"
    ADD CONSTRAINT "achievement_unlocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."achievement_unlocks"
    ADD CONSTRAINT "achievement_unlocks_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_catalog"
    ADD CONSTRAINT "activity_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_costs"
    ADD CONSTRAINT "activity_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_feedback"
    ADD CONSTRAINT "activity_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_feedback"
    ADD CONSTRAINT "activity_feedback_user_id_activity_id_key" UNIQUE ("user_id", "activity_id");



ALTER TABLE ONLY "public"."activity_quality_scores"
    ADD CONSTRAINT "activity_quality_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_accounts"
    ADD CONSTRAINT "agency_accounts_intake_token_key" UNIQUE ("intake_token");



ALTER TABLE ONLY "public"."agency_accounts"
    ADD CONSTRAINT "agency_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_booking_segments"
    ADD CONSTRAINT "agency_booking_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_communications"
    ADD CONSTRAINT "agency_communications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_documents"
    ADD CONSTRAINT "agency_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_invoices"
    ADD CONSTRAINT "agency_invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."agency_invoices"
    ADD CONSTRAINT "agency_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_payment_schedules"
    ADD CONSTRAINT "agency_payment_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_payments"
    ADD CONSTRAINT "agency_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_quotes"
    ADD CONSTRAINT "agency_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_suppliers"
    ADD CONSTRAINT "agency_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_tasks"
    ADD CONSTRAINT "agency_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_travelers"
    ADD CONSTRAINT "agency_travelers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_trip_travelers"
    ADD CONSTRAINT "agency_trip_travelers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_trip_travelers"
    ADD CONSTRAINT "agency_trip_travelers_trip_id_traveler_id_key" UNIQUE ("trip_id", "traveler_id");



ALTER TABLE ONLY "public"."agency_trips"
    ADD CONSTRAINT "agency_trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_trips"
    ADD CONSTRAINT "agency_trips_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."agent_clients"
    ADD CONSTRAINT "agent_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_itinerary_library"
    ADD CONSTRAINT "agent_itinerary_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."airport_transfer_fares"
    ADD CONSTRAINT "airport_transfer_fares_city_airport_code_key" UNIQUE ("city", "airport_code");



ALTER TABLE ONLY "public"."airport_transfer_fares"
    ADD CONSTRAINT "airport_transfer_fares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."airports"
    ADD CONSTRAINT "airports_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."airports"
    ADD CONSTRAINT "airports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archetype_destination_guides"
    ADD CONSTRAINT "archetype_destination_guides_archetype_destination_id_key" UNIQUE ("archetype", "destination_id");



ALTER TABLE ONLY "public"."archetype_destination_guides"
    ADD CONSTRAINT "archetype_destination_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archetype_pacing_stats"
    ADD CONSTRAINT "archetype_pacing_stats_archetype_trip_type_key" UNIQUE ("archetype", "trip_type");



ALTER TABLE ONLY "public"."archetype_pacing_stats"
    ADD CONSTRAINT "archetype_pacing_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attractions"
    ADD CONSTRAINT "attractions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_idempotency_cache"
    ADD CONSTRAINT "chat_idempotency_cache_pkey" PRIMARY KEY ("idempotency_key");



ALTER TABLE ONLY "public"."city_landmarks_cache"
    ADD CONSTRAINT "city_landmarks_cache_city_key" UNIQUE ("city");



ALTER TABLE ONLY "public"."city_landmarks_cache"
    ADD CONSTRAINT "city_landmarks_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_errors"
    ADD CONSTRAINT "client_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_guides"
    ADD CONSTRAINT "community_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_guides"
    ADD CONSTRAINT "community_guides_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."consent_records"
    ADD CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consent_records"
    ADD CONSTRAINT "consent_records_user_type_unique" UNIQUE ("user_id", "consent_type");



ALTER TABLE ONLY "public"."cost_change_log"
    ADD CONSTRAINT "cost_change_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_reference"
    ADD CONSTRAINT "cost_reference_destination_city_category_subcategory_item_n_key" UNIQUE ("destination_city", "category", "subcategory", "item_name");



ALTER TABLE ONLY "public"."cost_reference"
    ADD CONSTRAINT "cost_reference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_follows"
    ADD CONSTRAINT "creator_follows_follower_id_creator_id_key" UNIQUE ("follower_id", "creator_id");



ALTER TABLE ONLY "public"."creator_follows"
    ADD CONSTRAINT "creator_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_balances"
    ADD CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_balances"
    ADD CONSTRAINT "credit_balances_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."credit_ledger"
    ADD CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."curated_images"
    ADD CONSTRAINT "curated_images_entity_type_entity_key_destination_key" UNIQUE ("entity_type", "entity_key", "destination");



ALTER TABLE ONLY "public"."curated_images"
    ADD CONSTRAINT "curated_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_review_contacts"
    ADD CONSTRAINT "customer_review_contacts_pkey" PRIMARY KEY ("review_id");



ALTER TABLE ONLY "public"."customer_reviews"
    ADD CONSTRAINT "customer_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_usage"
    ADD CONSTRAINT "daily_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_usage"
    ADD CONSTRAINT "daily_usage_user_id_action_type_usage_date_key" UNIQUE ("user_id", "action_type", "usage_date");



ALTER TABLE ONLY "public"."day_balances"
    ADD CONSTRAINT "day_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."day_balances"
    ADD CONSTRAINT "day_balances_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."day_ledger"
    ADD CONSTRAINT "day_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destination_cost_index"
    ADD CONSTRAINT "destination_cost_index_city_country_key" UNIQUE ("city", "country");



ALTER TABLE ONLY "public"."destination_cost_index"
    ADD CONSTRAINT "destination_cost_index_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destination_fallbacks"
    ADD CONSTRAINT "destination_fallbacks_destination_key_key" UNIQUE ("destination_key");



ALTER TABLE ONLY "public"."destination_fallbacks"
    ADD CONSTRAINT "destination_fallbacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destination_image_cache"
    ADD CONSTRAINT "destination_image_cache_destination_slug_image_type_key" UNIQUE ("destination_slug", "image_type");



ALTER TABLE ONLY "public"."destination_image_cache"
    ADD CONSTRAINT "destination_image_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destination_insights_cache"
    ADD CONSTRAINT "destination_insights_cache_pkey" PRIMARY KEY ("destination");



ALTER TABLE ONLY "public"."destinations"
    ADD CONSTRAINT "destinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("currency_code");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_expense_id_member_id_key" UNIQUE ("expense_id", "member_id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_prompt_log"
    ADD CONSTRAINT "feedback_prompt_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_prompts"
    ADD CONSTRAINT "feedback_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_commission_imports"
    ADD CONSTRAINT "finance_commission_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_ledger_entries"
    ADD CONSTRAINT "finance_ledger_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_payout_lines"
    ADD CONSTRAINT "finance_payout_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_payout_runs"
    ADD CONSTRAINT "finance_payout_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."founding_member_tracker"
    ADD CONSTRAINT "founding_member_tracker_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."founding_member_tracker"
    ADD CONSTRAINT "founding_member_tracker_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."free_tier_status"
    ADD CONSTRAINT "free_tier_status_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_addressee_id_key" UNIQUE ("requester_id", "addressee_id");



ALTER TABLE ONLY "public"."generation_logs"
    ADD CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."geocoding_cache"
    ADD CONSTRAINT "geocoding_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."geocoding_cache"
    ADD CONSTRAINT "geocoding_cache_query_key_key" UNIQUE ("query_key");



ALTER TABLE ONLY "public"."google_api_budget"
    ADD CONSTRAINT "google_api_budget_pkey" PRIMARY KEY ("day");



ALTER TABLE ONLY "public"."google_places_search_cache"
    ADD CONSTRAINT "google_places_search_cache_pkey" PRIMARY KEY ("cache_key");



ALTER TABLE ONLY "public"."group_budget_transactions"
    ADD CONSTRAINT "group_budget_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_budgets"
    ADD CONSTRAINT "group_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_budgets"
    ADD CONSTRAINT "group_budgets_trip_id_key" UNIQUE ("trip_id");



ALTER TABLE ONLY "public"."group_unlocks"
    ADD CONSTRAINT "group_unlocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_unlocks"
    ADD CONSTRAINT "group_unlocks_trip_id_key" UNIQUE ("trip_id");



ALTER TABLE ONLY "public"."guide_activity_reviews"
    ADD CONSTRAINT "guide_activity_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_content_links"
    ADD CONSTRAINT "guide_content_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_favorites"
    ADD CONSTRAINT "guide_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_favorites"
    ADD CONSTRAINT "guide_favorites_user_id_activity_id_key" UNIQUE ("user_id", "activity_id");



ALTER TABLE ONLY "public"."guide_follows"
    ADD CONSTRAINT "guide_follows_follower_id_followed_id_key" UNIQUE ("follower_id", "followed_id");



ALTER TABLE ONLY "public"."guide_follows"
    ADD CONSTRAINT "guide_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_manual_entries"
    ADD CONSTRAINT "guide_manual_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_reports"
    ADD CONSTRAINT "guide_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_sections"
    ADD CONSTRAINT "guide_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."iap_transactions"
    ADD CONSTRAINT "iap_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."iap_transactions"
    ADD CONSTRAINT "iap_transactions_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."image_quality_log"
    ADD CONSTRAINT "image_quality_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_votes"
    ADD CONSTRAINT "image_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_votes"
    ADD CONSTRAINT "image_votes_user_id_image_url_key" UNIQUE ("user_id", "image_url");



ALTER TABLE ONLY "public"."invite_failure_log"
    ADD CONSTRAINT "invite_failure_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itinerary_activities"
    ADD CONSTRAINT "itinerary_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itinerary_customization_requests"
    ADD CONSTRAINT "itinerary_customization_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itinerary_days"
    ADD CONSTRAINT "itinerary_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itinerary_days"
    ADD CONSTRAINT "itinerary_days_trip_id_day_number_key" UNIQUE ("trip_id", "day_number");



ALTER TABLE ONLY "public"."itinerary_templates"
    ADD CONSTRAINT "itinerary_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itinerary_versions"
    ADD CONSTRAINT "itinerary_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itinerary_versions"
    ADD CONSTRAINT "itinerary_versions_trip_id_day_number_version_number_key" UNIQUE ("trip_id", "day_number", "version_number");



ALTER TABLE ONLY "public"."page_events"
    ADD CONSTRAINT "page_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_credit_charges"
    ADD CONSTRAINT "pending_credit_charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalization_tag_stats"
    ADD CONSTRAINT "personalization_tag_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalization_tag_stats"
    ADD CONSTRAINT "personalization_tag_stats_tag_destination_key" UNIQUE ("tag", "destination");



ALTER TABLE ONLY "public"."plan_entitlements"
    ADD CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_entitlements"
    ADD CONSTRAINT "plan_entitlements_plan_id_flag_id_key" UNIQUE ("plan_id", "flag_id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_platform_key" UNIQUE ("user_id", "platform");



ALTER TABLE ONLY "public"."quiz_responses"
    ADD CONSTRAINT "quiz_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_sessions"
    ADD CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."referral_codes"
    ADD CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referee_unique" UNIQUE ("referee_id");



ALTER TABLE ONLY "public"."route_cache"
    ADD CONSTRAINT "route_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_guides"
    ADD CONSTRAINT "saved_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_guides"
    ADD CONSTRAINT "saved_guides_user_id_guide_id_key" UNIQUE ("user_id", "guide_id");



ALTER TABLE ONLY "public"."saved_items"
    ADD CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_items"
    ADD CONSTRAINT "saved_items_user_id_item_type_item_id_key" UNIQUE ("user_id", "item_type", "item_id");



ALTER TABLE ONLY "public"."search_cache"
    ADD CONSTRAINT "search_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_cache"
    ADD CONSTRAINT "search_cache_search_key_key" UNIQUE ("search_key");



ALTER TABLE ONLY "public"."site_image_mappings"
    ADD CONSTRAINT "site_image_mappings_pkey" PRIMARY KEY ("photo_id");



ALTER TABLE ONLY "public"."stripe_webhook_log"
    ADD CONSTRAINT "stripe_webhook_log_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."stripe_webhook_log"
    ADD CONSTRAINT "stripe_webhook_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suggestion_votes"
    ADD CONSTRAINT "suggestion_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suggestion_votes"
    ADD CONSTRAINT "suggestion_votes_suggestion_id_user_id_key" UNIQUE ("suggestion_id", "user_id");



ALTER TABLE ONLY "public"."trait_drift_log"
    ADD CONSTRAINT "trait_drift_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_dna_history"
    ADD CONSTRAINT "travel_dna_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_dna_profiles"
    ADD CONSTRAINT "travel_dna_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_dna_profiles"
    ADD CONSTRAINT "travel_dna_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."travel_guides"
    ADD CONSTRAINT "travel_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_guides"
    ADD CONSTRAINT "travel_guides_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."travel_intel_cache"
    ADD CONSTRAINT "travel_intel_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_intel_cache"
    ADD CONSTRAINT "travel_intel_cache_trip_id_key" UNIQUE ("trip_id");



ALTER TABLE ONLY "public"."travel_intel_locks"
    ADD CONSTRAINT "travel_intel_locks_pkey" PRIMARY KEY ("lock_key");



ALTER TABLE ONLY "public"."trip_action_usage"
    ADD CONSTRAINT "trip_action_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_activities"
    ADD CONSTRAINT "trip_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_blogs"
    ADD CONSTRAINT "trip_blogs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_blogs"
    ADD CONSTRAINT "trip_blogs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."trip_budget_ledger"
    ADD CONSTRAINT "trip_budget_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_chat_messages"
    ADD CONSTRAINT "trip_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_cities"
    ADD CONSTRAINT "trip_cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_cities"
    ADD CONSTRAINT "trip_cities_trip_id_city_order_key" UNIQUE ("trip_id", "city_order");



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_trip_id_user_id_key" UNIQUE ("trip_id", "user_id");



ALTER TABLE ONLY "public"."trip_complexity"
    ADD CONSTRAINT "trip_complexity_pkey" PRIMARY KEY ("trip_id");



ALTER TABLE ONLY "public"."trip_cost_tracking"
    ADD CONSTRAINT "trip_cost_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_date_versions"
    ADD CONSTRAINT "trip_date_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_day_intents"
    ADD CONSTRAINT "trip_day_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_day_summaries"
    ADD CONSTRAINT "trip_day_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_day_summaries"
    ADD CONSTRAINT "trip_day_summaries_user_id_trip_id_day_number_key" UNIQUE ("user_id", "trip_id", "day_number");



ALTER TABLE ONLY "public"."trip_departure_summaries"
    ADD CONSTRAINT "trip_departure_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_departure_summaries"
    ADD CONSTRAINT "trip_departure_summaries_user_id_trip_id_key" UNIQUE ("user_id", "trip_id");



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_feedback_responses"
    ADD CONSTRAINT "trip_feedback_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_generation_llm_calls"
    ADD CONSTRAINT "trip_generation_llm_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_generation_mutations"
    ADD CONSTRAINT "trip_generation_mutations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_generation_stages"
    ADD CONSTRAINT "trip_generation_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_generation_traces"
    ADD CONSTRAINT "trip_generation_traces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_go_back_list"
    ADD CONSTRAINT "trip_go_back_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_intents"
    ADD CONSTRAINT "trip_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_intents"
    ADD CONSTRAINT "trip_intents_trip_id_intent_type_intent_value_key" UNIQUE ("trip_id", "intent_type", "intent_value");



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."trip_learnings"
    ADD CONSTRAINT "trip_learnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_learnings"
    ADD CONSTRAINT "trip_learnings_user_id_trip_id_key" UNIQUE ("user_id", "trip_id");



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_trip_id_email_key" UNIQUE ("trip_id", "email");



ALTER TABLE ONLY "public"."trip_memories"
    ADD CONSTRAINT "trip_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_notes"
    ADD CONSTRAINT "trip_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_notifications"
    ADD CONSTRAINT "trip_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_payments"
    ADD CONSTRAINT "trip_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_payments"
    ADD CONSTRAINT "trip_payments_unique_item_member" UNIQUE ("trip_id", "item_type", "item_id", "assigned_member_id");



ALTER TABLE ONLY "public"."trip_photos"
    ADD CONSTRAINT "trip_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_ratings"
    ADD CONSTRAINT "trip_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_ratings"
    ADD CONSTRAINT "trip_ratings_user_id_trip_id_key" UNIQUE ("user_id", "trip_id");



ALTER TABLE ONLY "public"."trip_rental_cars"
    ADD CONSTRAINT "trip_rental_cars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_reviews"
    ADD CONSTRAINT "trip_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_reviews"
    ADD CONSTRAINT "trip_reviews_user_id_trip_id_key" UNIQUE ("user_id", "trip_id");



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_suggestion_votes"
    ADD CONSTRAINT "trip_suggestion_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_suggestion_votes"
    ADD CONSTRAINT "trip_suggestion_votes_suggestion_id_user_id_key" UNIQUE ("suggestion_id", "user_id");



ALTER TABLE ONLY "public"."trip_suggestion_votes"
    ADD CONSTRAINT "trip_suggestion_votes_suggestion_id_voter_name_key" UNIQUE ("suggestion_id", "voter_name");



ALTER TABLE ONLY "public"."trip_suggestions"
    ADD CONSTRAINT "trip_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "unique_active_email_invite" UNIQUE NULLS NOT DISTINCT ("trip_id", "email");



ALTER TABLE ONLY "public"."trip_notifications"
    ADD CONSTRAINT "unique_trip_notification" UNIQUE ("trip_id", "notification_type");



ALTER TABLE ONLY "public"."trip_action_usage"
    ADD CONSTRAINT "uq_trip_action_usage" UNIQUE ("user_id", "trip_id", "action_type");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_type_key" UNIQUE ("user_id", "badge_type");



ALTER TABLE ONLY "public"."user_credit_bonuses"
    ADD CONSTRAINT "user_credit_bonuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credit_bonuses"
    ADD CONSTRAINT "user_credit_bonuses_user_id_bonus_type_key" UNIQUE ("user_id", "bonus_type");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_enrichment"
    ADD CONSTRAINT "user_enrichment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_entitlement_overrides"
    ADD CONSTRAINT "user_entitlement_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_entitlement_overrides"
    ADD CONSTRAINT "user_entitlement_overrides_user_id_flag_id_key" UNIQUE ("user_id", "flag_id");



ALTER TABLE ONLY "public"."user_preference_insights"
    ADD CONSTRAINT "user_preference_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preference_insights"
    ADD CONSTRAINT "user_preference_insights_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."user_social_links"
    ADD CONSTRAINT "user_social_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_social_links"
    ADD CONSTRAINT "user_social_links_user_id_platform_key" UNIQUE ("user_id", "platform");



ALTER TABLE ONLY "public"."user_tiers"
    ADD CONSTRAINT "user_tiers_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_usage"
    ADD CONSTRAINT "user_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_usage"
    ADD CONSTRAINT "user_usage_user_id_metric_key_period_key" UNIQUE ("user_id", "metric_key", "period");



ALTER TABLE ONLY "public"."verified_venues"
    ADD CONSTRAINT "verified_venues_google_place_id_key" UNIQUE ("google_place_id");



ALTER TABLE ONLY "public"."verified_venues"
    ADD CONSTRAINT "verified_venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voyance_events"
    ADD CONSTRAINT "voyance_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voyance_picks"
    ADD CONSTRAINT "voyance_picks_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_achievement_unlocks_achievement_id" ON "public"."achievement_unlocks" USING "btree" ("achievement_id");



CREATE INDEX "idx_achievement_unlocks_user_id" ON "public"."achievement_unlocks" USING "btree" ("user_id");



CREATE INDEX "idx_achievements_category" ON "public"."achievements" USING "btree" ("category");



CREATE INDEX "idx_activities_category" ON "public"."activities" USING "btree" ("category");



CREATE INDEX "idx_activities_dest_name" ON "public"."activities" USING "btree" ("destination_id", "name");



CREATE INDEX "idx_activities_destination_id" ON "public"."activities" USING "btree" ("destination_id");



CREATE INDEX "idx_activity_catalog_category" ON "public"."activity_catalog" USING "btree" ("category");



CREATE INDEX "idx_activity_catalog_destination" ON "public"."activity_catalog" USING "btree" ("destination_id");



CREATE INDEX "idx_activity_costs_trip" ON "public"."activity_costs" USING "btree" ("trip_id");



CREATE UNIQUE INDEX "idx_activity_costs_trip_activity" ON "public"."activity_costs" USING "btree" ("trip_id", "activity_id");



CREATE INDEX "idx_activity_costs_trip_day" ON "public"."activity_costs" USING "btree" ("trip_id", "day_number");



CREATE INDEX "idx_activity_feedback_rating" ON "public"."activity_feedback" USING "btree" ("rating");



CREATE INDEX "idx_activity_feedback_trip_id" ON "public"."activity_feedback" USING "btree" ("trip_id");



CREATE INDEX "idx_activity_feedback_user_id" ON "public"."activity_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_activity_quality_destination" ON "public"."activity_quality_scores" USING "btree" ("destination");



CREATE INDEX "idx_activity_quality_venue" ON "public"."activity_quality_scores" USING "btree" ("venue_id");



CREATE INDEX "idx_activity_reviews_activity" ON "public"."guide_activity_reviews" USING "btree" ("activity_name");



CREATE INDEX "idx_activity_reviews_destination" ON "public"."guide_activity_reviews" USING "btree" ("destination_city");



CREATE INDEX "idx_agency_accounts_agent" ON "public"."agency_accounts" USING "btree" ("agent_id");



CREATE INDEX "idx_agency_accounts_intake_token" ON "public"."agency_accounts" USING "btree" ("intake_token") WHERE ("intake_token" IS NOT NULL);



CREATE INDEX "idx_agency_booking_segments_trip" ON "public"."agency_booking_segments" USING "btree" ("trip_id");



CREATE INDEX "idx_agency_communications_trip" ON "public"."agency_communications" USING "btree" ("trip_id");



CREATE INDEX "idx_agency_documents_trip" ON "public"."agency_documents" USING "btree" ("trip_id");



CREATE INDEX "idx_agency_invoices_status" ON "public"."agency_invoices" USING "btree" ("status");



CREATE INDEX "idx_agency_invoices_trip" ON "public"."agency_invoices" USING "btree" ("trip_id");



CREATE INDEX "idx_agency_quotes_trip" ON "public"."agency_quotes" USING "btree" ("trip_id");



CREATE INDEX "idx_agency_tasks_agent" ON "public"."agency_tasks" USING "btree" ("agent_id");



CREATE INDEX "idx_agency_tasks_due" ON "public"."agency_tasks" USING "btree" ("due_date") WHERE ("status" = 'pending'::"public"."task_status");



CREATE INDEX "idx_agency_travelers_account" ON "public"."agency_travelers" USING "btree" ("account_id");



CREATE INDEX "idx_agency_travelers_agent" ON "public"."agency_travelers" USING "btree" ("agent_id");



CREATE INDEX "idx_agency_trips_account" ON "public"."agency_trips" USING "btree" ("account_id");



CREATE INDEX "idx_agency_trips_agent" ON "public"."agency_trips" USING "btree" ("agent_id");



CREATE INDEX "idx_agency_trips_share_token" ON "public"."agency_trips" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "idx_agency_trips_status" ON "public"."agency_trips" USING "btree" ("status");



CREATE INDEX "idx_agent_clients_agent_id" ON "public"."agent_clients" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_itinerary_library_agent" ON "public"."agent_itinerary_library" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_itinerary_library_tags" ON "public"."agent_itinerary_library" USING "gin" ("tags");



CREATE INDEX "idx_agent_itinerary_library_type" ON "public"."agent_itinerary_library" USING "btree" ("item_type");



CREATE INDEX "idx_airports_city" ON "public"."airports" USING "btree" ("city");



CREATE INDEX "idx_airports_code" ON "public"."airports" USING "btree" ("code");



CREATE INDEX "idx_airports_country" ON "public"."airports" USING "btree" ("country");



CREATE INDEX "idx_archetype_guides_lookup" ON "public"."archetype_destination_guides" USING "btree" ("archetype", "destination_id");



CREATE INDEX "idx_archetype_pacing" ON "public"."archetype_pacing_stats" USING "btree" ("archetype", "trip_type");



CREATE INDEX "idx_attractions_budget_level" ON "public"."attractions" USING "btree" ("budget_level");



CREATE INDEX "idx_attractions_category" ON "public"."attractions" USING "btree" ("category");



CREATE INDEX "idx_attractions_dest_name" ON "public"."attractions" USING "btree" ("destination_id", "name");



CREATE INDEX "idx_attractions_destination" ON "public"."attractions" USING "btree" ("destination_id");



CREATE INDEX "idx_attractions_experience_categories" ON "public"."attractions" USING "gin" ("experience_categories");



CREATE INDEX "idx_attractions_vibe" ON "public"."attractions" USING "gin" ("vibe");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_budget_ledger_category" ON "public"."trip_budget_ledger" USING "btree" ("trip_id", "category");



CREATE INDEX "idx_budget_ledger_day" ON "public"."trip_budget_ledger" USING "btree" ("trip_id", "day_number");



CREATE INDEX "idx_budget_ledger_trip_id" ON "public"."trip_budget_ledger" USING "btree" ("trip_id");



CREATE INDEX "idx_chat_idempotency_expires_at" ON "public"."chat_idempotency_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_city_landmarks_cache_city" ON "public"."city_landmarks_cache" USING "btree" ("lower"("city"));



CREATE INDEX "idx_client_errors_created_at" ON "public"."client_errors" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_client_errors_session_id" ON "public"."client_errors" USING "btree" ("session_id");



CREATE INDEX "idx_community_guides_status" ON "public"."community_guides" USING "btree" ("status");



CREATE INDEX "idx_community_guides_trip" ON "public"."community_guides" USING "btree" ("trip_id");



CREATE INDEX "idx_community_guides_user" ON "public"."community_guides" USING "btree" ("user_id");



CREATE INDEX "idx_consent_records_type" ON "public"."consent_records" USING "btree" ("consent_type");



CREATE INDEX "idx_consent_records_user_id" ON "public"."consent_records" USING "btree" ("user_id");



CREATE INDEX "idx_cost_change_log_trip_applied" ON "public"."cost_change_log" USING "btree" ("trip_id", "applied_at" DESC);



CREATE INDEX "idx_cost_ref_city_cat" ON "public"."cost_reference" USING "btree" ("destination_city", "category");



CREATE INDEX "idx_cost_ref_country_cat" ON "public"."cost_reference" USING "btree" ("destination_country", "category");



CREATE INDEX "idx_credit_balances_user_id" ON "public"."credit_balances" USING "btree" ("user_id");



CREATE INDEX "idx_credit_ledger_created_at" ON "public"."credit_ledger" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credit_ledger_stripe_session" ON "public"."credit_ledger" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);



CREATE INDEX "idx_credit_ledger_transaction_type" ON "public"."credit_ledger" USING "btree" ("transaction_type");



CREATE INDEX "idx_credit_ledger_user_id" ON "public"."credit_ledger" USING "btree" ("user_id");



CREATE INDEX "idx_credit_purchases_stripe" ON "public"."credit_purchases" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);



CREATE INDEX "idx_credit_purchases_user_expires" ON "public"."credit_purchases" USING "btree" ("user_id", "expires_at");



CREATE INDEX "idx_credit_purchases_user_remaining" ON "public"."credit_purchases" USING "btree" ("user_id", "remaining") WHERE ("remaining" > 0);



CREATE INDEX "idx_credit_transactions_created_at" ON "public"."credit_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credit_transactions_user_id" ON "public"."credit_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_curated_images_alt_text_lower" ON "public"."curated_images" USING "btree" ("lower"("alt_text"));



CREATE INDEX "idx_curated_images_dest_place" ON "public"."curated_images" USING "btree" ("destination", "place_id") WHERE ("place_id" IS NOT NULL);



CREATE INDEX "idx_curated_images_dest_updated" ON "public"."curated_images" USING "btree" ("destination", "entity_type", "updated_at" DESC);



CREATE INDEX "idx_curated_images_destination" ON "public"."curated_images" USING "btree" ("destination");



CREATE INDEX "idx_curated_images_lookup" ON "public"."curated_images" USING "btree" ("entity_type", "entity_key");



CREATE INDEX "idx_curated_images_report_count" ON "public"."curated_images" USING "btree" ("user_report_count") WHERE ("user_report_count" >= 3);



CREATE INDEX "idx_curated_images_source" ON "public"."curated_images" USING "btree" ("source");



CREATE INDEX "idx_customer_reviews_approved" ON "public"."customer_reviews" USING "btree" ("is_approved") WHERE ("is_approved" = true);



CREATE INDEX "idx_customer_reviews_featured" ON "public"."customer_reviews" USING "btree" ("is_featured") WHERE ("is_featured" = true);



CREATE INDEX "idx_customer_reviews_user" ON "public"."customer_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_customization_requests_trip" ON "public"."itinerary_customization_requests" USING "btree" ("trip_id");



CREATE INDEX "idx_customization_requests_user" ON "public"."itinerary_customization_requests" USING "btree" ("user_id");



CREATE INDEX "idx_daily_usage_lookup" ON "public"."daily_usage" USING "btree" ("user_id", "action_type", "usage_date");



CREATE INDEX "idx_day_balances_user_id" ON "public"."day_balances" USING "btree" ("user_id");



CREATE INDEX "idx_day_ledger_created_at" ON "public"."day_ledger" USING "btree" ("created_at");



CREATE INDEX "idx_day_ledger_stripe_session" ON "public"."day_ledger" USING "btree" ("stripe_session_id");



CREATE INDEX "idx_day_ledger_user_id" ON "public"."day_ledger" USING "btree" ("user_id");



CREATE INDEX "idx_day_summaries_user_trip" ON "public"."trip_day_summaries" USING "btree" ("user_id", "trip_id");



CREATE INDEX "idx_departure_summaries_user_trip" ON "public"."trip_departure_summaries" USING "btree" ("user_id", "trip_id");



CREATE INDEX "idx_destination_cost_index_city_country" ON "public"."destination_cost_index" USING "btree" ("lower"("city"), "lower"("country"));



CREATE INDEX "idx_destination_fallbacks_key" ON "public"."destination_fallbacks" USING "btree" ("destination_key");



CREATE INDEX "idx_destination_image_cache_slug" ON "public"."destination_image_cache" USING "btree" ("destination_slug", "image_type");



CREATE INDEX "idx_destinations_city" ON "public"."destinations" USING "btree" ("city");



CREATE INDEX "idx_destinations_country" ON "public"."destinations" USING "btree" ("country");



CREATE INDEX "idx_destinations_featured" ON "public"."destinations" USING "btree" ("featured") WHERE ("featured" = true);



CREATE INDEX "idx_destinations_hero_image" ON "public"."destinations" USING "btree" ("city") WHERE ("hero_image_url" IS NOT NULL);



CREATE INDEX "idx_destinations_region" ON "public"."destinations" USING "btree" ("region");



CREATE INDEX "idx_expense_splits_paid_via_settlement" ON "public"."expense_splits" USING "btree" ("paid_via_settlement");



CREATE INDEX "idx_feedback_responses_activity" ON "public"."trip_feedback_responses" USING "btree" ("activity_id");



CREATE INDEX "idx_feedback_responses_submitted" ON "public"."trip_feedback_responses" USING "btree" ("submitted_at");



CREATE INDEX "idx_feedback_responses_user_trip" ON "public"."trip_feedback_responses" USING "btree" ("user_id", "trip_id");



CREATE INDEX "idx_finance_entries_agent" ON "public"."finance_ledger_entries" USING "btree" ("agent_id");



CREATE INDEX "idx_finance_entries_date" ON "public"."finance_ledger_entries" USING "btree" ("effective_date");



CREATE INDEX "idx_finance_entries_stripe_pi" ON "public"."finance_ledger_entries" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "idx_finance_entries_trip" ON "public"."finance_ledger_entries" USING "btree" ("trip_id");



CREATE INDEX "idx_finance_entries_type" ON "public"."finance_ledger_entries" USING "btree" ("entry_type");



CREATE INDEX "idx_friendships_addressee" ON "public"."friendships" USING "btree" ("addressee_id");



CREATE INDEX "idx_friendships_requester" ON "public"."friendships" USING "btree" ("requester_id");



CREATE INDEX "idx_friendships_status" ON "public"."friendships" USING "btree" ("status");



CREATE INDEX "idx_generation_logs_created_at" ON "public"."generation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_generation_logs_trip_id" ON "public"."generation_logs" USING "btree" ("trip_id");



CREATE INDEX "idx_geocoding_cache_expires" ON "public"."geocoding_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_geocoding_cache_query_key" ON "public"."geocoding_cache" USING "btree" ("query_key");



CREATE INDEX "idx_group_budgets_owner" ON "public"."group_budgets" USING "btree" ("owner_id");



CREATE INDEX "idx_group_budgets_trip" ON "public"."group_budgets" USING "btree" ("trip_id");



CREATE INDEX "idx_group_transactions_budget" ON "public"."group_budget_transactions" USING "btree" ("group_budget_id");



CREATE INDEX "idx_group_transactions_created" ON "public"."group_budget_transactions" USING "btree" ("created_at");



CREATE INDEX "idx_group_transactions_user" ON "public"."group_budget_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_group_unlocks_purchaser" ON "public"."group_unlocks" USING "btree" ("purchased_by");



CREATE INDEX "idx_group_unlocks_trip" ON "public"."group_unlocks" USING "btree" ("trip_id");



CREATE INDEX "idx_guide_favorites_trip" ON "public"."guide_favorites" USING "btree" ("trip_id");



CREATE INDEX "idx_guide_favorites_user_trip" ON "public"."guide_favorites" USING "btree" ("user_id", "trip_id");



CREATE INDEX "idx_guide_follows_followed" ON "public"."guide_follows" USING "btree" ("followed_id");



CREATE INDEX "idx_guide_follows_follower" ON "public"."guide_follows" USING "btree" ("follower_id");



CREATE INDEX "idx_guide_sections_guide" ON "public"."guide_sections" USING "btree" ("guide_id", "sort_order");



CREATE INDEX "idx_guides_community" ON "public"."guides" USING "btree" ("guide_type", "status", "destination_city") WHERE (("guide_type" = 'user'::"text") AND ("status" = 'published'::"text"));



CREATE INDEX "idx_guides_user" ON "public"."guides" USING "btree" ("user_id") WHERE ("guide_type" = 'user'::"text");



CREATE INDEX "idx_image_quality_log_created_at" ON "public"."image_quality_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_image_quality_log_destination" ON "public"."image_quality_log" USING "btree" ("destination");



CREATE INDEX "idx_image_votes_entity" ON "public"."image_votes" USING "btree" ("entity_type", "entity_key");



CREATE INDEX "idx_image_votes_url" ON "public"."image_votes" USING "btree" ("image_url");



CREATE INDEX "idx_invite_failure_log_created" ON "public"."invite_failure_log" USING "btree" ("created_at");



CREATE UNIQUE INDEX "idx_itinerary_activities_external_id" ON "public"."itinerary_activities" USING "btree" ("trip_id", "itinerary_day_id", "external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "idx_itinerary_activities_locked" ON "public"."itinerary_activities" USING "btree" ("trip_id", "itinerary_day_id", "is_locked");



CREATE INDEX "idx_itinerary_templates_tags" ON "public"."itinerary_templates" USING "gin" ("tags");



CREATE INDEX "idx_itinerary_templates_user_id" ON "public"."itinerary_templates" USING "btree" ("user_id");



CREATE INDEX "idx_itinerary_versions_current" ON "public"."itinerary_versions" USING "btree" ("trip_id", "day_number", "is_current") WHERE ("is_current" = true);



CREATE INDEX "idx_itinerary_versions_trip_day" ON "public"."itinerary_versions" USING "btree" ("trip_id", "day_number");



CREATE INDEX "idx_page_events_created" ON "public"."page_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_page_events_event_type" ON "public"."page_events" USING "btree" ("event_type");



CREATE INDEX "idx_page_events_page_path" ON "public"."page_events" USING "btree" ("page_path");



CREATE INDEX "idx_page_events_session" ON "public"."page_events" USING "btree" ("session_id");



CREATE INDEX "idx_page_events_user_id" ON "public"."page_events" USING "btree" ("user_id");



CREATE INDEX "idx_pending_charges_status_created" ON "public"."pending_credit_charges" USING "btree" ("status", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_pending_charges_user_trip" ON "public"."pending_credit_charges" USING "btree" ("user_id", "trip_id");



CREATE INDEX "idx_pending_credit_charges_pi" ON "public"."pending_credit_charges" USING "btree" ((("metadata" ->> 'stripe_payment_intent_id'::"text"))) WHERE ("metadata" ? 'stripe_payment_intent_id'::"text");



CREATE INDEX "idx_personalization_tag_stats_destination" ON "public"."personalization_tag_stats" USING "btree" ("destination");



CREATE INDEX "idx_personalization_tag_stats_retention" ON "public"."personalization_tag_stats" USING "btree" ("retention_rate" DESC);



CREATE INDEX "idx_personalization_tag_stats_tag" ON "public"."personalization_tag_stats" USING "btree" ("tag");



CREATE INDEX "idx_places_cache_expires" ON "public"."google_places_search_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_places_cache_text_query" ON "public"."google_places_search_cache" USING "btree" ("text_query");



CREATE INDEX "idx_profiles_handle" ON "public"."profiles" USING "btree" ("handle");



CREATE INDEX "idx_prompt_log_user_trip" ON "public"."feedback_prompt_log" USING "btree" ("user_id", "trip_id", "shown_at");



CREATE INDEX "idx_quiz_responses_session_id" ON "public"."quiz_responses" USING "btree" ("session_id");



CREATE INDEX "idx_quiz_responses_user_id" ON "public"."quiz_responses" USING "btree" ("user_id");



CREATE INDEX "idx_quiz_sessions_user_id" ON "public"."quiz_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limits_lookup" ON "public"."rate_limits" USING "btree" ("ip_address", "endpoint", "created_at" DESC);



CREATE INDEX "idx_referral_codes_code" ON "public"."referral_codes" USING "btree" ("code");



CREATE INDEX "idx_referral_codes_user" ON "public"."referral_codes" USING "btree" ("user_id");



CREATE INDEX "idx_referrals_referrer" ON "public"."referrals" USING "btree" ("referrer_id");



CREATE INDEX "idx_route_cache_expires" ON "public"."route_cache" USING "btree" ("expires_at");



CREATE UNIQUE INDEX "idx_route_cache_key" ON "public"."route_cache" USING "btree" ("cache_key");



CREATE INDEX "idx_saved_items_type" ON "public"."saved_items" USING "btree" ("item_type");



CREATE INDEX "idx_saved_items_user" ON "public"."saved_items" USING "btree" ("user_id");



CREATE INDEX "idx_search_cache_expires" ON "public"."search_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_search_cache_key" ON "public"."search_cache" USING "btree" ("search_key");



CREATE INDEX "idx_tgl_trace" ON "public"."trip_generation_llm_calls" USING "btree" ("trace_id", "day_number");



CREATE INDEX "idx_tgm_field" ON "public"."trip_generation_mutations" USING "btree" ("trace_id", "field");



CREATE INDEX "idx_tgm_trace" ON "public"."trip_generation_mutations" USING "btree" ("trace_id", "day_number");



CREATE INDEX "idx_tgs_trace" ON "public"."trip_generation_stages" USING "btree" ("trace_id", "day_number", "order_index");



CREATE INDEX "idx_tgt_trip" ON "public"."trip_generation_traces" USING "btree" ("trip_id", "started_at" DESC);



CREATE INDEX "idx_tgt_user" ON "public"."trip_generation_traces" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_trait_drift_log_user_ran" ON "public"."trait_drift_log" USING "btree" ("user_id", "ran_at" DESC);



CREATE INDEX "idx_transfer_fares_city" ON "public"."airport_transfer_fares" USING "btree" ("lower"("city"));



CREATE INDEX "idx_travel_dna_history_user_id" ON "public"."travel_dna_history" USING "btree" ("user_id");



CREATE INDEX "idx_travel_dna_profiles_user_id" ON "public"."travel_dna_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_travel_guides_slug" ON "public"."travel_guides" USING "btree" ("slug");



CREATE INDEX "idx_travel_guides_trip" ON "public"."travel_guides" USING "btree" ("trip_id");



CREATE INDEX "idx_travel_guides_user" ON "public"."travel_guides" USING "btree" ("user_id");



CREATE INDEX "idx_travel_intel_cache_trip_id" ON "public"."travel_intel_cache" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_action_usage_lookup" ON "public"."trip_action_usage" USING "btree" ("user_id", "trip_id", "action_type");



CREATE INDEX "idx_trip_activities_booking_state" ON "public"."trip_activities" USING "btree" ("booking_state");



CREATE INDEX "idx_trip_activities_day_id" ON "public"."trip_activities" USING "btree" ("itinerary_day_id");



CREATE INDEX "idx_trip_activities_quote_expires" ON "public"."trip_activities" USING "btree" ("quote_expires_at");



CREATE INDEX "idx_trip_activities_trip_id" ON "public"."trip_activities" USING "btree" ("trip_id");



CREATE UNIQUE INDEX "idx_trip_blogs_slug" ON "public"."trip_blogs" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_trip_blogs_trip" ON "public"."trip_blogs" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_blogs_user" ON "public"."trip_blogs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_trip_chat_trip_id" ON "public"."trip_chat_messages" USING "btree" ("trip_id", "created_at");



CREATE INDEX "idx_trip_cities_trip_id" ON "public"."trip_cities" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_cities_trip_order" ON "public"."trip_cities" USING "btree" ("trip_id", "city_order");



CREATE INDEX "idx_trip_collaborators_trip" ON "public"."trip_collaborators" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_collaborators_user" ON "public"."trip_collaborators" USING "btree" ("user_id");



CREATE INDEX "idx_trip_cost_tracking_action_type" ON "public"."trip_cost_tracking" USING "btree" ("action_type");



CREATE INDEX "idx_trip_cost_tracking_cache_hit" ON "public"."trip_cost_tracking" USING "btree" ("is_cache_hit") WHERE ("is_cache_hit" = true);



CREATE INDEX "idx_trip_cost_tracking_category" ON "public"."trip_cost_tracking" USING "btree" ("cost_category");



CREATE INDEX "idx_trip_cost_tracking_created_at" ON "public"."trip_cost_tracking" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_trip_cost_tracking_retry_of" ON "public"."trip_cost_tracking" USING "btree" ("retry_of") WHERE ("retry_of" IS NOT NULL);



CREATE INDEX "idx_trip_cost_tracking_trip_id" ON "public"."trip_cost_tracking" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_date_versions_trip" ON "public"."trip_date_versions" USING "btree" ("trip_id", "created_at" DESC);



CREATE INDEX "idx_trip_day_intents_locked" ON "public"."trip_day_intents" USING "btree" ("trip_id", "locked") WHERE ("locked" = true);



CREATE INDEX "idx_trip_day_intents_trip_day" ON "public"."trip_day_intents" USING "btree" ("trip_id", "day_number") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_trip_day_intents_trip_status" ON "public"."trip_day_intents" USING "btree" ("trip_id", "status");



CREATE INDEX "idx_trip_go_back_list_trip_id" ON "public"."trip_go_back_list" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_go_back_list_user_id" ON "public"."trip_go_back_list" USING "btree" ("user_id");



CREATE INDEX "idx_trip_intents_trip" ON "public"."trip_intents" USING "btree" ("trip_id") WHERE ("active" = true);



CREATE INDEX "idx_trip_invites_replaced" ON "public"."trip_invites" USING "btree" ("token") WHERE ("replaced_at" IS NOT NULL);



CREATE INDEX "idx_trip_invites_token" ON "public"."trip_invites" USING "btree" ("token");



CREATE INDEX "idx_trip_invites_token_lower" ON "public"."trip_invites" USING "btree" ("lower"("token"));



CREATE INDEX "idx_trip_learnings_destination" ON "public"."trip_learnings" USING "btree" ("destination");



CREATE INDEX "idx_trip_learnings_user_id" ON "public"."trip_learnings" USING "btree" ("user_id");



CREATE INDEX "idx_trip_memories_trip_id" ON "public"."trip_memories" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_memories_user_id" ON "public"."trip_memories" USING "btree" ("user_id");



CREATE INDEX "idx_trip_notes_trip_id" ON "public"."trip_notes" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_notes_user_id" ON "public"."trip_notes" USING "btree" ("user_id");



CREATE INDEX "idx_trip_notifications_trip_id" ON "public"."trip_notifications" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_notifications_type_sent" ON "public"."trip_notifications" USING "btree" ("notification_type", "sent");



CREATE UNIQUE INDEX "idx_trip_notifications_unique_per_day" ON "public"."trip_notifications" USING "btree" ("trip_id", "user_id", "notification_type", "sent_date");



CREATE INDEX "idx_trip_payments_active" ON "public"."trip_payments" USING "btree" ("trip_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_trip_payments_assigned_member" ON "public"."trip_payments" USING "btree" ("assigned_member_id") WHERE ("assigned_member_id" IS NOT NULL);



CREATE INDEX "idx_trip_payments_status" ON "public"."trip_payments" USING "btree" ("status");



CREATE INDEX "idx_trip_payments_trip_id" ON "public"."trip_payments" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_payments_user_id" ON "public"."trip_payments" USING "btree" ("user_id");



CREATE INDEX "idx_trip_photos_day_number" ON "public"."trip_photos" USING "btree" ("day_number");



CREATE INDEX "idx_trip_photos_trip_id" ON "public"."trip_photos" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_photos_user_id" ON "public"."trip_photos" USING "btree" ("user_id");



CREATE INDEX "idx_trip_ratings_user_trip" ON "public"."trip_ratings" USING "btree" ("user_id", "trip_id");



CREATE INDEX "idx_trip_rental_cars_trip_id" ON "public"."trip_rental_cars" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_rental_cars_user_id" ON "public"."trip_rental_cars" USING "btree" ("user_id");



CREATE INDEX "idx_trips_abandoned_at" ON "public"."trips" USING "btree" ("abandoned_at") WHERE ("abandoned_at" IS NOT NULL);



CREATE INDEX "idx_trips_client_id" ON "public"."trips" USING "btree" ("client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_trips_creation_source" ON "public"."trips" USING "btree" ("creation_source");



CREATE INDEX "idx_trips_dates" ON "public"."trips" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_trips_free_tier" ON "public"."trips" USING "btree" ("user_id", "is_free_tier_trip") WHERE ("is_free_tier_trip" = true);



CREATE INDEX "idx_trips_journey_id" ON "public"."trips" USING "btree" ("journey_id") WHERE ("journey_id" IS NOT NULL);



CREATE INDEX "idx_trips_share_token" ON "public"."trips" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "idx_trips_smart_finish" ON "public"."trips" USING "btree" ("smart_finish_purchased") WHERE ("smart_finish_purchased" = true);



CREATE INDEX "idx_trips_stale_drafts" ON "public"."trips" USING "btree" ("status", "last_activity_at") WHERE ("status" = 'draft'::"public"."trip_status");



CREATE INDEX "idx_trips_status" ON "public"."trips" USING "btree" ("status");



CREATE INDEX "idx_trips_user_id" ON "public"."trips" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_unique_stripe_dispute" ON "public"."finance_ledger_entries" USING "btree" ("stripe_dispute_id", "entry_type") WHERE ("stripe_dispute_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_unique_stripe_payment_intent" ON "public"."finance_ledger_entries" USING "btree" ("stripe_payment_intent_id", "entry_type") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_unique_stripe_refund" ON "public"."finance_ledger_entries" USING "btree" ("stripe_refund_id", "entry_type") WHERE ("stripe_refund_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_unique_stripe_transfer" ON "public"."finance_ledger_entries" USING "btree" ("stripe_transfer_id", "entry_type") WHERE ("stripe_transfer_id" IS NOT NULL);



CREATE INDEX "idx_user_badges_type" ON "public"."user_badges" USING "btree" ("badge_type");



CREATE INDEX "idx_user_badges_user" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_user_credit_bonuses_type" ON "public"."user_credit_bonuses" USING "btree" ("bonus_type");



CREATE INDEX "idx_user_credit_bonuses_user_id" ON "public"."user_credit_bonuses" USING "btree" ("user_id");



CREATE INDEX "idx_user_enrichment_aggregate" ON "public"."user_enrichment" USING "btree" ("user_id", "enrichment_type", "entity_id");



CREATE INDEX "idx_user_enrichment_entity" ON "public"."user_enrichment" USING "btree" ("user_id", "entity_type", "entity_id");



CREATE INDEX "idx_user_enrichment_type_lookup" ON "public"."user_enrichment" USING "btree" ("user_id", "enrichment_type");



CREATE INDEX "idx_user_enrichment_user_type" ON "public"."user_enrichment" USING "btree" ("user_id", "enrichment_type");



CREATE INDEX "idx_user_preference_insights_user_id" ON "public"."user_preference_insights" USING "btree" ("user_id");



CREATE INDEX "idx_user_preferences_stripe_connect" ON "public"."user_preferences" USING "btree" ("stripe_connect_account_id") WHERE ("stripe_connect_account_id" IS NOT NULL);



CREATE INDEX "idx_user_tiers_stripe_sub" ON "public"."user_tiers" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "idx_user_tiers_tier" ON "public"."user_tiers" USING "btree" ("tier");



CREATE INDEX "idx_verified_venues_category" ON "public"."verified_venues" USING "btree" ("category");



CREATE INDEX "idx_verified_venues_dest_name" ON "public"."verified_venues" USING "btree" ("destination", "normalized_name");



CREATE INDEX "idx_verified_venues_destination" ON "public"."verified_venues" USING "btree" ("destination");



CREATE INDEX "idx_verified_venues_expires_at" ON "public"."verified_venues" USING "btree" ("expires_at");



CREATE INDEX "idx_verified_venues_google_place_id" ON "public"."verified_venues" USING "btree" ("google_place_id");



CREATE INDEX "idx_verified_venues_normalized_name" ON "public"."verified_venues" USING "btree" ("normalized_name");



CREATE INDEX "idx_voyance_events_created_at" ON "public"."voyance_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_voyance_events_event_name" ON "public"."voyance_events" USING "btree" ("event_name");



CREATE INDEX "idx_voyance_events_user_id" ON "public"."voyance_events" USING "btree" ("user_id");



CREATE INDEX "idx_voyance_picks_destination" ON "public"."voyance_picks" USING "btree" ("lower"("destination")) WHERE ("is_active" = true);



CREATE INDEX "idx_webhook_log_received" ON "public"."stripe_webhook_log" USING "btree" ("received_at" DESC);



CREATE INDEX "itinerary_activities_day_id_idx" ON "public"."itinerary_activities" USING "btree" ("itinerary_day_id");



CREATE INDEX "itinerary_activities_locked_idx" ON "public"."itinerary_activities" USING "btree" ("trip_id", "is_locked") WHERE ("is_locked" = true);



CREATE INDEX "itinerary_activities_trip_id_idx" ON "public"."itinerary_activities" USING "btree" ("trip_id");



CREATE INDEX "itinerary_days_trip_id_idx" ON "public"."itinerary_days" USING "btree" ("trip_id");



CREATE UNIQUE INDEX "profiles_handle_unique_idx" ON "public"."profiles" USING "btree" ("handle") WHERE ("handle" IS NOT NULL);



CREATE UNIQUE INDEX "uq_credit_ledger_stripe_session" ON "public"."credit_ledger" USING "btree" ("stripe_session_id", "transaction_type") WHERE ("stripe_session_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_credit_ledger_user_idempotency" ON "public"."credit_ledger" USING "btree" ("user_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE UNIQUE INDEX "uq_trip_day_intents_dedupe" ON "public"."trip_day_intents" USING "btree" ("trip_id", COALESCE("day_number", '-1'::integer), "source_entry_point", "intent_kind", "lower"("title"), COALESCE("locked_source", ''::"text")) WHERE ("status" = ANY (ARRAY['active'::"text", 'fulfilled'::"text"]));



CREATE UNIQUE INDEX "user_usage_user_metric_period_uidx" ON "public"."user_usage" USING "btree" ("user_id", "metric_key", "period");



CREATE OR REPLACE TRIGGER "itinerary_days_scrub_activities_trg" BEFORE INSERT OR UPDATE OF "activities" ON "public"."itinerary_days" FOR EACH ROW EXECUTE FUNCTION "public"."itinerary_days_scrub_activities"();



CREATE OR REPLACE TRIGGER "prevent_permission_escalation" BEFORE UPDATE ON "public"."trip_collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_permission_self_escalation"();



CREATE OR REPLACE TRIGGER "site_image_mappings_updated_at" BEFORE UPDATE ON "public"."site_image_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "sync_activity_cost_to_itinerary_jsonb_trigger" AFTER INSERT OR DELETE OR UPDATE OF "cost_per_person_usd", "num_travelers", "source" ON "public"."activity_costs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_activity_cost_to_itinerary_jsonb"();



CREATE OR REPLACE TRIGGER "trg_cleanup_old_itinerary_versions" AFTER INSERT ON "public"."itinerary_versions" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_old_itinerary_versions"();



CREATE OR REPLACE TRIGGER "trg_increment_itinerary_version" BEFORE INSERT ON "public"."itinerary_versions" FOR EACH ROW EXECUTE FUNCTION "public"."increment_itinerary_version"();



CREATE OR REPLACE TRIGGER "trg_prevent_self_collaboration" BEFORE INSERT ON "public"."trip_collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_self_collaboration"();



CREATE OR REPLACE TRIGGER "trg_update_travel_guides_updated_at" BEFORE UPDATE ON "public"."travel_guides" FOR EACH ROW EXECUTE FUNCTION "public"."update_travel_guides_updated_at"();



CREATE OR REPLACE TRIGGER "trg_validate_activity_cost" BEFORE INSERT OR UPDATE ON "public"."activity_costs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_activity_cost"();



CREATE OR REPLACE TRIGGER "trg_validate_travel_guide_status" BEFORE INSERT OR UPDATE ON "public"."travel_guides" FOR EACH ROW EXECUTE FUNCTION "public"."validate_travel_guide_status"();



CREATE OR REPLACE TRIGGER "trigger_notify_on_member_join" AFTER INSERT OR UPDATE ON "public"."trip_collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."notify_trip_members_on_join"();



CREATE OR REPLACE TRIGGER "trips_scrub_artifacts" BEFORE INSERT OR UPDATE OF "itinerary_data" ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."_trips_scrub_itinerary_artifacts"();



CREATE OR REPLACE TRIGGER "trips_scrub_itinerary_days_trg" BEFORE INSERT OR UPDATE OF "itinerary_data" ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."trips_scrub_itinerary_days"();



CREATE OR REPLACE TRIGGER "trips_scrub_meal_suffix" BEFORE INSERT OR UPDATE OF "itinerary_data" ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."scrub_itinerary_meal_suffix"();



CREATE OR REPLACE TRIGGER "trips_scrub_prompt_artifacts" BEFORE INSERT OR UPDATE OF "itinerary_data" ON "public"."trips" FOR EACH ROW WHEN (("new"."itinerary_data" IS NOT NULL)) EXECUTE FUNCTION "public"."scrub_itinerary_prompt_artifacts"();



CREATE OR REPLACE TRIGGER "update_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_catalog_updated_at" BEFORE UPDATE ON "public"."activity_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_feedback_updated_at" BEFORE UPDATE ON "public"."activity_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_accounts_updated_at" BEFORE UPDATE ON "public"."agency_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_booking_segments_updated_at" BEFORE UPDATE ON "public"."agency_booking_segments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_invoices_updated_at" BEFORE UPDATE ON "public"."agency_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_payment_schedules_updated_at" BEFORE UPDATE ON "public"."agency_payment_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_quotes_updated_at" BEFORE UPDATE ON "public"."agency_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_suppliers_updated_at" BEFORE UPDATE ON "public"."agency_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_tasks_updated_at" BEFORE UPDATE ON "public"."agency_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_travelers_updated_at" BEFORE UPDATE ON "public"."agency_travelers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agency_trips_updated_at" BEFORE UPDATE ON "public"."agency_trips" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_clients_updated_at" BEFORE UPDATE ON "public"."agent_clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_itinerary_library_updated_at" BEFORE UPDATE ON "public"."agent_itinerary_library" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_airport_transfer_fares_updated_at" BEFORE UPDATE ON "public"."airport_transfer_fares" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_airports_updated_at" BEFORE UPDATE ON "public"."airports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_attractions_updated_at" BEFORE UPDATE ON "public"."attractions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_budget_ledger_timestamp" BEFORE UPDATE ON "public"."trip_budget_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."update_budget_ledger_updated_at"();



CREATE OR REPLACE TRIGGER "update_consent_records_updated_at" BEFORE UPDATE ON "public"."consent_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_credit_balances_updated_at" BEFORE UPDATE ON "public"."credit_balances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_credit_purchases_updated_at" BEFORE UPDATE ON "public"."credit_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_curated_images_updated_at" BEFORE UPDATE ON "public"."curated_images" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customer_reviews_updated_at" BEFORE UPDATE ON "public"."customer_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_day_balances_updated_at" BEFORE UPDATE ON "public"."day_balances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_day_summaries_updated_at" BEFORE UPDATE ON "public"."trip_day_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_departure_summaries_updated_at" BEFORE UPDATE ON "public"."trip_departure_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_destination_cost_index_updated_at" BEFORE UPDATE ON "public"."destination_cost_index" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_destinations_updated_at" BEFORE UPDATE ON "public"."destinations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expense_splits_updated_at" BEFORE UPDATE ON "public"."expense_splits" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feedback_prompts_updated_at" BEFORE UPDATE ON "public"."feedback_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_finance_commission_imports_updated_at" BEFORE UPDATE ON "public"."finance_commission_imports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_finance_ledger_entries_updated_at" BEFORE UPDATE ON "public"."finance_ledger_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_finance_payout_runs_updated_at" BEFORE UPDATE ON "public"."finance_payout_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_free_tier_status_updated_at" BEFORE UPDATE ON "public"."free_tier_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_friendships_updated_at" BEFORE UPDATE ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_guides_updated_at" BEFORE UPDATE ON "public"."guides" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_itinerary_activities_updated_at" BEFORE UPDATE ON "public"."itinerary_activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_itinerary_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_itinerary_days_updated_at" BEFORE UPDATE ON "public"."itinerary_days" FOR EACH ROW EXECUTE FUNCTION "public"."update_itinerary_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_itinerary_templates_updated_at" BEFORE UPDATE ON "public"."itinerary_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_plan_entitlements_updated_at" BEFORE UPDATE ON "public"."plan_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quiz_sessions_updated_at" BEFORE UPDATE ON "public"."quiz_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_travel_dna_profiles_updated_at" BEFORE UPDATE ON "public"."travel_dna_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_activities_updated_at" BEFORE UPDATE ON "public"."trip_activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_cities_updated_at" BEFORE UPDATE ON "public"."trip_cities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_day_intents_updated_at" BEFORE UPDATE ON "public"."trip_day_intents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_expenses_updated_at" BEFORE UPDATE ON "public"."trip_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_intents_updated_at" BEFORE UPDATE ON "public"."trip_intents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_learnings_updated_at" BEFORE UPDATE ON "public"."trip_learnings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_members_updated_at" BEFORE UPDATE ON "public"."trip_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_notifications_updated_at" BEFORE UPDATE ON "public"."trip_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_payments_updated_at" BEFORE UPDATE ON "public"."trip_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_photos_updated_at" BEFORE UPDATE ON "public"."trip_photos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_ratings_updated_at" BEFORE UPDATE ON "public"."trip_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_rental_cars_updated_at" BEFORE UPDATE ON "public"."trip_rental_cars" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_reviews_updated_at" BEFORE UPDATE ON "public"."trip_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_settlements_updated_at" BEFORE UPDATE ON "public"."trip_settlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trip_suggestions_updated_at" BEFORE UPDATE ON "public"."trip_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_trips_updated_at" BEFORE UPDATE ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_enrichment_updated_at" BEFORE UPDATE ON "public"."user_enrichment" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_entitlement_overrides_updated_at" BEFORE UPDATE ON "public"."user_entitlement_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_preference_insights_updated_at" BEFORE UPDATE ON "public"."user_preference_insights" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_usage_updated_at" BEFORE UPDATE ON "public"."user_usage" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_verified_venues_timestamp" BEFORE UPDATE ON "public"."verified_venues" FOR EACH ROW EXECUTE FUNCTION "public"."update_verified_venues_updated_at"();



CREATE OR REPLACE TRIGGER "verified_venues_strip_meal_suffix" BEFORE INSERT OR UPDATE OF "name" ON "public"."verified_venues" FOR EACH ROW EXECUTE FUNCTION "public"."strip_verified_venue_meal_suffix"();



ALTER TABLE ONLY "public"."achievement_unlocks"
    ADD CONSTRAINT "achievement_unlocks_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_costs"
    ADD CONSTRAINT "activity_costs_cost_reference_id_fkey" FOREIGN KEY ("cost_reference_id") REFERENCES "public"."cost_reference"("id");



ALTER TABLE ONLY "public"."activity_costs"
    ADD CONSTRAINT "activity_costs_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_feedback"
    ADD CONSTRAINT "activity_feedback_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_quality_scores"
    ADD CONSTRAINT "activity_quality_scores_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."trip_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agency_accounts"
    ADD CONSTRAINT "agency_accounts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_booking_segments"
    ADD CONSTRAINT "agency_booking_segments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_booking_segments"
    ADD CONSTRAINT "agency_booking_segments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_communications"
    ADD CONSTRAINT "agency_communications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."agency_accounts"("id");



ALTER TABLE ONLY "public"."agency_communications"
    ADD CONSTRAINT "agency_communications_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_communications"
    ADD CONSTRAINT "agency_communications_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "public"."agency_travelers"("id");



ALTER TABLE ONLY "public"."agency_communications"
    ADD CONSTRAINT "agency_communications_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_documents"
    ADD CONSTRAINT "agency_documents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."agency_accounts"("id");



ALTER TABLE ONLY "public"."agency_documents"
    ADD CONSTRAINT "agency_documents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_documents"
    ADD CONSTRAINT "agency_documents_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "public"."agency_travelers"("id");



ALTER TABLE ONLY "public"."agency_documents"
    ADD CONSTRAINT "agency_documents_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_invoices"
    ADD CONSTRAINT "agency_invoices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."agency_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_invoices"
    ADD CONSTRAINT "agency_invoices_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_invoices"
    ADD CONSTRAINT "agency_invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."agency_quotes"("id");



ALTER TABLE ONLY "public"."agency_invoices"
    ADD CONSTRAINT "agency_invoices_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_payment_schedules"
    ADD CONSTRAINT "agency_payment_schedules_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_payment_schedules"
    ADD CONSTRAINT "agency_payment_schedules_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."agency_invoices"("id");



ALTER TABLE ONLY "public"."agency_payment_schedules"
    ADD CONSTRAINT "agency_payment_schedules_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."agency_payments"("id");



ALTER TABLE ONLY "public"."agency_payment_schedules"
    ADD CONSTRAINT "agency_payment_schedules_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_payments"
    ADD CONSTRAINT "agency_payments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_payments"
    ADD CONSTRAINT "agency_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."agency_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_payments"
    ADD CONSTRAINT "agency_payments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_quotes"
    ADD CONSTRAINT "agency_quotes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_quotes"
    ADD CONSTRAINT "agency_quotes_parent_quote_id_fkey" FOREIGN KEY ("parent_quote_id") REFERENCES "public"."agency_quotes"("id");



ALTER TABLE ONLY "public"."agency_quotes"
    ADD CONSTRAINT "agency_quotes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_suppliers"
    ADD CONSTRAINT "agency_suppliers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_tasks"
    ADD CONSTRAINT "agency_tasks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."agency_accounts"("id");



ALTER TABLE ONLY "public"."agency_tasks"
    ADD CONSTRAINT "agency_tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_tasks"
    ADD CONSTRAINT "agency_tasks_booking_segment_id_fkey" FOREIGN KEY ("booking_segment_id") REFERENCES "public"."agency_booking_segments"("id");



ALTER TABLE ONLY "public"."agency_tasks"
    ADD CONSTRAINT "agency_tasks_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "public"."agency_travelers"("id");



ALTER TABLE ONLY "public"."agency_tasks"
    ADD CONSTRAINT "agency_tasks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_travelers"
    ADD CONSTRAINT "agency_travelers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."agency_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_travelers"
    ADD CONSTRAINT "agency_travelers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_trip_travelers"
    ADD CONSTRAINT "agency_trip_travelers_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "public"."agency_travelers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_trip_travelers"
    ADD CONSTRAINT "agency_trip_travelers_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_trips"
    ADD CONSTRAINT "agency_trips_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."agency_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_trips"
    ADD CONSTRAINT "agency_trips_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_trips"
    ADD CONSTRAINT "agency_trips_linked_trip_id_fkey" FOREIGN KEY ("linked_trip_id") REFERENCES "public"."trips"("id");



ALTER TABLE ONLY "public"."agent_clients"
    ADD CONSTRAINT "agent_clients_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_itinerary_library"
    ADD CONSTRAINT "agent_itinerary_library_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archetype_destination_guides"
    ADD CONSTRAINT "archetype_destination_guides_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_guides"
    ADD CONSTRAINT "community_guides_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_guides"
    ADD CONSTRAINT "community_guides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_change_log"
    ADD CONSTRAINT "cost_change_log_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_balances"
    ADD CONSTRAINT "credit_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_review_contacts"
    ADD CONSTRAINT "customer_review_contacts_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."customer_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_reviews"
    ADD CONSTRAINT "customer_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."trip_expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_paid_via_settlement_fkey" FOREIGN KEY ("paid_via_settlement") REFERENCES "public"."trip_settlements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_prompt_log"
    ADD CONSTRAINT "feedback_prompt_log_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."trip_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_prompt_log"
    ADD CONSTRAINT "feedback_prompt_log_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."feedback_prompts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_prompt_log"
    ADD CONSTRAINT "feedback_prompt_log_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_ledger_entries"
    ADD CONSTRAINT "finance_ledger_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."agency_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_ledger_entries"
    ADD CONSTRAINT "finance_ledger_entries_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."agency_booking_segments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_ledger_entries"
    ADD CONSTRAINT "finance_ledger_entries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_payout_lines"
    ADD CONSTRAINT "finance_payout_lines_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."finance_ledger_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_payout_lines"
    ADD CONSTRAINT "finance_payout_lines_payout_run_id_fkey" FOREIGN KEY ("payout_run_id") REFERENCES "public"."finance_payout_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_payout_lines"
    ADD CONSTRAINT "finance_payout_lines_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."agency_booking_segments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_payout_lines"
    ADD CONSTRAINT "finance_payout_lines_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."agency_trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."free_tier_status"
    ADD CONSTRAINT "free_tier_status_free_trip_id_fkey" FOREIGN KEY ("free_trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_logs"
    ADD CONSTRAINT "generation_logs_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_budget_transactions"
    ADD CONSTRAINT "group_budget_transactions_group_budget_id_fkey" FOREIGN KEY ("group_budget_id") REFERENCES "public"."group_budgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_budget_transactions"
    ADD CONSTRAINT "group_budget_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_budgets"
    ADD CONSTRAINT "group_budgets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_budgets"
    ADD CONSTRAINT "group_budgets_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_activity_reviews"
    ADD CONSTRAINT "guide_activity_reviews_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."community_guides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_activity_reviews"
    ADD CONSTRAINT "guide_activity_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."guide_content_links"
    ADD CONSTRAINT "guide_content_links_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."community_guides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_content_links"
    ADD CONSTRAINT "guide_content_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_favorites"
    ADD CONSTRAINT "guide_favorites_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_favorites"
    ADD CONSTRAINT "guide_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_follows"
    ADD CONSTRAINT "guide_follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_follows"
    ADD CONSTRAINT "guide_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_manual_entries"
    ADD CONSTRAINT "guide_manual_entries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_manual_entries"
    ADD CONSTRAINT "guide_manual_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_reports"
    ADD CONSTRAINT "guide_reports_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."community_guides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_reports"
    ADD CONSTRAINT "guide_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guide_sections"
    ADD CONSTRAINT "guide_sections_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."community_guides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guides"
    ADD CONSTRAINT "guides_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itinerary_activities"
    ADD CONSTRAINT "itinerary_activities_itinerary_day_id_fkey" FOREIGN KEY ("itinerary_day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itinerary_activities"
    ADD CONSTRAINT "itinerary_activities_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itinerary_customization_requests"
    ADD CONSTRAINT "itinerary_customization_requests_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itinerary_days"
    ADD CONSTRAINT "itinerary_days_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itinerary_templates"
    ADD CONSTRAINT "itinerary_templates_source_trip_id_fkey" FOREIGN KEY ("source_trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itinerary_versions"
    ADD CONSTRAINT "itinerary_versions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_entitlements"
    ADD CONSTRAINT "plan_entitlements_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_entitlements"
    ADD CONSTRAINT "plan_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_responses"
    ADD CONSTRAINT "quiz_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_responses"
    ADD CONSTRAINT "quiz_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_sessions"
    ADD CONSTRAINT "quiz_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_guides"
    ADD CONSTRAINT "saved_guides_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."community_guides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_guides"
    ADD CONSTRAINT "saved_guides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_items"
    ADD CONSTRAINT "saved_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suggestion_votes"
    ADD CONSTRAINT "suggestion_votes_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."trip_suggestions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_dna_history"
    ADD CONSTRAINT "travel_dna_history_quiz_session_id_fkey" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_dna_history"
    ADD CONSTRAINT "travel_dna_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_dna_profiles"
    ADD CONSTRAINT "travel_dna_profiles_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_dna_profiles"
    ADD CONSTRAINT "travel_dna_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_guides"
    ADD CONSTRAINT "travel_guides_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_intel_cache"
    ADD CONSTRAINT "travel_intel_cache_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_action_usage"
    ADD CONSTRAINT "trip_action_usage_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_activities"
    ADD CONSTRAINT "trip_activities_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_blogs"
    ADD CONSTRAINT "trip_blogs_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_blogs"
    ADD CONSTRAINT "trip_blogs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_budget_ledger"
    ADD CONSTRAINT "trip_budget_ledger_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_chat_messages"
    ADD CONSTRAINT "trip_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_cities"
    ADD CONSTRAINT "trip_cities_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id");



ALTER TABLE ONLY "public"."trip_cities"
    ADD CONSTRAINT "trip_cities_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_invited_by_profiles_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_user_id_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_complexity"
    ADD CONSTRAINT "trip_complexity_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_cost_tracking"
    ADD CONSTRAINT "trip_cost_tracking_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_date_versions"
    ADD CONSTRAINT "trip_date_versions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_day_intents"
    ADD CONSTRAINT "trip_day_intents_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_day_intents"
    ADD CONSTRAINT "trip_day_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_day_summaries"
    ADD CONSTRAINT "trip_day_summaries_highlight_activity_id_fkey" FOREIGN KEY ("highlight_activity_id") REFERENCES "public"."trip_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_day_summaries"
    ADD CONSTRAINT "trip_day_summaries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_departure_summaries"
    ADD CONSTRAINT "trip_departure_summaries_best_experience_activity_id_fkey" FOREIGN KEY ("best_experience_activity_id") REFERENCES "public"."trip_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_departure_summaries"
    ADD CONSTRAINT "trip_departure_summaries_best_meal_activity_id_fkey" FOREIGN KEY ("best_meal_activity_id") REFERENCES "public"."trip_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_departure_summaries"
    ADD CONSTRAINT "trip_departure_summaries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_paid_by_member_id_fkey" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."trip_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_feedback_responses"
    ADD CONSTRAINT "trip_feedback_responses_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."trip_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_feedback_responses"
    ADD CONSTRAINT "trip_feedback_responses_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."feedback_prompts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_feedback_responses"
    ADD CONSTRAINT "trip_feedback_responses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_generation_llm_calls"
    ADD CONSTRAINT "trip_generation_llm_calls_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "public"."trip_generation_traces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_generation_mutations"
    ADD CONSTRAINT "trip_generation_mutations_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "public"."trip_generation_traces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_generation_stages"
    ADD CONSTRAINT "trip_generation_stages_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "public"."trip_generation_traces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_go_back_list"
    ADD CONSTRAINT "trip_go_back_list_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_intents"
    ADD CONSTRAINT "trip_intents_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_intents"
    ADD CONSTRAINT "trip_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_learnings"
    ADD CONSTRAINT "trip_learnings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_memories"
    ADD CONSTRAINT "trip_memories_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_notes"
    ADD CONSTRAINT "trip_notes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_notifications"
    ADD CONSTRAINT "trip_notifications_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_payments"
    ADD CONSTRAINT "trip_payments_assigned_member_id_fkey" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."trip_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_payments"
    ADD CONSTRAINT "trip_payments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_photos"
    ADD CONSTRAINT "trip_photos_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."trip_activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_photos"
    ADD CONSTRAINT "trip_photos_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_rental_cars"
    ADD CONSTRAINT "trip_rental_cars_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_reviews"
    ADD CONSTRAINT "trip_reviews_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "public"."trip_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "public"."trip_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_suggestion_votes"
    ADD CONSTRAINT "trip_suggestion_votes_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."trip_suggestions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_suggestion_votes"
    ADD CONSTRAINT "trip_suggestion_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_suggestions"
    ADD CONSTRAINT "trip_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."agent_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_entitlement_overrides"
    ADD CONSTRAINT "user_entitlement_overrides_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_social_links"
    ADD CONSTRAINT "user_social_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tiers"
    ADD CONSTRAINT "user_tiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Achievements are publicly readable" ON "public"."achievements" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Activities are publicly readable" ON "public"."activities" FOR SELECT USING (true);



CREATE POLICY "Activity catalog is publicly readable" ON "public"."activity_catalog" FOR SELECT USING (true);



CREATE POLICY "Addressee can update friendship" ON "public"."friendships" FOR UPDATE USING (("auth"."uid"() = "addressee_id"));



CREATE POLICY "Admin can view all logs" ON "public"."generation_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can manage curated images" ON "public"."curated_images" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can read errors" ON "public"."client_errors" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can read google budget" ON "public"."google_api_budget" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can read image quality log" ON "public"."image_quality_log" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can read page events" ON "public"."page_events" FOR SELECT USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can read reports" ON "public"."guide_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all credit balances" ON "public"."credit_balances" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all credit ledger" ON "public"."credit_ledger" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all credit purchases" ON "public"."credit_purchases" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all founding member rows" ON "public"."founding_member_tracker" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can view all group budgets" ON "public"."group_budgets" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all trips" ON "public"."trips" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can view all user tiers" ON "public"."user_tiers" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins can view cost tracking" ON "public"."trip_cost_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Agents can create accounts" ON "public"."agency_accounts" FOR INSERT TO "authenticated" WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can create their own library items" ON "public"."agent_itinerary_library" FOR INSERT WITH CHECK (("auth"."uid"() = "agent_id"));



CREATE POLICY "Agents can delete own accounts" ON "public"."agency_accounts" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own communications" ON "public"."agency_communications" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own documents" ON "public"."agency_documents" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own ledger entries" ON "public"."finance_ledger_entries" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own library" ON "public"."agent_itinerary_library" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own payment schedules" ON "public"."agency_payment_schedules" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own payments" ON "public"."agency_payments" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own segments" ON "public"."agency_booking_segments" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own suppliers" ON "public"."agency_suppliers" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own tasks" ON "public"."agency_tasks" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own travelers" ON "public"."agency_travelers" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete own trips" ON "public"."agency_trips" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete their own accounts" ON "public"."agency_accounts" FOR DELETE TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can delete their own library items" ON "public"."agent_itinerary_library" FOR DELETE USING (("auth"."uid"() = "agent_id"));



CREATE POLICY "Agents can delete trip travelers" ON "public"."agency_trip_travelers" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."agency_trips" "t"
  WHERE (("t"."id" = "agency_trip_travelers"."trip_id") AND ("t"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Agents can insert own accounts" ON "public"."agency_accounts" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own commission imports" ON "public"."finance_commission_imports" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own communications" ON "public"."agency_communications" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own documents" ON "public"."agency_documents" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own ledger entries" ON "public"."finance_ledger_entries" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own library" ON "public"."agent_itinerary_library" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own payment schedules" ON "public"."agency_payment_schedules" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own payments" ON "public"."agency_payments" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own payout lines" ON "public"."finance_payout_lines" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own payout runs" ON "public"."finance_payout_runs" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own segments" ON "public"."agency_booking_segments" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own suppliers" ON "public"."agency_suppliers" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own tasks" ON "public"."agency_tasks" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own travelers" ON "public"."agency_travelers" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert own trips" ON "public"."agency_trips" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert trip travelers" ON "public"."agency_trip_travelers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."agency_trips" "t"
  WHERE (("t"."id" = "agency_trip_travelers"."trip_id") AND ("t"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Agents can manage own accounts" ON "public"."agency_accounts" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own booking segments" ON "public"."agency_booking_segments" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own commission imports" ON "public"."finance_commission_imports" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own communications" ON "public"."agency_communications" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own ledger entries" ON "public"."finance_ledger_entries" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own payment schedules" ON "public"."agency_payment_schedules" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own payments" ON "public"."agency_payments" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own payout lines" ON "public"."finance_payout_lines" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own payout runs" ON "public"."finance_payout_runs" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage own suppliers" ON "public"."agency_suppliers" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage their own accounts" ON "public"."agency_accounts" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage their own communications" ON "public"."agency_communications" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage their own payment schedules" ON "public"."agency_payment_schedules" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage their own payments" ON "public"."agency_payments" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage their own segments" ON "public"."agency_booking_segments" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage their own suppliers" ON "public"."agency_suppliers" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage their own trips" ON "public"."agency_trips" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage trip travelers" ON "public"."agency_trip_travelers" USING ((EXISTS ( SELECT 1
   FROM "public"."agency_trips"
  WHERE (("agency_trips"."id" = "agency_trip_travelers"."trip_id") AND ("agency_trips"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Agents can update own accounts" ON "public"."agency_accounts" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own commission imports" ON "public"."finance_commission_imports" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own communications" ON "public"."agency_communications" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own documents" ON "public"."agency_documents" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own ledger entries" ON "public"."finance_ledger_entries" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own library" ON "public"."agent_itinerary_library" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own payment schedules" ON "public"."agency_payment_schedules" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own payments" ON "public"."agency_payments" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own payout runs" ON "public"."finance_payout_runs" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own segments" ON "public"."agency_booking_segments" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own suppliers" ON "public"."agency_suppliers" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own tasks" ON "public"."agency_tasks" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own travelers" ON "public"."agency_travelers" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update own trips" ON "public"."agency_trips" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update their own accounts" ON "public"."agency_accounts" FOR UPDATE TO "authenticated" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update their own library items" ON "public"."agent_itinerary_library" FOR UPDATE USING (("auth"."uid"() = "agent_id"));



CREATE POLICY "Agents can update their own trips" ON "public"."agency_trips" FOR UPDATE USING (("auth"."uid"() = "agent_id"));



CREATE POLICY "Agents can view own accounts" ON "public"."agency_accounts" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own commission imports" ON "public"."finance_commission_imports" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own communications" ON "public"."agency_communications" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own documents" ON "public"."agency_documents" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own ledger entries" ON "public"."finance_ledger_entries" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own library" ON "public"."agent_itinerary_library" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own payment schedules" ON "public"."agency_payment_schedules" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own payments" ON "public"."agency_payments" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own payout lines" ON "public"."finance_payout_lines" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own payout runs" ON "public"."finance_payout_runs" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own segments" ON "public"."agency_booking_segments" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own suppliers" ON "public"."agency_suppliers" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own tasks" ON "public"."agency_tasks" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own travelers" ON "public"."agency_travelers" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view own trips" ON "public"."agency_trips" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view their own accounts" ON "public"."agency_accounts" FOR SELECT TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view their own library items" ON "public"."agent_itinerary_library" FOR SELECT USING (("auth"."uid"() = "agent_id"));



CREATE POLICY "Agents can view trip travelers" ON "public"."agency_trip_travelers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agency_trips" "t"
  WHERE (("t"."id" = "agency_trip_travelers"."trip_id") AND ("t"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Airports are publicly readable" ON "public"."airports" FOR SELECT USING (true);



CREATE POLICY "Allow anonymous inserts for logging" ON "public"."invite_failure_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can count followers" ON "public"."creator_follows" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can insert errors" ON "public"."client_errors" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert page events" ON "public"."page_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read active prompts" ON "public"."feedback_prompts" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Anyone can read activity quality scores" ON "public"."activity_quality_scores" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read archetype pacing stats" ON "public"."archetype_pacing_stats" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read cached images" ON "public"."destination_image_cache" FOR SELECT USING (true);



CREATE POLICY "Anyone can read content links for published guides" ON "public"."guide_content_links" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."community_guides" "cg"
  WHERE (("cg"."id" = "guide_content_links"."guide_id") AND ("cg"."status" = 'published'::"text")))));



CREATE POLICY "Anyone can read destination cost index" ON "public"."destination_cost_index" FOR SELECT USING (true);



CREATE POLICY "Anyone can read destination fallbacks" ON "public"."destination_fallbacks" FOR SELECT USING (true);



CREATE POLICY "Anyone can read geocoding cache" ON "public"."geocoding_cache" FOR SELECT USING (true);



CREATE POLICY "Anyone can read guide activity reviews" ON "public"."guide_activity_reviews" FOR SELECT USING (true);



CREATE POLICY "Anyone can read landmarks cache" ON "public"."city_landmarks_cache" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read published blogs" ON "public"."trip_blogs" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Anyone can read published guides" ON "public"."travel_guides" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Anyone can read tag stats" ON "public"."personalization_tag_stats" FOR SELECT USING (true);



CREATE POLICY "Anyone can read transfer fares" ON "public"."airport_transfer_fares" FOR SELECT USING (true);



CREATE POLICY "Anyone can report a guide" ON "public"."guide_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can view badges" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "Anyone can view curated images" ON "public"."curated_images" FOR SELECT USING (true);



CREATE POLICY "Anyone can view published guides" ON "public"."community_guides" FOR SELECT TO "authenticated", "anon" USING (("status" = 'published'::"text"));



CREATE POLICY "Archetype guides are publicly readable" ON "public"."archetype_destination_guides" FOR SELECT USING (true);



CREATE POLICY "Attractions are publicly readable" ON "public"."attractions" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert own reviews" ON "public"."guide_activity_reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can insert suggestions" ON "public"."trip_suggestions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_suggestions"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."trip_id" = "trip_suggestions"."trip_id") AND ("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."agency_trips"
  WHERE (("agency_trips"."id" = "trip_suggestions"."trip_id") AND ("agency_trips"."agent_id" = "auth"."uid"())))))));



CREATE POLICY "Authenticated users can manage voyance picks" ON "public"."voyance_picks" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read cost_reference" ON "public"."cost_reference" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read exchange_rates" ON "public"."exchange_rates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read suggestions for their trips" ON "public"."trip_suggestions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_suggestions"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."trip_id" = "trip_suggestions"."trip_id") AND ("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."agency_trips"
  WHERE (("agency_trips"."id" = "trip_suggestions"."trip_id") AND ("agency_trips"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Authenticated users can remove their vote" ON "public"."trip_suggestion_votes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can submit own reviews" ON "public"."customer_reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can view site image mappings" ON "public"."site_image_mappings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can vote" ON "public"."trip_suggestion_votes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can vote on images" ON "public"."image_votes" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Budget participants can view transactions" ON "public"."group_budget_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_budgets" "gb"
  WHERE (("gb"."id" = "group_budget_transactions"."group_budget_id") AND (("gb"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."trip_collaborators" "tc"
          WHERE (("tc"."trip_id" = "gb"."trip_id") AND ("tc"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Collaborators can view group budget" ON "public"."group_budgets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "group_budgets"."trip_id") AND ("tc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Collaborators can view rental cars" ON "public"."trip_rental_cars" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_rental_cars"."trip_id") AND ("tc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Collaborators can view trip activities" ON "public"."trip_activities" FOR SELECT TO "authenticated" USING ("public"."is_trip_collaborator"("trip_id", "auth"."uid"(), false));



CREATE POLICY "Collaborators with edit can delete trip activities" ON "public"."trip_activities" FOR DELETE TO "authenticated" USING ("public"."is_trip_collaborator"("trip_id", "auth"."uid"(), true));



CREATE POLICY "Collaborators with edit can insert trip activities" ON "public"."trip_activities" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_trip_collaborator"("trip_id", "auth"."uid"(), true));



CREATE POLICY "Collaborators with edit can update trip activities" ON "public"."trip_activities" FOR UPDATE TO "authenticated" USING ("public"."is_trip_collaborator"("trip_id", "auth"."uid"(), true));



CREATE POLICY "Delete trip day intents" ON "public"."trip_day_intents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_day_intents"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Deny anon from accessing rate limits" ON "public"."rate_limits" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Deny authenticated users from accessing rate limits" ON "public"."rate_limits" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "Deny authenticated users from modifying rate limits" ON "public"."rate_limits" TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "Destinations are publicly readable" ON "public"."destinations" FOR SELECT USING (true);



CREATE POLICY "Expense splits access" ON "public"."expense_splits" USING ((("member_id" IN ( SELECT "trip_members"."id"
   FROM "public"."trip_members"
  WHERE ("trip_members"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM ("public"."trip_expenses" "te"
     JOIN "public"."trips" "t" ON (("te"."trip_id" = "t"."id")))
  WHERE (("te"."id" = "expense_splits"."expense_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Feature flags are publicly readable" ON "public"."feature_flags" FOR SELECT USING (true);



CREATE POLICY "Insert trip day intents" ON "public"."trip_day_intents" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_day_intents"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_day_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL) AND ("tc"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text", 'editor'::"text", 'contributor'::"text"])))))));



CREATE POLICY "Only admins can modify cost index" ON "public"."destination_cost_index" USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "Plan entitlements are publicly readable" ON "public"."plan_entitlements" FOR SELECT USING (true);



CREATE POLICY "Plans are publicly readable" ON "public"."plans" FOR SELECT USING (true);



CREATE POLICY "Public can read social links for published creators" ON "public"."user_social_links" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."community_guides" "cg"
  WHERE (("cg"."user_id" = "user_social_links"."user_id") AND (("cg"."status" = 'published'::"text") OR ("cg"."published_at" IS NOT NULL))))));



CREATE POLICY "Self sees own membership row" ON "public"."trip_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Service role can insert audit logs" ON "public"."audit_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert cost tracking" ON "public"."trip_cost_tracking" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert credit ledger entries" ON "public"."credit_ledger" FOR INSERT TO "service_role" WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert credit transactions" ON "public"."credit_transactions" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



COMMENT ON POLICY "Service role can insert credit transactions" ON "public"."credit_transactions" IS 'Restricted to service_role for edge function use only. Validates auth.role() for defense in depth.';



CREATE POLICY "Service role can manage all notifications" ON "public"."trip_notifications" TO "service_role" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage archetype guides" ON "public"."archetype_destination_guides" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage credit balances" ON "public"."credit_balances" TO "service_role" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage rate limits" ON "public"."rate_limits" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage search cache" ON "public"."search_cache" TO "service_role" USING (true) WITH CHECK (true);



COMMENT ON POLICY "Service role can manage search cache" ON "public"."search_cache" IS 'Allows edge functions with service role key to read/write search cache entries';



CREATE POLICY "Service role can manage tag stats" ON "public"."personalization_tag_stats" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can modify user credits" ON "public"."user_credits" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



COMMENT ON POLICY "Service role can modify user credits" ON "public"."user_credits" IS 'Restricted to service_role for edge function use only.';



CREATE POLICY "Service role can update user credits" ON "public"."user_credits" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."chat_idempotency_cache" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."destination_insights_cache" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."google_places_search_cache" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."stripe_webhook_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."travel_intel_locks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on travel_intel_cache" ON "public"."travel_intel_cache" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to activity_costs" ON "public"."activity_costs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to cost_reference" ON "public"."cost_reference" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to exchange_rates" ON "public"."exchange_rates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages trip complexity" ON "public"."trip_complexity" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role only for reads" ON "public"."invite_failure_log" FOR SELECT USING (false);



CREATE POLICY "Service role writes llm calls" ON "public"."trip_generation_llm_calls" TO "authenticated" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role writes mutations" ON "public"."trip_generation_mutations" TO "authenticated" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role writes stages" ON "public"."trip_generation_stages" TO "authenticated" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role writes traces" ON "public"."trip_generation_traces" TO "authenticated" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Settlement access" ON "public"."trip_settlements" USING ((("from_member_id" IN ( SELECT "trip_members"."id"
   FROM "public"."trip_members"
  WHERE ("trip_members"."user_id" = "auth"."uid"()))) OR ("to_member_id" IN ( SELECT "trip_members"."id"
   FROM "public"."trip_members"
  WHERE ("trip_members"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_settlements"."trip_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "System inserts cost changes" ON "public"."cost_change_log" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "cost_change_log"."trip_id") AND (("t"."user_id" = "auth"."uid"()) OR "public"."is_trip_collaborator"("t"."id", "auth"."uid"(), true))))));



CREATE POLICY "Trip members can create notifications" ON "public"."trip_notifications" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_notifications"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."trip_id" = "trip_notifications"."trip_id") AND ("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Trip members can read chat" ON "public"."trip_chat_messages" FOR SELECT USING (((("trip_type" = 'consumer'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_chat_messages"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."trip_id" = "trip_chat_messages"."trip_id") AND ("trip_collaborators"."user_id" = "auth"."uid"())))))) OR (("trip_type" = 'agency'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."agency_trips"
  WHERE (("agency_trips"."id" = "trip_chat_messages"."trip_id") AND ("agency_trips"."agent_id" = "auth"."uid"())))))));



CREATE POLICY "Trip members can read votes" ON "public"."trip_suggestion_votes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trip_suggestions" "ts"
  WHERE (("ts"."id" = "trip_suggestion_votes"."suggestion_id") AND ((EXISTS ( SELECT 1
           FROM "public"."trips" "t"
          WHERE (("t"."id" = "ts"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."trip_collaborators" "tc"
          WHERE (("tc"."trip_id" = "ts"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL)))) OR (EXISTS ( SELECT 1
           FROM "public"."agency_trips" "at"
          WHERE (("at"."id" = "ts"."trip_id") AND ("at"."agent_id" = "auth"."uid"())))))))));



CREATE POLICY "Trip members can send chat" ON "public"."trip_chat_messages" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ((("trip_type" = 'consumer'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_chat_messages"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."trip_id" = "trip_chat_messages"."trip_id") AND ("trip_collaborators"."user_id" = "auth"."uid"())))))) OR (("trip_type" = 'agency'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."agency_trips"
  WHERE (("agency_trips"."id" = "trip_chat_messages"."trip_id") AND ("agency_trips"."agent_id" = "auth"."uid"()))))))));



CREATE POLICY "Trip members can view expenses" ON "public"."trip_expenses" FOR SELECT USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_members"."trip_id"
   FROM "public"."trip_members"
  WHERE ("trip_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owner can manage group budget" ON "public"."group_budgets" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Trip owner can view group unlock" ON "public"."group_unlocks" FOR SELECT USING (("public"."is_trip_owner"("trip_id") OR "public"."is_trip_collaborator"("trip_id", "auth"."uid"())));



CREATE POLICY "Trip owner reads llm calls" ON "public"."trip_generation_llm_calls" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."trip_generation_traces" "tr"
     JOIN "public"."trips" "t" ON (("t"."id" = "tr"."trip_id")))
  WHERE (("tr"."id" = "trip_generation_llm_calls"."trace_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owner reads mutations" ON "public"."trip_generation_mutations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."trip_generation_traces" "tr"
     JOIN "public"."trips" "t" ON (("t"."id" = "tr"."trip_id")))
  WHERE (("tr"."id" = "trip_generation_mutations"."trace_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owner reads stages" ON "public"."trip_generation_stages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."trip_generation_traces" "tr"
     JOIN "public"."trips" "t" ON (("t"."id" = "tr"."trip_id")))
  WHERE (("tr"."id" = "trip_generation_stages"."trace_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owner reads traces" ON "public"."trip_generation_traces" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_generation_traces"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owner sees all members" ON "public"."trip_members" FOR SELECT TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners and collaborators can view cost changes" ON "public"."cost_change_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "cost_change_log"."trip_id") AND (("t"."user_id" = "auth"."uid"()) OR "public"."is_trip_collaborator"("t"."id", "auth"."uid"(), false))))));



CREATE POLICY "Trip owners can add collaborators" ON "public"."trip_collaborators" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owners can delete action usage" ON "public"."trip_action_usage" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete complexity" ON "public"."trip_complexity" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete cost tracking" ON "public"."trip_cost_tracking" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete customization requests" ON "public"."itinerary_customization_requests" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete day summaries" ON "public"."trip_day_summaries" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete departure summaries" ON "public"."trip_departure_summaries" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete expenses" ON "public"."trip_expenses" FOR DELETE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete feedback prompts" ON "public"."feedback_prompt_log" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete feedback responses" ON "public"."trip_feedback_responses" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete learnings" ON "public"."trip_learnings" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete members" ON "public"."trip_members" FOR DELETE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete notifications" ON "public"."trip_notifications" FOR DELETE TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete settlements" ON "public"."trip_settlements" FOR DELETE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can delete splits" ON "public"."expense_splits" FOR DELETE USING (("expense_id" IN ( SELECT "te"."id"
   FROM "public"."trip_expenses" "te"
  WHERE ("te"."trip_id" IN ( SELECT "trips"."id"
           FROM "public"."trips"
          WHERE ("trips"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Trip owners can insert expenses" ON "public"."trip_expenses" FOR INSERT WITH CHECK (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can insert invites" ON "public"."trip_invites" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_invites"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) AND ("invited_by" = "auth"."uid"())));



CREATE POLICY "Trip owners can insert members" ON "public"."trip_members" FOR INSERT WITH CHECK (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can insert settlements" ON "public"."trip_settlements" FOR INSERT WITH CHECK (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can insert splits" ON "public"."expense_splits" FOR INSERT WITH CHECK (("expense_id" IN ( SELECT "te"."id"
   FROM "public"."trip_expenses" "te"
  WHERE ("te"."trip_id" IN ( SELECT "trips"."id"
           FROM "public"."trips"
          WHERE ("trips"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Trip owners can manage activity_costs" ON "public"."activity_costs" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "activity_costs"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR "public"."is_trip_collaborator"("trip_id", "auth"."uid"(), false))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "activity_costs"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR "public"."is_trip_collaborator"("trip_id", "auth"."uid"(), true)));



CREATE POLICY "Trip owners can manage invites" ON "public"."trip_invites" USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_invites"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owners can manage members" ON "public"."trip_members" FOR INSERT WITH CHECK (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can update collaborator permissions" ON "public"."trip_collaborators" FOR UPDATE USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Trip owners can update expenses" ON "public"."trip_expenses" FOR UPDATE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can update members" ON "public"."trip_members" FOR UPDATE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can update settlements" ON "public"."trip_settlements" FOR UPDATE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Trip owners can update splits" ON "public"."expense_splits" FOR UPDATE USING (("expense_id" IN ( SELECT "te"."id"
   FROM "public"."trip_expenses" "te"
  WHERE ("te"."trip_id" IN ( SELECT "trips"."id"
           FROM "public"."trips"
          WHERE ("trips"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Trip participants can add expenses" ON "public"."trip_expenses" FOR INSERT WITH CHECK ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR "public"."is_trip_member"("trip_id", "auth"."uid"())));



CREATE POLICY "Trip participants can manage settlements" ON "public"."trip_settlements" USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR "public"."is_trip_member"("trip_id", "auth"."uid"())));



CREATE POLICY "Trip participants can manage splits" ON "public"."expense_splits" USING (("expense_id" IN ( SELECT "trip_expenses"."id"
   FROM "public"."trip_expenses"
  WHERE (("trip_expenses"."trip_id" IN ( SELECT "trips"."id"
           FROM "public"."trips"
          WHERE ("trips"."user_id" = "auth"."uid"()))) OR "public"."is_trip_member"("trip_expenses"."trip_id", "auth"."uid"())))));



CREATE POLICY "Trip participants can update expenses" ON "public"."trip_expenses" FOR UPDATE USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR "public"."is_trip_member"("trip_id", "auth"."uid"())));



CREATE POLICY "Trip participants can view expenses" ON "public"."trip_expenses" FOR SELECT USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR "public"."is_trip_member"("trip_id", "auth"."uid"())));



CREATE POLICY "Trip participants can view settlements" ON "public"."trip_settlements" FOR SELECT USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR "public"."is_trip_member"("trip_id", "auth"."uid"())));



CREATE POLICY "Trip participants can view splits" ON "public"."expense_splits" FOR SELECT USING (("expense_id" IN ( SELECT "trip_expenses"."id"
   FROM "public"."trip_expenses"
  WHERE (("trip_expenses"."trip_id" IN ( SELECT "trips"."id"
           FROM "public"."trips"
          WHERE ("trips"."user_id" = "auth"."uid"()))) OR "public"."is_trip_member"("trip_expenses"."trip_id", "auth"."uid"())))));



CREATE POLICY "Update trip day intents" ON "public"."trip_day_intents" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_day_intents"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_day_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL) AND ("tc"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text", 'editor'::"text", 'contributor'::"text"])))))));



CREATE POLICY "Users can cast votes" ON "public"."suggestion_votes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."trip_suggestions" "ts"
     JOIN "public"."trips" "t" ON (("t"."id" = "ts"."trip_id")))
  WHERE (("ts"."id" = "suggestion_votes"."suggestion_id") AND (("t"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."trip_collaborators" "tc"
          WHERE (("tc"."trip_id" = "t"."id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL))))))))));



CREATE POLICY "Users can create friend requests" ON "public"."friendships" FOR INSERT WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Users can create guides" ON "public"."guides" FOR INSERT WITH CHECK ((("guide_type" = 'user'::"text") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can create own customization requests" ON "public"."itinerary_customization_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own templates" ON "public"."itinerary_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own trips" ON "public"."trips" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create rental cars for their trips" ON "public"."trip_rental_cars" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own day summaries" ON "public"."trip_day_summaries" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own departure summaries" ON "public"."trip_departure_summaries" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own feedback" ON "public"."activity_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own feedback" ON "public"."trip_feedback_responses" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own go-back list items" ON "public"."trip_go_back_list" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own insights" ON "public"."user_preference_insights" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own memories" ON "public"."trip_memories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own prompt log" ON "public"."feedback_prompt_log" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own trip learnings" ON "public"."trip_learnings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own trip notes" ON "public"."trip_notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete intents for their trips" ON "public"."trip_intents" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_intents"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can delete own friendships" ON "public"."friendships" FOR DELETE USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));



CREATE POLICY "Users can delete own guides" ON "public"."guides" FOR DELETE USING ((("guide_type" = 'user'::"text") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can delete own manual entries" ON "public"."guide_manual_entries" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own photos" ON "public"."trip_photos" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own reviews" ON "public"."guide_activity_reviews" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own reviews" ON "public"."trip_reviews" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own saved items" ON "public"."saved_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own social links" ON "public"."user_social_links" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own templates" ON "public"."itinerary_templates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own trip activities" ON "public"."trip_activities" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_activities"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own trips" ON "public"."trips" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own votes" ON "public"."suggestion_votes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own feedback" ON "public"."activity_feedback" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own go-back list items" ON "public"."trip_go_back_list" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own itinerary versions" ON "public"."itinerary_versions" FOR DELETE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own memories" ON "public"."trip_memories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own rental cars" ON "public"."trip_rental_cars" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own trip activities" ON "public"."itinerary_activities" FOR DELETE USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text"])) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can delete their own trip days" ON "public"."itinerary_days" FOR DELETE USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text"])) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can delete their own trip intel cache" ON "public"."travel_intel_cache" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "travel_intel_cache"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own trip notes" ON "public"."trip_notes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their trip budget entries" ON "public"."trip_budget_ledger" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_budget_ledger"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their trip cities" ON "public"."trip_cities" FOR DELETE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can follow creators" ON "public"."creator_follows" FOR INSERT TO "authenticated" WITH CHECK (("follower_id" = "auth"."uid"()));



CREATE POLICY "Users can insert intents for their trips" ON "public"."trip_intents" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_intents"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can insert own DNA history" ON "public"."travel_dna_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own enrichment data" ON "public"."user_enrichment" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own free tier status" ON "public"."free_tier_status" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own manual entries" ON "public"."guide_manual_entries" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own quiz responses" ON "public"."quiz_responses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own quiz sessions" ON "public"."quiz_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own referral codes" ON "public"."referral_codes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own reviews" ON "public"."trip_reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own saved items" ON "public"."saved_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own social links" ON "public"."user_social_links" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own travel DNA" ON "public"."travel_dna_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own trip activities" ON "public"."trip_activities" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_activities"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own trip ratings" ON "public"."trip_ratings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own usage" ON "public"."user_usage" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own consent records" ON "public"."consent_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own day balance" ON "public"."day_balances" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own events" ON "public"."voyance_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own itinerary versions" ON "public"."itinerary_versions" FOR INSERT WITH CHECK (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own trip activities" ON "public"."itinerary_activities" FOR INSERT WITH CHECK ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text"])) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can insert their own trip days" ON "public"."itinerary_days" FOR INSERT WITH CHECK ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text"])) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can insert their own trip intel cache" ON "public"."travel_intel_cache" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "travel_intel_cache"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own usage" ON "public"."trip_action_usage" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their trip budget entries" ON "public"."trip_budget_ledger" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_budget_ledger"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their trip cities" ON "public"."trip_cities" FOR INSERT WITH CHECK (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage own content links" ON "public"."guide_content_links" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own push tokens" ON "public"."push_tokens" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage sections of own guides" ON "public"."guide_sections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."community_guides"
  WHERE (("community_guides"."id" = "guide_sections"."guide_id") AND (("community_guides"."user_id" = "auth"."uid"()) OR ("community_guides"."status" = 'published'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."community_guides"
  WHERE (("community_guides"."id" = "guide_sections"."guide_id") AND ("community_guides"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own blogs" ON "public"."trip_blogs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own guide favorites" ON "public"."guide_favorites" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own guides" ON "public"."community_guides" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can purchase group unlock" ON "public"."group_unlocks" FOR INSERT WITH CHECK (("auth"."uid"() = "purchased_by"));



CREATE POLICY "Users can read own generation logs" ON "public"."generation_logs" FOR SELECT TO "authenticated" USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can read own manual entries" ON "public"."guide_manual_entries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own social links" ON "public"."user_social_links" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own tier" ON "public"."user_tiers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own trip complexity" ON "public"."trip_complexity" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_complexity"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read published guides and own drafts" ON "public"."guides" FOR SELECT USING ((("published" = true) OR (("guide_type" = 'user'::"text") AND ("user_id" = "auth"."uid"())) OR ("guide_type" = 'editorial'::"text")));



CREATE POLICY "Users can remove collaborations" ON "public"."trip_collaborators" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_collaborators"."trip_id") AND ("trips"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can save guides" ON "public"."saved_guides" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can see who follows them" ON "public"."guide_follows" FOR SELECT USING (("auth"."uid"() = "followed_id"));



CREATE POLICY "Users can unfollow" ON "public"."creator_follows" FOR DELETE TO "authenticated" USING (("follower_id" = "auth"."uid"()));



CREATE POLICY "Users can unlock achievements" ON "public"."achievement_unlocks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unsave guides" ON "public"."saved_guides" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update intents for their trips" ON "public"."trip_intents" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_intents"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_intents"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can update own enrichment data" ON "public"."user_enrichment" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own free tier status" ON "public"."free_tier_status" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own guides" ON "public"."guides" FOR UPDATE USING ((("guide_type" = 'user'::"text") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can update own manual entries" ON "public"."guide_manual_entries" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own or collaborated trips" ON "public"."trips" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_trip_collaborator"("id", "auth"."uid"(), true))) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_trip_collaborator"("id", "auth"."uid"(), true)));



CREATE POLICY "Users can update own photos" ON "public"."trip_photos" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own quiz responses" ON "public"."quiz_responses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own quiz sessions" ON "public"."quiz_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own reviews" ON "public"."guide_activity_reviews" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own reviews" ON "public"."trip_reviews" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own saved items" ON "public"."saved_items" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own social links" ON "public"."user_social_links" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own templates" ON "public"."itinerary_templates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own travel DNA" ON "public"."travel_dna_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own trip activities" ON "public"."trip_activities" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_activities"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own trip ratings" ON "public"."trip_ratings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own unlocks" ON "public"."achievement_unlocks" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own usage" ON "public"."user_usage" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own votes" ON "public"."suggestion_votes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own consent records" ON "public"."consent_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own day balance" ON "public"."day_balances" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own day summaries" ON "public"."trip_day_summaries" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own departure summaries" ON "public"."trip_departure_summaries" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own feedback" ON "public"."activity_feedback" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own feedback" ON "public"."trip_feedback_responses" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own go-back list items" ON "public"."trip_go_back_list" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own insights" ON "public"."user_preference_insights" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own itinerary versions" ON "public"."itinerary_versions" FOR UPDATE USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own memories" ON "public"."trip_memories" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."trip_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own rental cars" ON "public"."trip_rental_cars" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own reviews" ON "public"."customer_reviews" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own suggestions" ON "public"."trip_suggestions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own trip activities" ON "public"."itinerary_activities" FOR UPDATE USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text"])) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can update their own trip days" ON "public"."itinerary_days" FOR UPDATE USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text"])) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can update their own trip intel cache" ON "public"."travel_intel_cache" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "travel_intel_cache"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own trip learnings" ON "public"."trip_learnings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own trip notes" ON "public"."trip_notes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own usage" ON "public"."trip_action_usage" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their trip budget entries" ON "public"."trip_budget_ledger" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_budget_ledger"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their trip cities" ON "public"."trip_cities" FOR UPDATE USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL) AND ("trip_collaborators"."permission" = ANY (ARRAY['edit'::"text", 'admin'::"text"])))))));



CREATE POLICY "Users can upload photos to own trips" ON "public"."trip_photos" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_photos"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view accepted friends profiles" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE (("friendships"."requester_id" = "auth"."uid"()) AND ("friendships"."addressee_id" = "profiles"."id") AND ("friendships"."status" = 'accepted'::"public"."friendship_status")))) OR (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE (("friendships"."addressee_id" = "auth"."uid"()) AND ("friendships"."requester_id" = "profiles"."id") AND ("friendships"."status" = 'accepted'::"public"."friendship_status")))) OR (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE (("friendships"."addressee_id" = "auth"."uid"()) AND ("friendships"."requester_id" = "profiles"."id") AND ("friendships"."status" = 'pending'::"public"."friendship_status")))) OR (EXISTS ( SELECT 1
   FROM ("public"."trip_collaborators" "tc"
     JOIN "public"."trips" "t" ON (("t"."id" = "tc"."trip_id")))
  WHERE ((("t"."user_id" = "auth"."uid"()) AND ("tc"."user_id" = "profiles"."id") AND ("tc"."accepted_at" IS NOT NULL)) OR (("tc"."user_id" = "auth"."uid"()) AND ("t"."user_id" = "profiles"."id") AND ("tc"."accepted_at" IS NOT NULL))))))));



CREATE POLICY "Users can view expense splits" ON "public"."expense_splits" FOR SELECT USING (("expense_id" IN ( SELECT "te"."id"
   FROM "public"."trip_expenses" "te"
  WHERE (("te"."trip_id" IN ( SELECT "trips"."id"
           FROM "public"."trips"
          WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("te"."trip_id" IN ( SELECT "trip_members"."trip_id"
           FROM "public"."trip_members"
          WHERE ("trip_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view intents for their trips" ON "public"."trip_intents" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_intents"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can view logs for their trips" ON "public"."generation_logs" FOR SELECT TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own DNA history" ON "public"."travel_dna_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own IAP transactions" ON "public"."iap_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own achievement unlocks" ON "public"."achievement_unlocks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own and collaborated trips" ON "public"."trips" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."is_trip_collaborator"("id", "auth"."uid"(), false)));



CREATE POLICY "Users can view own audit logs" ON "public"."audit_logs" FOR SELECT USING (((("auth"."uid"())::"text" = "user_id") OR "public"."has_role"('admin'::"public"."app_role")));



CREATE POLICY "Users can view own credit purchases" ON "public"."credit_purchases" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own credit transactions" ON "public"."credit_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own credits" ON "public"."user_credits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own customization requests" ON "public"."itinerary_customization_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own daily usage" ON "public"."daily_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own enrichment data" ON "public"."user_enrichment" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own founding member row" ON "public"."founding_member_tracker" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own free tier status" ON "public"."free_tier_status" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own friendships" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));



CREATE POLICY "Users can view own overrides" ON "public"."user_entitlement_overrides" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own pending charges" ON "public"."pending_credit_charges" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own quiz responses" ON "public"."quiz_responses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own quiz sessions" ON "public"."quiz_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own referral codes" ON "public"."referral_codes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own reviews" ON "public"."trip_reviews" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own saved guides" ON "public"."saved_guides" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own saved items" ON "public"."saved_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own templates" ON "public"."itinerary_templates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own trip activities" ON "public"."trip_activities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_activities"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own trip photos" ON "public"."trip_photos" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own trip ratings" ON "public"."trip_ratings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own usage" ON "public"."user_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view profiles of outgoing pending requests" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."friendships" "f"
  WHERE (("f"."requester_id" = "auth"."uid"()) AND ("f"."addressee_id" = "profiles"."id") AND ("f"."status" = 'pending'::"public"."friendship_status")))));



CREATE POLICY "Users can view profiles of trip co-members" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "tm"."user_id"
   FROM "public"."trip_members" "tm"
  WHERE (("tm"."user_id" IS NOT NULL) AND ("tm"."accepted_at" IS NOT NULL) AND ("tm"."trip_id" IN ( SELECT "tm2"."trip_id"
           FROM "public"."trip_members" "tm2"
          WHERE (("tm2"."user_id" = "auth"."uid"()) AND ("tm2"."accepted_at" IS NOT NULL))))))));



CREATE POLICY "Users can view settlements" ON "public"."trip_settlements" FOR SELECT USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_members"."trip_id"
   FROM "public"."trip_members"
  WHERE ("trip_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own bonuses" ON "public"."user_credit_bonuses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own consent records" ON "public"."consent_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own credit balance" ON "public"."credit_balances" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own credit history" ON "public"."credit_ledger" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own day balance" ON "public"."day_balances" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own day summaries" ON "public"."trip_day_summaries" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own departure summaries" ON "public"."trip_departure_summaries" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own events" ON "public"."voyance_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own feedback" ON "public"."activity_feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own feedback" ON "public"."trip_feedback_responses" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own go-back list items" ON "public"."trip_go_back_list" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own insights" ON "public"."user_preference_insights" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own invites" ON "public"."trip_invites" FOR SELECT TO "authenticated" USING ((("auth"."uid"() IS NOT NULL) AND (("invited_by" = "auth"."uid"()) OR ("accepted_by" = "auth"."uid"()) OR ("email" = "public"."get_current_user_email"()) OR (EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_invites"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view their own itinerary versions" ON "public"."itinerary_versions" FOR SELECT USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own ledger" ON "public"."day_ledger" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own memories" ON "public"."trip_memories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own prompt log" ON "public"."feedback_prompt_log" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own rental cars" ON "public"."trip_rental_cars" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own reviews" ON "public"."customer_reviews" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own trip activities" ON "public"."itinerary_activities" FOR SELECT USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can view their own trip days" ON "public"."itinerary_days" FOR SELECT USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can view their own trip intel cache" ON "public"."travel_intel_cache" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "travel_intel_cache"."trip_id") AND (("t"."user_id" = "auth"."uid"()) OR "public"."is_trip_collaborator"("t"."id", "auth"."uid"()))))));



CREATE POLICY "Users can view their own trip learnings" ON "public"."trip_learnings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own trip notes" ON "public"."trip_notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own trip notifications" ON "public"."trip_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own usage" ON "public"."trip_action_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their trip budget ledger" ON "public"."trip_budget_ledger" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trips"
  WHERE (("trips"."id" = "trip_budget_ledger"."trip_id") AND ("trips"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their trip cities" ON "public"."trip_cities" FOR SELECT USING ((("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))) OR ("trip_id" IN ( SELECT "trip_collaborators"."trip_id"
   FROM "public"."trip_collaborators"
  WHERE (("trip_collaborators"."user_id" = "auth"."uid"()) AND ("trip_collaborators"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can view travel DNA" ON "public"."travel_dna_profiles" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE (("friendships"."status" = 'accepted'::"public"."friendship_status") AND ((("friendships"."requester_id" = "auth"."uid"()) AND ("friendships"."addressee_id" = "travel_dna_profiles"."user_id")) OR (("friendships"."addressee_id" = "auth"."uid"()) AND ("friendships"."requester_id" = "travel_dna_profiles"."user_id"))))))));



CREATE POLICY "Users can view votes on their trip suggestions" ON "public"."suggestion_votes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."trip_suggestions" "ts"
     JOIN "public"."trips" "t" ON (("t"."id" = "ts"."trip_id")))
  WHERE (("ts"."id" = "suggestion_votes"."suggestion_id") AND (("t"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."trip_collaborators" "tc"
          WHERE (("tc"."trip_id" = "t"."id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL)))))))));



CREATE POLICY "Users manage own follows" ON "public"."guide_follows" USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users manage own guides" ON "public"."travel_guides" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own trip date versions" ON "public"."trip_date_versions" TO "authenticated" USING (("trip_id" IN ( SELECT "trips"."id"
   FROM "public"."trips"
  WHERE ("trips"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users read own drift log" ON "public"."trait_drift_log" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own referrals" ON "public"."referrals" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "referrer_id") OR ("auth"."uid"() = "referee_id")));



CREATE POLICY "Verified venues are publicly readable" ON "public"."verified_venues" FOR SELECT USING (true);



CREATE POLICY "View trip day intents" ON "public"."trip_day_intents" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_day_intents"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_day_intents"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Voyance picks are publicly readable" ON "public"."voyance_picks" FOR SELECT USING (true);



ALTER TABLE "public"."achievement_unlocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_costs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_quality_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_booking_segments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_communications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_invoices_delete" ON "public"."agency_invoices" FOR DELETE TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agency_invoices_insert" ON "public"."agency_invoices" FOR INSERT TO "authenticated" WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "agency_invoices_select" ON "public"."agency_invoices" FOR SELECT TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agency_invoices_update" ON "public"."agency_invoices" FOR UPDATE TO "authenticated" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



ALTER TABLE "public"."agency_payment_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_quotes_delete" ON "public"."agency_quotes" FOR DELETE TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agency_quotes_insert" ON "public"."agency_quotes" FOR INSERT TO "authenticated" WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "agency_quotes_select" ON "public"."agency_quotes" FOR SELECT TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agency_quotes_update" ON "public"."agency_quotes" FOR UPDATE TO "authenticated" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



ALTER TABLE "public"."agency_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_travelers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_trip_travelers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_clients_delete" ON "public"."agent_clients" FOR DELETE TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agent_clients_insert" ON "public"."agent_clients" FOR INSERT TO "authenticated" WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "agent_clients_select" ON "public"."agent_clients" FOR SELECT TO "authenticated" USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agent_clients_update" ON "public"."agent_clients" FOR UPDATE TO "authenticated" USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



ALTER TABLE "public"."agent_itinerary_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."airport_transfer_fares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."airports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."archetype_destination_guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."archetype_pacing_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attractions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_idempotency_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_idempotency_cache_deny_non_service" ON "public"."chat_idempotency_cache" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."city_landmarks_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_change_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_reference" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_purchases: deny anon all" ON "public"."credit_purchases" AS RESTRICTIVE TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "credit_purchases: deny authenticated DELETE" ON "public"."credit_purchases" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "credit_purchases: deny authenticated INSERT" ON "public"."credit_purchases" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "credit_purchases: deny authenticated UPDATE" ON "public"."credit_purchases" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."curated_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curated_images_service_role_manage" ON "public"."curated_images" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."customer_review_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_review_contacts_owner_insert" ON "public"."customer_review_contacts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."customer_reviews" "cr"
  WHERE (("cr"."id" = "customer_review_contacts"."review_id") AND ("cr"."user_id" = "auth"."uid"())))));



CREATE POLICY "customer_review_contacts_owner_read" ON "public"."customer_review_contacts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."customer_reviews" "cr"
  WHERE (("cr"."id" = "customer_review_contacts"."review_id") AND ("cr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."customer_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_reviews_owner_read" ON "public"."customer_reviews" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."daily_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."day_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."day_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destination_cost_index" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destination_fallbacks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destination_image_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destination_insights_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "destination_insights_cache_deny_non_service" ON "public"."destination_insights_cache" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."destinations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_splits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_prompt_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_commission_imports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_ledger_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_payout_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_payout_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."founding_member_tracker" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."free_tier_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generation_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "generation_logs_no_user_deletes" ON "public"."generation_logs" FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "generation_logs_no_user_updates" ON "public"."generation_logs" FOR UPDATE TO "authenticated", "anon" USING (false);



CREATE POLICY "generation_logs_no_user_writes" ON "public"."generation_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



ALTER TABLE "public"."geocoding_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_api_budget" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_places_search_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "google_places_search_cache_deny_non_service" ON "public"."google_places_search_cache" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."group_budget_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_unlocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_unlocks: deny anon all" ON "public"."group_unlocks" AS RESTRICTIVE TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "group_unlocks: deny authenticated DELETE" ON "public"."group_unlocks" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "group_unlocks: deny authenticated UPDATE" ON "public"."group_unlocks" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."guide_activity_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guide_content_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guide_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guide_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guide_manual_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guide_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guide_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."iap_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "iap_transactions_owner_read" ON "public"."iap_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."image_quality_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invite_failure_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itinerary_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itinerary_customization_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itinerary_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itinerary_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itinerary_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_credit_charges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personalization_tag_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."route_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "route_cache_no_user_deletes" ON "public"."route_cache" FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "route_cache_no_user_updates" ON "public"."route_cache" FOR UPDATE TO "authenticated", "anon" USING (false);



CREATE POLICY "route_cache_no_user_writes" ON "public"."route_cache" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "route_cache_public_read" ON "public"."route_cache" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "route_cache_service_role_write" ON "public"."route_cache" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."saved_guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "self_collaborator_read" ON "public"."trip_collaborators" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."site_image_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_webhook_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe_webhook_log_deny_non_service" ON "public"."stripe_webhook_log" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."suggestion_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trait_drift_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_dna_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_dna_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_guides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_intel_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_intel_locks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travel_intel_locks_deny_non_service" ON "public"."travel_intel_locks" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."trip_action_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_blogs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_budget_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_complexity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_cost_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_date_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_day_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_day_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_departure_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_feedback_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_generation_llm_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_generation_mutations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_generation_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_generation_traces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_go_back_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_learnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_members_owner_read" ON "public"."trip_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_members"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "trip_members_self_read" ON "public"."trip_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."trip_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_owner_collaborator_read" ON "public"."trip_collaborators" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_collaborators"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."trip_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_payments_delete" ON "public"."trip_payments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_payments"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "trip_payments_insert" ON "public"."trip_payments" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_payments"."trip_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "trip_payments_select" ON "public"."trip_payments" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_payments"."trip_id") AND ("t"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."trip_collaborators" "tc"
  WHERE (("tc"."trip_id" = "trip_payments"."trip_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."accepted_at" IS NOT NULL))))));



CREATE POLICY "trip_payments_update" ON "public"."trip_payments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."trips" "t"
  WHERE (("t"."id" = "trip_payments"."trip_id") AND ("t"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."trip_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_rental_cars" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_suggestion_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credit_bonuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_enrichment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_entitlement_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preference_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_social_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verified_venues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voyance_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voyance_picks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "voyance_picks_restrict_writes_to_admins" ON "public"."voyance_picks" AS RESTRICTIVE TO "authenticated", "anon" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."itinerary_days";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."trip_chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."trip_cities";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."trip_collaborators";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."trip_notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."trip_suggestion_votes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."trip_suggestions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."trips";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."_scrub_itinerary_prompt_artifacts"("p_itin" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_scrub_itinerary_prompt_artifacts"("p_itin" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scrub_itinerary_prompt_artifacts"("p_itin" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."_strip_prompt_artifacts_in_activities"("acts" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_strip_prompt_artifacts_in_activities"("acts" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_strip_prompt_artifacts_in_activities"("acts" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."_trips_scrub_itinerary_artifacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trips_scrub_itinerary_artifacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trips_scrub_itinerary_artifacts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_shared_trip"("p_share_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_shared_trip"("p_share_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_shared_trip"("p_share_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."add_to_group_budget"("p_budget_id" "uuid", "p_credits" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_to_group_budget"("p_budget_id" "uuid", "p_credits" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_orphan_trip_payments"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_orphan_trip_payments"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_founding_member"("p_user_id" "uuid", "p_stripe_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_founding_member"("p_user_id" "uuid", "p_stripe_session_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bump_archetype_guide_usage"("p_archetype" "text", "p_destination_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bump_archetype_guide_usage"("p_archetype" "text", "p_destination_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bump_places_cache_hit"("p_cache_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bump_places_cache_hit"("p_cache_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bump_venue_usage"("p_place_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bump_venue_usage"("p_place_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_first_trip_benefit"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_first_trip_benefit"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."claim_first_trip_benefit"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cleanup_expired_search_cache"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_expired_search_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_venues"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_venues"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_venues"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_itinerary_versions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_itinerary_versions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_rate_limits"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_rate_limits"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_stale_intel_locks"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_stale_intel_locks"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_quiz"("_prefs" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_quiz"("_prefs" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."complete_quiz"("_prefs" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."consume_free_edit"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_free_edit"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_google_budget"("p_cost" numeric, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_google_budget"("p_cost" numeric, "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."deduct_credits_fifo"("p_user_id" "uuid", "p_cost" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deduct_credits_fifo"("p_user_id" "uuid", "p_cost" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_stale_trip_payments"("p_trip_id" "uuid", "p_max_age_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_stale_trip_payments"("p_trip_id" "uuid", "p_max_age_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."fulfill_credit_purchase"("p_user_id" "uuid", "p_credits" integer, "p_bonus_credits" integer, "p_credit_type" "text", "p_stripe_session_id" "text", "p_amount_cents" integer, "p_club_tier" "text", "p_product_id" "text", "p_price_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fulfill_credit_purchase"("p_user_id" "uuid", "p_credits" integer, "p_bonus_credits" integer, "p_credit_type" "text", "p_stripe_session_id" "text", "p_amount_cents" integer, "p_club_tier" "text", "p_product_id" "text", "p_price_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_booking_reference"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_intake_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_intake_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_intake_token"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_invoice_number"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_share_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_share_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_share_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_share_token"("size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_share_token"("size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_share_token"("size" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_consumer_shared_trip"("p_share_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_consumer_shared_trip"("p_share_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_consumer_shared_trip"("p_share_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_consumer_shared_trip"("p_share_token" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."get_current_user_email"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_user_email"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_current_user_email"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_founding_member_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_founding_member_count"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_founding_member_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_founding_member_count"() TO "anon";



REVOKE ALL ON FUNCTION "public"."get_intake_account"("p_intake_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_intake_account"("p_intake_token" "text") TO "service_role";



GRANT ALL ON TABLE "public"."trips" TO "anon";
GRANT ALL ON TABLE "public"."trips" TO "authenticated";
GRANT ALL ON TABLE "public"."trips" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_journey_trips"("p_journey_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_journey_trips"("p_journey_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_platform_destination_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_destination_count"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_destination_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_destination_count"() TO "anon";



REVOKE ALL ON FUNCTION "public"."get_platform_trip_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_platform_trip_count"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_platform_trip_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_trip_count"() TO "anon";



REVOKE ALL ON FUNCTION "public"."get_shared_trip_payload"("p_share_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_shared_trip_payload"("p_share_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_shared_trip_payload"("p_share_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_trip_payload"("p_share_token" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."get_trip_invite_info"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_trip_invite_info"("p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_trip_invite_info"("p_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_trip_permission"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_trip_permission"("p_trip_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_trip_permission"("p_trip_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_unit_economics_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_unit_economics_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_unit_economics_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_id_by_email"("lookup_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("lookup_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("lookup_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_info_by_email"("lookup_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_info_by_email"("lookup_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_info_by_email"("lookup_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_trip_ids"("uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_trip_ids"("uid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_user_trip_ids"("uid" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user_free_tier"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user_free_tier"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_daily_usage"("p_user_id" "uuid", "p_action_type" "text", "p_usage_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_daily_usage"("p_user_id" "uuid", "p_action_type" "text", "p_usage_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_itinerary_version"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_itinerary_version"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_user_usage"("p_user_id" "uuid", "p_metric_key" "text", "p_period" "text", "p_amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_user_usage"("p_user_id" "uuid", "p_metric_key" "text", "p_period" "text", "p_amount" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_user_id" "text", "p_actor" "text", "p_target" "text", "p_target_id" "text", "p_action_type" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "text", "p_user_id" "text", "p_actor" "text", "p_target" "text", "p_target_id" "text", "p_action_type" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_user_audit_log"("p_action" "text", "p_action_type" "text", "p_target" "text", "p_target_id" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_user_audit_log"("p_action" "text", "p_action_type" "text", "p_target" "text", "p_target_id" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_trip_collaborator"("p_trip_id" "uuid", "p_user_id" "uuid", "p_require_edit" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_trip_collaborator"("p_trip_id" "uuid", "p_user_id" "uuid", "p_require_edit" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."is_trip_collaborator"("p_trip_id" "uuid", "p_user_id" "uuid", "p_require_edit" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_trip_member"("p_trip_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_trip_member"("p_trip_id" "uuid", "p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_trip_member"("p_trip_id" "uuid", "p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_trip_owner"("p_trip_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."itinerary_days_scrub_activities"() TO "anon";
GRANT ALL ON FUNCTION "public"."itinerary_days_scrub_activities"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."itinerary_days_scrub_activities"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_trip_members_on_join"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_trip_members_on_join"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."optimistic_update_itinerary"("p_trip_id" "uuid", "p_expected_version" integer, "p_itinerary_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."optimistic_update_itinerary"("p_trip_id" "uuid", "p_expected_version" integer, "p_itinerary_data" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."optimistic_update_itinerary"("p_trip_id" "uuid", "p_expected_version" integer, "p_itinerary_data" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."prevent_permission_self_escalation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_permission_self_escalation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_self_collaboration"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_self_collaboration"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_itinerary_versions_per_trip"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_itinerary_versions_per_trip"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reconcile_credit_balances"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_credit_balances"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rescue_orphan_cost_row"("p_trip_id" "uuid", "p_day_number" integer, "p_category" "text", "p_new_activity_id" "uuid", "p_live_activity_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rescue_orphan_cost_row"("p_trip_id" "uuid", "p_day_number" integer, "p_category" "text", "p_new_activity_id" "uuid", "p_live_activity_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_or_rotate_invite"("p_trip_id" "uuid", "p_force_rotate" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_or_rotate_invite"("p_trip_id" "uuid", "p_force_rotate" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."resolve_or_rotate_invite"("p_trip_id" "uuid", "p_force_rotate" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb", "p_derivation_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb", "p_derivation_source" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."save_onboarding_dna"("p_user_id" "uuid", "p_primary_archetype" "text", "p_secondary_archetype" "text", "p_confidence" integer, "p_trait_scores" "jsonb", "p_preferences" "jsonb", "p_derivation_source" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."scrub_itinerary_activities"("acts" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."scrub_itinerary_activities"("acts" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."scrub_itinerary_activities"("acts" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."scrub_itinerary_meal_suffix"() TO "anon";
GRANT ALL ON FUNCTION "public"."scrub_itinerary_meal_suffix"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."scrub_itinerary_meal_suffix"() TO "service_role";



GRANT ALL ON FUNCTION "public"."scrub_itinerary_prompt_artifacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."scrub_itinerary_prompt_artifacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."scrub_itinerary_prompt_artifacts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_booking_reference"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_booking_reference"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."spend_from_group_budget"("p_budget_id" "uuid", "p_cost" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."spend_from_group_budget"("p_budget_id" "uuid", "p_cost" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."strip_verified_venue_meal_suffix"() TO "anon";
GRANT ALL ON FUNCTION "public"."strip_verified_venue_meal_suffix"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."strip_verified_venue_meal_suffix"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_client_intake"("p_intake_token" "text", "p_legal_first_name" "text", "p_legal_last_name" "text", "p_preferred_name" "text", "p_email" "text", "p_phone" "text", "p_date_of_birth" "date", "p_gender" "text", "p_passport_country" "text", "p_passport_expiry" "date", "p_seat_preference" "text", "p_meal_preference" "text", "p_dietary_restrictions" "text"[], "p_allergies" "text"[], "p_mobility_needs" "text", "p_medical_notes" "text", "p_emergency_contact" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_client_intake"("p_intake_token" "text", "p_legal_first_name" "text", "p_legal_last_name" "text", "p_preferred_name" "text", "p_email" "text", "p_phone" "text", "p_date_of_birth" "date", "p_gender" "text", "p_passport_country" "text", "p_passport_expiry" "date", "p_seat_preference" "text", "p_meal_preference" "text", "p_dietary_restrictions" "text"[], "p_allergies" "text"[], "p_mobility_needs" "text", "p_medical_notes" "text", "p_emergency_contact" "jsonb", "p_notes" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_client_intake"("p_intake_token" "text", "p_legal_first_name" "text", "p_legal_last_name" "text", "p_preferred_name" "text", "p_email" "text", "p_phone" "text", "p_date_of_birth" "date", "p_gender" "text", "p_passport_country" "text", "p_passport_expiry" "date", "p_seat_preference" "text", "p_meal_preference" "text", "p_dietary_restrictions" "text"[], "p_allergies" "text"[], "p_mobility_needs" "text", "p_medical_notes" "text", "p_emergency_contact" "jsonb", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."sweep_stale_pending_charges"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sweep_stale_pending_charges"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_activity_cost_to_itinerary_jsonb"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_activity_cost_to_itinerary_jsonb"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_expired_credit_balances"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_expired_credit_balances"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_consumer_trip_share"("p_trip_id" "uuid", "p_enabled" boolean, "p_permission" "text", "p_credit_policy" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_consumer_trip_share"("p_trip_id" "uuid", "p_enabled" boolean, "p_permission" "text", "p_credit_policy" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_consumer_trip_share"("p_trip_id" "uuid", "p_enabled" boolean, "p_permission" "text", "p_credit_policy" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_consumer_trip_share"("p_trip_id" "uuid", "p_enabled" boolean, "p_permission" "text", "p_credit_policy" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_booking_state"("p_activity_id" "uuid", "p_new_state" "public"."booking_item_state", "p_trigger_source" "text", "p_trigger_reference" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_booking_state"("p_activity_id" "uuid", "p_new_state" "public"."booking_item_state", "p_trigger_source" "text", "p_trigger_reference" "text", "p_metadata" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."transition_booking_state"("p_activity_id" "uuid", "p_new_state" "public"."booking_item_state", "p_trigger_source" "text", "p_trigger_reference" "text", "p_metadata" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."trips_scrub_itinerary_days"() TO "anon";
GRANT ALL ON FUNCTION "public"."trips_scrub_itinerary_days"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trips_scrub_itinerary_days"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_budget_ledger_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_budget_ledger_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_budget_ledger_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_collaborator_permission"("p_collaborator_id" "uuid", "p_permission" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_collaborator_permission"("p_collaborator_id" "uuid", "p_permission" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_collaborator_permission"("p_collaborator_id" "uuid", "p_permission" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_itinerary_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_itinerary_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_itinerary_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_travel_guides_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_travel_guides_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_travel_guides_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_verified_venues_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_verified_venues_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_verified_venues_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_activity_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_activity_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_activity_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_travel_guide_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_travel_guide_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_travel_guide_status"() TO "service_role";
























GRANT ALL ON TABLE "public"."achievement_unlocks" TO "anon";
GRANT ALL ON TABLE "public"."achievement_unlocks" TO "authenticated";
GRANT ALL ON TABLE "public"."achievement_unlocks" TO "service_role";



GRANT ALL ON TABLE "public"."achievements" TO "anon";
GRANT ALL ON TABLE "public"."achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."achievements" TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_catalog" TO "anon";
GRANT ALL ON TABLE "public"."activity_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."activity_costs" TO "anon";
GRANT ALL ON TABLE "public"."activity_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_costs" TO "service_role";



GRANT ALL ON TABLE "public"."activity_feedback" TO "anon";
GRANT ALL ON TABLE "public"."activity_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."activity_quality_scores" TO "anon";
GRANT ALL ON TABLE "public"."activity_quality_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_quality_scores" TO "service_role";



GRANT ALL ON TABLE "public"."agency_accounts" TO "anon";
GRANT ALL ON TABLE "public"."agency_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."agency_accounts_intake" TO "anon";
GRANT ALL ON TABLE "public"."agency_accounts_intake" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_accounts_intake" TO "service_role";



GRANT ALL ON TABLE "public"."agency_booking_segments" TO "anon";
GRANT ALL ON TABLE "public"."agency_booking_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_booking_segments" TO "service_role";



GRANT ALL ON TABLE "public"."agency_communications" TO "anon";
GRANT ALL ON TABLE "public"."agency_communications" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_communications" TO "service_role";



GRANT ALL ON TABLE "public"."agency_documents" TO "anon";
GRANT ALL ON TABLE "public"."agency_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_documents" TO "service_role";



GRANT ALL ON TABLE "public"."agency_invoices" TO "anon";
GRANT ALL ON TABLE "public"."agency_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."agency_payment_schedules" TO "anon";
GRANT ALL ON TABLE "public"."agency_payment_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_payment_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."agency_payments" TO "anon";
GRANT ALL ON TABLE "public"."agency_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_payments" TO "service_role";



GRANT ALL ON TABLE "public"."agency_quotes" TO "anon";
GRANT ALL ON TABLE "public"."agency_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."agency_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."agency_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."agency_tasks" TO "anon";
GRANT ALL ON TABLE "public"."agency_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."agency_travelers" TO "anon";
GRANT ALL ON TABLE "public"."agency_travelers" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_travelers" TO "service_role";



GRANT ALL ON TABLE "public"."agency_trip_travelers" TO "anon";
GRANT ALL ON TABLE "public"."agency_trip_travelers" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_trip_travelers" TO "service_role";



GRANT ALL ON TABLE "public"."agency_trips" TO "anon";
GRANT ALL ON TABLE "public"."agency_trips" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_trips" TO "service_role";



GRANT ALL ON TABLE "public"."agent_clients" TO "anon";
GRANT ALL ON TABLE "public"."agent_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_clients" TO "service_role";



GRANT ALL ON TABLE "public"."agent_itinerary_library" TO "anon";
GRANT ALL ON TABLE "public"."agent_itinerary_library" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_itinerary_library" TO "service_role";



GRANT ALL ON TABLE "public"."airport_transfer_fares" TO "anon";
GRANT ALL ON TABLE "public"."airport_transfer_fares" TO "authenticated";
GRANT ALL ON TABLE "public"."airport_transfer_fares" TO "service_role";



GRANT ALL ON TABLE "public"."airports" TO "anon";
GRANT ALL ON TABLE "public"."airports" TO "authenticated";
GRANT ALL ON TABLE "public"."airports" TO "service_role";



GRANT ALL ON TABLE "public"."archetype_destination_guides" TO "anon";
GRANT ALL ON TABLE "public"."archetype_destination_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."archetype_destination_guides" TO "service_role";



GRANT ALL ON TABLE "public"."archetype_pacing_stats" TO "anon";
GRANT ALL ON TABLE "public"."archetype_pacing_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."archetype_pacing_stats" TO "service_role";



GRANT ALL ON TABLE "public"."attractions" TO "anon";
GRANT ALL ON TABLE "public"."attractions" TO "authenticated";
GRANT ALL ON TABLE "public"."attractions" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."audit_logs" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."chat_idempotency_cache" TO "service_role";



GRANT ALL ON TABLE "public"."city_landmarks_cache" TO "anon";
GRANT ALL ON TABLE "public"."city_landmarks_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."city_landmarks_cache" TO "service_role";



GRANT ALL ON TABLE "public"."client_errors" TO "anon";
GRANT ALL ON TABLE "public"."client_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."client_errors" TO "service_role";



GRANT ALL ON TABLE "public"."community_guides" TO "anon";
GRANT ALL ON TABLE "public"."community_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."community_guides" TO "service_role";



GRANT ALL ON TABLE "public"."consent_records" TO "anon";
GRANT ALL ON TABLE "public"."consent_records" TO "authenticated";
GRANT ALL ON TABLE "public"."consent_records" TO "service_role";



GRANT ALL ON TABLE "public"."cost_change_log" TO "anon";
GRANT ALL ON TABLE "public"."cost_change_log" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_change_log" TO "service_role";



GRANT ALL ON TABLE "public"."cost_reference" TO "anon";
GRANT ALL ON TABLE "public"."cost_reference" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_reference" TO "service_role";



GRANT ALL ON TABLE "public"."creator_follows" TO "anon";
GRANT ALL ON TABLE "public"."creator_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_follows" TO "service_role";



GRANT ALL ON TABLE "public"."credit_balances" TO "anon";
GRANT ALL ON TABLE "public"."credit_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_balances" TO "service_role";



GRANT ALL ON TABLE "public"."credit_ledger" TO "anon";
GRANT ALL ON TABLE "public"."credit_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."credit_ledger_safe" TO "anon";
GRANT ALL ON TABLE "public"."credit_ledger_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_ledger_safe" TO "service_role";



GRANT ALL ON TABLE "public"."credit_purchases" TO "anon";
GRANT ALL ON TABLE "public"."credit_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."curated_images" TO "anon";
GRANT ALL ON TABLE "public"."curated_images" TO "authenticated";
GRANT ALL ON TABLE "public"."curated_images" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customer_review_contacts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customer_review_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_review_contacts" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."customer_reviews" TO "anon";
GRANT ALL ON TABLE "public"."customer_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_reviews" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("rating") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("review_text") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("trip_destination") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("archetype") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("is_featured") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("photo_consent") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."customer_reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."daily_usage" TO "anon";
GRANT ALL ON TABLE "public"."daily_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_usage" TO "service_role";



GRANT ALL ON TABLE "public"."day_balances" TO "anon";
GRANT ALL ON TABLE "public"."day_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."day_balances" TO "service_role";



GRANT ALL ON TABLE "public"."day_ledger" TO "anon";
GRANT ALL ON TABLE "public"."day_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."day_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."destination_cost_index" TO "anon";
GRANT ALL ON TABLE "public"."destination_cost_index" TO "authenticated";
GRANT ALL ON TABLE "public"."destination_cost_index" TO "service_role";



GRANT ALL ON TABLE "public"."destination_fallbacks" TO "anon";
GRANT ALL ON TABLE "public"."destination_fallbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."destination_fallbacks" TO "service_role";



GRANT ALL ON TABLE "public"."destination_image_cache" TO "anon";
GRANT ALL ON TABLE "public"."destination_image_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."destination_image_cache" TO "service_role";



GRANT ALL ON TABLE "public"."destination_insights_cache" TO "service_role";



GRANT ALL ON TABLE "public"."destinations" TO "anon";
GRANT ALL ON TABLE "public"."destinations" TO "authenticated";
GRANT ALL ON TABLE "public"."destinations" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."expense_splits" TO "anon";
GRANT ALL ON TABLE "public"."expense_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_splits" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_prompt_log" TO "anon";
GRANT ALL ON TABLE "public"."feedback_prompt_log" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_prompt_log" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_prompts" TO "anon";
GRANT ALL ON TABLE "public"."feedback_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."finance_commission_imports" TO "anon";
GRANT ALL ON TABLE "public"."finance_commission_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_commission_imports" TO "service_role";



GRANT ALL ON TABLE "public"."finance_ledger_entries" TO "anon";
GRANT ALL ON TABLE "public"."finance_ledger_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_ledger_entries" TO "service_role";



GRANT ALL ON TABLE "public"."finance_payout_lines" TO "anon";
GRANT ALL ON TABLE "public"."finance_payout_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payout_lines" TO "service_role";



GRANT ALL ON TABLE "public"."finance_payout_runs" TO "anon";
GRANT ALL ON TABLE "public"."finance_payout_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payout_runs" TO "service_role";



GRANT ALL ON TABLE "public"."finance_trip_profit_summary" TO "anon";
GRANT ALL ON TABLE "public"."finance_trip_profit_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_trip_profit_summary" TO "service_role";



GRANT ALL ON TABLE "public"."founding_member_tracker" TO "anon";
GRANT ALL ON TABLE "public"."founding_member_tracker" TO "authenticated";
GRANT ALL ON TABLE "public"."founding_member_tracker" TO "service_role";



GRANT ALL ON TABLE "public"."free_tier_status" TO "anon";
GRANT ALL ON TABLE "public"."free_tier_status" TO "authenticated";
GRANT ALL ON TABLE "public"."free_tier_status" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."generation_logs" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."generation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."geocoding_cache" TO "anon";
GRANT ALL ON TABLE "public"."geocoding_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."geocoding_cache" TO "service_role";



GRANT ALL ON TABLE "public"."google_api_budget" TO "anon";
GRANT ALL ON TABLE "public"."google_api_budget" TO "authenticated";
GRANT ALL ON TABLE "public"."google_api_budget" TO "service_role";



GRANT ALL ON TABLE "public"."google_places_search_cache" TO "service_role";



GRANT ALL ON TABLE "public"."group_budget_transactions" TO "anon";
GRANT ALL ON TABLE "public"."group_budget_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."group_budget_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."group_budgets" TO "anon";
GRANT ALL ON TABLE "public"."group_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."group_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."group_unlocks" TO "anon";
GRANT ALL ON TABLE "public"."group_unlocks" TO "authenticated";
GRANT ALL ON TABLE "public"."group_unlocks" TO "service_role";



GRANT ALL ON TABLE "public"."guide_activity_reviews" TO "anon";
GRANT ALL ON TABLE "public"."guide_activity_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_activity_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."guide_content_links" TO "anon";
GRANT ALL ON TABLE "public"."guide_content_links" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_content_links" TO "service_role";



GRANT ALL ON TABLE "public"."guide_favorites" TO "anon";
GRANT ALL ON TABLE "public"."guide_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."guide_follows" TO "anon";
GRANT ALL ON TABLE "public"."guide_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_follows" TO "service_role";



GRANT ALL ON TABLE "public"."guide_manual_entries" TO "anon";
GRANT ALL ON TABLE "public"."guide_manual_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_manual_entries" TO "service_role";



GRANT ALL ON TABLE "public"."guide_reports" TO "anon";
GRANT ALL ON TABLE "public"."guide_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_reports" TO "service_role";



GRANT ALL ON TABLE "public"."guide_sections" TO "anon";
GRANT ALL ON TABLE "public"."guide_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_sections" TO "service_role";



GRANT ALL ON TABLE "public"."guides" TO "anon";
GRANT ALL ON TABLE "public"."guides" TO "authenticated";
GRANT ALL ON TABLE "public"."guides" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."iap_transactions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."iap_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."iap_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."image_quality_log" TO "anon";
GRANT ALL ON TABLE "public"."image_quality_log" TO "authenticated";
GRANT ALL ON TABLE "public"."image_quality_log" TO "service_role";



GRANT ALL ON TABLE "public"."image_votes" TO "anon";
GRANT ALL ON TABLE "public"."image_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."image_votes" TO "service_role";



GRANT ALL ON TABLE "public"."invite_failure_log" TO "anon";
GRANT ALL ON TABLE "public"."invite_failure_log" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_failure_log" TO "service_role";



GRANT ALL ON TABLE "public"."itinerary_activities" TO "anon";
GRANT ALL ON TABLE "public"."itinerary_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."itinerary_activities" TO "service_role";



GRANT ALL ON TABLE "public"."itinerary_customization_requests" TO "anon";
GRANT ALL ON TABLE "public"."itinerary_customization_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."itinerary_customization_requests" TO "service_role";



GRANT ALL ON TABLE "public"."itinerary_days" TO "anon";
GRANT ALL ON TABLE "public"."itinerary_days" TO "authenticated";
GRANT ALL ON TABLE "public"."itinerary_days" TO "service_role";



GRANT ALL ON TABLE "public"."itinerary_templates" TO "anon";
GRANT ALL ON TABLE "public"."itinerary_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."itinerary_templates" TO "service_role";



GRANT ALL ON TABLE "public"."itinerary_versions" TO "anon";
GRANT ALL ON TABLE "public"."itinerary_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."itinerary_versions" TO "service_role";



GRANT ALL ON TABLE "public"."page_events" TO "anon";
GRANT ALL ON TABLE "public"."page_events" TO "authenticated";
GRANT ALL ON TABLE "public"."page_events" TO "service_role";



GRANT ALL ON TABLE "public"."pending_credit_charges" TO "anon";
GRANT ALL ON TABLE "public"."pending_credit_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_credit_charges" TO "service_role";



GRANT ALL ON TABLE "public"."personalization_tag_stats" TO "anon";
GRANT ALL ON TABLE "public"."personalization_tag_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."personalization_tag_stats" TO "service_role";



GRANT ALL ON TABLE "public"."plan_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."plan_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_friends" TO "anon";
GRANT ALL ON TABLE "public"."profiles_friends" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_friends" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_public" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_public" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_safe" TO "service_role";



GRANT ALL ON TABLE "public"."public_customer_reviews" TO "anon";
GRANT ALL ON TABLE "public"."public_customer_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."public_customer_reviews" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."trip_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."trip_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."public_trip_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."public_trip_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."trip_members" TO "anon";
GRANT ALL ON TABLE "public"."trip_members" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_members" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("trip_id") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("role") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("invited_at") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("accepted_at") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."trip_members" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."trip_members" TO "authenticated";



GRANT ALL ON TABLE "public"."public_trip_members" TO "authenticated";
GRANT ALL ON TABLE "public"."public_trip_members" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_responses" TO "anon";
GRANT ALL ON TABLE "public"."quiz_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_responses" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_sessions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_sessions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."referral_codes" TO "anon";
GRANT ALL ON TABLE "public"."referral_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_codes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."referrals" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."route_cache" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."route_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."route_cache" TO "service_role";



GRANT ALL ON TABLE "public"."saved_guides" TO "anon";
GRANT ALL ON TABLE "public"."saved_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_guides" TO "service_role";



GRANT ALL ON TABLE "public"."saved_items" TO "anon";
GRANT ALL ON TABLE "public"."saved_items" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_items" TO "service_role";



GRANT ALL ON TABLE "public"."search_cache" TO "anon";
GRANT ALL ON TABLE "public"."search_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."search_cache" TO "service_role";



GRANT ALL ON TABLE "public"."site_image_mappings" TO "anon";
GRANT ALL ON TABLE "public"."site_image_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_image_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_log" TO "service_role";



GRANT ALL ON TABLE "public"."suggestion_votes" TO "anon";
GRANT ALL ON TABLE "public"."suggestion_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."suggestion_votes" TO "service_role";



GRANT ALL ON TABLE "public"."trait_drift_log" TO "anon";
GRANT ALL ON TABLE "public"."trait_drift_log" TO "authenticated";
GRANT ALL ON TABLE "public"."trait_drift_log" TO "service_role";



GRANT ALL ON TABLE "public"."travel_dna_history" TO "anon";
GRANT ALL ON TABLE "public"."travel_dna_history" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_dna_history" TO "service_role";



GRANT ALL ON TABLE "public"."travel_dna_profiles" TO "anon";
GRANT ALL ON TABLE "public"."travel_dna_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_dna_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."travel_guides" TO "anon";
GRANT ALL ON TABLE "public"."travel_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_guides" TO "service_role";



GRANT ALL ON TABLE "public"."travel_intel_cache" TO "anon";
GRANT ALL ON TABLE "public"."travel_intel_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_intel_cache" TO "service_role";



GRANT ALL ON TABLE "public"."travel_intel_locks" TO "service_role";



GRANT ALL ON TABLE "public"."trip_action_usage" TO "anon";
GRANT ALL ON TABLE "public"."trip_action_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_action_usage" TO "service_role";



GRANT ALL ON TABLE "public"."trip_activities" TO "anon";
GRANT ALL ON TABLE "public"."trip_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_activities" TO "service_role";



GRANT ALL ON TABLE "public"."trip_blogs" TO "anon";
GRANT ALL ON TABLE "public"."trip_blogs" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_blogs" TO "service_role";



GRANT ALL ON TABLE "public"."trip_budget_ledger" TO "anon";
GRANT ALL ON TABLE "public"."trip_budget_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_budget_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."trip_budget_summary" TO "anon";
GRANT ALL ON TABLE "public"."trip_budget_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_budget_summary" TO "service_role";



GRANT ALL ON TABLE "public"."trip_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."trip_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."trip_cities" TO "anon";
GRANT ALL ON TABLE "public"."trip_cities" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_cities" TO "service_role";



GRANT ALL ON TABLE "public"."trip_complexity" TO "anon";
GRANT ALL ON TABLE "public"."trip_complexity" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_complexity" TO "service_role";



GRANT ALL ON TABLE "public"."trip_cost_tracking" TO "anon";
GRANT ALL ON TABLE "public"."trip_cost_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_cost_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."trip_cost_summary" TO "anon";
GRANT ALL ON TABLE "public"."trip_cost_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_cost_summary" TO "service_role";



GRANT ALL ON TABLE "public"."trip_date_versions" TO "anon";
GRANT ALL ON TABLE "public"."trip_date_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_date_versions" TO "service_role";



GRANT ALL ON TABLE "public"."trip_day_intents" TO "anon";
GRANT ALL ON TABLE "public"."trip_day_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_day_intents" TO "service_role";



GRANT ALL ON TABLE "public"."trip_day_summaries" TO "anon";
GRANT ALL ON TABLE "public"."trip_day_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_day_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."trip_departure_summaries" TO "anon";
GRANT ALL ON TABLE "public"."trip_departure_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_departure_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."trip_expenses" TO "anon";
GRANT ALL ON TABLE "public"."trip_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."trip_feedback_responses" TO "anon";
GRANT ALL ON TABLE "public"."trip_feedback_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_feedback_responses" TO "service_role";



GRANT ALL ON TABLE "public"."trip_finance_ledger" TO "anon";
GRANT ALL ON TABLE "public"."trip_finance_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_finance_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."trip_generation_llm_calls" TO "anon";
GRANT ALL ON TABLE "public"."trip_generation_llm_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_generation_llm_calls" TO "service_role";



GRANT ALL ON TABLE "public"."trip_generation_mutations" TO "anon";
GRANT ALL ON TABLE "public"."trip_generation_mutations" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_generation_mutations" TO "service_role";



GRANT ALL ON TABLE "public"."trip_generation_stages" TO "anon";
GRANT ALL ON TABLE "public"."trip_generation_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_generation_stages" TO "service_role";



GRANT ALL ON TABLE "public"."trip_generation_traces" TO "anon";
GRANT ALL ON TABLE "public"."trip_generation_traces" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_generation_traces" TO "service_role";



GRANT ALL ON TABLE "public"."trip_go_back_list" TO "anon";
GRANT ALL ON TABLE "public"."trip_go_back_list" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_go_back_list" TO "service_role";



GRANT ALL ON TABLE "public"."trip_intents" TO "anon";
GRANT ALL ON TABLE "public"."trip_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_intents" TO "service_role";



GRANT ALL ON TABLE "public"."trip_invites" TO "anon";
GRANT ALL ON TABLE "public"."trip_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_invites" TO "service_role";



GRANT ALL ON TABLE "public"."trip_learnings" TO "anon";
GRANT ALL ON TABLE "public"."trip_learnings" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_learnings" TO "service_role";



GRANT ALL ON TABLE "public"."trip_members_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_members_safe" TO "service_role";



GRANT ALL ON TABLE "public"."trip_memories" TO "anon";
GRANT ALL ON TABLE "public"."trip_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_memories" TO "service_role";



GRANT ALL ON TABLE "public"."trip_notes" TO "anon";
GRANT ALL ON TABLE "public"."trip_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_notes" TO "service_role";



GRANT ALL ON TABLE "public"."trip_notifications" TO "anon";
GRANT ALL ON TABLE "public"."trip_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."trip_payments" TO "anon";
GRANT ALL ON TABLE "public"."trip_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_payments" TO "service_role";



GRANT ALL ON TABLE "public"."trip_photos" TO "anon";
GRANT ALL ON TABLE "public"."trip_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_photos" TO "service_role";



GRANT ALL ON TABLE "public"."trip_ratings" TO "anon";
GRANT ALL ON TABLE "public"."trip_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."trip_rental_cars" TO "anon";
GRANT ALL ON TABLE "public"."trip_rental_cars" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_rental_cars" TO "service_role";



GRANT ALL ON TABLE "public"."trip_reviews" TO "anon";
GRANT ALL ON TABLE "public"."trip_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."trip_settlements" TO "anon";
GRANT ALL ON TABLE "public"."trip_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."trip_suggestion_votes" TO "anon";
GRANT ALL ON TABLE "public"."trip_suggestion_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_suggestion_votes" TO "service_role";



GRANT ALL ON TABLE "public"."trip_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."trip_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."trips_with_audit_violations" TO "anon";
GRANT ALL ON TABLE "public"."trips_with_audit_violations" TO "authenticated";
GRANT ALL ON TABLE "public"."trips_with_audit_violations" TO "service_role";



GRANT ALL ON TABLE "public"."trips_with_chronology_issues" TO "anon";
GRANT ALL ON TABLE "public"."trips_with_chronology_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."trips_with_chronology_issues" TO "service_role";



GRANT ALL ON TABLE "public"."trips_with_orphan_preferences" TO "anon";
GRANT ALL ON TABLE "public"."trips_with_orphan_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."trips_with_orphan_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_credit_bonuses" TO "anon";
GRANT ALL ON TABLE "public"."user_credit_bonuses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credit_bonuses" TO "service_role";



GRANT ALL ON TABLE "public"."user_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credits" TO "service_role";



GRANT ALL ON TABLE "public"."user_enrichment" TO "anon";
GRANT ALL ON TABLE "public"."user_enrichment" TO "authenticated";
GRANT ALL ON TABLE "public"."user_enrichment" TO "service_role";



GRANT ALL ON TABLE "public"."user_entitlement_overrides" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlement_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlement_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."user_preference_insights" TO "anon";
GRANT ALL ON TABLE "public"."user_preference_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preference_insights" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences_safe" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences_safe" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences_safe" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_social_links" TO "anon";
GRANT ALL ON TABLE "public"."user_social_links" TO "authenticated";
GRANT ALL ON TABLE "public"."user_social_links" TO "service_role";



GRANT ALL ON TABLE "public"."user_tiers" TO "anon";
GRANT ALL ON TABLE "public"."user_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."user_usage" TO "anon";
GRANT ALL ON TABLE "public"."user_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."user_usage" TO "service_role";



GRANT ALL ON TABLE "public"."v_budget_by_category" TO "anon";
GRANT ALL ON TABLE "public"."v_budget_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."v_budget_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."v_day_totals" TO "anon";
GRANT ALL ON TABLE "public"."v_day_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."v_day_totals" TO "service_role";



GRANT ALL ON TABLE "public"."v_google_spend_per_trip" TO "anon";
GRANT ALL ON TABLE "public"."v_google_spend_per_trip" TO "authenticated";
GRANT ALL ON TABLE "public"."v_google_spend_per_trip" TO "service_role";



GRANT ALL ON TABLE "public"."v_payments_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_payments_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_payments_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_trip_total" TO "anon";
GRANT ALL ON TABLE "public"."v_trip_total" TO "authenticated";
GRANT ALL ON TABLE "public"."v_trip_total" TO "service_role";



GRANT ALL ON TABLE "public"."verified_venues" TO "anon";
GRANT ALL ON TABLE "public"."verified_venues" TO "authenticated";
GRANT ALL ON TABLE "public"."verified_venues" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."voyance_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."voyance_events" TO "authenticated";
GRANT ALL ON TABLE "public"."voyance_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."voyance_picks" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."voyance_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."voyance_picks" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































