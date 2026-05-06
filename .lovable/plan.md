# Archive payments on regenerate, ignore stale ones at read time

## Problem
When a user regenerates an itinerary, rows in `trip_payments` (split-bill / paid items) survive even though the activity IDs they reference no longer exist. Result: $2,900 paid stays attached to a fresh $2,670 itinerary, triggering the (correct) "Overpaid by $230" warning. The warning is a symptom — the root cause is orphaned payments.

User decision: **Archive payments and start clean** on regenerate, with a frontend safety net for legacy trips.

## Layer 1 — Archive at regenerate time (backend, authoritative)

In `supabase/functions/generate-itinerary/action-generate-trip.ts`, inside the `if (!isResume)` block (around line 203, right next to the anchor harvest + itinerary wipe):

- Add a soft-archive step for `trip_payments` belonging to this `trip_id`.
- Strategy: add a new column `archived_at timestamptz` (and optional `archived_reason text`, `archived_itinerary_version int`) to `trip_payments`. Set `archived_at = now()` for every existing row before the wipe.
- Keep the rows (don't delete) so the user has an audit trail and we can build a "Previous payments" view later if needed.
- Skip rows whose `item_type IN ('flight','hotel')` since flight/hotel bookings typically should survive a regeneration (the new itinerary still uses the same flights/hotel). Only archive `activity`, `dining`, `transport`, `shopping`, `other`.

Migration:
```sql
ALTER TABLE public.trip_payments
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_reason text;
CREATE INDEX idx_trip_payments_active
  ON public.trip_payments(trip_id) WHERE archived_at IS NULL;
```

## Layer 2 — Filter archived payments everywhere they're read (frontend safety net)

Update every `from('trip_payments').select(...)` call site to add `.is('archived_at', null)`. Sites identified:
- `src/hooks/useTripFinancialSnapshot.ts` (line 118 area — the totals source feeding the Overpaid warning)
- `src/components/itinerary/PaymentsTab.tsx` (read sites at ~535, ~704)
- `src/services/tripPaymentsAPI.ts` (any list/get helpers)

This handles legacy trips that already have orphaned payments from before this change ships — they keep showing in PaymentsTab unless we also offer a one-time reconcile (see Layer 3).

## Layer 3 — Legacy reconcile banner (frontend)

In `PaymentsTab.tsx`, when `isOverpaid` is true AND no archived rows exist for this trip, show an info strip above the warning:

> "Some payments are from an earlier version of this itinerary. **Archive previous payments** to start fresh."

Button calls a small RPC `archive_orphan_trip_payments(p_trip_id uuid)` that sets `archived_at = now()` for any `trip_payments` row whose `item_id` no longer matches any current activity in `itinerary_data` (excluding `flight`/`hotel`). One click, idempotent, owner-only via RLS.

## Out of scope
- No UI to view/restore archived payments yet (data is preserved server-side; future enhancement).
- No change to flight/hotel payments — they intentionally survive regenerate.
- The "Overpaid by X" warning logic itself is correct and stays as-is; it just won't fire spuriously once archives are filtered.

## Files touched
- migration: add columns + index on `trip_payments`, plus `archive_orphan_trip_payments` SQL function
- `supabase/functions/generate-itinerary/action-generate-trip.ts` (archive step in pre-wipe block)
- `src/hooks/useTripFinancialSnapshot.ts` (filter archived)
- `src/components/itinerary/PaymentsTab.tsx` (filter archived + reconcile banner)
- `src/services/tripPaymentsAPI.ts` (filter archived in shared helpers)
