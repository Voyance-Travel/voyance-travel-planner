-- Table to capture user itinerary customization requests for profile improvement
CREATE TABLE public.itinerary_customization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- 'swap', 'pace', 'dietary', 'budget', 'general'
  user_message TEXT NOT NULL, -- What the user asked for
  extracted_preferences JSONB, -- Structured preferences extracted from the message
  action_taken TEXT, -- 'applied', 'suggested', 'declined', 'pending'
  activity_id UUID, -- If targeting a specific activity
  conversation_id UUID, -- Group messages in same session
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.itinerary_customization_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own customization requests
CREATE POLICY "Users can view own customization requests"
ON public.itinerary_customization_requests
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own customization requests
CREATE POLICY "Users can create own customization requests"
ON public.itinerary_customization_requests
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_customization_requests_user ON public.itinerary_customization_requests(user_id);
CREATE INDEX idx_customization_requests_trip ON public.itinerary_customization_requests(trip_id);