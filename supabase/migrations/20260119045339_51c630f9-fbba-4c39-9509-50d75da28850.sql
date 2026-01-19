-- Create trip_payments table to track payment status for all trip components
CREATE TABLE public.trip_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- What is being paid for
  item_type TEXT NOT NULL CHECK (item_type IN ('flight', 'hotel', 'activity')),
  item_id TEXT NOT NULL, -- activity id, 'outbound_flight', 'return_flight', 'hotel', or external booking id
  item_name TEXT NOT NULL, -- Human readable name
  
  -- External booking reference (from Viator, airline, hotel provider)
  external_provider TEXT, -- 'viator', 'amadeus', 'booking_com', 'manual', etc.
  external_booking_id TEXT,
  external_booking_url TEXT,
  
  -- Pricing
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Payment status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
  
  -- Stripe integration
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate payments for same item
  UNIQUE(trip_id, item_type, item_id)
);

-- Enable RLS
ALTER TABLE public.trip_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view their own payments"
  ON public.trip_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create payments for their trips
CREATE POLICY "Users can create payments for their trips"
  ON public.trip_payments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
  );

-- Users can update their own pending payments
CREATE POLICY "Users can update their own payments"
  ON public.trip_payments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for common queries
CREATE INDEX idx_trip_payments_trip_id ON public.trip_payments(trip_id);
CREATE INDEX idx_trip_payments_user_id ON public.trip_payments(user_id);
CREATE INDEX idx_trip_payments_status ON public.trip_payments(status);

-- Add trigger for updated_at
CREATE TRIGGER update_trip_payments_updated_at
  BEFORE UPDATE ON public.trip_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add booking_status column to trip_activities if not exists
ALTER TABLE public.trip_activities 
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS external_booking_url TEXT,
  ADD COLUMN IF NOT EXISTS external_booking_id TEXT;

-- Add comment for documentation
COMMENT ON TABLE public.trip_payments IS 'Tracks payment status for all trip components (flights, hotels, activities)';
COMMENT ON COLUMN public.trip_payments.item_type IS 'Type of item: flight, hotel, or activity';
COMMENT ON COLUMN public.trip_payments.status IS 'Payment status: pending, processing, paid, failed, refunded, cancelled';