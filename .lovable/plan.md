

## Post-Processing Restaurant Deduplication Across Days

### Current State
The system already has significant restaurant deduplication infrastructure:
- **Prompt-level**: `ALREADY USED` blocklist injected into each day's prompt, `MEAL VARIETY RULE`
- **Validation**: `MEAL REPEAT` detection via `conceptSimilarity` in `day-validation.ts`
- **Post-processing swap**: Pool-based replacement when `MEAL REPEAT` is detected
- **Tracking**: `used_restaurants` persisted in trip metadata between chained calls

### The Gap
Despite all this, duplicates like "Maisen Aoyama" appearing on Day 1 AND Day 2 still occur because:
1. **Title-only matching**: The `used_restaurants` tracker extracts from `act.title` after stripping meal prefixes — but if the AI formats differently (e.g., "Tonkatsu at Maisen" vs "Maisen Aoyama"), the match fails
2. **`location.name` ignored**: The dedup tracking doesn't capture `act.location.name`, which is often the actual restaurant name
3. **`conceptSimilarity` misses**: The fuzzy matcher can fail on short restaurant names or different romanizations

### Changes

**1. `supabase/functions/generate-itinerary/index.ts` — Strengthen used-restaurant tracking (2 locations)**

At both parse sites (~line 2600 and ~line 10400), after post-processing completes and before the day is added to results, add a post-generation dedup check:

```typescript
// After all post-processing for this day:
// 1. Check for duplicates against usedVenueNames (built from previous days)
// 2. If a dining activity's location.name matches a previously used venue, swap it from pool
```

**At the main loop (~line 2600)**: After all validation/fixes, before pushing to `generatedDays`:
- Build `usedVenueNames: Set<string>` from all previous days' dining activities — collecting BOTH `title` (stripped of meal prefix) AND `location.name`
- For each dining activity in the new day, check both `title` and `location.name` against the set
- If duplicate found and restaurant pool available, swap with an unused pool entry (same logic as existing MEAL REPEAT swap)
- If no pool, log and keep (real restaurant > nothing)

**2. `supabase/functions/generate-itinerary/day-validation.ts` — Add `location.name` to dedup check**

In `validateDayActivities`, around line 433-440 where `previousLocations` is checked:
- Currently only checks non-dining activities for location dedup
- The dining section (line 443) only uses `conceptSimilarity` on title concepts
- Add a direct `location.name` match check for dining activities too:

```typescript
// In the dining section, before conceptSimilarity:
const actLocNameForDining = normalizeText(act.location?.name || '');
if (actLocNameForDining.length > 3 && previousLocations.has(actLocNameForDining)) {
  if (!isRecurringEvent(act, mustDoActivities)) {
    errors.push(`MEAL REPEAT: "${act.title}" uses the same restaurant "${act.location?.name}" as a previous day.`);
    continue;
  }
}
```

**3. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — Track `location.name` in used_restaurants**

Around line 904-912, where `newUsedRestaurants` is built after each day:
- Currently only captures `act.title` (stripped of meal prefix)
- Also capture `act.location?.name` if it differs from the title

```typescript
// Add location.name to tracking
if (act.location?.name) {
  const locName = act.location.name.trim();
  if (locName && !newUsedRestaurants.includes(locName)) {
    newUsedRestaurants.push(locName);
  }
}
```

**4. Redeploy** the `generate-itinerary` edge function.

### Why This Fixes It
The existing system tracks restaurant *titles* but not *venue names*. When the AI writes "Tonkatsu Lunch at Maisen" on Day 1 and "Maisen Aoyama" on Day 2, the title-based tracker misses the match. By also tracking and checking `location.name`, we catch the actual restaurant identity regardless of how the AI titles the activity.

