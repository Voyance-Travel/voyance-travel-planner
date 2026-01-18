-- Create activities table for destination activities catalog
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration_minutes INTEGER,
  price_range JSONB DEFAULT '{}'::jsonb,
  booking_required BOOLEAN DEFAULT false,
  booking_url TEXT,
  best_times JSONB DEFAULT '{}'::jsonb,
  crowd_levels TEXT,
  coordinates JSONB DEFAULT '{"lat": 0, "lng": 0}'::jsonb,
  accessibility_info JSONB DEFAULT '{}'::jsonb,
  tags TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for destination lookups
CREATE INDEX idx_activities_destination_id ON public.activities(destination_id);
CREATE INDEX idx_activities_category ON public.activities(category);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- This is reference data - publicly readable
CREATE POLICY "Activities are publicly readable"
  ON public.activities FOR SELECT
  USING (true);

-- Only admins can modify (via service role)
-- No INSERT/UPDATE/DELETE policies for regular users

-- Add trigger for updated_at
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();