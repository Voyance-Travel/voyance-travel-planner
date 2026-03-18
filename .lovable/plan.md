

## Fix: Flight Card Issues on Multi-City Trips

### Three Issues Identified

1. **Wrong day** — The "Final Departure" flight card appears on the first leg's last day (`dayIndex === rawDays.length - 1`). For multi-city trips, the itinerary has transition/departure days between cities. The condition `!d.isDepartureDay && !d.isTransitionDay` was meant to avoid doubling up, but the card still shows on Day 1's city if no departure/transition flags are set on that last day. The real problem: for multi-city, the homebound flight card should only appear on the **true last day of the entire trip**, which it does — but the user is seeing it on Day 1 because `rawDays` may only contain the currently-visible city's days, or the legs lookup is grabbing the wrong leg.

   **Root cause after deeper look**: Line 1629 checks `dayIndex === rawDays.length - 1`. This IS the last day of the full itinerary. But the `returnLeg` lookup (line 1632-1636) grabs `allLegs[allLegs.length - 1]` — the last leg in the `flightSelection.legs` array. For a multi-city trip with legs `[outbound, city1→city2, city2→city3, homebound]`, this correctly gets the homebound leg. However, if the last day already has `isDepartureDay` or `isTransitionDay` set, the card is skipped. The issue is likely that for multi-city trips, the last day of the *first city* has neither flag set (it's just a regular sightseeing day), but somehow `rawDays.length - 1` resolves to that day index.

   **Actually**: Re-reading the user's report — "it's appearing on my first leg" — the card shows on the first city's days. This means the final departure card condition `dayIndex === rawDays.length - 1` is matching a day that shouldn't be the last. But `rawDays` should contain ALL days across all cities. Unless the itinerary only has days for the first city generated so far.

   **Fix**: The final departure card should only inject on the last day if that day's city matches the last city in the trip (or if it's a single-city trip). Additionally, guard against injecting if there are transition/departure days *after* this day elsewhere in the trip structure.

2. **Before checkout** — The card inserts chronologically by `startTime`. If the departure time (e.g., 18:00) is earlier than checkout-related activities, or if checkout has no time, the flight card lands before it. Fix: ensure the final departure card is always inserted **after** any hotel checkout activity.

3. **Styling** — The `InterCityTransportCard` could use visual refinement for the final departure variant.

### Plan

| # | File | Change |
|---|------|--------|
| 1 | `EditorialItinerary.tsx` (lines 1628-1710) | **Fix the Final Departure injection logic**: (a) Only inject if this is truly the homebound day — check that no subsequent days exist with `isDepartureDay` or `isTransitionDay`, AND that the day's city matches the last city or departure city. (b) When inserting chronologically, skip past any hotel checkout activities (`__hotelCheckout` flag or checkout-related titles) so the card always appears after checkout. (c) For multi-city trips with `allHotels`, only inject on the last day if it belongs to the final city segment. |
| 2 | `InterCityTransportCard.tsx` | **Styling improvements**: Add slightly more visual distinction for the final departure variant — larger padding, subtle gradient background, and a "Heading Home" or destination label. Accept an optional `variant="final"` prop. |
| 3 | `EditorialItinerary.tsx` (line 8775) | Pass `variant="final"` to `InterCityTransportCard` when the activity has `__syntheticFinalDeparture`. |

### Key Logic Change (Issue 1 — wrong day)

```typescript
// BEFORE:
if (dayIndex === rawDays.length - 1 && !d.isDepartureDay && !d.isTransitionDay && flightSelection) {

// AFTER:
// Only inject final departure on the absolute last day AND only if no
// remaining days after this one have departure/transition flags (multi-city guard)
const isAbsoluteLastDay = dayIndex === rawDays.length - 1;
const hasLaterTravelDays = rawDays.slice(dayIndex + 1).some(
  rd => (rd as any).isDepartureDay || (rd as any).isTransitionDay
);
if (isAbsoluteLastDay && !d.isDepartureDay && !d.isTransitionDay && !hasLaterTravelDays && flightSelection) {
```

Since `dayIndex === rawDays.length - 1` already means it's the last day, `hasLaterTravelDays` would always be false. So the real fix is different — the problem must be that the card is appearing on a day that ISN'T the last. Let me re-check: the user said "it's appearing on my first leg." This likely means the card shows on the last day of the first city, which IS the last generated day if later city days haven't been generated yet.

**Revised fix**: Guard the injection by also checking if multi-city hotels exist and whether the current day belongs to the final city:

```typescript
const isLastCity = !allHotels || allHotels.length <= 1 || 
  d.city?.toLowerCase() === allHotels[allHotels.length - 1]?.cityName?.toLowerCase();
if (isAbsoluteLastDay && !d.isDepartureDay && !d.isTransitionDay && isLastCity && flightSelection) {
```

### Key Logic Change (Issue 2 — before checkout)

After chronological insertion, shift the card past any checkout activities:

```typescript
// After inserting, ensure it's after any checkout activity
while (insertIndex > 0 && insertIndex < updatedActivities.length) {
  const prev = updatedActivities[insertIndex - 1];
  // If the card landed before a checkout, swap past it
  // (checkout activities typically have titles like "Check out", "Hotel Checkout")
  break;
}
// Simpler: insert at end if the time-based position lands before checkout
```

Actually the cleaner approach: after the chronological insert, check if any activity before the card is a checkout — if the card ended up before a checkout, move it after.

