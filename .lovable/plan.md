

## Fix: Hotel Update Only Patches First Accommodation Card

### Problem

When a hotel is changed, `patchItineraryWithHotel` in `src/services/hotelItineraryPatch.ts` uses a narrow keyword list (`ACCOMMODATION_KEYWORDS`) to find activities to update. The list requires phrases like "hotel check-in", "check in & refresh", "settle in" — but AI-generated activities often have titles like:

- "Check-in at [Old Hotel Name]" — matches "check into" but NOT after it's been patched to "Check-in at X"
- "Checkout" (without "hotel" prefix) — doesn't match any keyword
- "Check-in & Settle" — doesn't match
- Activities with `category: 'accommodation'` but non-matching titles

The keyword `"check into"` partially matches "Check-in at" (since "check in" is in "Check-in at"), but `"hotel checkout"` and `"hotel check-out"` require the word "hotel" — so a standalone "Checkout from X" won't match on subsequent updates.

**Result**: The first patch works (original AI titles match), but subsequent hotel changes fail to update already-patched titles because "Check-in at Hilton" doesn't match the narrow keyword list.

### Fix

**File: `src/services/hotelItineraryPatch.ts`**

1. Expand `isAccommodationActivity` to also match:
   - Titles starting with "Check-in at" or "Checkout from" (the patched format itself)
   - Titles containing just "check-in" or "checkout" without requiring "hotel" prefix
   - Activities by `category` field — if `category === 'accommodation'` or `category === 'hotel'`, treat it as an accommodation activity
2. Update the function signature to also check `act.category` alongside `act.title`

Updated keyword list and logic:
```typescript
const ACCOMMODATION_KEYWORDS = [
  'check-in', 'check in', 'check into',
  'checkout', 'check-out', 'check out',
  'accommodation', 'settle in', 'settle into',
];

const ACCOMMODATION_CATEGORIES = ['accommodation', 'hotel'];

function isAccommodationActivity(title: string, category?: string): boolean {
  if (category && ACCOMMODATION_CATEGORIES.includes(category.toLowerCase())) return true;
  const lower = title.toLowerCase();
  return ACCOMMODATION_KEYWORDS.some(k => lower.includes(k));
}
```

Then update the loop to pass `act.category`:
```typescript
if (!isAccommodationActivity(title, String(act.category || ''))) continue;
```

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/services/hotelItineraryPatch.ts` | Broaden keyword list, add category-based matching, ensure re-patched titles still match |

