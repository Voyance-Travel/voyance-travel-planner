# Lock down `trip-photos` storage bucket

## Findings

- Bucket is **`trip-photos`** (hyphen, not underscore), currently `public = true`.
- The catch-all RLS policy `Users can view trip photos` with `USING (bucket_id = 'trip-photos')` allows any authenticated client to list/select every object. Combined with `public = true`, the `/object/public/...` URLs also work for any anonymous visitor who guesses or scrapes a path.
- `useTripPhotos.ts` already fetches user photos via `createSignedUrl(...)`, so private-bucket access already works for the app — no UI rewrite needed.
- **Conflict**: the same bucket is also used for **public destination marketing images** under the `destination/` prefix:
  - `src/data/destinationStorageImages.ts` hard-codes `…/object/public/trip-photos/destination/…`
  - `supabase/functions/_shared/photo-storage.ts`, `backfill-destination-images`, and `destination-images` write to `trip-photos/destination/*`
  - There is a dedicated policy `Public can view destination images in trip-photos` for that prefix, but `/object/public/...` URLs only work while the bucket is public. Flipping the bucket to private will break destination hero images.
- `trip-memories` is already private and properly scoped — no change needed.

## Plan

### 1. Split the bucket: move destination images to the already-public `destination-images` bucket

This decouples public marketing content from private user uploads so we can safely lock `trip-photos` down.

- New migration copies/relocates objects under `trip-photos/destination/*` → `destination-images/*` (storage objects can be moved with `UPDATE storage.objects SET bucket_id, name`).
- Update code that reads/writes the destination prefix to point at `destination-images`:
  - `src/data/destinationStorageImages.ts` — change `STORAGE_BASE`.
  - `supabase/functions/_shared/photo-storage.ts` — change `BUCKET_NAME` (only for the destination flow).
  - `supabase/functions/backfill-destination-images/index.ts` — change `BUCKET`.
  - `supabase/functions/destination-images/index.ts` — adjust the two URL guards (`includes('/storage/v1/object/public/trip-photos/')`).
- Drop the now-redundant policy `Public can view destination images in trip-photos`.

### 2. Migration: `supabase/migrations/<ts>_secure_trip_photos.sql`

```sql
-- Relocate destination images
UPDATE storage.objects
SET bucket_id = 'destination-images',
    name = regexp_replace(name, '^destination/', '')
WHERE bucket_id = 'trip-photos'
  AND name LIKE 'destination/%';

-- Make trip-photos private
UPDATE storage.buckets SET public = false WHERE id = 'trip-photos';

-- Drop the broad/duplicate policies
DROP POLICY IF EXISTS "Users can view trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view destination images in trip-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own trip photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own trip photos" ON storage.objects;

-- Owner read
CREATE POLICY "trip_photos_owner_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Collaborator read (path = <userId>/<tripId>/<file>)
CREATE POLICY "trip_photos_collaborator_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND EXISTS (
    SELECT 1 FROM public.trip_collaborators tc
    WHERE tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
      AND tc.trip_id::text = (storage.foldername(name))[2]
  )
);

-- Owner write/update/delete (split to keep WITH CHECK explicit)
CREATE POLICY "trip_photos_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trip-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "trip_photos_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "trip_photos_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 3. Frontend

- `useTripPhotos.ts` already uses `createSignedUrl`, so no change.
- Verify no other callers rely on `getPublicUrl('trip-photos', …)` for user photos. (The destination prefix is the only known public-URL consumer, handled in step 1.)

## Verification

- `curl` an old `…/object/public/trip-photos/<userId>/<tripId>/<file>` URL → expect 400/404 (bucket private).
- Authenticated owner → `createSignedUrl` returns a working URL.
- Authenticated non-collaborator → signed URL request denied / 403.
- Authenticated accepted collaborator → signed URL works.
- Destination heroes still render (now via `destination-images` bucket).

## Open question

Confirm before I implement: **OK to relocate `trip-photos/destination/*` → `destination-images/*`** and update the four code paths above? If you'd rather keep destination images in `trip-photos`, the alternative is to keep the bucket public and only drop the catch-all SELECT policy, which doesn't actually solve the finding (public URLs would still resolve). Moving them is the only clean fix.
