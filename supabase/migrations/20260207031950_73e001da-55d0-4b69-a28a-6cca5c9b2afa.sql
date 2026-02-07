
-- Create storage bucket for trip memories
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-memories', 'trip-memories', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for trip-memories bucket
CREATE POLICY "Users can upload their own trip memories"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'trip-memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own trip memories"
ON storage.objects FOR SELECT
USING (bucket_id = 'trip-memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own trip memories"
ON storage.objects FOR DELETE
USING (bucket_id = 'trip-memories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trip_memories table for metadata
CREATE TABLE public.trip_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  activity_id TEXT,
  activity_name TEXT,
  image_url TEXT NOT NULL,
  caption TEXT,
  location_name TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  day_number INTEGER
);

ALTER TABLE public.trip_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memories"
ON public.trip_memories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memories"
ON public.trip_memories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
ON public.trip_memories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
ON public.trip_memories FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_trip_memories_trip_id ON public.trip_memories(trip_id);
CREATE INDEX idx_trip_memories_user_id ON public.trip_memories(user_id);
