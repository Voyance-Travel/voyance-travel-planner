
-- Trip chat messages for collaborative discussion
CREATE TABLE public.trip_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL,
  trip_type TEXT NOT NULL DEFAULT 'consumer' CHECK (trip_type IN ('consumer', 'agency')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trip_chat_trip_id ON public.trip_chat_messages(trip_id, created_at);

-- Enable RLS
ALTER TABLE public.trip_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Trip owner or collaborator can read consumer trip messages
CREATE POLICY "Trip members can read chat"
ON public.trip_chat_messages
FOR SELECT
USING (
  -- Consumer trip: owner or collaborator
  (trip_type = 'consumer' AND (
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.trip_collaborators WHERE trip_id = trip_chat_messages.trip_id AND user_id = auth.uid())
  ))
  -- Agency trip: agent who owns the trip
  OR (trip_type = 'agency' AND (
    EXISTS (SELECT 1 FROM public.agency_trips WHERE id = trip_id AND agent_id = auth.uid())
  ))
);

-- Policy: Authenticated users can insert to their own trips
CREATE POLICY "Trip members can send chat"
ON public.trip_chat_messages
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    (trip_type = 'consumer' AND (
      EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.trip_collaborators WHERE trip_id = trip_chat_messages.trip_id AND user_id = auth.uid())
    ))
    OR (trip_type = 'agency' AND (
      EXISTS (SELECT 1 FROM public.agency_trips WHERE id = trip_id AND agent_id = auth.uid())
    ))
  )
);

-- Policy: Anonymous chat via share link (handled by edge function, allow anon read for shared agency trips)
CREATE POLICY "Shared trip viewers can read chat"
ON public.trip_chat_messages
FOR SELECT
TO anon
USING (
  trip_type = 'agency'
  AND EXISTS (
    SELECT 1 FROM public.agency_trips 
    WHERE id = trip_id AND share_enabled = true AND share_token IS NOT NULL
  )
);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_chat_messages;
