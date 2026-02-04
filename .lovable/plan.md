

# Fix: Destination Hero Images Showing Wrong Photos (Paris Canyon Issue)

## Problem Summary

The Paris trip is showing a canyon/desert landscape image instead of Paris landmarks. This happens because:

1. **Paris is NOT in the curated-only list** - The frontend has beautiful Unsplash images for Paris, but the code calls the backend API instead of using them
2. **Random POI Selection** - Backend picks a random POI from the destination, leading to inconsistent images
3. **Stale/Polluted Cache** - The `curated_images` database has some mismatched entries (e.g., NYC carriage rides cached for Paris activities)

## Root Cause Analysis

The image resolution flow:

```text
DynamicDestinationPhotos (Paris trip)
        │
        ▼
getDestinationImages() in destinationImagesAPI.ts
        │
        ▼ Paris is NOT in CURATED_ONLY_DESTINATIONS
        │
        ▼ Calls backend edge function
        │
destination-images edge function
        │
        ▼ Picks random POI → "Musée d'Orsay"
        │
        ▼ Searches Google Places / TripAdvisor
        │
        ▼ May return cached bad image or network-cached wrong image
```

The frontend already has high-quality curated Unsplash images for Paris:
- Eiffel Tower panorama
- Paris cityscape with Seine
- Parisian architecture

But these are ONLY used if Paris is in `CURATED_ONLY_DESTINATIONS`.

---

## Solution

### Fix 1: Add Major Destinations to Curated-Only List

Update `src/services/destinationImagesAPI.ts` to include all destinations that have curated images:

```typescript
// Destinations that MUST use curated images (no third-party sources allowed)
const CURATED_ONLY_DESTINATIONS = new Set([
  'rome', 
  'lisbon', 
  'paris',
  'london',
  'barcelona',
  'santorini',
  'amsterdam',
  'vienna',
  'copenhagen',
  'florence',
  'porto',
  'tokyo',
  'kyoto',
  'bali',
  'bangkok',
  'singapore',
  'hong kong',
  'seoul',
  'new york',
  'los angeles',
  'san francisco',
  'miami',
  'new orleans',
  'hawaii',
  'oahu',
  'maui',
  'mexico city',
  'cabo san lucas',
  'cancun',
  'buenos aires',
  'rio de janeiro',
  'peru',
  'cusco',
  'oaxaca',
  'cape town',
  'marrakech',
  'dubai',
  'melbourne',
  'sydney',
  'auckland',
  'cartagena',
  'vancouver'
]);
```

This ensures that for hero images, we use the reliable curated Unsplash images instead of unpredictable API results.

### Fix 2: Improve Fallback Logic

Update `getDestinationImages()` to ALWAYS check for curated images first, regardless of the curated-only list:

```typescript
export async function getDestinationImages(
  params: GetImagesParams = {}
): Promise<DestinationImage[]> {
  const normalizedDestination = normalizeDestinationQuery(params.destination);

  // For hero/gallery, ALWAYS prefer curated images if available
  if (
    normalizedDestination &&
    (params.imageType === 'hero' || params.imageType === 'gallery' || params.imageType === 'all') &&
    hasCuratedImages(normalizedDestination)
  ) {
    const type = (params.imageType === 'gallery' ? 'gallery' : 'hero') as DestinationImage['type'];
    const limit = params.limit ?? (params.imageType === 'gallery' ? 6 : 1);
    const urls = getCuratedDestinationImages(normalizedDestination, limit);
    return urls.map((url, i) => ({
      id: `curated-local-${type}-${i}`,
      url,
      alt: `${normalizedDestination} photo ${i + 1}`,
      type,
      source: 'database',
    }));
  }

  // ... rest of function for API fallback
}
```

### Fix 3: Database Cleanup

Clear mismatched cached images:

```sql
-- Delete cached images with NYC content for Paris
DELETE FROM curated_images
WHERE destination ILIKE '%Paris%'
  AND (alt_text ILIKE '%NYC%' OR alt_text ILIKE '%New York%');

-- Delete any canyon/desert images mistakenly cached for European cities
DELETE FROM curated_images  
WHERE destination IN ('Paris', 'London', 'Rome', 'Barcelona')
  AND (alt_text ILIKE '%canyon%' OR alt_text ILIKE '%desert%');
```

---

## Files to Change

| File | Changes |
|------|---------|
| `src/services/destinationImagesAPI.ts` | Add more destinations to `CURATED_ONLY_DESTINATIONS`; improve logic to always prefer curated images first |

---

## Technical Details

### src/services/destinationImagesAPI.ts Changes

1. Expand `CURATED_ONLY_DESTINATIONS` to include all destinations with curated images
2. Modify `getDestinationImages()` to check for curated images FIRST before calling backend

```typescript
// Line ~19: Expand curated destinations list
const CURATED_ONLY_DESTINATIONS = new Set([
  'rome', 'lisbon', 'paris', 'london', 'barcelona', 'santorini', 'amsterdam',
  'vienna', 'copenhagen', 'florence', 'porto', 'tokyo', 'kyoto', 'bali',
  'bangkok', 'singapore', 'hong kong', 'seoul', 'new york', 'los angeles',
  'san francisco', 'miami', 'new orleans', 'hawaii', 'oahu', 'maui',
  'mexico city', 'cabo san lucas', 'cancun', 'buenos aires', 'rio de janeiro',
  'peru', 'cusco', 'oaxaca', 'cape town', 'marrakech', 'dubai', 'melbourne',
  'sydney', 'auckland', 'cartagena', 'vancouver', 'reykjavik'
]);

// Line ~77: Modify the curated check to not require destination to be in the curated-only list
// For hero/gallery, prefer curated images if available (any destination)
if (
  normalizedDestination &&
  (params.imageType === 'hero' || params.imageType === 'gallery' || params.imageType === 'all') &&
  hasCuratedImages(normalizedDestination)
) {
  // Use curated images...
}
```

---

## Impact

- **Paris and other major cities** will show correct, high-quality Unsplash images
- **Consistent hero images** - no more random POI selection
- **Faster loading** - curated images don't require backend API calls
- **No breaking changes** - destinations without curated images still use API fallback

