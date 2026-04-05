

## Fix Phantom Pricing — Expand Tier 1 Free Venue Field Coverage

### Root cause

Line 301 of `sanitization.ts` builds the search string from only three fields:
```
const titleAndVenue = (act.title || '') + ' ' + (act.venue_name || '') + ' ' + ((act.location as any)?.name || '');
```

If "miradouro" appears in `description`, `address`, `place_name`, or a nested `restaurant.name` / `place.name` field, the Tier 1 pattern never sees it. The activity title is "Panoramic Views of Lisbon" — no "miradouro" there — so it falls through.

### Plan

**1. Expand `titleAndVenue` to include all text fields** (`sanitization.ts` ~line 301)

Replace the narrow field concatenation with a broad one covering `title`, `venue_name`, `description`, `location.name`, `address`, `place_name`, `place` (string or object), and `restaurant.name`. Apply to both Tier 1 and Tier 2 checks.

**2. Add debug log for miradouro detection** (`sanitization.ts`, same block)

Before the Tier 1 check, log when "miradouro" is found anywhere in the activity JSON so we can confirm the fix catches it.

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — expand line 301's field coverage and add debug log

### Verification
- Generate a Lisbon trip; any Miradouro activity should show as Free (€0)
- Console should show the zeroing log for miradouro venues

