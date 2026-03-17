

## Fix: Duplicate Images in Admin Gallery

### Problem

The `curated_images` table has 10,404 rows but only 5,194 unique image URLs. The same photo gets stored under many different `entity_key` values — for example, a single Lisbon photo appears 29 times because every restaurant/activity in Lisbon that failed to find its own photo fell back to the same generic image. The unique constraint `(entity_type, entity_key, destination)` allows this because each row has a different `entity_key`.

The gallery query fetches all rows without deduplicating by `image_url`, so admins see every duplicate.

### Fix

**Two-part approach: deduplicate the display AND clean up the data.**

**1. Gallery display dedup (`src/components/admin/ImageGallery.tsx`)**

After fetching images, deduplicate by `image_url` before displaying. Keep the row with the highest `quality_score` (or most recent) as the representative:

```typescript
// After fetching:
const deduped = Array.from(
  new Map(fetched.map(img => [img.image_url, img])).values()
);
```

This is a simple, instant fix that makes the gallery show unique images only.

**2. Database cleanup (one-time migration)**

Run a migration to delete duplicate rows, keeping only the best-scored row per `image_url`:

```sql
DELETE FROM curated_images
WHERE id NOT IN (
  SELECT DISTINCT ON (image_url) id
  FROM curated_images
  ORDER BY image_url, quality_score DESC NULLS LAST, created_at DESC
);
```

This reduces 10,404 rows to ~5,194 and cuts storage/query overhead in half.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/admin/ImageGallery.tsx` | Deduplicate fetched results by `image_url` before setting state |
| 2 | Database migration | One-time cleanup of duplicate `image_url` rows |

