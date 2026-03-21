

## Fix: Budget Coach Swap Leaves "Lunch" in Location Name and Transit Labels

### Problem
The meal coherence guard fixes the `title` and `name` fields, but two other places still use the raw `suggestion.suggested_swap` text ("Lunch at Osteria Beccafico"):
1. **Line 6216**: `location.name` is set to raw `suggestion.suggested_swap` — this feeds transit labels ("Walk to Lunch at Osteria Beccafico · 23 min")
2. **Line 6210**: `description` falls back to raw `suggestion.suggested_swap`

So even though the title is corrected to "Dinner at Osteria Beccafico", the location name and transit segment still say "Lunch."

### Fix (1 file, ~3 lines)

**File: `src/components/itinerary/EditorialItinerary.tsx`**

Apply the same `coherentTitle` to `location.name` and the description fallback:

- **Line 6210**: Change `suggestion.suggested_description || suggestion.suggested_swap` → `suggestion.suggested_description || coherentTitle`
- **Line 6216**: Change `name: suggestion.suggested_swap` → `name: coherentTitle`

This ensures every user-visible text field that displays the activity name uses the meal-corrected version, including transit segment labels that derive from `location.name`.

### Files
- `src/components/itinerary/EditorialItinerary.tsx` — use `coherentTitle` in location.name and description fallback

