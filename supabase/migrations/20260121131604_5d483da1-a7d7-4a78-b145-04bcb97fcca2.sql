-- Add destinations JSONB column to trips table for multi-city support
-- This stores an array of destination objects: [{city, country, nights, order, arrivalDate, departureDate}]
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS destinations JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.trips.destinations IS 'Array of destinations for multi-city trips: [{city: string, country?: string, nights: number, order: number, arrivalDate?: string, departureDate?: string}]';

-- Add is_multi_city flag for easy querying
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS is_multi_city BOOLEAN DEFAULT FALSE;