

# Wire Curated Images to Actually Be Used + Add Upload Flow

## Problem
The admin Image Gallery lets you view, replace URLs, and blacklist — but it doesn't solve the core issue:
1. **Activity images don't check `curated_images`** — `useActivityImage` goes localStorage → edge function → Google Places. It never queries the `curated_images` table directly for activity matches.
2. **External URLs expire** — 1,213 activity images and 213 destination images are raw Google Places URLs that break. Replacing with another external URL just kicks the can.
3. **No file upload** — the admin can only paste URLs, not upload actual image files that get stored permanently in your `destination-images` storage bucket.

## Plan

### 1. Add file upload to the Image Gallery (admin)
**`src/components/admin/ImageGallery.tsx`** — Add an "Upload Image" button/dialog that:
- Accepts JPG/PNG/WebP files (drag-drop or file picker)
- Uploads to the existing `destination-images` storage bucket (public, already exists)
- Generates a stable public URL (never expires)
- Inserts a row into `curated_images` with entity_type, entity_key, destination, and `source: 'admin_upload'`
- Shows preview before confirming

**`src/components/admin/ImageUploadDialog.tsx`** — New component for the upload flow with entity_key/type/destination fields + file input + preview.

### 2. Wire `useActivityImage` to check `curated_images` table first
**`src/hooks/useActivityImage.ts`** — Before calling the expensive edge function, add a quick DB check:
```
Priority chain becomes:
1. existingPhoto (already on the activity record)
2. In-memory cache
3. localStorage cache  
4. NEW: curated_images DB table (by entity_key match)
5. Edge function (Google Places, etc.)
6. Category fallback gradient
```

This is a simple query: `curated_images WHERE entity_type='activity' AND entity_key ILIKE '%{title}%' AND is_blacklisted=false` with vote_score ordering. If found, cache it and skip the edge function entirely.

### 3. Add "Replace with Upload" in gallery cards
**`src/components/admin/ImageGalleryCard.tsx`** — Extend the existing Replace dialog to support file upload (not just URL paste), uploading to `destination-images` bucket and updating the `curated_images` row with the permanent public URL.

### 4. Bulk broken-image re-upload flow
**`src/components/admin/ImageGallery.tsx`** — When "Broken only" filter is active, add a "Re-source" button per card that opens the upload dialog pre-filled with the entity_key/destination, so you can quickly find and upload a replacement.

## Files Changed
- **`src/hooks/useActivityImage.ts`** — Add `curated_images` DB lookup as tier between cache and edge function
- **`src/components/admin/ImageUploadDialog.tsx`** — New: upload file → storage → curated_images row
- **`src/components/admin/ImageGallery.tsx`** — Add upload button, integrate upload dialog, broken-image re-source flow
- **`src/components/admin/ImageGalleryCard.tsx`** — Add file upload option to replace action

## No database or RLS changes needed
The `destination-images` bucket is already public. The admin RLS policy on `curated_images` was added in the previous step. Storage upload works with authenticated users.

