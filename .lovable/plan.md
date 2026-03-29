

# Fix Missing Travel Buffers Warning

## Problem
The "X activities have no travel buffer" warning counts every consecutive activity pair with zero/negative gap, but ignores that **transport activities ARE the travel buffer**. When Activity A → Transport → Activity B exists, both the A→Transport and Transport→B gaps are counted as "missing buffer" even though transit is present.

## Root Cause
In `EditorialItinerary.tsx` (lines 9350-9363), the `zeroGapCount` loop iterates over all consecutive activity pairs without skipping transport entries. Since transport activities (category `"transport"`) represent the travel buffer itself, pairs involving them should be excluded from the count.

## Changes

### File: `src/components/itinerary/EditorialItinerary.tsx` (~line 9352)

Update the zero-gap counting loop to skip pairs where either activity is a transport entry:

```typescript
const acts = day.activities || [];
let zeroGapCount = 0;
for (let i = 0; i < acts.length - 1; i++) {
  // Transport entries ARE the travel buffer — skip pairs involving them
  const catA = ((acts[i] as any).category || '').toLowerCase();
  const catB = ((acts[i + 1] as any).category || '').toLowerCase();
  if (catA === 'transport' || catB === 'transport') continue;

  const gap = computeGapMinutes(
    acts[i].endTime,
    acts[i].startTime || (acts[i] as any).time,
    acts[i].duration,
    acts[i + 1].startTime || (acts[i + 1] as any).time,
  );
  if (gap !== null && gap <= 0) {
    const sameLocation = !!(acts[i].location?.name && acts[i + 1].location?.name && acts[i].location.name === acts[i + 1].location.name);
    if (!sameLocation) zeroGapCount++;
  }
}
```

## Issue B: 120-minute Travel Estimate
The "Travel to Ganko Yakiniku — 120 min" text is AI-generated content in the activity title, not computed by any backend distance function. The auto-route optimizer uses coordinates for reordering but doesn't generate duration text. The transit-estimate edge function (which does compute durations correctly) is only called by the Refresh Day tool, not during generation. This is an AI hallucination in the prompt response — fixing it would require prompt changes, which is out of scope per the user's constraints.

## Files to modify
- `src/components/itinerary/EditorialItinerary.tsx` — skip transport activities in zero-gap count

One targeted edit.
