

## Remove Photos from "Build It Myself" (Manual Builder) Mode

### Problem
When a user clicks "I'll build it myself", manual mode is enabled but activity photos still display if the activity has an `existingPhoto` stored in the database. The user wants no photos in manual builder mode.

### Root Cause
In `EditorialItinerary.tsx` line 9889:
```typescript
const thumbnailUrl = fetchedImageUrl;
```

While `shouldFetchRealPhoto` is correctly `false` in manual mode (preventing API calls), `useActivityImage` still returns `existingPhoto` when it exists. So stored photos still render.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx` (line 9889)**

Change:
```typescript
const thumbnailUrl = fetchedImageUrl;
```

To:
```typescript
const thumbnailUrl = isManualMode ? null : fetchedImageUrl;
```

This suppresses all photo rendering in manual mode — both fetched and existing photos. The three render locations (clean preview image, mobile expanded photo, desktop thumbnail column) all gate on `thumbnailUrl` already, so this single change handles all of them.

### Scope
1 line changed in 1 file.

