-- Create a secure RPC function that returns sanitized trip data for share links
-- This prevents internal items from leaking to clients via the JSON blob

CREATE OR REPLACE FUNCTION public.get_shared_trip_payload(p_share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip record;
  v_segments jsonb;
  v_sanitized_days jsonb;
BEGIN
  -- Fetch trip by share token (must be enabled)
  SELECT id, name, destination, start_date, end_date, traveler_count, notes, itinerary_data
  INTO v_trip
  FROM agency_trips
  WHERE share_token = p_share_token
    AND share_enabled = true;
  
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Trip not found or sharing is disabled');
  END IF;
  
  -- Fetch confirmed booking segments (public info only, no net costs/commissions)
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
    ) ORDER BY s.start_date
  ), '[]'::jsonb)
  INTO v_segments
  FROM agency_booking_segments s
  WHERE s.trip_id = v_trip.id
    AND s.status IN ('confirmed', 'ticketed');
  
  -- Sanitize itinerary_data.days - filter out internal items
  -- Each day's activities should only include client-visible ones
  IF v_trip.itinerary_data IS NOT NULL AND v_trip.itinerary_data->'days' IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'date', day->>'date',
        'dayNumber', (day->>'dayNumber')::int,
        'title', day->>'title',
        'description', day->>'description',
        'theme', day->>'theme',
        'weather', day->'weather',
        'activities', (
          SELECT COALESCE(jsonb_agg(activity), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(day->'activities', '[]'::jsonb)) AS activity
          WHERE (activity->>'is_client_visible') IS NULL 
             OR (activity->>'is_client_visible')::boolean = true
             OR activity->>'is_client_visible' = 'true'
        )
      ) ORDER BY (day->>'dayNumber')::int
    ), '[]'::jsonb)
    INTO v_sanitized_days
    FROM jsonb_array_elements(v_trip.itinerary_data->'days') AS day;
  ELSE
    v_sanitized_days := '[]'::jsonb;
  END IF;
  
  -- Return sanitized payload
  RETURN jsonb_build_object(
    'id', v_trip.id,
    'name', v_trip.name,
    'destination', v_trip.destination,
    'start_date', v_trip.start_date,
    'end_date', v_trip.end_date,
    'traveler_count', v_trip.traveler_count,
    'notes', v_trip.notes,
    'itinerary_data', jsonb_build_object(
      'days', v_sanitized_days,
      'status', v_trip.itinerary_data->>'status'
    ),
    'segments', v_segments
  );
END;
$$;

-- Grant execute to anon (share pages are public)
GRANT EXECUTE ON FUNCTION public.get_shared_trip_payload(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_trip_payload(text) TO authenticated;