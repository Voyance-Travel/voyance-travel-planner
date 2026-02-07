
-- Create trip suggestions table
CREATE TABLE public.trip_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL,
  trip_type TEXT NOT NULL DEFAULT 'consumer',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  suggestion_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create suggestion votes table
CREATE TABLE public.trip_suggestion_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID NOT NULL REFERENCES public.trip_suggestions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  voter_name TEXT NOT NULL,
  vote_type TEXT NOT NULL DEFAULT 'up',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id),
  UNIQUE(suggestion_id, voter_name)
);

-- Enable RLS
ALTER TABLE public.trip_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_suggestion_votes ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read suggestions for trips they have access to
-- (authenticated users for their trips, anon via edge function)
CREATE POLICY "Authenticated users can read suggestions for their trips"
ON public.trip_suggestions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators WHERE trip_id = trip_suggestions.trip_id AND user_id = auth.uid() AND status = 'accepted'
  )
  OR EXISTS (
    SELECT 1 FROM public.agency_trips WHERE id = trip_id AND (agent_id = auth.uid() OR share_enabled = true)
  )
);

-- Authenticated users can insert suggestions for trips they belong to
CREATE POLICY "Authenticated users can insert suggestions"
ON public.trip_suggestions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.trip_collaborators WHERE trip_id = trip_suggestions.trip_id AND user_id = auth.uid() AND status = 'accepted')
    OR EXISTS (SELECT 1 FROM public.agency_trips WHERE id = trip_id AND agent_id = auth.uid())
  )
);

-- Allow anon reads for shared agency trips
CREATE POLICY "Anon can read suggestions for shared agency trips"
ON public.trip_suggestions FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.agency_trips WHERE id = trip_id AND share_enabled = true
  )
);

-- Votes RLS
CREATE POLICY "Authenticated users can read votes"
ON public.trip_suggestion_votes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Anon can read votes"
ON public.trip_suggestion_votes FOR SELECT TO anon
USING (true);

CREATE POLICY "Authenticated users can vote"
ON public.trip_suggestion_votes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can remove their vote"
ON public.trip_suggestion_votes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_suggestion_votes;

-- Updated_at trigger
CREATE TRIGGER update_trip_suggestions_updated_at
BEFORE UPDATE ON public.trip_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
