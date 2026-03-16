

# Audit: User Paths and Edge Functions

## Summary

After reviewing the key user paths (ActiveTrip, TripDetail, TripDashboard, LiveItineraryView, AcceptInvite) and the edge function logs, here are the findings:

## Edge Functions: Healthy
- **get-entitlements**: Running cleanly, returning correct tier/credit data, no errors
- **trip-notifications**: Healthy, processing `get-user-notifications` actions without errors
- **generate-itinerary**: Structure is solid with proper CORS, action routing, and auth checks
- No 500s or runtime crashes visible in recent logs

## Bug Found: LiveItineraryView Hydration is Dead Code

**File**: `src/components/itinerary/LiveItineraryView.tsx` (lines 374-388)

The component tries to hydrate completed/skipped activities from `a.metadata?.completed`, but the `Activity` objects passed via the `days` prop come from `parseActiveTripDays()`, which **does not include a `metadata` field**. The parsed activity shape only contains: `id, name, description, type, category, startTime, endTime, duration, location, imageUrl, tips, confirmationNumber, etc.`

This means:
- `initialCompleted` and `initialSkipped` Sets are always empty
- The `useEffect` hooks that merge them into state do nothing
- Completions in `LiveItineraryView` (used in TripDetail for live trips) are visual-only and lost on remount

**ActiveTrip.tsx** handles this correctly by fetching directly from the `trip_activities` table (lines 247-264). LiveItineraryView needs the same approach.

## Fix

**`src/components/itinerary/LiveItineraryView.tsx`**: Replace the broken `useMemo` hydration (which reads non-existent `metadata` from parsed itinerary JSON) with a `useEffect` that fetches `trip_activities` from the database (same pattern as ActiveTrip.tsx):

```typescript
useEffect(() => {
  supabase
    .from('trip_activities')
    .select('id, metadata')
    .eq('trip_id', tripId)
    .then(({ data }) => {
      if (!data) return;
      const completed = new Set<string>();
      const skipped = new Set<string>();
      data.forEach((row: any) => {
        const meta = row.metadata as Record<string, unknown> | null;
        if (meta?.completed) completed.add(row.id);
        if (meta?.skipped) skipped.add(row.id);
      });
      if (completed.size > 0) setCompletedActivities(prev => new Set([...prev, ...completed]));
      if (skipped.size > 0) setSkippedActivities(prev => new Set([...prev, ...skipped]));
    });
}, [tripId]);
```

Remove the broken `initialCompleted`/`initialSkipped` `useMemo` blocks and their associated `useEffect` sync hooks.

## Other Paths Verified (No Issues Found)
- **TripDetail → ActiveTrip redirect**: Correctly redirects active/in-date-window trips unless `?edit=true`
- **TripDashboard**: Standard data loading, no issues
- **AcceptInvite**: Proper token validation and auth flow
- **useTripViewMode**: Collaborator edit access fix is correct
- **Activity completion persistence in ActiveTrip.tsx**: Works correctly (DB read + write)

## Scope
- 1 file changed: `src/components/itinerary/LiveItineraryView.tsx`
- No database changes needed

