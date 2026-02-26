
-- Allow public read access for legacy destination images in trip-photos bucket
-- until they are fully migrated to the destination-images bucket
CREATE POLICY "Public can view destination images in trip-photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trip-photos' 
  AND (storage.foldername(name))[1] = 'destination'
);
