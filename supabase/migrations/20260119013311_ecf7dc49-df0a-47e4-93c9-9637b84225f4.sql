-- Add itinerary customization preferences columns
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS enable_gap_filling boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_route_optimization boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_real_transport boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_geocoding boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_venue_verification boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_cost_lookup boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS preferred_downtime_minutes integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_activities_per_day integer DEFAULT 6;