-- Add share token and linked trip ID to agency_trips for share link functionality
ALTER TABLE public.agency_trips 
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS linked_trip_id UUID REFERENCES public.trips(id),
ADD COLUMN IF NOT EXISTS itinerary_data JSONB;

-- Create index for share token lookups
CREATE INDEX IF NOT EXISTS idx_agency_trips_share_token ON public.agency_trips(share_token) WHERE share_token IS NOT NULL;

-- Create function to generate share token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  token := '';
  FOR i IN 1..12 LOOP
    token := token || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN token;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- RLS policy for public share access (read-only via share token)
CREATE POLICY "Public can view shared trips by token"
ON public.agency_trips
FOR SELECT
USING (share_enabled = true AND share_token IS NOT NULL);

-- Allow agents to update share settings on their own trips
DROP POLICY IF EXISTS "Agents can update their own trips" ON public.agency_trips;
CREATE POLICY "Agents can update their own trips"
ON public.agency_trips
FOR UPDATE
USING (auth.uid() = agent_id);