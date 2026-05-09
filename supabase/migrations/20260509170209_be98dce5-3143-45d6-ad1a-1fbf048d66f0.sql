DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      tp.item_id::uuid AS activity_id,
      tp.id AS payment_id,
      tp.stripe_checkout_session_id
    FROM public.trip_payments tp
    JOIN public.trip_activities ta
      ON ta.id = tp.item_id::uuid
    WHERE tp.status = 'paid'
      AND tp.external_provider = 'viator'
      AND tp.item_type = 'activity'
      AND ta.booking_state = 'selected_pending'
  LOOP
    PERFORM public.transition_booking_state(
      p_activity_id    := r.activity_id,
      p_new_state      := 'booked_confirmed'::public.booking_item_state,
      p_trigger_source := 'manual_backfill',
      p_trigger_reference := r.stripe_checkout_session_id,
      p_metadata       := jsonb_build_object('payment_id', r.payment_id, 'reason', 'enum_bug_recovery')
    );
  END LOOP;
END $$;