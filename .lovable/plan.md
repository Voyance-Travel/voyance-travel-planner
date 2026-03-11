

## Fix: Unsplash Image Loading Errors

### Root Cause

The project has a global MutationObserver in `main.tsx` that patches `<img>` elements with error handlers, but this approach is fragile — React's virtual DOM can replace nodes faster than the observer patches them. Meanwhile, the existing `SafeImage` component (which handles errors properly) is only used in 5 files. Dozens of components render bare `<img>` tags without `onError` handlers.

### Approach

**1. Enhance `SafeImage` with category-aware fallbacks**

Add an optional `fallbackCategory` prop to `SafeImage`. When an image fails, instead of always falling back to a generic placeholder SVG, use a category-specific gradient SVG (generated inline as data URIs — no external dependencies needed). Categories: `dining`, `sightseeing`, `nightlife`, `accommodation`, `shopping`, `transport`, `default`.

**2. Replace bare `<img>` tags with `SafeImage` in key components**

These components render images without error handling and are the most visible to users:

| Component | What it shows |
|-----------|--------------|
| `TripActivityCard.tsx` (line 182) | Activity thumbnails in planner |
| `TripCard.tsx` (line 41) | Trip card hero images |
| `HotelSelector.tsx` (line 47) | Hotel images |
| `SampleItinerary.tsx` (lines 421, 598) | Sample itinerary photos |
| `CommunityGuideDetail.tsx` (lines 231, 453, 466) | Guide hero + activity photos |
| `CommunityGuideCard.tsx` (line 38) | Guide card thumbnails |
| `TripDashboard.tsx` (line 703) | Suggested destination images |
| `DemoPlayground.tsx` (lines 319, 331, 822) | Demo destination images |
| `DemoHero.tsx` (line 131) | Demo card images |
| `GuidePreview.tsx` (line 57) | Guide preview thumbnails |

**3. Keep the global guard as a safety net**

The `main.tsx` MutationObserver stays as a last-resort catch-all, but the primary defense is now per-component via `SafeImage`.

### Summary

- Enhance `SafeImage` with category-specific gradient fallbacks (inline SVG data URIs)
- Swap ~15 bare `<img>` tags across 10 components to use `SafeImage`
- No new image files needed — fallbacks are generated as SVG data URIs
- Global guard in `main.tsx` remains unchanged as backup

