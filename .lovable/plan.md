

## Problem: Return Home Card Doesn't Reflect Step 2 Transport Mode

### What Already Works

- **Mid-city departures**: The `isDepartureDay` flag reads `transport_type` from `trip_cities` (Step 2 data). Train, bus, ferry, car — all render correctly with the right card and details.
- **Early flight pruning**: Both backend (R5 time window enforcement) and frontend (cutoff = flight time - 90min buffer) already trim activities that conflict with departure logistics. A 10 AM flight will strip lunch at noon.
- **Departure sequence**: Checkout → transport → security → flight ordering is already enforced.

### What's Missing

**Gap 1: Final day return card requires `flightSelection`**
The return home card (line 1772) only fires when `flightSelection` exists. If the user selected "train", "ferry", or "car" to return home in Step 2, and has no flight booked, **no return card is injected on the last day at all**.

**Gap 2: Last day is never marked `isDepartureDay`**
`buildDayCityMap()` only sets `isDepartureDay` when there's a `nextCity`. The absolute last day of the trip never gets this flag, so the mid-trip departure card logic (line 1648) never fires for it.

**Gap 3: Backend repair Step 8b generic card ignores transport mode**
When the backend injects a generic "Departure Transfer" card (no flight data, no nextLegTransport), it doesn't look at `trip_cities` transport_type for the homebound leg. It produces a bland card instead of "Transfer to Train Station" or similar.

### What to Change

**File: `src/services/itineraryAPI.ts`** — `buildDayCityMap()`
- Mark the absolute last day as `isDepartureDay: true` with `departureTo` set to the user's home/departure city (from `trip.departure_city`) and `departureTransportType` derived from the return flight selection or the trip's return transport mode.

**File: `src/components/itinerary/EditorialItinerary.tsx`** — Final departure card injection (line 1772)
- Expand the condition: inject the return card if `flightSelection` exists **OR** if the day is `isDepartureDay` with a `departureTransportType`. For non-flight returns, build the card from `departureTo` + `departureTransportType` + `departureTransportDetails` (same logic as mid-city departures).
- Remove the `!d.isDepartureDay` guard from line 1772 so the final card injection doesn't skip when `isDepartureDay` is true.

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Step 8b
- In the generic fallback branch (line 653), check `nextLegTransport` to label the card correctly (e.g., "Transfer to Train Station" instead of "Departure Transfer"). Currently the branch only fires when `isLastDay && !returnDepartureTime24`, but `nextLegTransport` could still be set for non-flight returns.

### Expected Result
- User selects "Train" to return home in Step 2 → last day shows a "Train to Home City" card with correct icon and timing
- User selects "Flight" → works as before with full flight details populated
- No transport selected → shows generic "Departure Transfer" placeholder card
- Early departures (10 AM flight) continue to prune post-checkout activities as they already do

