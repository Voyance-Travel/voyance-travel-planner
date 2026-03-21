

## Fix: Split Bill Assignment Not Persisting

### Root Cause

Two compounding issues:

**Issue 1: Stale member ID mapping after creating new trip_members rows**

When assigning an item to a member (e.g., "Ashton Lightfoot") who exists as a synthetic `owner-xxx` or `collab-xxx` ID but not yet as a real `trip_members` row, `resolveRealMemberId` creates a new DB row by calling `addTripMember()` directly (the raw function, not the React Query mutation hook). This means `queryClient.invalidateQueries(['trip-members'])` never fires, so `rawTripMembers` stays stale.

After the payment is saved with the new real `assigned_member_id`, the immediate `fetchPayments(0)` returns the payment. But `realIdToSyntheticId` (line 248) can't map the new real ID to any known synthetic ID because `rawTripMembers` was never refreshed. It falls back to `'unassigned'`, making it appear the assignment didn't persist.

**Issue 2: Unique constraint blocks multi-member splits**

`trip_payments` has `UNIQUE (trip_id, item_type, item_id)`, so only one payment row per item can exist. Multi-member splits (which need N rows with the same item key but different `assigned_member_id`) silently fail — only the last row survives the upsert.

### Fix

**File: `src/components/itinerary/PaymentsTab.tsx`**

1. After `resolveRealMemberId` creates a new trip_member row, invalidate the `['trip-members', tripId]` query so `rawTripMembers` refreshes and `realIdToSyntheticId` picks up the new ID. Import `useQueryClient` and call `queryClient.invalidateQueries` after the resolution loop in `handleAssignMember`.

2. Alternatively (simpler, more robust): after calling `resolveRealMemberId`, also call `await refetchMembers()` (expose refetch from `useTripMembers`) before proceeding with `fetchPayments`.

**Database migration: Update unique constraint to include `assigned_member_id`**

Change the unique constraint from `(trip_id, item_type, item_id)` to `(trip_id, item_type, item_id, assigned_member_id)`. This allows multiple payment rows per item (one per assigned member) which is required for multi-member splits. Drop both duplicate constraints and create one correct one.

### Implementation Details

**PaymentsTab.tsx changes (~10 lines):**
- Add `const queryClient = useQueryClient()` (already imported from tanstack)
- In `handleAssignMember`, after the `resolveRealMemberId` loop (line 527), add: `await queryClient.refetchQueries({ queryKey: ['trip-members', tripId] })`
- Same fix in the "Split All Evenly" handler (around line 1120)
- Change `fetchPayments(0)` to `await fetchPayments(0)` on line 585 so the UI waits for fresh data

**Migration SQL:**
```sql
ALTER TABLE trip_payments DROP CONSTRAINT IF EXISTS trip_payments_trip_id_item_type_item_id_key;
ALTER TABLE trip_payments DROP CONSTRAINT IF EXISTS trip_payments_unique_item;
ALTER TABLE trip_payments ADD CONSTRAINT trip_payments_unique_item_member 
  UNIQUE (trip_id, item_type, item_id, assigned_member_id);
```

### Scope
1 file changed (`PaymentsTab.tsx`), 1 migration (constraint update). No backend function changes.

