-- Create trip_notes table for personal journal entries
CREATE TABLE public.trip_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN ('memory', 'tip', 'saved_place', 'regret', 'discovery')),
  content TEXT NOT NULL,
  location TEXT,
  day_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trip_go_back_list table for "next time" items
CREATE TABLE public.trip_go_back_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'activity' CHECK (category IN ('restaurant', 'activity', 'place', 'event', 'other')),
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_go_back_list ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_notes
CREATE POLICY "Users can view their own trip notes"
  ON public.trip_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trip notes"
  ON public.trip_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trip notes"
  ON public.trip_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trip notes"
  ON public.trip_notes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for trip_go_back_list
CREATE POLICY "Users can view their own go-back list items"
  ON public.trip_go_back_list FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own go-back list items"
  ON public.trip_go_back_list FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own go-back list items"
  ON public.trip_go_back_list FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own go-back list items"
  ON public.trip_go_back_list FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_trip_notes_trip_id ON public.trip_notes(trip_id);
CREATE INDEX idx_trip_notes_user_id ON public.trip_notes(user_id);
CREATE INDEX idx_trip_go_back_list_trip_id ON public.trip_go_back_list(trip_id);
CREATE INDEX idx_trip_go_back_list_user_id ON public.trip_go_back_list(user_id);