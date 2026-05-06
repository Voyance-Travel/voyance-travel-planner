## Problem

When opening an itinerary, the page sometimes lands scrolled near the bottom instead of at the top. `ScrollToTop` is already wired into the router, so the cause isn't a missing route reset — it's an effect inside `EditorialItinerary` that fires on mount and pulls the page down.

## Root cause

`src/components/itinerary/EditorialItinerary.tsx` (~line 3209) runs this effect on every change of `selectedDayIndex`, including the initial mount:

```ts
useEffect(() => {
  const btn = dayButtonRefs.current[selectedDayIndex];
  if (btn) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}, [selectedDayIndex]);
```

`Element.scrollIntoView` walks up every scrollable ancestor — including the `window` — to bring the target into view. When the trip is active, `selectedDayIndex` is initialized to "today" (often day 3+), so the picker's selected pill sits offscreen on first render and the browser scrolls the whole page down to it. The `PostGenerationCTA` "Explore your itinerary" button uses `scrollIntoView` too, but only on click, so it's not the culprit.

## Fix

Constrain the day-picker auto-scroll to its own horizontal scroller and skip the first render:

1. In `EditorialItinerary.tsx`, add a ref for the horizontal day-picker container (the element that already wraps `dayButtonRefs.current[*]`).
2. Replace the effect with one that:
   - Skips the very first run (using a `didMountRef`), so the initial "today" selection never yanks the page.
   - On subsequent changes, scrolls horizontally inside the container only, e.g.

     ```ts
     const container = dayPickerScrollRef.current;
     const btn = dayButtonRefs.current[selectedDayIndex];
     if (container && btn) {
       const target = btn.offsetLeft - (container.clientWidth - btn.clientWidth) / 2;
       container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
     }
     ```

   This keeps the "centered selected day" UX without ever moving `window.scrollY`.
3. Verify the existing `ScrollToTop` in `App.tsx` still puts new route loads at the top (no change needed there).

## Files to change

- `src/components/itinerary/EditorialItinerary.tsx` — add `dayPickerScrollRef` to the existing day-picker scroller and rewrite the `selectedDayIndex` scroll effect as described.

## Out of scope

- Other `scrollIntoView` calls (refresh-day diff, fix-timing, onboarding tour, PostGenerationCTA hint button) — they only fire on explicit user actions and are working as intended.
