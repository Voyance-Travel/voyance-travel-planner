

## Refactor Placeholder Orchestration into Reusable Function

### Problem
The placeholder detection and replacement logic is currently inline (lines 636-749) inside `handleGenerateDay`. The user wants it extracted into a clean `fixPlaceholdersForDay()` orchestrator function, and there's a bug: `applyFallbackToActivity` doesn't accept `'drinks'` as a meal type.

### What Already Works
- Placeholder detection patterns — done
- AI micro-call with trip-aware context — done
- Hardcoded fast-path fallback — done
- All the logic exists inline

### Changes

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**

1. **Fix `applyFallbackToActivity` signature** — change `mealType` from `'breakfast' | 'lunch' | 'dinner'` to `'breakfast' | 'lunch' | 'dinner' | 'drinks'` and add `'Drinks'` label mapping

2. **Extract `fixPlaceholdersForDay()` function** — move the inline block (lines 636-749) into a standalone async function with this signature:
   ```typescript
   async function fixPlaceholdersForDay(
     activities: any[],
     city: string,
     country: string,
     tripType: string,
     dayIndex: number,
     usedVenueNames: Set<string>,
     budgetTier: string,
     apiKey: string,
     lockedActivities: any[],
     dayTitle?: string,
   ): Promise<void>
   ```

3. **Replace inline block** with a single call:
   ```typescript
   await fixPlaceholdersForDay(
     normalizedActivities, destination, destinationCountry || '',
     tripType || 'Explorer', dayNumber, usedVenueNamesFromParams,
     budgetTier || 'moderate', LOVABLE_API_KEY, lockedActivities,
     dayItinerary?.theme
   );
   ```

4. **Add quality logging** — log "No placeholders detected ✓" when none found, matching the user's proposed format

### What Stays the Same
- `PLACEHOLDER_TITLE_PATTERNS` and `PLACEHOLDER_VENUE_PATTERNS` — unchanged
- `generateFallbackRestaurant()` — unchanged
- `INLINE_FALLBACK_RESTAURANTS` — unchanged
- `RESTAURANT_SUGGESTION_TOOL` — unchanged

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/action-generate-day.ts` | Fix drinks type in `applyFallbackToActivity`, extract inline placeholder block into `fixPlaceholdersForDay()`, replace inline block with function call |

### Deployment
Redeploy `generate-itinerary` edge function.

