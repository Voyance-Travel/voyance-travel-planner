

## Fix: "Just Tell Us" Chat Planner Ignoring User Input

### Problem Summary
The chat planner fails to carry user-specified details (flights, activities, hotel, events) into the generated itinerary due to missing extraction fields, weak prompt guidance, and a type mismatch in the per-day generation path.

**Note:** The user's root cause #1 (additionalNotes never read) is actually already fixed — `generate-itinerary/index.ts` reads it at lines 8525 and 9802. The real issues are extraction quality and downstream type handling.

### Changes (5 files)

**1. Edge Function: Add flight fields + improve descriptions**
`supabase/functions/chat-trip-planner/index.ts`
- Add `arrivalAirport`, `arrivalTime`, `departureAirport`, `departureTime` properties to the `extract_trip_details` tool schema
- Rewrite `mustDoActivities` description to be explicit about capturing every activity/event/venue with times
- Rewrite `additionalNotes` description to clarify it's for logistics, not activities
- Add "EXTRACTION QUALITY" section to system prompt with examples for activities, flights, hotel, and logistics

**2. Frontend: Update TripDetails interface**
`src/components/planner/TripChatPlanner.tsx`
- Add `arrivalAirport`, `arrivalTime`, `departureAirport`, `departureTime` to the `TripDetails` interface

**3. Frontend: Show flight + must-do in confirmation card**
`src/components/planner/TripConfirmCard.tsx`
- Add rows for arriving (airport + time) and departing (airport + time) using the Plane icon
- Remove the existing standalone `mustDoActivities` display block and move it into the structured rows list

**4. Trip creation: Build flight_selection from chat**
`src/pages/Start.tsx`
- After the `hotelSelection` construction, build a `flightSelection` object from the new fields
- Add `flight_selection: flightSelection` to the trip insert

**5. Fix type mismatch in per-day generation**
`src/services/itineraryAPI.ts`
- Lines 276 and 519: Change `(existingMeta.mustDoActivities as string[]) || []` to handle both string and string[] (the chat planner saves a string, the manual planner saves an array)
- Also merge `additionalNotes` into the mustDoActivities context for the per-day path

### Technical Details

The structured flight fields flow: chat extraction → TripDetails → TripConfirmCard display → Start.tsx builds `flight_selection` JSON → saved to trip record → generate-itinerary reads `trip.flight_selection` for scheduling.

The `mustDoActivities` fix ensures both `string` and `string[]` are normalized to a single string before being passed to the generation prompt, preventing silent failures.

