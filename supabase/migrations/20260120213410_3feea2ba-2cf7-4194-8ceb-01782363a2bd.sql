-- Drop and recreate with hardened security settings
DROP FUNCTION IF EXISTS public.get_shared_trip_payload(text);

CREATE OR REPLACE FUNCTION public.get_shared_trip_payload(p_share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
  -- Using robust boolean check: treat anything explicitly false-like as hidden
  IF v_trip.itinerary_data IS NOT NULL AND v_trip.itinerary_data->'days' IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'dayNumber', day->'dayNumber',
        'date', day->'date',
        'theme', day->'theme',
        'description', day->'description',
        'weather', day->'weather',
        'activities', (
          SELECT COALESCE(jsonb_agg(activity), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(day->'activities', '[]'::jsonb)) AS activity
          WHERE NOT (
            activity ? 'is_client_visible'
            AND lower(coalesce(activity->>'is_client_visible', '')) IN ('false', 'f', '0', 'no', 'n', 'off')
          )
        )
      )
    ) INTO v_sanitized_days
    FROM jsonb_array_elements(v_trip.itinerary_data->'days') AS day;
  ELSE
    v_sanitized_days := '[]'::jsonb;
  END IF;

  -- Get sanitized booking segments (only client-safe fields, schema-qualified)
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
      'status', s.status
    )
  ), '[]'::jsonb) INTO v_segments
  FROM public.agency_booking_segments s
  WHERE s.trip_id = v_trip.id
    AND COALESCE(s.is_informational_only, false) = false;

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

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_shared_trip_payload(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_trip_payload(text) TO authenticated;