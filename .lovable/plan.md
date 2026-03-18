

## Fix: Itinerary Tour Never Shows for New Users

### Root Cause

The itinerary tour's "show banner" effect (line 183) runs **once** when `shouldShowWhenAllowed` becomes true. It tries `requestPopup('itinerary_tour')` after a 1.5s delay. For new users, other popups (welcome credits, site tour, onboarding preferences) are almost always active at that moment, so the request fails and gets queued.

When the queue eventually processes and grants the `itinerary_tour` slot, it only sets `activePopup` in the store — **nobody calls `setShowBanner(true)`** because the effect already fired and won't re-run. The tour is permanently stuck.

### Fix

**File: `src/components/itinerary/ItineraryOnboardingTour.tsx`**

Add polling or subscribe to the popup coordination store so that when the itinerary tour slot becomes available (after other popups close), the component reacts and shows the banner.

Two changes:

1. **Add `activePopup` as a dependency** — subscribe to the store's `activePopup` state and re-attempt the popup request when it changes to `null` (meaning the previous popup closed and the slot is free):

```typescript
useEffect(() => {
  if (!shouldShowWhenAllowed || isVisible || showBanner) return;

  const timer = setTimeout(() => {
    const allowed = requestPopup('itinerary_tour');
    if (allowed) setShowBanner(true);
  }, 1500);

  return () => clearTimeout(timer);
}, [shouldShowWhenAllowed, activePopup]);
//                         ^^^^^^^^^^^ re-run when slot frees up
```

2. **Guard against stale state** — since `activePopup` changes frequently, ensure the timeout only fires when there's actually no active popup, preventing unnecessary requests.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/ItineraryOnboardingTour.tsx` | Add `activePopup` to the effect dependency array so the banner request retries when the popup slot becomes available |

