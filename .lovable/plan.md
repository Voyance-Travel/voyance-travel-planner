

## Fix: Trips Reappearing After Deletion

### Problem
When you delete a trip, it disappears from the dashboard but reappears when you navigate away and come back. The deletion is only removing the trip from local (in-memory) state — it may not be actually deleting from the database, or the UI may be re-fetching stale data.

### Root Cause
Two issues working together:

1. **Silent delete failures**: The delete call (`supabase.from('trips').delete().eq('id', trip.id)`) does not verify that a row was actually deleted. Supabase RLS silently returns success with 0 rows affected if the policy blocks the operation. The code assumes success and removes the trip from local state.

2. **No cache invalidation**: The dashboard uses manual `useState` for trip data. The `handleTripDelete` callback only does `setTrips(prev => prev.filter(...))`. When the user navigates away and back, the `loadTrips` useEffect re-runs, re-fetching from the database — where the trip still exists.

### Fix

**File: `src/pages/TripDashboard.tsx`**

#### 1. Verify the delete actually removed a row
Change the delete call to use `.select()` to get the deleted rows back. If no rows are returned, the delete didn't actually happen — show an error instead of a success toast.

```typescript
const { data, error } = await supabase
  .from('trips')
  .delete()
  .eq('id', trip.id)
  .eq('user_id', user.id)  // explicit ownership check
  .select('id');

if (error) throw error;
if (!data || data.length === 0) {
  throw new Error('Trip could not be deleted');
}
```

#### 2. Apply the same fix to `PastTripCard`
**File: `src/components/trips/PastTripCard.tsx`**

Same pattern — add `.eq('user_id', user.id)` and `.select('id')` to verify the delete succeeded before updating local state.

#### 3. Pass `user.id` to both components
Both `TripCard` and `PastTripCard` need access to the current user ID. `TripCard` is an inner component of `TripDashboard` which already has `user` from `useAuth()`. Thread `userId` as a prop to both components (or use `useAuth()` directly inside them).

### Expected Behavior
- Deleted trips stay deleted — they won't reappear on navigation
- If a delete fails silently (RLS block, FK constraint), the user sees "Failed to delete trip" instead of a false success

### Files Changed
- `src/pages/TripDashboard.tsx` — verify delete, add `user_id` filter
- `src/components/trips/PastTripCard.tsx` — same verification fix

