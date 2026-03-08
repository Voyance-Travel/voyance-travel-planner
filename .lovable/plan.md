

## Fix: Route Active Trips to ActiveTrip Page

### Problem
The ActiveTrip page (`/trip/:tripId/active`) exists with a full today-focused experience but nothing routes to it. Users see the full multi-day itinerary instead of today's focused view.

### Current State
- **ActiveTripCard** line 336: Already links to `/trip/${trip.id}/active` — **no fix needed here**
- **TripDashboard** line 303-308: `handleCardClick` sends upcoming itinerary trips to `/itinerary/${trip.id}` — active trips use ActiveTripCard so this doesn't affect active trips, but still should route active correctly
- **ItineraryView.tsx**: Blindly redirects `/itinerary/:id` → `/trip/:id`
- **TripDetail.tsx** line 1460+: Has `isLiveTrip` check and renders LiveItineraryView inline instead of redirecting to ActiveTrip

### Fixes (3 files)

**1. `src/pages/TripDashboard.tsx` — line 303-308**
Update `handleCardClick` in `TripCard` to route active trips to the active view:
```typescript
const handleCardClick = () => {
  if (displayStatus === 'active') {
    navigate(`/trip/${trip.id}/active`);
  } else if (hasItinerary) {
    navigate(`/trip/${trip.id}`);
  } else {
    navigate(`/trip/${trip.id}`);
  }
};
```
Also fix `/itinerary/` references — upcoming trips should go to `/trip/${trip.id}` directly (ItineraryView just redirects there anyway).

**2. `src/pages/TripDetail.tsx` — after line 1460**
Add a redirect for active trips. After `const isLiveTrip = trip.status === 'active';` add a date-window check too, then redirect:
```typescript
import { Navigate } from 'react-router-dom';

const isLiveTrip = trip.status === 'active';
const isInDateWindow = (() => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = parseLocalDate(trip.start_date);
  const end = parseLocalDate(trip.end_date);
  return start <= today && end >= today;
})();

if (isLiveTrip || isInDateWindow) {
  return <Navigate to={`/trip/${trip.id}/active`} replace />;
}
```
This makes TripDetail exclusively for non-active trips. The existing LiveItineraryView code in TripDetail becomes dead code but can be cleaned up later.

**3. `src/pages/ItineraryView.tsx`**
Keep simple — just redirect to `/trip/:id`. The TripDetail redirect above will catch active trips and forward them to `/trip/:id/active`. No need for useTrip hook here.

**4. `src/components/trips/PastTripCard.tsx` — lines 89 and 198**
Replace `/itinerary/${trip.id}` → `/trip/${trip.id}` to remove the unnecessary ItineraryView hop.

### What stays the same
- `ActiveTrip.tsx` — no changes, already works perfectly
- `ActiveTripCard.tsx` — already routes correctly to `/trip/:id/active`
- `LiveItineraryView.tsx` — stays (will become unused from TripDetail, but no breaking changes)

