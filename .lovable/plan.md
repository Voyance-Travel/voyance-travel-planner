## Plan

1. **Update `RestaurantLink.tsx` only**
   - Add a timeout inside the existing `useEffect` so the restaurant-link spinner cannot stay loading forever if `supabase.functions.invoke('lookup-restaurant-url')` never resolves.
   - Keep the existing cache-hit, empty-name, success, and catch behavior unchanged.

2. **Make the fallback safe**
   - After `lookupUrl()` starts, set a 5-second deadline.
   - If the request is still unresolved and the component is still mounted, set `url` to `null` and `isLoading` to `false`.
   - Clear the timeout in the effect cleanup.
   - Preserve the existing `cancelled` guard so late async responses cannot update state after unmount.

3. **Verify the exact fix**
   - Confirm `RestaurantLink.tsx` now contains the timeout fallback.
   - Run a targeted grep for `setTimeout` in the file and ensure cleanup uses `clearTimeout`.

## Technical detail

The implementation will follow this shape inside the existing effect:

```ts
lookupUrl();

const timeoutId = window.setTimeout(() => {
  if (!cancelled) {
    setUrl(null);
    setIsLoading(false);
  }
}, 5000);

return () => {
  cancelled = true;
  window.clearTimeout(timeoutId);
};
```

No backend, dining-description, itinerary, or CI files will be changed.