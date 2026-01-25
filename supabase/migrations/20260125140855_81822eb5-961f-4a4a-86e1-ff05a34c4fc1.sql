-- Create itinerary version history table for undo functionality
CREATE TABLE public.itinerary_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  activities JSONB NOT NULL,
  day_metadata JSONB, -- theme, title, narrative, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_action TEXT, -- 'regenerate', 'swap', 'manual_edit', etc.
  is_current BOOLEAN DEFAULT false,
  
  UNIQUE(trip_id, day_number, version_number)
);

-- Create index for fast lookups
CREATE INDEX idx_itinerary_versions_trip_day ON public.itinerary_versions(trip_id, day_number);
CREATE INDEX idx_itinerary_versions_current ON public.itinerary_versions(trip_id, day_number, is_current) WHERE is_current = true;

-- Enable RLS
ALTER TABLE public.itinerary_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies: Users can only access versions for their own trips
CREATE POLICY "Users can view their own itinerary versions"
ON public.itinerary_versions
FOR SELECT
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their own itinerary versions"
ON public.itinerary_versions
FOR INSERT
WITH CHECK (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own itinerary versions"
ON public.itinerary_versions
FOR UPDATE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their own itinerary versions"
ON public.itinerary_versions
FOR DELETE
USING (
  trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
);

-- Function to auto-increment version number
CREATE OR REPLACE FUNCTION public.increment_itinerary_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the next version number for this trip/day
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM public.itinerary_versions
  WHERE trip_id = NEW.trip_id AND day_number = NEW.day_number;
  
  -- Mark previous versions as not current
  UPDATE public.itinerary_versions
  SET is_current = false
  WHERE trip_id = NEW.trip_id AND day_number = NEW.day_number;
  
  -- Mark this one as current
  NEW.is_current := true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-versioning
CREATE TRIGGER trg_increment_itinerary_version
BEFORE INSERT ON public.itinerary_versions
FOR EACH ROW
EXECUTE FUNCTION public.increment_itinerary_version();

-- Keep only last 10 versions per day (cleanup function)
CREATE OR REPLACE FUNCTION public.cleanup_old_itinerary_versions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.itinerary_versions
  WHERE id IN (
    SELECT id FROM public.itinerary_versions
    WHERE trip_id = NEW.trip_id AND day_number = NEW.day_number
    ORDER BY version_number DESC
    OFFSET 10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create cleanup trigger
CREATE TRIGGER trg_cleanup_old_itinerary_versions
AFTER INSERT ON public.itinerary_versions
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_old_itinerary_versions();