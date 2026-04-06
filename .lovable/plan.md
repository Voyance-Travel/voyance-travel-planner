

## Fix Missing Meal When Cross-Day Dedup Strips a Restaurant + Orphaned Travel Routing

### Problem

Two dedup passes exist in `action-generate-trip-day.ts`:
1. **Post-generation dedup** (lines 883-932): Has primary meal protection (keeps duplicates rather than removing meals) and attempts pool replacement — but when pool is exhausted, primary meals are kept as duplicates.
2. **Failsafe dedup** (lines 1274-1317): Runs on trip completion but has NO primary meal protection and NO replacement logic — it blindly removes all duplicates, causing missing meals and orphaned travel routing.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

**Change 1: Import and define FALLBACK_RESTAURANTS map** (~line 15)
- Import the `FallbackVenue` type and reuse the same city-keyed fallback map already in `repair-day.ts` (Lisbon, Porto, Barcelona with breakfast/lunch/dinner lists). Define it as a local constant or import it.

**Change 2: Rewrite the failsafe dedup block** (lines 1274-1317)
- Instead of `return false` (removing), attempt replacement:
  1. Detect meal type from title
  2. Look up fallback from `FALLBACK_RESTAURANTS[cityKey][mealType]`
  3. Find one not in `allUsedRestaurants`
  4. Rewrite `act.title`, `act.location.name`, `act.venue_name`, `act.restaurant.name`
  5. If no fallback available AND it's a primary meal, KEEP the duplicate (log warning)
  6. Only remove if it's NOT a primary meal and no fallback exists

**Change 3: Add orphaned travel routing cleanup** (after the failsafe dedup, ~line 1317)
- For each day, build a set of current activity venue names
- Filter `day.travelRouting` to remove entries whose destination doesn't match any current activity and isn't a hotel/airport/known landmark
- Log each orphaned route removal

### Files to edit
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — rewrite failsafe dedup with replacement fallback + add orphaned travel routing cleanup

### Verification
Generate a 4-day Lisbon trip. All days should have complete meals. No orphaned travel routing. No placeholder names. Check logs for `DEDUP REPLACEMENT` and `ORPHANED ROUTE CLEANUP` entries.

