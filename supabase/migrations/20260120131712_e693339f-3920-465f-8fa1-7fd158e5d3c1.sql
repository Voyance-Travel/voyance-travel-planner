-- Add booking state machine enum
CREATE TYPE public.booking_item_state AS ENUM (
  'not_selected',
  'selected_pending',
  'booked_confirmed', 
  'changed',
  'cancelled',
  'refunded'
);

-- Add new columns to trip_activities for full booking lifecycle
ALTER TABLE public.trip_activities
  ADD COLUMN IF NOT EXISTS booking_state public.booking_item_state DEFAULT 'not_selected',
  ADD COLUMN IF NOT EXISTS quote_id text,
  ADD COLUMN IF NOT EXISTS quote_price_cents integer,
  ADD COLUMN IF NOT EXISTS quote_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS quote_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_number text,
  ADD COLUMN IF NOT EXISTS voucher_url text,
  ADD COLUMN IF NOT EXISTS voucher_data jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_policy jsonb,
  ADD COLUMN IF NOT EXISTS modification_policy jsonb,
  ADD COLUMN IF NOT EXISTS booked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer,
  ADD COLUMN IF NOT EXISTS traveler_data jsonb,
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS vendor_booking_id text,
  ADD COLUMN IF NOT EXISTS state_history jsonb DEFAULT '[]'::jsonb;

-- Create booking state audit log table
CREATE TABLE IF NOT EXISTS public.booking_state_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_activity_id uuid REFERENCES public.trip_activities(id) ON DELETE CASCADE,
  trip_id uuid,
  user_id uuid,
  previous_state public.booking_item_state,
  new_state public.booking_item_state NOT NULL,
  trigger_source text, -- 'user', 'stripe_webhook', 'vendor_api', 'manual'
  trigger_reference text, -- e.g. stripe session id, vendor booking id
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on booking_state_log
ALTER TABLE public.booking_state_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own booking state logs
CREATE POLICY "Users can read own booking state logs"
  ON public.booking_state_log
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = booking_state_log.trip_id
      AND t.user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can insert booking state logs
CREATE POLICY "Authenticated users can insert booking state logs"
  ON public.booking_state_log
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trip_activities_booking_state ON public.trip_activities(booking_state);
CREATE INDEX IF NOT EXISTS idx_trip_activities_quote_expires ON public.trip_activities(quote_expires_at);
CREATE INDEX IF NOT EXISTS idx_booking_state_log_activity ON public.booking_state_log(trip_activity_id);
CREATE INDEX IF NOT EXISTS idx_booking_state_log_trip ON public.booking_state_log(trip_id);

-- Function to transition booking state with audit logging
CREATE OR REPLACE FUNCTION public.transition_booking_state(
  p_activity_id uuid,
  p_new_state public.booking_item_state,
  p_trigger_source text DEFAULT 'user',
  p_trigger_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity record;
  v_allowed boolean := false;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Get current activity state
  SELECT * INTO v_activity FROM trip_activities WHERE id = p_activity_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity not found');
  END IF;
  
  -- Define valid state transitions
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
      v_allowed := false; -- Terminal state
    ELSE
      v_allowed := p_new_state = 'selected_pending'; -- Default for NULL
  END CASE;
  
  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Invalid state transition from %s to %s', v_activity.booking_state, p_new_state)
    );
  END IF;
  
  -- Update the activity state
  UPDATE trip_activities
  SET 
    booking_state = p_new_state,
    updated_at = now(),
    booked_at = CASE WHEN p_new_state = 'booked_confirmed' THEN now() ELSE booked_at END,
    cancelled_at = CASE WHEN p_new_state = 'cancelled' THEN now() ELSE cancelled_at END,
    refunded_at = CASE WHEN p_new_state = 'refunded' THEN now() ELSE refunded_at END,
    state_history = COALESCE(state_history, '[]'::jsonb) || jsonb_build_object(
      'from', v_activity.booking_state,
      'to', p_new_state,
      'at', now(),
      'by', v_user_id
    )
  WHERE id = p_activity_id;
  
  -- Log the state change
  INSERT INTO booking_state_log (
    trip_activity_id,
    trip_id,
    user_id,
    previous_state,
    new_state,
    trigger_source,
    trigger_reference,
    metadata
  ) VALUES (
    p_activity_id,
    v_activity.trip_id,
    v_user_id,
    v_activity.booking_state,
    p_new_state,
    p_trigger_source,
    p_trigger_reference,
    p_metadata
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_state', v_activity.booking_state,
    'new_state', p_new_state
  );
END;
$$;