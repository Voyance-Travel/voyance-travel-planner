

## Fix: "No travel buffer" Warning Noise Reduction

### Current Behavior

The system has two layers:
1. **Day-level banner** — shows when a day has **2+ zero-gap pairs**, with a "Refresh Day" CTA (line 8565: `if (zeroGapCount < 2) return null`)
2. **Individual `TransitGapIndicator`** — for each activity pair. When the banner is shown (`zeroGapCount >= 2`), individual zero-gap rows are suppressed via `suppressZeroGap` (line 349)

**The problem**: When a day has exactly **1** zero-gap, no banner appears AND the individual zero-gap indicator still renders (muted but visible). Across 5+ days of a trip, users see 5+ individual muted warnings with no consolidated action.

### The Fix

**Lower the day-level banner threshold from 2 to 1**, so any day with at least one zero-gap shows a single consolidated banner instead of per-gap indicators.

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/EditorialItinerary.tsx` | Change `zeroGapCount < 2` → `zeroGapCount < 1` on line 8565; adjust banner text to handle singular ("1 activity has no travel buffer") vs plural |

**Line 8565**: `if (zeroGapCount < 1) return null;`

**Line 8570**: Adjust text:
```tsx
<span className="font-medium">
  {zeroGapCount} {zeroGapCount === 1 ? 'activity has' : 'activities have'}
</span> no travel buffer
```

This means:
- **0 zero-gaps** → no banner, no individual warnings
- **1+ zero-gaps** → one consolidated banner per day with "Refresh Day" CTA; individual zero-gap rows suppressed (since `suppressZeroGap` is already `zeroGapCount >= 2`, change that to `>= 1` on line 8818)

Also update line 8818:
```tsx
suppressZeroGap={((day as any).__zeroGapCount ?? 0) >= 1}
```

Single file, ~4 lines changed.

