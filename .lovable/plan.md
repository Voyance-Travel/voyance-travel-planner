

## Fix "Skip to playground" Navigation

### Problem
In the `DemoFeatureShowcase` step-by-step tour, the "Skip to playground →" link calls `onComplete`, which triggers `handleTourComplete` in `Demo.tsx`. That handler scrolls to `comparisonRef` (the Archetype Comparison section) — not the actual playground/sample itinerary section.

### Fix

**File: `src/pages/Demo.tsx`**

1. Pass a separate `onSkipToPlayground` prop to `DemoFeatureShowcase` (in addition to `onComplete`)
2. Wire it to `playgroundRef.scrollIntoView`

**File: `src/components/demo/DemoFeatureShowcase.tsx`**

1. Accept `onSkipToPlayground` as an optional prop
2. Change the "Skip to playground →" button's `onClick` from `onComplete` to `onSkipToPlayground`

This keeps `onComplete` working as intended (finishing the tour → scrolling to comparison) while "Skip to playground" goes directly to the sample itinerary section.

