-- Create itinerary templates table
CREATE TABLE public.itinerary_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Template source metadata
  source_destination TEXT, -- Original destination this was created from
  source_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  -- The template data (activities abstracted from specific destination)
  template_data JSONB NOT NULL, -- Array of days with activities
  day_count INTEGER NOT NULL DEFAULT 1,
  -- Categorization
  tags TEXT[] DEFAULT '{}',
  trip_type TEXT, -- e.g., 'romantic', 'adventure', 'cultural', 'relaxation'
  pace TEXT, -- 'relaxed', 'moderate', 'packed'
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.itinerary_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY "Users can view own templates" 
ON public.itinerary_templates 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own templates
CREATE POLICY "Users can create own templates" 
ON public.itinerary_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" 
ON public.itinerary_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" 
ON public.itinerary_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Index for quick lookup
CREATE INDEX idx_itinerary_templates_user_id ON public.itinerary_templates(user_id);
CREATE INDEX idx_itinerary_templates_tags ON public.itinerary_templates USING GIN(tags);

-- Trigger for updated_at
CREATE TRIGGER update_itinerary_templates_updated_at
BEFORE UPDATE ON public.itinerary_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();