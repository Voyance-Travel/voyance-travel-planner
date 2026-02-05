-- Add cost_category enum and column to trip_cost_tracking
-- Categories map to user-facing actions for easier analysis

-- Create the enum type
CREATE TYPE public.cost_category AS ENUM (
  'home_browse',      -- Home page, destination browsing, image loading
  'quiz',             -- Travel DNA quiz analysis
  'explore',          -- Destination exploration, intelligence lookups
  'itinerary_gen',    -- Full/preview itinerary generation
  'itinerary_edit',   -- Activity swaps, day regeneration, AI chat
  'booking_search',   -- Hotel/flight searches, Amadeus calls
  'recommendations',  -- Restaurant recs, nearby suggestions
  'enrichment',       -- Activity enrichment, photo fetching
  'other'             -- Uncategorized/system operations
);

-- Add the category column with default
ALTER TABLE public.trip_cost_tracking 
ADD COLUMN cost_category public.cost_category DEFAULT 'other';

-- Backfill existing data based on action_type
UPDATE public.trip_cost_tracking SET cost_category = 'quiz' 
WHERE action_type IN ('travel_dna', 'calculate_dna', 'travel-dna');

UPDATE public.trip_cost_tracking SET cost_category = 'home_browse' 
WHERE action_type IN ('destination_images', 'home_destinations');

UPDATE public.trip_cost_tracking SET cost_category = 'itinerary_gen' 
WHERE action_type IN ('generate_itinerary', 'generate-itinerary', 'generate_preview', 
  'generate-quick-preview', 'generate-full-preview', 'generate-trip-preview',
  'quick_preview', 'full_preview', 'trip_preview');

UPDATE public.trip_cost_tracking SET cost_category = 'itinerary_edit' 
WHERE action_type IN ('swap_activity', 'regenerate_day', 'itinerary_chat', 
  'itinerary-chat', 'get-activity-alternatives', 'optimize-itinerary',
  'analyze_itinerary', 'analyze-itinerary');

UPDATE public.trip_cost_tracking SET cost_category = 'booking_search' 
WHERE action_type IN ('hotels_search', 'hotels', 'flights', 'flight_search',
  'amadeus_hotels', 'amadeus_flights');

UPDATE public.trip_cost_tracking SET cost_category = 'recommendations' 
WHERE action_type IN ('recommend_restaurants', 'recommend-restaurants', 
  'nearby_suggestions', 'nearby-suggestions');

UPDATE public.trip_cost_tracking SET cost_category = 'enrichment' 
WHERE action_type IN ('enrich_itinerary', 'enrich-itinerary', 'fetch_reviews',
  'lookup_activity_url', 'lookup-activity-url');

UPDATE public.trip_cost_tracking SET cost_category = 'explore' 
WHERE action_type IN ('destination_intelligence', 'get-destination-intelligence',
  'lookup-destination-insights', 'lookup_travel_advisory', 'local_events',
  'parse_travel_story');

-- Create index for efficient category queries
CREATE INDEX idx_trip_cost_tracking_category ON public.trip_cost_tracking(cost_category);