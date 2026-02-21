

# Fix: Increase Stall Timeout to 600s and Kill Broken Image

## Changes

### 1. Increase stall detector threshold from 120s to 600s
**File:** `src/components/itinerary/ItineraryGenerator.tsx`

- Line 248: Change `120_000` to `600_000`
- Line 208: Update log message to say "600s" instead of "120s"

This gives each day up to 10 minutes of silence before the stall detector fires. Since each day already has its own 90s timeout with 4 retries in `useItineraryGeneration.ts`, the stall detector is purely a last-resort safety net for truly dead connections. 600 seconds is generous enough for any trip size.

### 2. Add global image error handler for the broken Unsplash photo
**File:** `src/hooks/useDestinationImages.ts` (or wherever destination images are resolved)

Add a blocklist of known-broken Unsplash photo IDs. If the URL contains a blocked ID, replace it with a CSS gradient fallback before it reaches the UI. The ID `photo-1563177978-4f4a11e3f462` goes in this blocklist.

If the image is coming from the database rather than code, we will also run a one-time SQL update to remove/replace any rows containing this broken URL.

### Summary
- **2 lines changed** in `ItineraryGenerator.tsx` (threshold + log message)
- **Small addition** to image resolution logic (blocklist)
- **Optional DB cleanup** if the broken URL is stored in a table
- No edge function changes, no credit/billing changes
