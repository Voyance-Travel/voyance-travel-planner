

## Fix: Read from prefetch cache before calling API

**File:** `src/components/planner/shared/DynamicDestinationPhotos.tsx`

### Changes

1. **Line 5** — Add `getCachedImages` to the import:
   ```ts
   import { prefetchDestinationImages, getCachedImages } from '@/utils/imagePrefetch';
   ```

2. **Lines 62-93** — Replace the `loadImage` function to check the prefetch cache (localStorage + in-memory) before hitting the API. On cache hit, set the hero image immediately and return. On miss, proceed with the existing API fetch and trigger `prefetchDestinationImages` for future visits.

Single file, ~30 lines changed. No backend or structural changes.

