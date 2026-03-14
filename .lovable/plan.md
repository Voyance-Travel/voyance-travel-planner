

## Fix: destination-images 400 Bad Request

**Root cause**: `useTripHeroImage` is called with `destination: trip?.destination || ''` (empty string). When the API fallback chain triggers, `getHeroImageByName('')` normalizes `''` to `undefined`, sending `{imageType: "hero", limit: 1}` to the edge function with no destination/venueName/destinationId — triggering the 400 validation error.

**Fix** (two guard layers):

1. **`src/hooks/useTripHeroImage.ts`** — In the API fetch effect (~line 111), add an early return if `destination` is empty/falsy. This prevents the edge function call entirely when there's no destination.

2. **`src/services/destinationImagesAPI.ts`** — In `getDestinationImages()` (~line 229), add a guard before the edge function call: if `normalizedDestination` and `params.destinationId` are both falsy, return `[]` instead of calling the backend. This is a safety net for any other caller.

Both changes are 1-2 line guards. No structural refactoring needed.

