-- =============================================================================
-- BOOKING ENGINE: Multi-Supplier Abstraction Layer
-- Supports: Activities (Viator), Hotels (Rapid), Flights (Amadeus), etc.
-- =============================================================================

-- Enum for supplier types
CREATE TYPE public.booking_supplier AS ENUM (
  'viator',
  'rapid_hotels',
  'amadeus',
  'direct',
  'manual'
);

-- Enum for product types
CREATE TYPE public.booking_product_type AS ENUM (
  'activity',
  'hotel',
  'flight',
  'transfer',
  'package'
);

-- Enum for booking status
CREATE TYPE public.booking_status_v2 AS ENUM (
  'pending',
  'confirmed',
  'ticketed',
  'cancelled',
  'refunded',
  'no_show',
  'completed'
);

-- =============================================================================
-- 1. OFFERS TABLE - What search returns (cached, expires quickly)
-- =============================================================================
CREATE TABLE public.booking_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Context
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  product_type booking_product_type NOT NULL,
  
  -- Supplier reference
  supplier booking_supplier NOT NULL,
  supplier_offer_id TEXT NOT NULL,
  supplier_product_code TEXT,
  
  -- Product info
  title TEXT NOT NULL,
  description TEXT,
  location JSONB, -- { city, country, address, lat, lng }
  
  -- Pricing
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_breakdown JSONB, -- { base, taxes, fees, discount }
  
  -- Availability
  available_dates JSONB, -- [{ date, times: [...], capacity }]
  availability_summary TEXT, -- "Available daily", "Limited spots"
  min_participants INTEGER DEFAULT 1,
  max_participants INTEGER,
  
  -- Policy summaries (human-readable)
  cancellation_summary TEXT, -- "Free cancellation until 24h before"
  inclusions JSONB, -- ["Hotel pickup", "Lunch included"]
  exclusions JSONB, -- ["Gratuities", "Travel insurance"]
  
  -- Fallback
  deep_link TEXT, -- External booking URL if we can't book directly
  
  -- Images
  image_url TEXT,
  image_urls JSONB,
  
  -- Metadata
  rating NUMERIC(3,2),
  review_count INTEGER,
  duration_minutes INTEGER,
  supplier_metadata JSONB, -- Raw supplier data for debugging
  
  -- Lifecycle
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_booking_offers_trip ON public.booking_offers(trip_id);
CREATE INDEX idx_booking_offers_user ON public.booking_offers(user_id);
CREATE INDEX idx_booking_offers_supplier ON public.booking_offers(supplier, supplier_offer_id);
CREATE INDEX idx_booking_offers_expires ON public.booking_offers(expires_at);

