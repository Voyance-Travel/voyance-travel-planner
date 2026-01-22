-- Create storage bucket for trip photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create trip_photos table to track uploaded photos
CREATE TABLE IF NOT EXISTS public.trip_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  caption TEXT,
  taken_at TIMESTAMP WITH TIME ZONE,
  day_number INTEGER,
  activity_id UUID REFERENCES public.trip_activities(id) ON DELETE SET NULL,
  location JSONB,
  is_favorite BOOLEAN DEFAULT false,
  is_cover BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;

-- Users can view photos from their own trips
CREATE POLICY "Users can view own trip photos"
ON public.trip_photos FOR SELECT
USING (user_id = auth.uid() OR trip_id IN (
  SELECT id FROM public.trips WHERE user_id = auth.uid()
));

-- Users can insert photos to their own trips
CREATE POLICY "Users can upload photos to own trips"
ON public.trip_photos FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
);

-- Users can update their own photos
CREATE POLICY "Users can update own photos"
ON public.trip_photos FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
ON public.trip_photos FOR DELETE
USING (user_id = auth.uid());

-- Storage policies for trip-photos bucket
CREATE POLICY "Users can upload trip photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trip-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view trip photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'trip-photos');

CREATE POLICY "Users can update own trip photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'trip-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own trip photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trip-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Trigger for updated_at
CREATE TRIGGER update_trip_photos_updated_at
BEFORE UPDATE ON public.trip_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_trip_photos_trip_id ON public.trip_photos(trip_id);
CREATE INDEX idx_trip_photos_user_id ON public.trip_photos(user_id);
CREATE INDEX idx_trip_photos_day_number ON public.trip_photos(day_number);