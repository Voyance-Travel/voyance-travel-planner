
Goal: Ensure active-trip entry points always open the dedicated “today-focused” ActiveTrip page, not full multi-day itinerary.

What I found in code:
- `ActiveTripCard` already routes “Today’s Plan” to `/trip/${trip.id}/active` (correct).
- `TripDashboard` card click already routes active trips to `/trip/${trip.id}/active` (correct).
- `TripDetail` already redirects active/in-date-window trips to `/trip/${trip.id}/active` (safety net already present).
- Remaining gap: `src/pages/ItineraryView.tsx` still blindly redirects `/itinerary/:id` → `/trip/:id` without checking active status.

Implementation plan:
1. Update legacy itinerary redirect logic
   - File: `src/pages/ItineraryView.tsx`
   - Add trip lookup (`useTrip(id)`) and redirect logic:
     - If trip is active (or falls within today between start/end dates), redirect to `/trip/${id}/active`.
     - Otherwise redirect to `/trip/${id}`.
   - Add lightweight loading guard so redirect target is chosen after trip data is known (prevents wrong first redirect).

2. Keep existing active-route behavior as-is (no changes unless mismatch found)
   - `src/components/trips/ActiveTripCard.tsx` remains `/trip/${trip.id}/active`.
   - `src/pages/TripDashboard.tsx` active click behavior remains `/trip/${trip.id}/active`.
   - `src/pages/TripDetail.tsx` active safety redirect remains in place.

3. Regression coverage
   - Add/adjust route behavior test in `src/test/navigation.test.ts` (or existing routing test area) for:
     - Active trip on `/itinerary/:id` resolves to `/trip/:id/active`.
     - Non-active trip on `/itinerary/:id` resolves to `/trip/:id`.

Technical details:
- Reuse existing date logic conventions (`parseLocalDate`, inclusive day-window check) so behavior matches `TripDetail`.
- No database/schema/auth changes.
- No UI redesign; routing-only fix.

Validation checklist after implementation:
1. Active trip → “Today’s Plan” opens `/trip/{id}/active`.
2. Active trip card click opens `/trip/{id}/active`.
3. Direct `/itinerary/{id}` for active trip redirects to `/trip/{id}/active`.
4. Direct `/itinerary/{id}` for upcoming/completed trip redirects to `/trip/{id}`.
5. Non-active trip flows remain unchanged.
