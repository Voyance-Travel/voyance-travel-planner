-- Create airports table
CREATE TABLE public.airports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'international',
  city TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  distance_km NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_airports_code ON public.airports(code);
CREATE INDEX idx_airports_city ON public.airports(city);
CREATE INDEX idx_airports_country ON public.airports(country);

ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Airports are publicly readable"
  ON public.airports FOR SELECT
  USING (true);

CREATE TRIGGER update_airports_updated_at
  BEFORE UPDATE ON public.airports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create activity_catalog table
CREATE TABLE public.activity_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  cost_usd NUMERIC,
  estimated_duration_hours NUMERIC,
  location JSONB DEFAULT '{}'::jsonb,
  ai_generated BOOLEAN DEFAULT false,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_catalog_destination ON public.activity_catalog(destination_id);
CREATE INDEX idx_activity_catalog_category ON public.activity_catalog(category);

ALTER TABLE public.activity_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity catalog is publicly readable"
  ON public.activity_catalog FOR SELECT
  USING (true);

CREATE TRIGGER update_activity_catalog_updated_at
  BEFORE UPDATE ON public.activity_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create attractions table
CREATE TABLE public.attractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  category TEXT,
  subcategory TEXT,
  visit_duration_mins INTEGER,
  price_range JSONB DEFAULT '{}'::jsonb,
  opening_hours JSONB,
  peak_hours JSONB,
  crowd_patterns JSONB,
  average_rating NUMERIC,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_attractions_destination ON public.attractions(destination_id);
CREATE INDEX idx_attractions_category ON public.attractions(category);

ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attractions are publicly readable"
  ON public.attractions FOR SELECT
  USING (true);

CREATE TRIGGER update_attractions_updated_at
  BEFORE UPDATE ON public.attractions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action_type TEXT DEFAULT 'general',
  actor TEXT,
  target_id TEXT
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs - admins can read all, users can read their own
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid()::text = user_id OR public.has_role('admin'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);