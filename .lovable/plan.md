

## Fix React #310 "Too Many Re-renders" Crash

### Root Cause

The crash is React Error #310 ("Too many re-renders"), triggered inside `useActivityImage` when called from `ActivityRow` in `EditorialItinerary.tsx`. The error occurs on **all** trip views (active and past), meaning it's in the shared itinerary rendering path.

Two contributing factors:

1. **`useActivityImage` state cascade**: The hook's `persistPhotoToActivity` writes fetched photo URLs back to `trip_activities.photos`. If anything causes a React Query refetch of trip data (budget sync, query invalidation), the `existingPhoto` prop changes → useEffect re-fires → new fetch → new persist → new refetch = infinite loop.

2. **Unstable hook arguments in `ActivityRow`**: The `useActivityImage` call at line 8718 receives computed string expressions (`\`${hotelName} hotel\``) that create new values each render, plus `shouldFetchRealPhoto ? destination : undefined` which toggles the `destination` arg and re-triggers the effect.

### Plan

#### 1. Stabilize `useActivityImage` hook
**File:** `src/hooks/useActivityImage.ts`

- Add a `useRef` to track the last processed cache key; skip the effect entirely if the key hasn't changed
- Use functional state updates (`setImageUrl(prev => prev === url ? prev : url)`) to prevent re-renders when the value is already correct
- Guard the `existingPhoto` early-return: if it equals the current `imageUrl`, skip all `setState` calls
- Move `persistPhotoToActivity` out of the effect's synchronous path — only persist **after** confirming the component is still mounted and the URL is genuinely new

#### 2. Memoize hook arguments in `ActivityRow`
**File:** `src/components/itinerary/EditorialItinerary.tsx` (~line 8718)

- Wrap the computed `title` and `destination` arguments in `useMemo` so they produce stable references across renders
- This prevents the `useActivityImage` effect from re-running on every render

#### 3. Remove aggressive DB write-back from image hook
**File:** `src/hooks/useActivityImage.ts`

- Remove or disable the `persistPhotoToActivity` call that writes fetched URLs back to `trip_activities.photos`. This is the primary feedback loop causing the crash. Photos are already cached in localStorage with a 7-day TTL — that's sufficient. The DB write-back can be re-added later behind a debounce guard once stability is confirmed.

#### 4. Guard `InlineRouteDetails` in `ActiveTrip.tsx`
**File:** `src/pages/ActiveTrip.tsx`

- Memoize `fetchRoute` callback dependencies by extracting lat/lng values into stable refs instead of passing the full `activity`/`previousActivity` objects
- This prevents the `useCallback` from being recreated on every render when trip data refreshes

### Files to Edit

| File | Change |
|------|--------|
| `src/hooks/useActivityImage.ts` | Add ref guard, functional setState, remove DB write-back |
| `src/components/itinerary/EditorialItinerary.tsx` | Memoize `useActivityImage` arguments in `ActivityRow` |
| `src/pages/ActiveTrip.tsx` | Stabilize `InlineRouteDetails` callback deps |

