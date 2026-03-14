

## Fix: Payment assignment — 409 conflict, slow UI update, controlled/uncontrolled warning

### Three issues

**1. 409 Conflict (`duplicate key value violates unique constraint`)**

In `handleAssignMember` (line 752-780), it deletes existing payments by their `id`, then inserts new rows. But if the item has no prior payment rows in `allPayments` (common for auto-generated items), the delete is skipped and the insert hits the unique constraint on `(trip_id, item_type, item_id)`.

Same issue in the "Split All Evenly" handler (line 1354) — uses raw `insert` with no conflict handling.

**Fix**: Replace both `insert` calls with `upsert` using `onConflict: 'trip_id,item_type,item_id'`. Since multi-member splits create multiple rows with the same `(trip_id, item_type, item_id)` but different `assigned_member_id`, we need to keep the delete-then-insert pattern but wrap it in proper error handling — use upsert for single assignments and keep delete+insert for splits, but add the `onConflict` clause as a safety net.

**2. Slow UI update after assignment (feels like ~1 minute)**

After a successful assignment, the code calls `await fetchPayments(150)` which adds a 150ms artificial delay, then does a full DB round-trip. The user sees no change until the fetch completes. Combined with React re-render timing and the `payableItems` memo recalculation, this feels sluggish.

**Fix**: Add optimistic local state update — immediately update the `payments` state with the new assignment data before the server fetch. Then do a background refetch (no await) to sync. This gives instant visual feedback.

**3. Controlled/uncontrolled Select warning**

`assignMemberId` is initialized as `''` (line 110), but when setting it from an item that has no assignment, it gets `item.assignedMemberId || ''` which can be `undefined || ''`. The Select component receives `undefined` on first render if the state briefly transitions. This is a minor issue since the modal now uses multi-select checkboxes, but the state variable is still referenced.

**Fix**: Ensure `assignMemberId` always defaults to `''` (never `undefined`). Initialize with `useState<string>('')` and guard all setters.

### Files to edit

**`src/components/itinerary/PaymentsTab.tsx`**

1. **`handleAssignMember` (~line 779)**: Change `supabase.from('trip_payments').insert(rows)` to `.upsert(rows, { onConflict: 'trip_id,item_type,item_id' })` as a safety net after the delete.

2. **"Split All Evenly" handler (~line 1354)**: Same change — use `upsert` with `onConflict` instead of raw `insert`. Also add a delete of existing payments for the item before inserting, matching the pattern in `handleAssignMember`.

3. **Optimistic update after assignment (~line 786-790)**: After successful insert/upsert, immediately update local `payments` state with the new rows (synthesize `id` temporarily). Then do `fetchPayments(0)` in background (no await, no artificial delay) to sync real IDs.

4. **Controlled Select guard (~line 916)**: Change `setAssignMemberId(item.assignedMemberId || '')` to ensure it's always a string. Also verify initialization is `''` not `undefined`.

