-- Add transportation preferences to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS transportation_preferences JSONB DEFAULT NULL;

-- Add rental car details table for tracking rental car bookings
CREATE TABLE IF NOT EXISTS public.trip_rental_cars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Rental details
  rental_company TEXT,
  car_type TEXT, -- economy, compact, midsize, fullsize, suv, luxury, minivan
  
  -- Pickup/dropoff
  pickup_location TEXT,
  pickup_date DATE,
  pickup_time TIME,
  dropoff_location TEXT,
  dropoff_date DATE,
  dropoff_time TIME,
  
  -- Costs
  daily_rate NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  
  -- Booking info
  confirmation_number TEXT,
  booking_url TEXT,
  insurance_included BOOLEAN DEFAULT false,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_rental_cars ENABLE ROW LEVEL SECURITY;

-- RLS policies for rental cars
CREATE POLICY "Users can view their own rental cars" 
ON public.trip_rental_cars 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create rental cars for their trips" 
ON public.trip_rental_cars 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rental cars" 
ON public.trip_rental_cars 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rental cars" 
ON public.trip_rental_cars 
FOR DELETE 
USING (auth.uid() = user_id);

-- Collaborators can view rental cars for trips they're invited to
CREATE POLICY "Collaborators can view rental cars" 
ON public.trip_rental_cars 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.trip_collaborators tc 
    WHERE tc.trip_id = trip_rental_cars.trip_id 
    AND tc.user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_trip_rental_cars_trip_id ON public.trip_rental_cars(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_rental_cars_user_id ON public.trip_rental_cars(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_trip_rental_cars_updated_at
BEFORE UPDATE ON public.trip_rental_cars
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();