

## Fix: Directions Button in ActiveTrip

**File: `src/pages/ActiveTrip.tsx` (line 1022)**

Add an `onClick` handler using the existing `openMapLocation` utility from `@/utils/mapNavigation` (already used in `LiveActivityCard.tsx`).

```tsx
<Button
  size="sm"
  variant="outline"
  className="h-8 gap-1.5"
  onClick={() => {
    openMapLocation({
      name: activity.location?.name || activity.name,
      address: activity.location?.address,
      lat: activity.location?.lat,
      lng: activity.location?.lng,
    });
  }}
>
```

Ensure `openMapLocation` is imported from `@/utils/mapNavigation` (add to existing imports if not already present). This handles iOS/Android detection and opens Apple Maps or Google Maps accordingly.

