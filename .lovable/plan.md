

## Fix: Incomplete Metadata Transfer from Discover Panel

### Problem

Two fields from AI-generated suggestions are lost when adding activities via the Discover panel:

1. **Rating**: Both `discover-proactive` and `nearby-suggestions` edge functions return `rating` (e.g., 4.5), but `handleAdd` never passes it to `onAddActivity`. The `onAddActivity` callback signature doesn't accept `rating`. Result: activities always show "See Reviews" instead of the "4.5 ★" badge.

2. **Address (proactive only)**: The `discover-proactive` edge function doesn't ask the AI for a street address, and the `ProactiveSuggestion` interface lacks an `address` field. `NearbySuggestion` does have `address` and the nearby edge function returns it.

### Fix — 3 files

**1. `src/components/itinerary/DiscoverDrawer.tsx`**

- Expand `onAddActivity` callback type to accept `rating?: number`
- In `handleAdd`, pass `rating` from the suggestion:
  ```typescript
  onAddActivity({
    title: suggestion.name,
    description: suggestion.description,
    category: cat,
    rating: suggestion.rating,  // ← NEW
    cost: ...,
    location: { name: suggestion.name, address: ... },
  });
  ```

**2. `src/components/itinerary/EditorialItinerary.tsx`**

- Where `onAddActivity` is passed to `DiscoverDrawer` (around line 6631), the receiving `handleAddActivity` already accepts `Partial<EditorialActivity>`, which includes `rating`. No type change needed — just ensure the `DiscoverDrawer` prop type matches.
- In `handleAddActivity` (line 4258), the `newActivity` construction already spreads `activity` fields but explicitly lists each one. Add `rating: activity.rating` to the constructed object.

**3. `supabase/functions/discover-proactive/index.ts`**

- Add `"address": "Street address or area"` to the JSON output format in the prompt so the AI returns addresses for proactive suggestions.

**4. `src/components/itinerary/discover/ProactivePicks.tsx`**

- Add `address?: string` to the `ProactiveSuggestion` interface so it can carry the field from the edge function response.

### Summary of Changes

| File | Change |
|------|--------|
| `DiscoverDrawer.tsx` | Add `rating` to `onAddActivity` type and pass it in `handleAdd` |
| `EditorialItinerary.tsx` | Add `rating` to `newActivity` construction in `handleAddActivity` |
| `discover-proactive/index.ts` | Add `address` field to AI prompt output format |
| `ProactivePicks.tsx` | Add `address?: string` to `ProactiveSuggestion` interface |

