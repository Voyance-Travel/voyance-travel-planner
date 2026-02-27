
-- Add columns to trips table for storing selected airport-hotel transfer options
-- One for arrival (airport → hotel) and one for departure (hotel → airport)
ALTER TABLE public.trips 
  ADD COLUMN IF NOT EXISTS arrival_transfer jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS departure_transfer jsonb DEFAULT NULL;

-- Also add to trip_cities for multi-city trips (each city has its own arrival transfer)
ALTER TABLE public.trip_cities
  ADD COLUMN IF NOT EXISTS arrival_transfer jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS departure_transfer jsonb DEFAULT NULL;

COMMENT ON COLUMN public.trips.arrival_transfer IS 'Selected airport-to-hotel transfer option with mode, duration, cost, route details';
COMMENT ON COLUMN public.trips.departure_transfer IS 'Selected hotel-to-airport transfer option for departure day';
COMMENT ON COLUMN public.trip_cities.arrival_transfer IS 'Selected arrival transfer for this city in a multi-city trip';
COMMENT ON COLUMN public.trip_cities.departure_transfer IS 'Selected departure transfer for this city in a multi-city trip';
