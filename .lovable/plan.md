

# Fix: Filter Dining Activities with Placeholder Addresses

## Problem
Dining activities with fake addresses like "the destination" survive into the final itinerary. This happens in two places:
1. The AI generates restaurants with placeholder addresses
2. The meal guard fallback system (`day-validation.ts`) injects emergency venues using `destination` (e.g., "Paris, France") as the address

## What already exists
There's already a hallucination filter at lines 340-383 in `action-generate-day.ts` that checks for fake addresses with `address.length < 10`. But fallback venues like "Bistrot du Marché" get injected **after** this filter by the meal guard (line ~1277), bypassing it entirely.

## Plan

### 1. Add the user's filter as a final guard in `action-generate-day.ts`
Place the exact filter the user specified **after** the meal guard fires (around line 1280, after `generatedDay.activities = mealGuardResult.activities`). This catches both AI-generated fakes AND meal-guard-injected fakes:

```typescript
// Strip dining with placeholder addresses (post-meal-guard)
normalizedActivities = normalizedActivities.filter(activity => {
  if (activity.category !== 'dining') return true;
  const address = (activity.address || '').trim().toLowerCase();
  if (
    address === 'the destination' ||
    address === 'your destination' ||
    address === 'the city' ||
    address === '' ||
    address.length < 8
  ) {
    console.log(`[CLEANUP] Removed dining with placeholder address: "${activity.title}" (address: "${address}")`);
    return false;
  }
  return true;
});
generatedDay.activities = normalizedActivities;
```

The address field needs to be extracted from `activity.location.address` (the actual schema), not `activity.address` directly. I'll adapt the extraction to match the object shape.

### 2. Fix the root cause in `day-validation.ts`
The meal guard at line 989 initializes `venueAddress = destination` and lines 1004/1021 fall back to `destination` when no real address exists. Change these to use a proper placeholder that won't pass as a real address, or skip injection entirely when no real venue with a real address is available.

### Files to modify
- `supabase/functions/generate-itinerary/action-generate-day.ts` — add final placeholder-address filter after meal guard
- `supabase/functions/generate-itinerary/day-validation.ts` — stop using `destination` as a fake address for injected meals

