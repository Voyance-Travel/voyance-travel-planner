-- Add travel_agent_mode to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS travel_agent_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS agent_business_name text,
ADD COLUMN IF NOT EXISTS agent_business_email text;

-- Create agent_clients table for storing client profiles
CREATE TABLE public.agent_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Contact
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  
  -- Travel Preferences (mirrors Travel DNA structure)
  travel_preferences jsonb DEFAULT '{}'::jsonb,
  -- Example: { budget_tier: "mid", pace: "relaxed", interests: ["culture", "food"] }
  
  -- Notes & Tags
  notes text,
  tags text[] DEFAULT '{}',
  
  -- Tracking
  total_trips integer DEFAULT 0,
  total_revenue_cents integer DEFAULT 0,
  last_trip_date timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add client_id to trips table for linking trips to clients
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.agent_clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_agent_trip boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS agent_notes text;

-- Enable RLS
ALTER TABLE public.agent_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Agents can only see their own clients
CREATE POLICY "Agents can view own clients"
ON public.agent_clients FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

CREATE POLICY "Agents can create own clients"
ON public.agent_clients FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own clients"
ON public.agent_clients FOR UPDATE
TO authenticated
USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own clients"
ON public.agent_clients FOR DELETE
TO authenticated
USING (agent_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_agent_clients_updated_at
BEFORE UPDATE ON public.agent_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_agent_clients_agent_id ON public.agent_clients(agent_id);
CREATE INDEX idx_trips_client_id ON public.trips(client_id) WHERE client_id IS NOT NULL;