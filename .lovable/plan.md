

## Fix: Hotel Update from Planner Page Doesn't Propagate to Itinerary or Budget

### Root cause

**`src/pages/planner/PlannerHotelEnhanced.tsx`** has two hotel save paths that are missing critical post-save steps compared to `AddBookingInline`:

1. **`handleSelectHotel`** (lines ~523-572) — saves hotel + calls `syncHotelToLedger` but:
   - Never calls `patchItineraryWithHotel()` → accommodation activities keep old hotel name
   - Never dispatches `booking-changed` event → financial snapshot doesn't refresh

2. **`handleManualHotelSubmit`** (lines ~638-683) — saves hotel but:
   - Never calls `syncHotelToLedger()` → price doesn't update in budget
   - Never calls `patchItineraryWithHotel()` → itinerary not updated
   - Never dispatches `booking-changed` event

By contrast, `AddBookingInline` (the itinerary page hotel editor) correctly does all three.

### Fix

**File: `src/pages/planner/PlannerHotelEnhanced.tsx`**

#### 1. Add missing import
```typescript
import { patchItineraryWithHotel } from '@/services/hotelItineraryPatch';
```

#### 2. In `handleSelectHotel` (~after line 567, after `syncHotelToLedger`)
Add itinerary patch + booking-changed event:
```typescript
// Patch itinerary accommodation activities
patchItineraryWithHotel(tripId, {
  name: hotelSelection.name,
  address: hotelSelection.address,
}).catch(err => console.warn('[PlannerHotel] Itinerary patch failed:', err));

// Refresh financial snapshot
window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
```

#### 3. In `handleManualHotelSubmit` (~after line 671, after saving)
Add budget sync + itinerary patch + booking-changed event for manual hotels:
```typescript
const tripId = plannerState.tripId;
if (tripId && manualHotel.name) {
  syncHotelToLedger(tripId, manualHotel as any)
    .catch(err => console.warn('[PlannerHotel] Manual hotel budget sync failed:', err));
  patchItineraryWithHotel(tripId, {
    name: manualHotel.name,
    address: manualHotel.address,
  }).catch(err => console.warn('[PlannerHotel] Manual hotel itinerary patch failed:', err));
  window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
}
```

### Scope
Single file: `src/pages/planner/PlannerHotelEnhanced.tsx` — 1 import + ~15 lines added across two functions. No backend changes.

