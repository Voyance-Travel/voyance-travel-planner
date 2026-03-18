

## Fix: Tour Steps for Trip Health & Custom Activity Not Highlighting Properly

### Problem

Two tour steps fail to highlight their target elements because those elements are inside collapsed sections:

1. **Trip Health step**: The `TripHealthPanel` (`data-tour="health-score"`) is wrapped in a `<Collapsible>` (line 4909 of EditorialItinerary.tsx) that defaults to closed. The `onBeforeStep` handler scrolls to the element but never opens the parent collapsible — so the element is unmounted/hidden and the spotlight finds nothing.

2. **Customize Activity step**: On mobile, the activity card content is collapsed behind a tap-to-expand button. The `onBeforeStep` uses `button.sm\\:hidden` as a CSS selector which may not match correctly. Even if it does, the tour highlights the compact header row rather than the expanded card showing the ⋯ menu and customization options.

### Fix

**File: `src/components/itinerary/ItineraryOnboardingTour.tsx`**

**1. Trip Health step — programmatically open the Collapsible**

Update the `onBeforeStep` for `trip-health` to click the `CollapsibleTrigger` that wraps the health panel, ensuring the content is visible before the spotlight tries to find it:

```typescript
onBeforeStep: () => {
  // Expand mobile overview if needed
  const isMobile = window.innerWidth < 640;
  if (isMobile) {
    window.dispatchEvent(new CustomEvent('tour-expand-mobile-overview'));
  }
  
  // Open the Trip Completion collapsible that wraps the health panel
  // Find the collapsible trigger that contains "Trip Completion" text
  const collapsibleTriggers = document.querySelectorAll('[data-state="closed"]');
  collapsibleTriggers.forEach(trigger => {
    if (trigger.textContent?.includes('Trip Completion')) {
      (trigger as HTMLElement).click();
    }
  });
  
  // Wait for collapsible animation, then scroll into view
  setTimeout(() => {
    const healthEl = document.querySelector('[data-tour="health-score"]');
    if (healthEl) {
      healthEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 400);
},
```

**2. Customize Activity step — fix mobile expansion**

Update the `onBeforeStep` for `activity-card` to use a more reliable selector for the mobile expand button, and add a small delay so the expanded content is visible before the spotlight measures:

```typescript
onBeforeStep: () => {
  const isMobile = window.innerWidth < 640;
  if (isMobile) {
    const activityCard = document.querySelector('[data-tour="activity-card"]');
    if (activityCard) {
      // Use a direct child button query instead of escaped CSS class selector
      const mobileButton = activityCard.querySelector(':scope > button');
      if (mobileButton) {
        (mobileButton as HTMLElement).click();
      }
    }
  }
},
```

**3. Add `onLeaveStep` to close collapsibles** (optional cleanup)

Add `onLeaveStep` to the health step to re-close the collapsible when navigating away, keeping the UI tidy.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/ItineraryOnboardingTour.tsx` | Fix `onBeforeStep` for trip-health to open parent Collapsible; fix activity-card mobile expand selector |

