## Root cause

In `src/components/itinerary/EditorialItinerary.tsx` the single-city accommodation card (~L7230) renders the hero image based **only** on `hotelSelection.imageUrl`:

```tsx
{hotelSelection?.imageUrl ? (
  <img src={hotelSelection.imageUrl} … />
) : (
  <div …><Hotel className="…" /></div>   // grey placeholder
)}
```

But the photo-count badge a few lines below reads from a **different** field, `hotelSelection.images[]` (L7258, L7267):

```tsx
{hotelSelection?.images && hotelSelection.images.length > 1 && ( … {hotelSelection.images.length} … )}
```

So when a hotel has `images: [..5 urls..]` populated but `imageUrl` is null/empty (e.g. the Four Seasons Hotel George V record), the placeholder shows while the badge correctly reports "5". The two fields are not reconciled.

The same pattern exists in the multi-city accommodation card (~L7141) for `cityHotel.hotel.imageUrl` (no `images` fallback there either, but worth aligning).

This matches the stack-overflow note: image sources can be inconsistent across fields after writeback. The fix is purely client-side — pick the first available URL from a small fallback chain.

## Fix

Add a small inline resolver that returns the first usable URL from: `imageUrl` → `images[0]` → `photos[0]` (if present). Use it in both accommodation render paths.

### Changes

**`src/components/itinerary/EditorialItinerary.tsx`**

1. Add a tiny helper near the existing `getActivityPhoto` (~L1083), e.g.:

   ```ts
   function getHotelHeroImage(h: any): string | null {
     if (!h) return null;
     if (typeof h.imageUrl === 'string' && h.imageUrl.trim()) return h.imageUrl;
     const imgs = Array.isArray(h.images) ? h.images : [];
     for (const v of imgs) {
       if (typeof v === 'string' && v.trim()) return v;
       if (v && typeof v === 'object' && typeof v.url === 'string' && v.url.trim()) return v.url;
     }
     const photos = Array.isArray(h.photos) ? h.photos : [];
     for (const v of photos) {
       if (typeof v === 'string' && v.trim()) return v;
       if (v && typeof v === 'object' && typeof v.url === 'string' && v.url.trim()) return v.url;
     }
     return null;
   }
   ```

2. Single-city card (~L7241): replace the `hotelSelection?.imageUrl` ternary with `const heroSrc = getHotelHeroImage(hotelSelection);` and gate on `heroSrc`. On `onError`, fall back to a state flag (or to images[1], images[2]…) — simplest: keep `e.currentTarget.style.display = 'none'` but also set a local `useState` `imgFailed` so the placeholder div renders behind it. Acceptable minimum: keep current `style.display = 'none'` behavior; the gradient/badge still render which is the existing UX. Add the placeholder underneath via absolute positioning so it shows when the `<img>` is hidden:

   ```tsx
   const heroSrc = getHotelHeroImage(hotelSelection);
   …
   <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
     <Hotel className="h-12 w-12 text-muted-foreground/30" />
   </div>
   {heroSrc && (
     <img src={heroSrc} … className="relative w-full h-full object-cover …" onError={…} />
   )}
   ```

   This guarantees no blank state if the URL fails.

3. Multi-city city hotel card (~L7141): apply the same `getHotelHeroImage(cityHotel.hotel)` resolver so a hotel with `images[]` but no `imageUrl` still renders.

## Out of scope

- Persisting/uploading hotel images to permanent storage (covered separately if temporary URLs become an issue).
- The opacity-0 `group-hover` on the photo-count badge (separate touch-target issue, not in this report).
- Changes to data fetching / writeback pipelines.

## Verification

1. Open a trip with the Four Seasons Hotel George V (or any hotel where `images[]` is populated but `imageUrl` is empty). Confirm the hero image now displays the first photo and the "5" badge still shows.
2. Force the image URL to 404 (DevTools blocking). Confirm the grey placeholder shows underneath instead of a blank/broken image.
3. Multi-city trip: confirm the small thumbnail in each city card also resolves from `images[]`.
