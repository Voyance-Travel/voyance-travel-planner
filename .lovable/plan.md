

## Extract Universal `isPlaceholderMeal` Function

### Current State
The placeholder detection logic already exists inline in `fix-placeholders.ts` (lines 419-424) with the same patterns the user specified. The patterns (`PLACEHOLDER_TITLE_PATTERNS`, `PLACEHOLDER_VENUE_PATTERNS`) are already exported.

What's missing: a clean, exported `isPlaceholderMeal(activity, cityName)` function that encapsulates all checks into one reusable call.

### Changes

#### `supabase/functions/generate-itinerary/fix-placeholders.ts`

1. Add an exported `isPlaceholderMeal(activity, cityName): boolean` function after the pattern arrays (around line 201) that consolidates:
   - Category check (DINING/RESTAURANT only)
   - Title pattern matching
   - Venue-equals-city check
   - Venue pattern matching
   - Description recommendation CTA check

2. Refactor the inline detection in `fixPlaceholdersForDay` (lines 419-424) to call the new function instead of duplicating the logic.

### What Stays Unchanged
- The pattern arrays themselves — identical to what the user provided and what already exists
- The replacement/fallback logic — untouched
- All other files — no changes needed since this is a refactor within one file

### Deployment
Redeploy `generate-itinerary` edge function.

