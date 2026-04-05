

## Fix Restaurant Repetition — Add Failsafe Cross-Day Dedup + Debug Logging

### Problem
Fábrica da Nata appeared as breakfast on Days 1-3 of trip #11 despite existing dedup logic. The blocklist propagation via `metadata.used_restaurants` and the per-day cross-day dedup check are implemented but may have gaps: (1) the per-day dedup only fires when `usedRestaurants.length > 0`, so Day 1 restaurants are never checked, (2) if the replacement pool is exhausted, the activity is removed but the meal guard may backfill with the same restaurant, (3) there's no final cross-trip failsafe that checks ALL days at once.

### Changes

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

1. **Enhanced debug logging** (~line 344): After loading `usedRestaurants` from metadata, add a structured debug log that shows the exact array contents, length, and type — making it easy to verify propagation in logs.

2. **Debug logging for outbound blocklist** (~line 1323): After building `newUsedRestaurants`, log it before saving to metadata so we can trace what's being sent to the next day.

3. **Cross-day failsafe dedup at trip completion** (~line 1229, inside the `dayNumber >= totalDays` branch, BEFORE saving to DB): Walk ALL `updatedDays`, build a cumulative set of normalized restaurant names, and mark duplicates with `_crossDayDuplicate = true`, then filter them out. This catches anything the per-day dedup missed. Log every removal.

4. **Fix the per-day dedup guard** (~line 878): Change `if (usedRestaurants.length > 0 && ...)` to `if (dayResult?.activities?.length > 0)` — the dedup should ALWAYS run, even on Day 1 (to catch within-day duplicates). The `usedNorm` set will simply be empty for Day 1, which is fine.

**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

5. **Strengthen the restaurant variety instruction** (~line 999 area): Add an explicit "For breakfast specifically: NEVER repeat the same breakfast venue on consecutive days" rule and a reminder that the destination has hundreds of restaurants.

### Files to edit
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — debug logging + completion failsafe + fix dedup guard
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — strengthen prompt rules

### Verification
Deploy the edge function, generate a 4-day Lisbon trip. Check edge function logs for "RESTAURANT DEDUP DEBUG" entries. Verify no restaurant appears more than once across all days.

