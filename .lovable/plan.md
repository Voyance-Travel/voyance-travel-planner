

## Problem: Missing Departure Transport Card

The repair pipeline guarantees check-in (step 7), checkout (step 8), hotel returns (step 9), and departure sequence ordering (step 11) — but there is **no guarantee that a departure transport card exists**.

The system relies entirely on the AI prompt to produce "Transfer to Airport" or "Transfer to Station" cards. If the AI omits them, no repair step injects them. The checkout card gets created, but the traveler has no way to leave.

This affects both:
- **Last day of trip** (flight departure): no guaranteed airport transfer
- **Last day in city** (multi-city): no guaranteed station/transport transfer

### What to Change

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Add a new repair step (between current step 8 checkout guarantee and step 9 bookends):

**Step 8b: DEPARTURE TRANSPORT GUARANTEE**

On departure days (`isLastDay` or `isLastDayInCity && !isTransitionDay`):

1. Check if a departure transport card already exists (title contains "airport", "transfer to station", or category=transport with departure-related keywords)
2. If missing, inject one:
   - **Flight departure** (`isLastDay` with `returnDepartureTime24`): Create "Transfer to Airport" card, timed backward from flight (flight minus ~180 min)
   - **Non-flight departure** (`isLastDayInCity` with `nextLegTransport`): Create "Transfer to [Station]" card using `nextLegTransportDetails` for station name and departure time
   - **Last day, no flight data**: Create a generic "Departure Transfer" card after checkout
3. Place it chronologically after checkout but before any flight/security cards
4. If a flight card is also missing on the last day, inject a minimal "Departure Flight" card at the flight time

Also run `repairDepartureSequence` on `isLastDayInCity` departures too, not just `isLastDay` — currently step 6 only fires for `isLastDay`, so mid-trip city departures skip sequence repair entirely.

### Expected Result

- Every departure day (flight or train/bus) has: checkout → transport to airport/station → departure
- No more days that end at checkout with no way to leave
- Mid-trip city departures get the same sequence repair as final-day flights

