

## Fix: Broken Image Links in Image Review/Gallery

### Problem

The Image Curation page (both Gallery and Review tabs) renders `image_url` directly from the `curated_images` table. Many of these URLs are expired Google Places photo URLs (temporary signed links) that were stored directly instead of being cached to storage. The `destination-images` edge function has a "self-heal" mechanism that downloads external URLs into storage — but the admin gallery loads images directly without any healing.

### Solution

Add a **"Heal Broken Images" bulk action** to the admin gallery that identifies non-storage URLs and triggers the self-heal process, plus improve the gallery to visually surface broken vs. storage-backed images so you can triage.

Two-part fix:

**1. `src/components/admin/ImageGallery.tsx` — Add a "Heal Broken" bulk action**

Add a button that:
- Finds all loaded images whose `image_url` does NOT contain `/storage/v1/object/public/trip-photos/` (i.e., external URLs that will expire)
- For each, attempts to download and re-upload to storage via the existing `destination-images` edge function or a direct fetch-and-upload flow
- Updates the `curated_images` row with the new storage URL
- Refreshes the gallery

Also add a filter option "External URLs Only" alongside "Broken Only" so you can quickly see which images are at risk.

**2. `src/components/admin/ImageGalleryCard.tsx` — Visual indicator for external vs. cached URLs**

Add a badge showing "External" (yellow warning) for URLs not hosted in our storage bucket, vs. "Cached" (green) for storage-backed URLs. This lets admins identify at-risk images before they break.

**3. `src/components/admin/ImageGallery.tsx` — Add batch heal function**

Create a `healBrokenImages` function that:
```typescript
// For each image with an external URL:
// 1. Call supabase.functions.invoke('destination-images', { body: { entityType, entityKey, destination, forceRefresh: true } })
// 2. The edge function will download, cache to storage, and update curated_images
// 3. Refresh the gallery
```

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/admin/ImageGalleryCard.tsx` | Add "External"/"Cached" badge based on URL pattern |
| 2 | `src/components/admin/ImageGallery.tsx` | Add "External Only" filter, "Heal Broken" bulk action that invokes self-heal for non-storage URLs |

