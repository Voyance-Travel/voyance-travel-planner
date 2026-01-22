-- Create airport transfer fares table with versioning
CREATE TABLE public.airport_transfer_fares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  airport_code TEXT,
  airport_name TEXT,
  
  -- Taxi/Rideshare data
  taxi_duration_min INT,
  taxi_duration_max INT,
  taxi_cost_min NUMERIC(10,2),
  taxi_cost_max NUMERIC(10,2),
  taxi_is_fixed_price BOOLEAN DEFAULT false,
  taxi_notes TEXT,
  
  -- Train/Transit data  
  train_duration_min INT,
  train_duration_max INT,
  train_cost NUMERIC(10,2),
  train_line TEXT,
  train_notes TEXT,
  
  -- Bus/Shuttle data
  bus_duration_min INT,
  bus_duration_max INT,
  bus_cost NUMERIC(10,2),
  bus_notes TEXT,
  
  -- Metadata
  currency TEXT NOT NULL DEFAULT 'USD',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  destination_zone TEXT, -- e.g., "city center", "downtown"
  
  -- Versioning & freshness
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT, -- e.g., "official_website", "ai_researched", "user_reported"
  confidence_score NUMERIC(3,2) DEFAULT 0.8, -- 0-1 confidence in accuracy
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(city, airport_code)
);

-- Enable RLS (public read, admin write)
ALTER TABLE public.airport_transfer_fares ENABLE ROW LEVEL SECURITY;

-- Anyone can read fares
CREATE POLICY "Anyone can read transfer fares"
  ON public.airport_transfer_fares
  FOR SELECT
  USING (true);

-- Create index for fast city lookups
CREATE INDEX idx_transfer_fares_city ON public.airport_transfer_fares(LOWER(city));

-- Trigger for updated_at
CREATE TRIGGER update_airport_transfer_fares_updated_at
  BEFORE UPDATE ON public.airport_transfer_fares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();