

# Real-time Trip Deletion for Guests

## Problem
When a trip owner deletes a trip, the database cascade works correctly (trip_collaborators rows are removed via ON DELETE CASCADE). However, the guest's browser still shows the deleted trip until they refresh, because there's no real-time notification to invalidate their cached trip list.

## Solution
Add a Supabase Realtime subscription on the `trip_collaborators` table so that when a collaborator row is deleted (cascaded from trip deletion), the guest's dashboard automatically removes the trip from their view.

## Changes

**File**: `src/pages/TripDashboard.tsx`

Inside the `useEffect` that loads trips (around line 746), add a Realtime channel subscription:

1. Subscribe to `postgres_changes` on `trip_collaborators` filtered by `user_id = current user`
2. On DELETE events, remove the deleted trip from the local `trips` state
3. On INSERT events (new collaboration), refetch trips
4. Clean up the subscription on unmount

This requires enabling realtime on `trip_collaborators`:

**Database migration**: 
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_collaborators;
```

The realtime subscription in the dashboard will listen for DELETE events on the user's collaborator rows and immediately remove those trips from the UI without requiring a page refresh.

