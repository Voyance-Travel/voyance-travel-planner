

# Fix "Skip to playground" on How It Works Page

## Problem
On the How It Works page, the `DemoFeatureShowcase` component is rendered without an `onSkipToPlayground` prop (line 595). When users click "Skip to playground →", it falls back to `onComplete` which just hides the tour instead of scrolling to the "See It in Action" sample itinerary section.

## Fix
**File**: `src/pages/HowItWorks.tsx`

Update the `DemoFeatureShowcase` usage on line 595 to pass an `onSkipToPlayground` handler that:
1. Hides the feature tour (`setShowFeatureTour(false)`)
2. Scrolls to the `#playground` section (which contains `DemoPlayground` / "See It in Action")

```tsx
<DemoFeatureShowcase 
  onComplete={() => setShowFeatureTour(false)} 
  onSkipToPlayground={() => {
    setShowFeatureTour(false);
    setTimeout(() => {
      document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }}
/>
```

The `setTimeout` is needed because the tour section unmounts first, shifting layout before the scroll target is visible.

Single file, single line change.

