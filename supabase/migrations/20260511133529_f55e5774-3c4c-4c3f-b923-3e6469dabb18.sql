-- Doc-only migration (no DDL).
--
-- Contract: the `trip-memories` storage bucket is INSERT-ONCE + DELETE-ONLY by design.
-- The deliberate absence of an UPDATE policy on storage.objects for bucket_id =
-- 'trip-memories' is INTENTIONAL, not an oversight. Memory replacement is implemented
-- as DELETE-then-INSERT through the `upload-trip-memory` edge function (service role,
-- validates user/trip ownership). Client code MUST NOT call `.update()` or pass
-- `{ upsert: true }` against this bucket.
--
-- If a future feature requires in-place replacement, add an UPDATE policy mirroring
-- the existing INSERT/DELETE owner-folder check
--   (auth.uid()::text = (storage.foldername(name))[1])
-- and update mem://constraints/security/storage-buckets-update-policy.
--
-- The supabase linter finding `trip_memories_storage_no_update` is documented
-- accepted-class as of this migration.
DO $$ BEGIN
  RAISE NOTICE 'trip-memories bucket: insert-once + delete-only contract documented';
END $$;