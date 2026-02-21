
# Fix: Broken Petra Image + Stall Detector Not Taking Effect

## What's Happening

Two separate issues:

1. **Broken Petra image** (`photo-1579606032821-4e6161c81571`) -- This is the image we swapped IN as a "fix" for the previous broken image. It's also dead now, returning 404. It appears in `src/utils/destinationImages.ts` and `src/lib/destinations.ts` for Petra/Jordan.

2. **"120s" in the error log** -- The 600s stall detector IS in the code, but your browser is still running a cached older build. Once these changes deploy and you hard-refresh, you'll see the 600s threshold.

## Changes

### 1. Add broken image to blocklist
**File:** `src/hooks/useDestinationImages.ts`

Add `photo-1579606032821-4e6161c81571` to the `BLOCKED_IMAGE_IDS` set so it's caught immediately even if served from the backend API.

### 2. Replace Petra image in curated lists
**File:** `src/utils/destinationImages.ts`

Replace `photo-1579606032821-4e6161c81571` with a verified working Unsplash photo of Petra's Treasury.

### 3. Replace Petra image in destinations config
**File:** `src/lib/destinations.ts`

Same replacement for the `imageUrl` and `images` array for the Petra destination.

## Summary
- 3 files edited, ~6 lines changed total
- No edge function changes
- No timeout logic changes (the 600s fix is already in place -- just needs a fresh browser load)
