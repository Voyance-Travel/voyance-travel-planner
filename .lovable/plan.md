

# Fix: Activity Completion Not Persisting Across Navigation

## Problem
There are two separate issues causing completed activities to reset when navigating away:

1. **ActiveTrip.tsx** (`handleActivityComplete`): Only updates local React state (`setCompletedActivities`) — never writes to the database. So completions are lost on any navigation.

2. **LiveItineraryView.tsx**: Initializes `completedActivities` as an empty `Set()` every mount. It never reads persisted completion status from the activity metadata, so even when TripDetail.tsx does persist to the DB, the UI doesn't reflect it on re-mount.

## Solution

### 1. ActiveTrip.tsx — Persist completions to the database
Add a database update (same pattern as TripDetail.tsx) inside `handleActivityComplete`: update `trip_activities.metadata` with `{ completed: true, completedAt: ... }`.

### 2. LiveItineraryView.tsx — Hydrate state from existing metadata on mount
Add a `useEffect` (or `useMemo` in initial state) that scans all activities across all days for `metadata.completed === true` or `metadata.skipped === true`, and pre-populates the `completedActivities` and `skippedActivities` Sets so returning to the view shows the correct status.

### Files Changed

- **`src/pages/ActiveTrip.tsx`** — Add Supabase update call in `handleActivityComplete` (and similarly for skip if applicable)
- **`src/components/itinerary/LiveItineraryView.tsx`** — Initialize `completedActivities`/`skippedActivities` from activity metadata on mount/when days change

