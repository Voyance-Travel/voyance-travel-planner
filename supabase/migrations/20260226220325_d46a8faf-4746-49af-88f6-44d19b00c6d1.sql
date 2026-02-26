
-- Create a dedicated public bucket for static destination marketing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('destination-images', 'destination-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access for destination images
CREATE POLICY "Destination images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'destination-images');

-- Copy destination images from trip-photos to destination-images bucket
-- Note: Storage file copy must be done via application code or manually.
-- The images are at trip-photos/destination/* and need to be in destination-images/destination/*

-- Make trip-photos bucket private (user-uploaded content should not be public)
UPDATE storage.buckets SET public = false WHERE id = 'trip-photos';

-- Add RLS policies for trip-photos to allow authenticated users to manage their own files
-- Users can upload to their own folder
CREATE POLICY "Users can upload their own trip photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own photos
CREATE POLICY "Users can view their own trip photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'trip-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own photos
CREATE POLICY "Users can delete their own trip photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
