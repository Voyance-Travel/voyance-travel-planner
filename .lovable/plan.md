

## Fix: Lock icon and three-dot menu visible in Preview mode (desktop regression)

### Root cause

In `EditorialItinerary.tsx`, the `DaySection` render function passes `isCleanPreview` to `ActivityRow` for the **mobile** card (line 9377) but **not** for the **desktop** card (lines 9385-9427). The desktop `ActivityRow` defaults to `isCleanPreview = false`, so it renders the full edit-mode UI (lock icon, three-dot menu, etc.) instead of the clean magazine-style preview.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx` (~line 9425)**

Add the missing `isCleanPreview={isCleanPreview}` prop to the desktop `ActivityRow` instance, right after `isPastTrip={isPastTrip}` (around line 9424):

```typescript
  isPastTrip={isPastTrip}
  isCleanPreview={isCleanPreview}   // ← add this
  onPhotoResolved={onPhotoResolved}
  isManualMode={isManualMode}
```

One line addition. The `ActivityRow` component already handles `isCleanPreview` correctly (line 9862 — returns clean magazine card when true). It's just not receiving the prop on desktop.

