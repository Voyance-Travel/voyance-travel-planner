-- Add transition_day_mode column to trip_cities
ALTER TABLE public.trip_cities
ADD COLUMN transition_day_mode text DEFAULT 'half_and_half'
CHECK (transition_day_mode IN ('half_and_half', 'skip'));