
-- Create trip_cities table for per-city tracking in multi-city trips
CREATE TABLE public.trip_cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  city_order INTEGER NOT NULL DEFAULT 0,
  city_name TEXT NOT NULL,
  country TEXT,
  destination_id UUID REFERENCES public.destinations(id),
  slug TEXT,
  
  -- Dates for this city segment
  arrival_date DATE,
  departure_date DATE,
  nights INTEGER,
  
  -- Hotel per city
  hotel_selection JSONB,
  hotel_cost_cents INTEGER DEFAULT 0,
  
  -- Transport TO this city (from previous city or origin)
  transport_type TEXT, -- 'flight', 'train', 'bus', 'car', 'ferry'
  transport_details JSONB, -- flight number, carrier, times, booking ref, etc.
  transport_cost_cents INTEGER DEFAULT 0,
  transport_currency TEXT DEFAULT 'USD',
  
  -- Visit / generation status
  generation_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'generating', 'generated', 'failed'
  days_generated INTEGER DEFAULT 0,
  days_total INTEGER DEFAULT 0,
  itinerary_data JSONB, -- per-city itinerary days
  
  -- Per-city budget
  activity_cost_cents INTEGER DEFAULT 0,
  dining_cost_cents INTEGER DEFAULT 0,
  misc_cost_cents INTEGER DEFAULT 0,
  total_cost_cents INTEGER GENERATED ALWAYS AS (
    COALESCE(hotel_cost_cents, 0) + 
    COALESCE(transport_cost_cents, 0) + 
    COALESCE(activity_cost_cents, 0) + 
    COALESCE(dining_cost_cents, 0) + 
    COALESCE(misc_cost_cents, 0)
  ) STORED,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique city order per trip
  UNIQUE(trip_id, city_order)
);

-- Enable RLS
ALTER TABLE public.trip_cities ENABLE ROW LEVEL SECURITY;

-- Users can manage their own trip cities (via trip ownership)
CREATE POLICY "Users can view their trip cities"
  ON public.trip_cities FOR SELECT
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their trip cities"
  ON public.trip_cities FOR INSERT
  WITH CHECK (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their trip cities"
  ON public.trip_cities FOR UPDATE
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete their trip cities"
  ON public.trip_cities FOR DELETE
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

-- Index for efficient lookups
CREATE INDEX idx_trip_cities_trip_id ON public.trip_cities(trip_id);
CREATE INDEX idx_trip_cities_trip_order ON public.trip_cities(trip_id, city_order);

-- Trigger for updated_at
CREATE TRIGGER update_trip_cities_updated_at
  BEFORE UPDATE ON public.trip_cities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
