-- ==========================================================================
-- Normalized itinerary storage with explicit is_locked column
-- ==========================================================================

-- Itinerary days table
CREATE TABLE public.itinerary_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  title TEXT,
  theme TEXT,
  description TEXT,
  narrative JSONB,
  weather JSONB,
  estimated_walking_time TEXT,
  estimated_distance TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (trip_id, day_number)
);

-- Itinerary activities table
CREATE TABLE public.itinerary_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_day_id UUID NOT NULL REFERENCES public.itinerary_days(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE, -- denormalized for easier RLS & queries
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  name TEXT,
  description TEXT,
  category TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER,
  location JSONB,
  cost JSONB,
  tags TEXT[],
  is_locked BOOLEAN NOT NULL DEFAULT false,
  booking_required BOOLEAN DEFAULT false,
  tips TEXT,
  photos JSONB,
  walking_distance TEXT,
  walking_time TEXT,
  transportation JSONB,
  rating JSONB,
  website TEXT,
  viator_product_code TEXT,
  extra_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX itinerary_days_trip_id_idx ON public.itinerary_days(trip_id);
CREATE INDEX itinerary_activities_day_id_idx ON public.itinerary_activities(itinerary_day_id);
CREATE INDEX itinerary_activities_trip_id_idx ON public.itinerary_activities(trip_id);
CREATE INDEX itinerary_activities_locked_idx ON public.itinerary_activities(trip_id, is_locked) WHERE is_locked = true;

-- Enable RLS
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for itinerary_days
CREATE POLICY "Users can view their own trip days"
ON public.itinerary_days FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)
);

CREATE POLICY "Users can insert their own trip days"
ON public.itinerary_days FOR INSERT
WITH CHECK (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND permission IN ('edit', 'admin') AND accepted_at IS NOT NULL)
);

CREATE POLICY "Users can update their own trip days"
ON public.itinerary_days FOR UPDATE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND permission IN ('edit', 'admin') AND accepted_at IS NOT NULL)
);

CREATE POLICY "Users can delete their own trip days"
ON public.itinerary_days FOR DELETE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND permission IN ('edit', 'admin') AND accepted_at IS NOT NULL)
);

-- RLS policies for itinerary_activities
CREATE POLICY "Users can view their own trip activities"
ON public.itinerary_activities FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)
);

CREATE POLICY "Users can insert their own trip activities"
ON public.itinerary_activities FOR INSERT
WITH CHECK (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND permission IN ('edit', 'admin') AND accepted_at IS NOT NULL)
);

CREATE POLICY "Users can update their own trip activities"
ON public.itinerary_activities FOR UPDATE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND permission IN ('edit', 'admin') AND accepted_at IS NOT NULL)
);

CREATE POLICY "Users can delete their own trip activities"
ON public.itinerary_activities FOR DELETE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND permission IN ('edit', 'admin') AND accepted_at IS NOT NULL)
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_itinerary_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_itinerary_days_updated_at
BEFORE UPDATE ON public.itinerary_days
FOR EACH ROW
EXECUTE FUNCTION public.update_itinerary_updated_at_column();

CREATE TRIGGER update_itinerary_activities_updated_at
BEFORE UPDATE ON public.itinerary_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_itinerary_updated_at_column();