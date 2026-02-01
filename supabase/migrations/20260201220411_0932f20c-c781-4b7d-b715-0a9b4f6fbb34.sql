-- Destination Cost Index Table
-- Stores cost-of-living multipliers and base prices for defensible pricing estimates

CREATE TABLE public.destination_cost_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  
  -- Cost multiplier relative to USD baseline (1.0 = US average)
  -- e.g., Bangkok = 0.45, Tokyo = 1.15, Zurich = 1.55
  cost_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  
  -- Base prices in USD (before multiplier applied)
  breakfast_base_usd NUMERIC(8,2) DEFAULT 15.00,
  lunch_base_usd NUMERIC(8,2) DEFAULT 25.00,
  dinner_base_usd NUMERIC(8,2) DEFAULT 45.00,
  coffee_base_usd NUMERIC(8,2) DEFAULT 5.00,
  activity_base_usd NUMERIC(8,2) DEFAULT 30.00,
  museum_base_usd NUMERIC(8,2) DEFAULT 20.00,
  tour_base_usd NUMERIC(8,2) DEFAULT 75.00,
  transport_base_usd NUMERIC(8,2) DEFAULT 15.00,
  
  -- Tip/tax buffer percentage (e.g., 0.20 = 20%)
  tax_tip_buffer NUMERIC(4,2) DEFAULT 0.18,
  
  -- Data quality
  source TEXT DEFAULT 'manual',
  confidence_score NUMERIC(3,2) DEFAULT 0.7,
  last_verified_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(city, country)
);

-- Enable RLS
ALTER TABLE public.destination_cost_index ENABLE ROW LEVEL SECURITY;

-- Public read access (pricing data is not sensitive)
CREATE POLICY "Anyone can read destination cost index"
  ON public.destination_cost_index FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can modify cost index"
  ON public.destination_cost_index FOR ALL
  USING (public.has_role('admin'));

-- Auto-update updated_at
CREATE TRIGGER update_destination_cost_index_updated_at
  BEFORE UPDATE ON public.destination_cost_index
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_destination_cost_index_city_country 
  ON public.destination_cost_index(lower(city), lower(country));

-- Add comment
COMMENT ON TABLE public.destination_cost_index IS 'Cost-of-living multipliers and base prices for defensible activity/dining pricing estimates';

-- Seed with initial data for common destinations
INSERT INTO public.destination_cost_index (city, country, cost_multiplier, breakfast_base_usd, lunch_base_usd, dinner_base_usd, coffee_base_usd, activity_base_usd, tax_tip_buffer, source, confidence_score) VALUES
-- Southeast Asia (Low cost)
('Bangkok', 'Thailand', 0.45, 8, 12, 25, 3, 15, 0.10, 'research', 0.85),
('Chiang Mai', 'Thailand', 0.40, 6, 10, 20, 2, 12, 0.10, 'research', 0.80),
('Ho Chi Minh City', 'Vietnam', 0.40, 5, 8, 18, 2, 10, 0.05, 'research', 0.80),
('Hanoi', 'Vietnam', 0.38, 5, 8, 16, 2, 10, 0.05, 'research', 0.80),
('Bali', 'Indonesia', 0.50, 8, 12, 25, 3, 20, 0.10, 'research', 0.85),
('Kuala Lumpur', 'Malaysia', 0.50, 7, 10, 22, 3, 15, 0.10, 'research', 0.80),
('Singapore', 'Singapore', 1.10, 12, 20, 50, 6, 35, 0.10, 'research', 0.90),

-- Europe (Varied)
('Paris', 'France', 1.25, 15, 25, 55, 5, 35, 0.15, 'research', 0.90),
('London', 'United Kingdom', 1.35, 15, 28, 60, 5, 40, 0.12, 'research', 0.90),
('Rome', 'Italy', 1.00, 12, 20, 45, 4, 25, 0.15, 'research', 0.90),
('Barcelona', 'Spain', 0.95, 10, 18, 40, 4, 25, 0.15, 'research', 0.85),
('Amsterdam', 'Netherlands', 1.20, 14, 22, 50, 5, 30, 0.15, 'research', 0.85),
('Berlin', 'Germany', 0.90, 10, 18, 40, 4, 25, 0.15, 'research', 0.85),
('Prague', 'Czech Republic', 0.65, 8, 12, 28, 3, 18, 0.15, 'research', 0.80),
('Lisbon', 'Portugal', 0.80, 8, 15, 35, 3, 20, 0.15, 'research', 0.85),
('Vienna', 'Austria', 1.10, 12, 20, 48, 5, 28, 0.15, 'research', 0.85),
('Zurich', 'Switzerland', 1.55, 20, 35, 75, 7, 50, 0.05, 'research', 0.90),
('Copenhagen', 'Denmark', 1.40, 18, 30, 65, 6, 40, 0.00, 'research', 0.85),

-- Americas
('New York', 'United States', 1.30, 18, 28, 65, 6, 40, 0.22, 'research', 0.95),
('Los Angeles', 'United States', 1.15, 15, 25, 55, 5, 35, 0.22, 'research', 0.90),
('Miami', 'United States', 1.10, 14, 22, 50, 5, 35, 0.22, 'research', 0.85),
('San Francisco', 'United States', 1.25, 18, 28, 60, 6, 40, 0.22, 'research', 0.90),
('Chicago', 'United States', 1.05, 14, 22, 50, 5, 32, 0.22, 'research', 0.85),
('Mexico City', 'Mexico', 0.55, 8, 12, 28, 3, 18, 0.15, 'research', 0.85),
('Cancun', 'Mexico', 0.75, 12, 18, 40, 4, 30, 0.15, 'research', 0.80),
('Buenos Aires', 'Argentina', 0.50, 7, 12, 28, 3, 15, 0.15, 'research', 0.75),
('Rio de Janeiro', 'Brazil', 0.60, 8, 14, 32, 3, 20, 0.15, 'research', 0.75),

-- Asia Pacific
('Tokyo', 'Japan', 1.15, 12, 18, 50, 4, 30, 0.08, 'research', 0.90),
('Kyoto', 'Japan', 1.10, 12, 16, 45, 4, 28, 0.08, 'research', 0.85),
('Seoul', 'South Korea', 0.90, 10, 15, 40, 4, 25, 0.10, 'research', 0.85),
('Hong Kong', 'Hong Kong', 1.10, 10, 18, 50, 5, 30, 0.10, 'research', 0.90),
('Sydney', 'Australia', 1.20, 18, 25, 55, 5, 35, 0.10, 'research', 0.90),
('Melbourne', 'Australia', 1.15, 16, 22, 50, 5, 32, 0.10, 'research', 0.85),

-- Middle East & Africa
('Dubai', 'United Arab Emirates', 1.10, 15, 25, 60, 6, 40, 0.05, 'research', 0.85),
('Istanbul', 'Turkey', 0.55, 6, 12, 28, 3, 15, 0.15, 'research', 0.80),
('Marrakech', 'Morocco', 0.50, 6, 10, 25, 2, 15, 0.10, 'research', 0.75),
('Cape Town', 'South Africa', 0.60, 8, 15, 35, 3, 20, 0.15, 'research', 0.80);

-- Default fallback row for unknown destinations
INSERT INTO public.destination_cost_index (city, country, cost_multiplier, source, confidence_score)
VALUES ('_default', '_default', 1.0, 'fallback', 0.50);