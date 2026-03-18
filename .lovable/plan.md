

## Fix: Community Guide Missing Activities + Broken Images

### Problem 1: Not all activities shown in published guide
In `CommunityGuideDetail.tsx` (line 186-189), the published view filters activities to only show "enriched" ones — those with a user note, rating, recommendation, or photos. If you add 55 activities but don't annotate them all, the un-annotated ones are silently hidden. The user expects all selected activities to appear.

### Problem 2: Broken activity images
When building the guide, `image_url` is set from `s.photoUrl` (line 359 in GuideBuilder), which originates from the itinerary activity's `photos[0]` — typically an expired Google Places URL. These break after a few hours. User-uploaded photos (stored in `guide-photos` bucket) work fine, but the fallback itinerary photos don't.

### Fix

**1. `src/pages/CommunityGuideDetail.tsx` — Show all activities, not just enriched ones**

Remove the filter that hides un-annotated activities. All activities saved to the guide should appear in the published view. Activities without user content will show their AI tip/description as fallback content.

- Line ~186: Change `enrichedActivities` to include all activities (remove the filter)
- Line ~196: `regularActivities` should use all non-manual activities

**2. `src/pages/GuideBuilder.tsx` — Strip expired external URLs from `image_url`**

When building the `content` object for save (~line 351-367), check if `image_url` is a storage URL. If it's an external (Google) URL, don't store it — it will expire. Only persist URLs from our storage bucket or user-uploaded photos.

```typescript
// Helper: only keep storage-backed URLs
const safeImageUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.includes('/storage/v1/object/public/')) return url;
  return null; // Drop expired external URLs
};
```

Apply this to the `image_url` field in the content builder.

**3. `src/pages/CommunityGuideDetail.tsx` — Use `SafeImage` fallback gracefully**

Already using `SafeImage` which handles errors, but also skip rendering the image block entirely if `image_url` is falsy after the cleanup above.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/GuideBuilder.tsx` | Filter out non-storage URLs from `image_url` when saving content |
| 2 | `src/pages/CommunityGuideDetail.tsx` | Show all activities (remove enriched-only filter); keep enriched filter only for highlighting |

