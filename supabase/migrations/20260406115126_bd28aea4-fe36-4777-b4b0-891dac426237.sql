
-- Add share columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_trips_share_token ON public.trips (share_token) WHERE share_token IS NOT NULL;

-- Function to get a consumer shared trip payload (sanitized, read-only)
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
  -- Find trip by share token
  SELECT * INTO v_trip
  FROM public.trips
  WHERE share_token = p_share_token
    AND share_enabled = true;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Trip not found or sharing is disabled');
  END IF;

  -- Sanitize itinerary days — whitelist activity fields, strip internal data
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
  ELSE
    v_sanitized_days := '[]'::jsonb;
  END IF;

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

-- Function to toggle consumer trip sharing (generates token if needed)
CREATE OR REPLACE FUNCTION public.toggle_consumer_trip_share(p_trip_id uuid, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_trip record;
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

  -- Only owner can toggle sharing
  IF v_trip.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_owner');
  END IF;

  -- Generate token if enabling and none exists
  v_token := v_trip.share_token;
  IF p_enabled AND v_token IS NULL THEN
    v_token := encode(gen_random_bytes(12), 'hex');
  END IF;

  UPDATE public.trips
  SET share_enabled = p_enabled, share_token = v_token
  WHERE id = p_trip_id;

  RETURN jsonb_build_object(
    'success', true,
    'share_enabled', p_enabled,
    'share_token', v_token
  );
END;
$$;
