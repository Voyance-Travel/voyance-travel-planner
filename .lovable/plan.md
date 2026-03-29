

# Fix: Generation logs falsely report "completed" for failed itineraries

## Problem

The generation finalization logic has **two conflicting status computations**:

1. **Lines 876-877** correctly compute `isComplete` using three conditions: `allDaysHaveActivities && dayCountMatches && noFailedDays`
2. **Lines 954 and 989** only check `allDaysHaveActivities`, ignoring `dayCountMatches` and `noFailedDays`

This means a trip where days failed (tracked in `failed_day_numbers` metadata) or where day count doesn't match expectations still gets marked as `completed` in `generation_logs` and `ready` in the `itinerary_status` column — as long as every day in the array has at least one activity (which placeholder/structural days do).

Additionally, placeholder days injected at lines 913-924 contain structural activities (checkout, transfer, departure), so they pass the `activities.length > 0` check even though they were never truly generated.

## Evidence from the database

- Multiple trips show `itinerary_status: ready` but `generation_completed_days < generation_total_days` (e.g., Tokyo 3/5, Paris 2/4)
- All recent `generation_logs` rows show `status: completed` with empty errors arrays

## Fix (1 file)

**`supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

Replace the two inconsistent status checks with the already-computed `isComplete` variable:

1. **Line 954**: Change `allDaysHaveActivities ? 'ready' : 'partial'` to use `isComplete ? 'ready' : 'partial'`
2. **Line 965**: Change the `generation_completed_days` ternary to use `isComplete` instead of `allDaysHaveActivities`
3. **Line 970-971**: Change `chain_broken_at_day` and `chain_error` conditionals to use `isComplete`
4. **Line 989**: Change `timer.finalize(allDaysHaveActivities ? 'completed' : 'failed')` to `timer.finalize(isComplete ? 'completed' : 'failed')`
5. **Line 991**: Update the log message to use `isComplete`

This ensures that failed days, day count mismatches, and placeholder-only days all correctly result in `failed` generation logs and `partial` trip status, making the recovery UI ("Incomplete Itinerary" banner) appear as intended.

## Technical details

| Line | Current | Fixed |
|------|---------|-------|
| 954 | `allDaysHaveActivities ? 'ready' : 'partial'` | `isComplete ? 'ready' : 'partial'` |
| 965 | `allDaysHaveActivities ? totalDays : ...` | `isComplete ? totalDays : ...` |
| 970 | `allDaysHaveActivities ? null : emptyDaysList[0]` | `isComplete ? null : ...` |
| 971 | `allDaysHaveActivities ? null : ...` | `isComplete ? null : ...` |
| 989 | `allDaysHaveActivities ? 'completed' : 'failed'` | `isComplete ? 'completed' : 'failed'` |
| 991 | `allDaysHaveActivities` in log string | `isComplete` |

