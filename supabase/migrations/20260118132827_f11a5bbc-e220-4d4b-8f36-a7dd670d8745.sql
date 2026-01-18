-- Create destination_images table for destination photos
CREATE TABLE public.destination_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  source TEXT DEFAULT 'wikimedia',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_primary BOOLEAN DEFAULT false,
  confidence_score NUMERIC,
  alt_text TEXT,
  is_hero BOOLEAN DEFAULT false
);

-- Create index for destination lookups
CREATE INDEX idx_destination_images_destination_id ON public.destination_images(destination_id);
CREATE INDEX idx_destination_images_is_hero ON public.destination_images(is_hero) WHERE is_hero = true;

-- Enable RLS
ALTER TABLE public.destination_images ENABLE ROW LEVEL SECURITY;

-- This is reference data - publicly readable
CREATE POLICY "Destination images are publicly readable"
  ON public.destination_images FOR SELECT
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_destination_images_updated_at
  BEFORE UPDATE ON public.destination_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();