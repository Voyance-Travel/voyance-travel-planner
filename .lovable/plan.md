

## Problem Analysis

Two bugs in the Payments tab:

### Bug 1: Marking one activity as paid marks a second one too
**Root cause:** Duplicate activity IDs across days. The itinerary has `trans_001` on both Day 1 ("Arrival Transfer to Midtown") and Day 2 ("Taxi to Hudson Yards"). When the user pays the Day 1 item, the payment record stores `item_id: trans_001`. The `payableItems` memo then matches this payment to both activities since they share the same ID.

**Fix:** In `PaymentsTab.tsx`, when building payable items from itinerary activities (lines 319-371), use a composite key that includes the day number — e.g., `${activity.id}_d${day.dayNumber}` — instead of just `activity.id`. This ensures each activity row is unique even if the underlying IDs are reused across days. The same composite key must be used when inserting the payment record in `handleMarkAsPaid`.

### Bug 2: Slow UI feedback after marking paid
**Root cause:** `handleMarkAsPaid` inserts the payment, then waits 150ms + a full network fetch before updating the UI. No optimistic update.

**Fix:** After the successful insert in `handleMarkAsPaid`, immediately update the local `payments` state with the new payment object (optimistic update) before the background refetch. This gives instant visual feedback (avatar/icon appears immediately).

### Files Modified

| File | Change |
|------|--------|
| `src/components/itinerary/PaymentsTab.tsx` | Use composite `activityId_dN` keys for payable items; add optimistic local state update after marking paid |

