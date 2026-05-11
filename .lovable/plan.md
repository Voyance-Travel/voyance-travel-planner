## Problem

When trip generation finishes (`?generate=true` flow on `/trip/:id`), the page swaps the tall `ItineraryGenerator` (progress UI) for the rendered itinerary, but the window scroll position is preserved. Because the generator was typically scrolled near the bottom while the user watched progress, the itinerary now appears already scrolled to the bottom. `ScrollToTop` only fires on `pathname/search` changes, so it doesn't trigger on this in-place view swap.

## Fix

In `src/pages/TripDetail.tsx`, inside `handleGenerationComplete` (around line 1815, right after `setShowGenerator(false)` and the URL cleanup), force the window back to the top so the user lands on the trip header / `PostGenerationCTA`:

```ts
// Reset scroll so the new itinerary opens at the top, not wherever
// the generation progress UI happened to be scrolled to.
requestAnimationFrame(() => {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
});
```

Use `requestAnimationFrame` (not a raw call) so the scroll fires after React commits the view swap; otherwise the browser may restore the old offset on the next paint.

No other call sites or generation flows need changes — `handleGenerationComplete` is the single funnel for "generation just finished" in TripDetail.

## Verification

1. Start a new trip via `/start`, let generation complete.
2. On finish, page should land at the top showing the hero / PostGenerationCTA, not at the bottom.
3. Existing in-trip scroll behaviors (day-picker horizontal scroll, "Fix Timing" scroll-to-day, refresh-day) remain untouched.
