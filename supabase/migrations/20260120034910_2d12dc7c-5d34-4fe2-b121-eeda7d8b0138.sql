-- Create agent_itinerary_library table for saving reusable templates
CREATE TABLE public.agent_itinerary_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('activity', 'day', 'trip_template')),
  tags TEXT[],
  destination_hint TEXT, -- e.g., "Paris" to help with search
  content JSONB NOT NULL, -- The actual EditorialActivity, EditorialDay, or full trip template
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_itinerary_library ENABLE ROW LEVEL SECURITY;

-- Agents can only see and manage their own library items
CREATE POLICY "Agents can view their own library items"
  ON public.agent_itinerary_library
  FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can create their own library items"
  ON public.agent_itinerary_library
  FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own library items"
  ON public.agent_itinerary_library
  FOR UPDATE
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can delete their own library items"
  ON public.agent_itinerary_library
  FOR DELETE
  USING (auth.uid() = agent_id);

-- Create indexes for efficient queries
CREATE INDEX idx_agent_itinerary_library_agent ON public.agent_itinerary_library(agent_id);
CREATE INDEX idx_agent_itinerary_library_type ON public.agent_itinerary_library(item_type);
CREATE INDEX idx_agent_itinerary_library_tags ON public.agent_itinerary_library USING GIN(tags);

-- Add trigger for updated_at
CREATE TRIGGER update_agent_itinerary_library_updated_at
  BEFORE UPDATE ON public.agent_itinerary_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();