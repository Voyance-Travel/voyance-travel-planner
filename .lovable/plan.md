

## Fix: Cannot Delete Multi-City Trips

### Root Cause

Three overlapping issues prevent deletion of multi-city trips:

1. **Orphaned parent trips**: When a multi-city trip is split into journey legs, the original "parent" trip row gets `metadata.splitIntoJourney = true` and status `cancelled`. The dashboard filters these out (line 919: `.filter(row => !((row.metadata as any)?.splitIntoJourney))`), making them invisible — but they still exist in the database. There are ~15 of these orphans.

2. **PastTripCard has no delete button**: Any trip whose `end_date < today` renders as a `PastTripCard`, which only shows review/view options — no delete. The `canDeleteTrip` guard also explicitly blocks deletion of past trips. Multi-city trips with past dates (e.g., "Barcelona → Rome", end 2026-03-30) are stuck.

3. **Journey delete blocked by `isPaid` false positive**: The dashboard sets `isPaid: true` when `status === 'booked'` (line 934), even without actual payment. The Paris & London journey has a "booked" leg, so `JourneyPlaylist` blocks deletion via `hasPaidLeg`.

### Changes

**1. `src/pages/TripDashboard.tsx` — Allow past trip deletion**
- In `canDeleteTrip`: remove the "past trips cannot be deleted" block. Past trips should be deletable (they're just data cleanup). Only block deletion for actually paid trips.
- Fix `isPaid` mapping: use `(row.metadata as Record<string, any>)?.is_paid || false` — remove the `row.status === 'booked'` check, since "booked" doesn't mean "paid". A booked trip without confirmation/payment metadata should still be deletable.

**2. `src/components/trips/PastTripCard.tsx` — Add delete button**
- Add a delete button (trash icon) matching the TripCard pattern with AlertDialog confirmation.
- Accept an `onDelete` callback prop.

**3. `src/pages/TripDashboard.tsx` — Pass `onDelete` to PastTripCard**
- Wire `handleTripDelete` to PastTripCard instances rendered from TripCard (line 292).

**4. Database cleanup — Delete orphaned parent trips**
- Use the data insert tool to delete trips where `metadata->>'splitIntoJourney' = 'true'` and `status = 'cancelled'`. These are invisible remnants of the split process.

### Files

| File | Change |
|---|---|
| `src/pages/TripDashboard.tsx` | Remove past-trip deletion block; fix `isPaid` logic; pass `onDelete` to PastTripCard |
| `src/components/trips/PastTripCard.tsx` | Add delete button with confirmation dialog |
| Database (data operation) | Delete ~15 orphaned `splitIntoJourney` parent trip rows |

