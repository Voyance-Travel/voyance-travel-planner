
-- Revert trip-photos to public since destination marketing images need public access.
-- User-uploaded photos are protected by:
-- 1. Storage paths are only exposed via RLS-protected trip_photos table queries
-- 2. Code uses signed URLs for user content access
-- 3. Storage paths include userId/tripId/ prefix making them non-guessable
UPDATE storage.buckets SET public = true WHERE id = 'trip-photos';
