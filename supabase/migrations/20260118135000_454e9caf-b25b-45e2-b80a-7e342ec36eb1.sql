-- Create guides table for editorial content
CREATE TABLE public.guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  image_url TEXT,
  excerpt TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  category TEXT,
  reading_time INTEGER,
  destination_city TEXT,
  destination_country TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

-- Guides are publicly readable
CREATE POLICY "Guides are publicly readable"
  ON public.guides FOR SELECT
  USING (published = true);

-- Create trip_activities table for detailed activity tracking
CREATE TABLE public.trip_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  itinerary_day_id UUID,
  type TEXT NOT NULL DEFAULT 'activity',
  title TEXT NOT NULL,
  description TEXT,
  start_time TIME,
  end_time TIME,
  venue_id UUID,
  location TEXT,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  place_id TEXT,
  block_order INTEGER DEFAULT 0,
  locked BOOLEAN DEFAULT false,
  recommendation_score NUMERIC,
  added_by_user BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  booking_status TEXT DEFAULT 'not_booked',
  booking_required BOOLEAN DEFAULT false,
  cost NUMERIC,
  currency TEXT DEFAULT 'USD',
  tags JSONB DEFAULT '[]'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,
  operating_hours JSONB,
  transportation JSONB,
  verified BOOLEAN DEFAULT false,
  verification_confidence INTEGER,
  rating_value NUMERIC,
  rating_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;

-- Users can view activities for their trips
CREATE POLICY "Users can view own trip activities"
  ON public.trip_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_activities.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

-- Users can insert activities for their trips
CREATE POLICY "Users can insert own trip activities"
  ON public.trip_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_activities.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

-- Users can update activities for their trips
CREATE POLICY "Users can update own trip activities"
  ON public.trip_activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_activities.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

-- Users can delete activities for their trips
CREATE POLICY "Users can delete own trip activities"
  ON public.trip_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE trips.id = trip_activities.trip_id 
      AND trips.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_trip_activities_trip_id ON public.trip_activities(trip_id);
CREATE INDEX idx_trip_activities_day_id ON public.trip_activities(itinerary_day_id);

-- Create triggers
CREATE TRIGGER update_trip_activities_updated_at
  BEFORE UPDATE ON public.trip_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guides_updated_at
  BEFORE UPDATE ON public.guides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();