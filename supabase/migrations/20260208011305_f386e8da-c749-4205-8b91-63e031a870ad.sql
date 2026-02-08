-- Add guest edit mode to trips table
-- 'free_edit' = guests can directly modify itinerary
-- 'propose_approve' = guests must propose changes, owner approves (with collaborator voting)
ALTER TABLE public.trips 
ADD COLUMN guest_edit_mode text NOT NULL DEFAULT 'propose_approve' 
CHECK (guest_edit_mode IN ('free_edit', 'propose_approve'));

-- Add vote tracking to trip_suggestions for the hybrid approval system
-- owner_approved: owner has explicitly approved/rejected
-- votes_for/votes_against: collaborator vote counts
ALTER TABLE public.trip_suggestions 
ADD COLUMN IF NOT EXISTS owner_decision text CHECK (owner_decision IN ('approved', 'rejected', NULL)),
ADD COLUMN IF NOT EXISTS owner_decided_at timestamptz,
ADD COLUMN IF NOT EXISTS votes_for integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS votes_against integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_applied boolean NOT NULL DEFAULT false;

-- Create a votes table to track individual collaborator votes
CREATE TABLE IF NOT EXISTS public.suggestion_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id uuid NOT NULL REFERENCES public.trip_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote text NOT NULL CHECK (vote IN ('for', 'against')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

-- Enable RLS
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view votes on suggestions for trips they have access to
CREATE POLICY "Users can view votes on their trip suggestions"
  ON public.suggestion_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_suggestions ts
      JOIN public.trips t ON t.id = ts.trip_id
      WHERE ts.id = suggestion_votes.suggestion_id
      AND (
        t.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.trip_collaborators tc
          WHERE tc.trip_id = t.id AND tc.user_id = auth.uid() AND tc.accepted_at IS NOT NULL
        )
      )
    )
  );

-- RLS: Authenticated users can insert their own votes
CREATE POLICY "Users can cast votes"
  ON public.suggestion_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.trip_suggestions ts
      JOIN public.trips t ON t.id = ts.trip_id
      WHERE ts.id = suggestion_votes.suggestion_id
      AND (
        t.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.trip_collaborators tc
          WHERE tc.trip_id = t.id AND tc.user_id = auth.uid() AND tc.accepted_at IS NOT NULL
        )
      )
    )
  );

-- RLS: Users can update their own votes
CREATE POLICY "Users can update own votes"
  ON public.suggestion_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS: Users can delete their own votes
CREATE POLICY "Users can delete own votes"
  ON public.suggestion_votes FOR DELETE
  USING (auth.uid() = user_id);