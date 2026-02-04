
# Fix Image Edge Case: Blank/Expired CDN Images

## Problem Analysis

Based on the screenshot and code investigation, I identified that **destinations like Baltimore and Thurmont show gray gradients** instead of actual images. The root cause:

1. **Multiple image sources are in use**: Google Places (1,444 cached), TripAdvisor (797 cached), Wikimedia, and AI generation
2. **Expired CDN URLs return HTTP 200** with blank or tiny image data (not a network error)
3. **Current fallback only handles `onError`**: The `HeroImageWithFallback` component and `useTripHeroImage` hook only trigger fallback when the image fails to load, not when it loads but contains no useful content
4. **Baltimore and Thurmont have TripAdvisor cache entries**: These URLs (`media-cdn.tripadvisor.com`) may be loading "successfully" but rendering as blank

```text
+------------------+     +-------------------+     +-------------------+
|   Issue Chain    |     |   Current State   |     |   Missing Piece   |
+------------------+     +-------------------+     +-------------------+
| TripAdvisor CDN  | --> | HTTP 200 response | --> | onLoad validation |
| URL expires      |     | (blank image)     |     | not checking size |
+------------------+     +-------------------+     +-------------------+
```

## Solution: Multi-Layer Image Validation

### Phase 1: Client-Side Load Validation

**File: `src/components/common/HeroImageWithFallback.tsx`**

Add `onLoad` handler to detect blank/tiny images that "load" but contain no content:

- Check `naturalWidth` and `naturalHeight` after successful load
- If image dimensions are below 10x10 pixels, trigger fallback
- This catches expired CDN responses that return valid HTTP but empty content

```typescript
const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  // Detect blank/tiny images that loaded "successfully"
  if (img.naturalWidth < 10 || img.naturalHeight < 10) {
    console.warn('[Image] Loaded but blank/tiny, triggering fallback');
    handleError();
  }
};
```

### Phase 2: Update useTripHeroImage Hook

**File: `src/hooks/useTripHeroImage.ts`**

Extend the `onError` callback to also handle "blank load" detection:

- Return both `onError` and `onLoad` handlers
- Allow components to use both for comprehensive image validation

### Phase 3: Add US City Curated Images

**File: `src/utils/destinationImages.ts`**

Add curated Unsplash images for common US cities missing from the curated list:

- Baltimore (Inner Harbor, downtown skyline)
- Washington DC (if not present)
- Philadelphia, Boston, Atlanta, Denver

This provides instant, reliable images without API calls for popular destinations.

### Phase 4: Backend Cache Health Check (Optional Enhancement)

**File: `supabase/functions/destination-images/index.ts`**

Add URL validation before returning cached TripAdvisor images:

- Perform lightweight HEAD request on TripAdvisor URLs
- Check `Content-Length` header; reject if suspiciously small (< 1KB)
- Mark entries for cleanup or skip them in favor of other sources

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/common/HeroImageWithFallback.tsx` | Add `onLoad` validation for blank image detection |
| `src/hooks/useTripHeroImage.ts` | Return `onLoad` handler for size validation |
| `src/utils/destinationImages.ts` | Add Baltimore, DC, and other missing US city images |
| `src/pages/TripDashboard.tsx` | Wire up both `onError` and `onLoad` handlers |
| `supabase/functions/destination-images/index.ts` | (Optional) Add URL health check for TripAdvisor cache |

## Expected Outcome

After implementation:
- All destination cards will display real images or properly fall back to gradients
- Expired TripAdvisor URLs will be detected at load time and trigger fallback
- Common US cities will have reliable curated images
- No more gray boxes for Baltimore, Thurmont, or similar destinations
