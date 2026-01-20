-- Fix get_shared_trip_payload to whitelist activity fields and add explicit ordering
-- This prevents internal fields from leaking and ensures deterministic ordering

CREATE OR REPLACE FUNCTION public.get_shared_trip_payload(p_share_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;