

## Fix: Budget Coach Swap Retains Original Booking Metadata

### Problem
When the budget coach suggests a free/cheap replacement (e.g., "self-guided exploration at $0"), the swap only updates title, description, and cost — but leaves `bookingUrl`, `viatorProductCode`, and `website` from the original paid activity. The card then shows "Booking Required" + "View on Viator ~$85" for what's supposed to be a free walk.

### Root Cause
In `EditorialItinerary.tsx` line 6206, the budget swap spreads `...act` and only overrides `title`, `name`, `description`, `cost`, and `location`. All booking-related fields (`bookingUrl`, `viatorProductCode`, `website`) survive from the original activity.

### Fix (1 file, ~5 lines)

**File: `src/components/itinerary/EditorialItinerary.tsx` (~line 6206)**

In the budget swap application block, clear booking metadata when the new cost is zero or significantly lower (free replacement):

```typescript
return {
  ...act,
  title: coherentTitle,
  name: coherentTitle,
  description: suggestion.suggested_description || suggestion.suggested_swap,
  cost: ...,
  location: ...,
  // Clear booking metadata — the replacement is a different activity
  bookingUrl: undefined,
  viatorProductCode: undefined,
  website: undefined,
  tips: undefined,
  voyanceInsight: undefined,
  isVoyancePick: false,
};
```

This ensures that when a paid Viator tour is swapped for a free self-guided walk, the card no longer shows the original's booking link or vendor price. The booking metadata should always be cleared on budget swaps because the replacement is fundamentally a different activity — keeping the old booking URL is always wrong, not just for free swaps.

### Files
- `src/components/itinerary/EditorialItinerary.tsx` — clear booking fields in budget swap block

