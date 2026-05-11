-- doc_marker: trip_memories_no_update
-- The trip-memories storage bucket is insert-once + delete-only by design.
-- Memory replacement MUST be implemented as DELETE-then-INSERT through the
-- upload-trip-memory edge function — never .update() or { upsert: true }.
-- See mem://constraints/security/storage-buckets-update-policy
-- Original documentation migration: 20260511133529_f55e5774-3c4c-4c3f-b923-3e6469dabb18
-- This file exists purely for grep-discoverability of the constraint;
-- tokens: trip_memories no_update insert_once delete_only.

SELECT 'trip_memories_no_update_documented'::text AS marker;