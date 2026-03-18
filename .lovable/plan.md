

## Fix: Discover Panel Rating & Address Metadata Still Not Showing

### Root Causes Found

**Rating — blocked by `aiLocked` gate (line 10000)**

The rating rendering logic has this guard:
```typescript
if (isNonReviewable || aiLocked || !canViewPremium) return null;
```

For manual/imported trips before Smart Finish purchase, `aiLocked = true` (line 2261). This blocks ALL rating badges — including Discover-added activities that carry verified numeric ratings (like 4.6). The `aiLocked` gate was intended to suppress AI-generated content features, not to hide real venue ratings from the Discover panel.

**Address — two issues**

1. **DiscoverDrawer `handleAdd`** (line 294-304) correctly sets `location.address` from the suggestion, but the address field depends on the AI edge function returning it. The `ProactiveSuggestion` interface has `address?: string` and the prompt asks for it, but the AI may not always populate it.

2. **No fallback text**: When `address` is undefined/empty and `location.name` is `''` (as set by our previous fix), the condition `effectiveLocName || hasAddress` at line 10136 evaluates to `false`, hiding the location line entirely. There's no fallback to other available fields like `distance`, `walkTime`, or `scheduleFit` from the suggestion.

### Plan — 2 files

**1. `src/components/itinerary/EditorialItinerary.tsx`**

a) **Rating gate fix** (line ~10000): Change the condition so that activities WITH a numeric rating bypass the `aiLocked` check. The `aiLocked` gate should only suppress the "See Reviews" fallback button (which triggers AI-powered review fetching), not pre-existing numeric ratings:
```typescript
// Before:
if (isNonReviewable || aiLocked || !canViewPremium) return null;

// After:
if (isNonReviewable) return null;
// Show existing numeric rating even when aiLocked (Discover-sourced ratings are real data)
if (rating) {
  return <Badge ...>{rating.toFixed(1)}</Badge>;
}
// For "See Reviews" button, still require !aiLocked and canViewPremium
if (aiLocked || !canViewPremium) return null;
return <button>See Reviews</button>;
```

b) **Location fallback** (line ~10132-10152): When no `effectiveLocName` and no `hasAddress`, fall back to the `description` or show the `distance`/`walkTime` if present on the activity. But more importantly, also persist the `distance` and `walkTime` fields from DiscoverDrawer suggestions so they can be used as location context.

**2. `src/components/itinerary/DiscoverDrawer.tsx`**

c) **Persist more location metadata** (line ~294-304): When adding a Discover suggestion, also pass `distance` and `walkTime` into the location or as tags/metadata so the card has fallback location context even if the AI didn't return a street address. Also set `location.address` to a composite fallback when no street address: use `distance` + area name if available.

```typescript
const addressText = suggestion.address 
  || ('distance' in suggestion && suggestion.distance ? suggestion.distance : '')
  || '';

onAddActivity({
  title: suggestion.name,
  description: suggestion.description,
  category: cat,
  rating: suggestion.rating,
  cost: ...,
  location: {
    name: '',
    address: addressText || undefined,
  },
});
```

### Result
- Rating badge (e.g., "★ 4.6") displays for Discover activities even in manual/pre-Smart-Finish trips
- Address line shows street address when available, with fallback to distance info
- "See Reviews" AI button remains gated behind `aiLocked` and premium access as intended

