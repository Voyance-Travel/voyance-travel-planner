

## Fix: Discover Panel Metadata (Rating + Address) Not Transferring

### Problem Analysis

**Rating shows "☆ See Reviews" instead of numeric badge:**
- The Discover panel correctly passes `rating` as a number to `handleAddActivity`, and it's stored on the `EditorialActivity`.
- However, the `ActivityRow` component renders in **compact mode** (`compactCards={isManualMode || creationSource === 'smart_finish'}`), which is the default for Smart Finish trips.
- In compact mode (line ~10001), the code explicitly skips the rating badge: `if (rating && !compact)` → falls through to the generic "See Reviews" button.
- **Fix**: Show the rating badge in compact mode too when a numeric rating exists. The "compact hides inline ratings" rule was meant for AI-generated activities without verified ratings, not for Discover activities that come with real ratings.

**Address shows activity name instead of street address:**
- `DiscoverDrawer.handleAdd` (line 300-302) sets `location: { name: suggestion.name, address: suggestion.address }`.
- Setting `location.name` to the suggestion's name (e.g., "Street Art Safari in Montmartre's Backstreets") means the UI displays the activity title as the location.
- The `address` field from the edge function may or may not be populated, but even when it is, the UI at line 10138 shows `activity.location?.name || address` — preferring the name (which is just the title).
- **Fix**: Don't set `location.name` to the activity title. Use `address` as the primary field. If the suggestion has a distinct venue name (different from the activity title), use that for `location.name`.

**Repairing existing activities:**
- Activities already saved with `location.name === title` need a post-hoc cleanup. Add a normalization pass in the activity rendering or loading path that detects when `location.name` equals the activity title and clears it, falling back to `address`.

### Plan — 2 files

**1. `src/components/itinerary/DiscoverDrawer.tsx`** (line ~294-304)

Fix the `handleAdd` function to set location fields correctly:
```typescript
onAddActivity({
  title: suggestion.name,
  description: suggestion.description,
  category: cat,
  rating: suggestion.rating,
  cost: ...,
  location: {
    name: 'address' in suggestion && suggestion.address 
      ? suggestion.name   // Use name only if we also have a real address
      : '',               // Don't set name to title when there's no address
    address: 'address' in suggestion ? suggestion.address : undefined,
  },
});
```

Actually, the deeper issue is: `location.name` should be the **venue/place name** (not the activity title). For Discover suggestions, the suggestion name IS the activity title already shown. Setting it again as location name creates duplication. Better approach:
- Set `location.name` to empty string (or the address itself as a fallback)
- Set `location.address` to the suggestion's address
- This way the UI won't show the title repeated as location

**2. `src/components/itinerary/EditorialItinerary.tsx`**

Two changes:

a) **Rating display in compact mode** (~line 9999-10001): Allow the rating badge to show even in compact mode when a numeric rating exists. Change the condition from `if (rating && !compact)` to `if (rating)` for the badge branch. This ensures Discover-sourced ratings display correctly.

b) **Location name deduplication** (~line 10131-10138): Add a guard that treats `location.name` as empty when it equals the activity title (repairs existing activities without needing a migration):
```typescript
const locationName = activity.location?.name?.trim();
const effectiveLocationName = (locationName && locationName !== activityTitle) ? locationName : '';
```
Apply this same guard in the dining venue section (~line 10048) and the non-dining location section (~line 10131).

### Result
- Rating badge (e.g., "★ 4.5") will display for Discover activities even in compact/Smart Finish mode
- Address will show the real street address from the AI, not the activity name
- Existing activities with duplicated name/title will self-heal at render time

