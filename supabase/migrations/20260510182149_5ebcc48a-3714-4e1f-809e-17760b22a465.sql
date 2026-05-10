-- 1a. Conflict handling: rename trip-photos copies whose path already exists in destination-images.
--     The new path (no <uuid> first folder) is unreachable under the new RLS policies, but storage.objects can't be deleted directly.
UPDATE storage.objects AS t
SET name = '_archived_marketing/' || t.name
WHERE t.bucket_id = 'trip-photos'
  AND (
    t.name LIKE 'activity/%'
    OR t.name LIKE 'hotel/%'
    OR t.name LIKE 'restaurant/%'
    OR t.name LIKE 'destination/%'
  )
  AND EXISTS (
    SELECT 1 FROM storage.objects d
    WHERE d.bucket_id = 'destination-images' AND d.name = t.name
  );

-- 1b. Move remaining (non-conflicting) marketing images into destination-images
UPDATE storage.objects
SET bucket_id = 'destination-images'
WHERE bucket_id = 'trip-photos'
  AND (
    name LIKE 'activity/%'
    OR name LIKE 'hotel/%'
    OR name LIKE 'restaurant/%'
    OR name LIKE 'destination/%'
  );

-- 2. Make trip-photos private
UPDATE storage.buckets SET public = false WHERE id = 'trip-photos';

-- 3. Drop broad / duplicate legacy policies
DROP POLICY IF EXISTS "Users can view trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view destination images in trip-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own trip photos" ON storage.objects;

-- 4. Owner-only SELECT
CREATE POLICY "trip_photos_owner_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Collaborator SELECT — path = <userId>/<tripId>/<file>
CREATE POLICY "trip_photos_collaborator_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND EXISTS (
    SELECT 1
    FROM public.trip_collaborators tc
    WHERE tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
      AND tc.trip_id::text = (storage.foldername(name))[2]
  )
);

-- 6. Owner write
CREATE POLICY "trip_photos_owner_insert"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trip-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "trip_photos_owner_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'trip-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "trip_photos_owner_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);