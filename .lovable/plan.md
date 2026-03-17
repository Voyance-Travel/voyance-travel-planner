

## Fix: Generation Stalls on "Your Itinerary Is Ready" With Missing Day

### Root Cause

Three interacting bugs create a deadlock:

1. **Day count mismatch**: Trip dates 2026-09-24 to 2026-09-29 = 6 days expected, but backend generated only 5 days in `itinerary_data.days`. Backend still marked status as `ready`.

2. **`fetchCompletedDaysFromBackend` rejects valid data**: Line 181 checks `itineraryDays.length >= expectedTotalDays` (5 >= 6 = false). It retries 5 times, then falls through to the `itinerary_days` table fallback.

3. **Fallback has empty activities**: The `itinerary_days` table has 6 rows but the `activities` column is empty (all data lives in `itinerary_data.days`). So the fallback returns 6 days with 0 activities, which triggers the "all days are empty shells" guard at line 263, sending the user back to generating state — creating an infinite loop.

The CORS errors are a side effect: the stall triggers auto-resume calls to `generate-itinerary`, which crash or timeout, producing no CORS headers.

### The Fix

**File: `src/components/itinerary/ItineraryGenerator.tsx`**

Two changes in `fetchCompletedDaysFromBackend`:

1. **Accept itinerary_data.days when they have activities, even if count < expected** (line ~181):
   ```
   // Current: itineraryDays.length >= expectedTotalDays
   // New: Accept if we have days with real activities AND status is ready
   const daysWithActivities = itineraryDays.filter(
     d => Array.isArray(d.activities) && d.activities.length > 0
   );
   if (daysWithActivities.length > 0 && 
       (daysWithActivities.length >= expectedTotalDays || tripData.itinerary_status === 'ready')) {
     return itineraryDays;
   }
   ```

2. **In the `itinerary_days` fallback, merge activities from `itinerary_data.days`** (line ~203-234): When building `fallbackDays` from `itinerary_days` rows, cross-reference each day against `itinerary_data.days` to pull in activities if the row's own activities array is empty.

3. **Relax the fallback length guard** (line ~236-238): Don't return `[]` when days < expected if the trip status is already `ready`. The backend marked it complete — the frontend should trust that.

**File: `src/hooks/useGenerationPoller.ts`**

4. **In the `onReady` path (line 166-174)**: Already correct — it fires `onReady` when status is `ready`. No change needed here.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/ItineraryGenerator.tsx` | Relax strict day count check in `fetchCompletedDaysFromBackend` when trip status is `ready`; merge `itinerary_data` activities into `itinerary_days` fallback |

Single file, ~15 lines changed. The core principle: **when the backend says `ready`, trust it and show what we have instead of stalling**.

