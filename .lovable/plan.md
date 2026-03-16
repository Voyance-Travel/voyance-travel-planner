

## Problem: Frontend force-save overwrites backend-generated days

The database confirms the bug: trip `61bcfeab` has `itinerary_days` table with all 4 days, but `itinerary_data.days` JSON only has 2. This is a **race condition between the backend generation chain and the frontend force-save**.

### Root cause sequence:
1. Backend generates days sequentially (1→2→3→4), saving to `itinerary_data` and `itinerary_days` after each day
2. After day 2, the backend may briefly set status to `ready` (or the poller reads stale status), triggering the frontend's `onReady` callback
3. `fetchCompletedDaysFromBackend()` (ItineraryGenerator.tsx line 178) reads `itinerary_data.days` — which has only 2 days at that moment
4. Since `expectedTotalDays` can be 0 (metadata not yet written or race), the guard `itineraryDays.length >= expectedTotalDays` passes (anything >= 0)
5. The 2-day array is returned to `handleGenerationComplete`
6. `handleGenerationComplete` (TripDetail.tsx line 1633) **force-saves** those 2 days to `itinerary_data`, overwriting whatever the backend chain writes next
7. Days 3-4 continue generating to `itinerary_days` table but the JSON is now permanently truncated

The self-heal logic at line 1118 (`jsonDayCount > 0 && itineraryDaysDbCount > jsonDayCount`) should rebuild, but it requires `itinerary_activities` to have data (line 1129 guard). If those are empty, it skips the rebuild "to protect JSON data" — ironically protecting the truncated JSON.

### Fix — Three changes

#### 1. Never force-save fewer days than exist (TripDetail.tsx ~line 1633)
Before writing to `itinerary_data`, fetch the current JSON day count from the DB and block the write if the incoming payload has fewer days:

```
// Before force-save, check existing day count
const { data: currentData } = await supabase
  .from('trips')
  .select('itinerary_data')
  .eq('id', tripId)
  .maybeSingle();
const existingDayCount = (currentData?.itinerary_data as any)?.days?.length || 0;
const incomingDayCount = itineraryPayload.days.length;

if (existingDayCount > incomingDayCount) {
  console.warn(`[TripDetail] SHRINK BLOCKED: existing=${existingDayCount}, incoming=${incomingDayCount}. Skipping force-save.`);
  // Don't write — the backend chain has more data
} else {
  // proceed with save
}
```

#### 2. Fix the premature-return guard in fetchCompletedDaysFromBackend (ItineraryGenerator.tsx ~line 181)
Never return a partial result when `expectedTotalDays` is unknown (0). Require explicit knowledge of the total:

```
// OLD: returns 2 days if expectedTotalDays is 0
if (itineraryDays.length > 0 && (expectedTotalDays <= 0 || itineraryDays.length >= expectedTotalDays))

// NEW: only return if we KNOW we have all days
if (itineraryDays.length > 0 && expectedTotalDays > 0 && itineraryDays.length >= expectedTotalDays)
```

This prevents `fetchCompletedDaysFromBackend` from returning 2 days when it can't verify the total.

#### 3. Self-heal rebuild should not require itinerary_activities (TripDetail.tsx ~line 1129)
Remove the overly cautious guard that skips rebuild when `itinerary_activities` is empty. The `itinerary_days` table (which has all 4 days with embedded activities) is sufficient for rebuild:

```
// OLD: skip rebuild if itinerary_activities has 0 rows
if (!activityCount || activityCount === 0) {
  console.log(`... skipping table rebuild to protect JSON data`);
}

// NEW: use itinerary_days.activities column directly (already fetched below)
// Remove the itinerary_activities count check entirely
```

### Files to change
- `src/pages/TripDetail.tsx` — Add no-shrink guard to force-save (line ~1633), fix self-heal rebuild guard (line ~1129)
- `src/components/itinerary/ItineraryGenerator.tsx` — Fix premature return when expectedTotalDays is 0 (line ~181)

### Expected outcome
- The frontend can never overwrite a 4-day JSON with a 2-day snapshot
- `fetchCompletedDaysFromBackend` refuses to return partial data when the total is unknown
- Self-heal reliably rebuilds from `itinerary_days` when JSON is truncated
- Page refresh always shows all generated days

