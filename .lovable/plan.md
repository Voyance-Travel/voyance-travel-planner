

## Bug: Hotel Price Not Reflected in Budget & Payments After Adding

### Root Cause

Two separate issues combine to cause this:

1. **No financial snapshot refresh after booking changes** — When a hotel is added (via manual entry or FindMyHotelsDrawer), `onBookingAdded` in `TripDetail.tsx` refetches trip data and cities but **never triggers a refetch** of the financial snapshot (`useTripFinancialSnapshot`). The Budget tab, Payments tab, and itinerary header all rely on this snapshot, which only loads once on mount.

2. **`syncHotelToLedger` is fire-and-forget** — The sync call that writes the hotel cost into `activity_costs` uses `.catch()` (silently swallowing errors). If it fails (e.g., RLS, timing), neither the user nor the calling component knows. And even when it succeeds, no downstream refresh is triggered.

The result: hotel cost gets written to `activity_costs`, but the UI never re-reads it.

### Fix

**1. `src/pages/TripDetail.tsx`** — After `onBookingAdded` finishes refetching trip/cities data, **dispatch a custom event** that financial snapshot hooks can listen to:

```tsx
// At end of onBookingAdded callback:
window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
```

**2. `src/hooks/useTripFinancialSnapshot.ts`** — Listen for `booking-changed` events and re-fetch:

```tsx
useEffect(() => {
  const handler = () => fetchData();
  window.addEventListener('booking-changed', handler);
  return () => window.removeEventListener('booking-changed', handler);
}, [fetchData]);
```

**3. `src/components/itinerary/AddBookingInline.tsx`** — Make `syncHotelToLedger` **awaited** (not fire-and-forget) so the row is confirmed written before `onHotelAdded` fires:

```tsx
// Line 881-887: await instead of fire-and-forget
await syncHotelToLedger(tripId, { ... });
```

**4. `src/components/itinerary/FindMyHotelsDrawer.tsx`** — Same: await `syncHotelToLedger` before calling `onHotelSelected`:

```tsx
await syncHotelToLedger(tripId, hotelData);
```

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useTripFinancialSnapshot.ts` | Add `booking-changed` event listener to auto-refetch |
| `src/pages/TripDetail.tsx` | Dispatch `booking-changed` event at end of `onBookingAdded` |
| `src/components/itinerary/AddBookingInline.tsx` | Await `syncHotelToLedger` instead of fire-and-forget |
| `src/components/itinerary/FindMyHotelsDrawer.tsx` | Await `syncHotelToLedger` instead of fire-and-forget |

