

# Admin Image Management Dashboard

## Problem
The current Image Curation page is a Tinder-style swipe interface — useful for voting but impractical for diagnosing and fixing the image problem at scale. You need to **see** all images in a grid, identify broken/missing ones, and source replacements.

Key data: 10,419 curated images exist. 1,213 activity images and 213 destination images are raw Google Places API URLs (with embedded API keys), which expire and break. 7,916 are properly cached in storage. Zero Unsplash URLs (good — those were blocked).

## Plan

### 1. New "Image Gallery" tab on the existing ImageCuration page

Add a **Tabs** layout to the existing page:
- **Review** tab — keeps the existing Tinder swipe UI
- **Gallery** tab — new browsable grid with filters and actions

### 2. Gallery Tab Features

**Browsable Grid View**
- Display images in a responsive grid (3-4 columns) with entity name, destination, source badge, and score overlay
- Broken images highlighted with red border and "BROKEN" badge (detected via `onError`)
- Paginated (50 per page) with load-more

**Filters & Search**
- Filter by: entity_type (destination/activity/hotel/restaurant), source, broken-only toggle
- Search by entity_key or destination text
- Sort by: vote_score, quality_score, newest, unreviewed

**Per-Image Actions**
- **Replace**: Opens a dialog to paste a new URL → updates the `image_url` in `curated_images`
- **Delete/Blacklist**: Marks `is_blacklisted = true`
- **Preview full-size**: Click to expand

**Broken Image Detection**
- Client-side: `onError` handler marks images as broken in local state
- "Show broken only" filter to quickly find all bad images

### 3. Bulk Actions Bar
- Select multiple images via checkbox
- Bulk blacklist selected
- Stats summary: total images, broken count, by source breakdown

### 4. RLS Consideration
Current `curated_images` policies: public SELECT, service_role only for INSERT/UPDATE/DELETE. Admin users can't update via the client.

**Fix**: Add an RLS policy allowing admin-role users to INSERT/UPDATE/DELETE on `curated_images`:
```sql
CREATE POLICY "Admins can manage curated images"
ON public.curated_images FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### Files Changed
- **`src/pages/admin/ImageCuration.tsx`** — Add Tabs wrapper, keep existing swipe as "Review" tab, add new "Gallery" tab
- **`src/components/admin/ImageGallery.tsx`** — New component: grid view with filters, search, broken detection, replace/blacklist actions
- **`src/components/admin/ImageGalleryCard.tsx`** — New component: individual image card with actions overlay
- **Migration** — Add admin RLS policy for `curated_images` write access

