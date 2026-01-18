-- Create destinations table (core reference for all activities/attractions)
CREATE TABLE public.destinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  timezone TEXT,
  currency_code TEXT,
  description TEXT,
  temperature_range TEXT,
  seasonality TEXT,
  best_time_to_visit TEXT,
  cost_tier TEXT,
  known_for JSONB DEFAULT '[]'::jsonb,
  points_of_interest JSONB DEFAULT '[]'::jsonb,
  stock_image_url TEXT,
  featured BOOLEAN DEFAULT false,
  tier INTEGER DEFAULT 1,
  alternative_names JSONB DEFAULT '[]'::jsonb,
  safe_search_keywords JSONB DEFAULT '[]'::jsonb,
  default_transport_modes JSONB DEFAULT '[]'::jsonb,
  dynamic_weather JSONB,
  dynamic_currency_conversion JSONB,
  seasonal_events JSONB DEFAULT '{}'::jsonb,
  last_content_update TIMESTAMP WITH TIME ZONE,
  last_weather_update TIMESTAMP WITH TIME ZONE,
  last_currency_update TIMESTAMP WITH TIME ZONE,
  population INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  google_place_id TEXT,
  airport_codes JSONB,
  currency_data JSONB,
  weather_data JSONB,
  enrichment_status JSONB DEFAULT '{}'::jsonb,
  last_enriched TIMESTAMP WITH TIME ZONE,
  enrichment_priority INTEGER DEFAULT 0,
  coordinates JSONB,
  airport_lookup_codes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

-- Destinations are public read (reference data)
CREATE POLICY "Destinations are publicly readable"
  ON public.destinations FOR SELECT
  USING (true);

-- Create indexes for common queries
CREATE INDEX idx_destinations_city ON public.destinations(city);
CREATE INDEX idx_destinations_country ON public.destinations(country);
CREATE INDEX idx_destinations_featured ON public.destinations(featured) WHERE featured = true;
CREATE INDEX idx_destinations_region ON public.destinations(region);

-- Create updated_at trigger
CREATE TRIGGER update_destinations_updated_at
  BEFORE UPDATE ON public.destinations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();