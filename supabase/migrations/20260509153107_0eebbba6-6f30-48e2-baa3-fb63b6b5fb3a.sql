CREATE OR REPLACE FUNCTION public.get_consumer_shared_trip(p_share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
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

GRANT EXECUTE ON FUNCTION public.get_consumer_shared_trip(text) TO anon, authenticated;