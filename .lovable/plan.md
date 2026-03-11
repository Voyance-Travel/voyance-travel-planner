

## Fix 23H: Arrival Day Routing — Venue-First When Closer Than Hotel

### Problem
Day 1 always forces hotel-first routing regardless of geography. When a must-do venue (e.g., US Open in Flushing) is closer to the airport than the hotel (e.g., LGA → Flushing = 15 min vs LGA → Midtown = 45 min), the AI generates a 90-minute detour.

### Approach
Three files need changes:

1. **`flight-hotel-context.ts`** — Add `arrivalRouting` field to `FlightHotelContextResult` and a `determineArrivalRouting()` function that compares airport-to-venue vs airport-to-hotel travel time using a lookup table of known airport/venue estimates. The routing decision is computed at the end of `getFlightHotelContext()` using the arrival airport, hotel address, and must-do data (passed as a new optional parameter).

2. **`index.ts`** (line 1530) — Replace the hardcoded Day 1 constraint. When `arrivalRouting.strategy === 'venue-first'`, inject venue-first instructions (go directly to venue, bag drop at venue, hotel after). When `'hotel-first'`, keep existing behavior. Also pass must-do data into `getFlightHotelContext()` at the call site (~line 4463).

3. **`prompt-library.ts`** (lines 940-1012) — Update `buildArrivalDayPrompt()` to accept an optional `arrivalRouting` parameter. When venue-first, replace the `hotel_check_in` required sequence with a venue-first sequence (transport to venue → bag drop → venue → transport to hotel → check-in).

### Technical Details

**Routing Decision Logic** (in `flight-hotel-context.ts`):
- New `determineArrivalRouting(arrivalAirport, arrivalTime24, firstMustDo, hotelAddress)` function
- Uses a static lookup table of airport-to-area travel estimates for major airports (LGA, JFK, EWR, LAX, ORD, etc.)
- Decision: if `airportToVenue < airportToHotel` AND time window before must-do is too tight for hotel detour → `'venue-first'`
- Returns `{ strategy, reason, firstMustDoName, estimatedAirportToVenueMinutes, estimatedAirportToHotelMinutes }`

**Must-do data wiring**: At `index.ts` ~line 4463, the must-do activities from `context.mustDoActivities` are parsed and the first Day 1 must-do is extracted to pass into the routing decision.

**Prompt changes** (line 1530): Conditional template that either says "go directly to [venue]" or keeps the existing "Hotel Check-in & Refresh first" instruction.

### Files Changed: 3
1. `supabase/functions/generate-itinerary/flight-hotel-context.ts` — Add `arrivalRouting` to interface, add `determineArrivalRouting()`, call it at end of `getFlightHotelContext()`
2. `supabase/functions/generate-itinerary/index.ts` — Pass must-do data to routing decision, replace hardcoded Day 1 constraint at line 1530 with routing-aware template
3. `supabase/functions/generate-itinerary/prompt-library.ts` — Update `buildArrivalDayPrompt()` required sequence to support venue-first routing