-- =============================================================================
-- 2. QUOTES TABLE - Locked price + availability, expires
-- =============================================================================
CREATE TABLE public.booking_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Reference to offer
  offer_id UUID REFERENCES public.booking_offers(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  trip_activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  
  -- Supplier quote reference
  supplier booking_supplier NOT NULL,
  supplier_quote_id TEXT, -- Supplier's hold/quote ID
  supplier_offer_id TEXT NOT NULL,
  
  -- Product info (denormalized for history)
  product_type booking_product_type NOT NULL,
  title TEXT NOT NULL,
  
  -- Locked pricing
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_breakdown JSONB,
  
  -- Booking details
  selected_date DATE,
  selected_time TEXT,
  participant_count INTEGER NOT NULL DEFAULT 1,
  
  -- Exact policies (not summaries)
  cancellation_policy JSONB NOT NULL, 
  -- { deadline: ISO, refund_percentage: 100, fees_cents: 0, description: "..." }
  
  modification_policy JSONB,
  -- { allowed: true, deadline: ISO, fees_cents: 500 }
  
  inclusions JSONB,
  exclusions JSONB,
  
  -- Validity
  is_locked BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_quotes_trip ON public.booking_quotes(trip_id);
CREATE INDEX idx_booking_quotes_activity ON public.booking_quotes(trip_activity_id);
CREATE INDEX idx_booking_quotes_user ON public.booking_quotes(user_id);
CREATE INDEX idx_booking_quotes_expires ON public.booking_quotes(expires_at);

-- =============================================================================
-- 3. BOOKINGS TABLE - The actual reservation
-- =============================================================================
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Reference chain
  quote_id UUID REFERENCES public.booking_quotes(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.booking_offers(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  trip_activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  
  -- Internal reference
  booking_reference TEXT NOT NULL UNIQUE, -- VOY-XXXXXXXX
  
  -- Supplier confirmation
  supplier booking_supplier NOT NULL,
  supplier_booking_id TEXT, -- Supplier's confirmation code
  supplier_status TEXT, -- Raw status from supplier
  
  -- Product info (denormalized)
  product_type booking_product_type NOT NULL,
  title TEXT NOT NULL,
  
  -- Booking details
  booked_date DATE NOT NULL,
  booked_time TEXT,
  participant_count INTEGER NOT NULL DEFAULT 1,
  
  -- Pricing at time of booking
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_breakdown JSONB,
  
  -- Status
  status booking_status_v2 NOT NULL DEFAULT 'pending',
  
  -- Traveler details used
  traveler_data JSONB NOT NULL, 
  -- [{ firstName, lastName, email, phone, dob, passport, specialRequests }]
  
  lead_traveler_name TEXT,
  lead_traveler_email TEXT,
  
  -- Voucher / tickets
  voucher_url TEXT,
  voucher_data JSONB, -- { code, qr, instructions, validFrom, validUntil }
  tickets JSONB, -- For flights: e-ticket numbers
  
  -- Policies at time of booking
  cancellation_policy JSONB NOT NULL,
  modification_policy JSONB,
  
  -- Payment linkage
  payment_method TEXT, -- 'stripe', 'supplier_direct', 'invoice'
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Cancellation tracking
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  refund_amount_cents INTEGER,
  refund_status TEXT, -- 'pending', 'processed', 'failed'
  refunded_at TIMESTAMPTZ,
  
  -- Supplier communication
  supplier_emails JSONB, -- Log of confirmation emails received
  last_supplier_sync TIMESTAMPTZ,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_trip ON public.bookings(trip_id);
CREATE INDEX idx_bookings_activity ON public.bookings(trip_activity_id);
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_reference ON public.bookings(booking_reference);
CREATE INDEX idx_bookings_supplier ON public.bookings(supplier, supplier_booking_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- =============================================================================
-- 4. BOOKING HISTORY LOG - Audit trail for all state changes
-- =============================================================================
CREATE TABLE public.booking_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL, -- 'created', 'confirmed', 'modified', 'cancelled', 'refunded'
  previous_status booking_status_v2,
  new_status booking_status_v2,
  
  -- What changed
  changes JSONB, -- { field: { old, new } }
  
  -- Who/what triggered it
  triggered_by TEXT, -- 'user', 'supplier_webhook', 'system', 'agent'
  triggered_by_user_id UUID,
  
  -- Supplier response
  supplier_response JSONB,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_history_booking ON public.booking_history(booking_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
ALTER TABLE public.booking_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_history ENABLE ROW LEVEL SECURITY;

-- Offers: Users can see their own offers
CREATE POLICY "Users can view own offers" ON public.booking_offers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create offers" ON public.booking_offers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quotes: Users can see their own quotes  
CREATE POLICY "Users can view own quotes" ON public.booking_quotes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create quotes" ON public.booking_quotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotes" ON public.booking_quotes
  FOR UPDATE USING (auth.uid() = user_id);

-- Bookings: Users can see their own bookings
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- History: Users can see history for their bookings
CREATE POLICY "Users can view own booking history" ON public.booking_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = booking_history.booking_id 
      AND bookings.user_id = auth.uid()
    )
  );

-- =============================================================================
-- HELPER FUNCTION: Generate booking reference
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Auto-generate booking reference on insert
CREATE OR REPLACE FUNCTION public.set_booking_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_reference IS NULL THEN
    NEW.booking_reference := generate_booking_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_set_booking_reference
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_reference();

-- Update updated_at on bookings
CREATE TRIGGER tr_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_quotes_updated_at
  BEFORE UPDATE ON public.booking_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();