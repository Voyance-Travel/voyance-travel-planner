-- Lock down trip-memories bucket: client uploads must go through the
-- upload-trip-memory edge function (service-role) so we can enforce
-- server-side MIME/magic-byte/size validation and EXIF stripping.
DROP POLICY IF EXISTS "Users can upload their own trip memories" ON storage.objects;
-- View + delete policies remain unchanged (signed URL + cleanup flow).
