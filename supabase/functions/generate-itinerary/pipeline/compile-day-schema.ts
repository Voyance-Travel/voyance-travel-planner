/**
 * compile-day-schema.ts — Classify day mode and build dayConstraints prompt.
 *
 * Phase 2: Extracts the decision tree from action-generate-day.ts (lines ~883–1681).
 * Pure function — no DB calls, no side effects, fully testable.
 *
 * Input: DaySchemaInput (pre-resolved facts)
 * Output: CompiledSchema (dayConstraints string + possibly modified flightContext)
 */

import type { DaySchemaInput, CompiledSchema } from './types.ts';
import {
  parseTimeToMinutes,
  addMinutesToHHMM,
  normalizeTo24h,
} from '../flight-hotel-context.ts';

export function compileDaySchema(input: DaySchemaInput): CompiledSchema {
  const {
    isFirstDay, isLastDay, dayNumber, totalDays, destination,
    resolvedIsLastDayInCity, resolvedIsMultiCity,
    resolvedNextLegTransport, resolvedNextLegCity, resolvedNextLegTransportDetails,
    resolvedHotelOverride, resolvedIsTransitionDay,
    paramIsFirstDayInCity, paramIsTransitionDay,
    mustDoEventItems,
    arrivalAirportDisplay, airportTransferMinutes,
  } = input;

  // flightContext may be modified for non-flight departures
  let flightContext = { ...input.flightContext };
  let dayConstraints = '';

  if (isFirstDay) {
    // ===== RULE 1: CHECK FLIGHT =====
    const hasFlightData = !!(flightContext.arrivalTime24 || flightContext.arrivalTime);
    const hasHotelData = !!(flightContext.hotelName || flightContext.hotelAddress);

    console.log(`[compile-day-schema] Day1: flight=${hasFlightData}, hotel=${hasHotelData}`);

    if (hasFlightData) {
      const arrival24 = flightContext.arrivalTime24 || normalizeTo24h(flightContext.arrivalTime!) || '18:00';
      const arrivalMins = parseTimeToMinutes(arrival24) ?? (18 * 60);

      const isMorningArrival = arrivalMins < (12 * 60);
      const isAfternoonArrival = arrivalMins >= (12 * 60) && arrivalMins < (18 * 60);

      const customsClearance = addMinutesToHHMM(arrival24, 60);
      const transferStart = addMinutesToHHMM(arrival24, 75);
      const transferEnd = addMinutesToHHMM(transferStart, 60);
      const hotelCheckIn = transferEnd;
      const settleInEnd = addMinutesToHHMM(hotelCheckIn, 30);
      const earliestSightseeing = addMinutesToHHMM(settleInEnd, 30);

      const hotelNameDisplay = flightContext.hotelName || 'Your Hotel';
      const hotelAddressDisplay = flightContext.hotelAddress || '';

      console.log(`[compile-day-schema] Day1 arrival at ${arrival24}: morning=${isMorningArrival}, afternoon=${isAfternoonArrival}`);

      const day1HasAllDayEvent = mustDoEventItems?.some(
        (item: any) => item.priority?.activityType === 'all_day_event'
      );

      if (day1HasAllDayEvent) {
        const allDayEvent = mustDoEventItems.find(
          (item: any) => item.priority?.activityType === 'all_day_event'
        );
        const eventName = allDayEvent?.priority?.title || 'Event';

        console.log(`[compile-day-schema] Day1 ALL-DAY EVENT: "${eventName}"`);

        dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
The traveler has an ALL-DAY EVENT today: "${eventName}".

⚠️ MODIFIED DAY 1 — USER HAS AN ALL-DAY EVENT:
The traveler has explicitly requested "${eventName}" as an all-day event on Day 1.
Do NOT follow the standard arrival-transfer-checkin sequence. Instead:

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry):
1. "Arrival at ${arrivalAirportDisplay}"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"

2. "Transfer to ${eventName}"
   - startTime: "${addMinutesToHHMM(arrival24, 30)}", endTime: "${addMinutesToHHMM(arrival24, 90)}"
   - category: "transit"
   - description: "Head directly to the event from the airport."
   - tips: "Bag storage: Most major venues and transit hubs have luggage storage services (like LuggageHero or Bounce). Store your bags before the event and pick them up on the way to the hotel."

3. "${eventName}" (ALL-DAY EVENT)
   - This is the main activity. Schedule it for the appropriate duration after transfer.
   - category: appropriate category for the event

4. "Transfer to ${flightContext.hotelName || 'Hotel'}"
   - startTime: after the event ends (estimate based on event duration + 30 min)
   - category: "transit"
   - description: "Head to the hotel after the event"

5. "Check-in at ${flightContext.hotelName || 'Your Hotel'}"
   - startTime: 30 minutes after transfer starts
   - category: "accommodation"
   - description: "Late check-in after a full day at ${eventName}. Drop bags, freshen up."
   - location: { name: "${flightContext.hotelName || 'Hotel'}", address: "${flightContext.hotelAddress || ''}" }
   - tags: ["check-in", "late-checkin", "structural"]
   - ⚠️ THIS IS REQUIRED. Do NOT skip this activity. The traveler MUST check in to their hotel.

6. Dinner (if time permits — only add if check-in ends before 21:30)

⚠️ IMPORTANT CONSTRAINTS:
- The traveler CHOSE to go directly to the event. Respect this choice.
- Do NOT add a hotel check-in BEFORE the event.
- Do NOT generate a separate "Airport Transfer to Hotel" activity before the event.
- Activities 4 and 5 (transfer + hotel check-in) are MANDATORY after the event. The traveler needs to get to their hotel.

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
      } else if (isMorningArrival) {
        if (hasHotelData) {
          dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is a MORNING ARRIVAL - the traveler has likely been traveling overnight.

TRAVELER CONTEXT:
- The traveler has been on a long flight and may have jet lag
- They need to clear customs/immigration (estimate: 1 hour)
- Consider their energy level when planning activities

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at ${arrivalAirportDisplay}" 
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"
   - ⚠️ This MUST be its own activity block — do NOT merge with check-in

2. "Check-in at ${hotelNameDisplay}"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - description: "Check in, freshen up, and get oriented to the area"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

Do NOT generate an "Airport Transfer to Hotel" activity — the transfer is handled by a separate UI widget.

MORNING ARRIVAL GUIDELINES:
- After checking in (${settleInEnd}), the traveler may want a light breakfast or brunch near the hotel
- Consider their Travel DNA for pace preference - some may want to rest first, others to explore
- Start with LOW-ENERGY activities: a café, a leisurely neighborhood walk, or a nearby park
- Build energy throughout the day - save more intensive sightseeing for afternoon
- The traveler has a FULL DAY ahead - pace activities appropriately
- Earliest sightseeing/exploration: ${earliestSightseeing}

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
        } else {
          dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is a MORNING ARRIVAL - the traveler has likely been traveling overnight.

The traveler has NOT selected a specific hotel yet. Use "Your Hotel" as the placeholder name.
Still include hotel check-in and return-to-hotel activities using "Your Hotel" — these will be updated with the real hotel name once selected.

TRAVELER CONTEXT:
- The traveler has been on a long flight and may have jet lag
- They need to clear customs/immigration (estimate: 1 hour)

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry):
1. "Arrival at ${arrivalAirportDisplay}" 
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"

2. "Check-in at Your Hotel"
   - startTime: "${addMinutesToHHMM(arrival24, 90)}", endTime: "${addMinutesToHHMM(arrival24, 120)}"
   - category: "accommodation"
   - description: "Check in and freshen up"
   - location: { name: "Your Hotel" }

MORNING ARRIVAL GUIDELINES:
- After check-in, the traveler may want a light breakfast or brunch near the hotel
- Start with LOW-ENERGY activities: a café, a leisurely neighborhood walk, or a nearby park
- Build energy throughout the day - save more intensive sightseeing for afternoon
- Earliest sightseeing/exploration: ${earliestSightseeing}

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
        }
      } else if (isAfternoonArrival) {
        if (hasHotelData) {
          dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is an AFTERNOON ARRIVAL.

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at ${arrivalAirportDisplay}"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"
   - ⚠️ This MUST be its own activity block — do NOT merge with check-in

2. "Check-in at ${hotelNameDisplay}"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - description: "Check in and freshen up"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

Do NOT generate an "Airport Transfer to Hotel" activity — the transfer is handled by a separate UI widget.

AFTERNOON ARRIVAL GUIDELINES:
- After check-in (${settleInEnd}), plan 1-2 light activities
- Focus on the hotel neighborhood - nearby exploration, a café, or a walk
- End the day with a nice dinner near the hotel
- Earliest exploration: ${earliestSightseeing}
- Save major attractions for full days

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
        } else {
          dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is an AFTERNOON ARRIVAL.

The traveler has NOT selected a specific hotel yet. Use "Your Hotel" as the placeholder name.
Still include hotel check-in and return-to-hotel activities using "Your Hotel" — these will be updated with the real hotel name once selected.

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry):
1. "Arrival at ${arrivalAirportDisplay}"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - description: "Clear customs and collect luggage"

2. "Check-in at Your Hotel"
   - startTime: "${addMinutesToHHMM(arrival24, 60)}", endTime: "${addMinutesToHHMM(arrival24, 90)}"
   - category: "accommodation"
   - description: "Check in and freshen up"
   - location: { name: "Your Hotel" }

AFTERNOON ARRIVAL GUIDELINES:
- After check-in, plan 1-2 light activities
- Focus on the hotel neighborhood - nearby exploration, a café, or a walk
- End the day with a nice dinner near the hotel
- Earliest exploration: ${earliestSightseeing}
- Save major attractions for full days

DO NOT plan activities before ${arrival24}. The day starts when the plane lands.`;
        }
      } else {
        // Evening arrival
        dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (${flightContext.arrivalTime || arrival24}).
This is an EVENING ARRIVAL - limited time for activities today.

REQUIRED ACTIVITY SEQUENCE (in exact order — each MUST be a SEPARATE activity entry, NEVER combine into one):
1. "Arrival at ${arrivalAirportDisplay}"
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - ⚠️ This MUST be its own activity block — do NOT merge with check-in

2. "Check-in at ${hotelNameDisplay}"
   - startTime: "${hotelCheckIn}", endTime: "${settleInEnd}"
   - category: "accommodation"
   - location: { name: "${hotelNameDisplay}", address: "${hotelAddressDisplay}" }

Do NOT generate an "Airport Transfer to Hotel" activity — the transfer is handled by a separate UI widget.

EVENING ARRIVAL GUIDELINES:
- Day 1 should ONLY include:
  * The 2 arrival activities above
  * OPTIONALLY: One dinner near the hotel (if time permits and traveler isn't exhausted)
- The traveler needs rest after a long journey
- NO intensive sightseeing on an evening arrival
- Maximum 3 activities total including the required sequence

DO NOT plan activities before ${arrival24}.`;
      }
    } else if (hasHotelData) {
      // No flight, hotel provided — assume 09:00 arrival with transfer
      const defaultArrival = '09:00';
      const transferEnd = addMinutesToHHMM(defaultArrival, 45);
      const checkinEnd = addMinutesToHHMM(transferEnd, 30);
      const earliestActivity = addMinutesToHHMM(checkinEnd, 15);

      console.log(`[compile-day-schema] Day1: hotel provided, no flight — default arrival at ${defaultArrival}`);

      dayConstraints = `
ARRIVAL DAY — NO FLIGHT DETAILS PROVIDED:
- Hotel: ${flightContext.hotelName}
- Address: ${flightContext.hotelAddress || 'Address on file'}

The traveler has not provided flight details. Assume a morning arrival at approximately ${defaultArrival}.

REQUIRED OPENING SEQUENCE (in this exact order):
1. "Arrival" 
   - startTime: "${defaultArrival}", endTime: "${addMinutesToHHMM(defaultArrival, 15)}"
   - category: "travel"
   - description: "Arrive at destination."

2. "Transfer to ${flightContext.hotelName}"
   - startTime: "${addMinutesToHHMM(defaultArrival, 15)}", endTime: "${transferEnd}"
   - category: "transport"
   - description: "Travel from arrival point to hotel."
   - location: { name: "${flightContext.hotelName}", address: "${flightContext.hotelAddress || 'Hotel Address'}" }

3. "Check-in at ${flightContext.hotelName}"
   - startTime: "${transferEnd}", endTime: "${checkinEnd}"
   - category: "accommodation"
   - description: "Check in and drop bags. Early check-in often available on request."
   - location: { name: "${flightContext.hotelName}", address: "${flightContext.hotelAddress || 'Hotel Address'}" }

DAY 1 GUIDELINES:
- After check-in (${checkinEnd}), plan a full day of activities starting from ${earliestActivity}
- Include a "Return to Hotel" activity around 15:00-15:30 for official check-in/freshen up if the day is long enough
- The traveler is free to explore all day after dropping bags
- End with dinner

Start the day at ${defaultArrival} with the arrival sequence.`;
    } else {
      // No flight, no hotel — assume 09:00 arrival with placeholder hotel
      console.log(`[compile-day-schema] Day1: no flight AND no hotel — default arrival at 09:00`);

      dayConstraints = `
ARRIVAL DAY — NO FLIGHT OR HOTEL DETAILS PROVIDED

The traveler has not specified flight or hotel details.
Use "Your Hotel" as a placeholder name for accommodation activities — these will be updated with the real hotel name once selected.
Assume a morning arrival at approximately 09:00.

REQUIRED OPENING SEQUENCE (in this exact order):
1. "Arrival"
   - startTime: "09:00", endTime: "09:15"
   - category: "travel"
   - description: "Arrive at destination."

2. "Transfer to Your Hotel"
   - startTime: "09:15", endTime: "09:45"
   - category: "transport"
   - description: "Travel from arrival point to hotel."
   - location: { name: "Your Hotel" }

3. "Check-in at Your Hotel"
   - startTime: "09:45", endTime: "10:15"
   - category: "accommodation"
   - description: "Check in and get settled."
   - location: { name: "Your Hotel" }

STRUCTURE:
4. After check-in, plan a full day of activities starting from 10:30
5. Include a "Freshen up at Your Hotel" break mid-afternoon
6. End with dinner

Start the day at 09:00 with the arrival sequence.`;
    }
  } else if (isLastDay || resolvedIsLastDayInCity) {
    // ===== LAST DAY / LAST DAY IN CITY: DEPARTURE LOGIC =====
    const isMidTripCityDeparture = resolvedIsLastDayInCity && !isLastDay;
    const isNonFlightDeparture = isMidTripCityDeparture && resolvedNextLegTransport && resolvedNextLegTransport !== 'flight';

    if (isNonFlightDeparture) {
      // Strip return flight data to prevent prompt conflict
      flightContext = { ...flightContext, returnDepartureTime: undefined, returnDepartureTime24: undefined, latestLastActivityTime: undefined };
      if (flightContext.context) {
        flightContext.context = flightContext.context.replace(/🚨 LAST DAY TIMING CONSTRAINT:[\s\S]*?(?=\n={5,}|\n🚨|$)/, '');
      }

      const td = resolvedNextLegTransportDetails || {};
      const modeLabel = resolvedNextLegTransport.charAt(0).toUpperCase() + resolvedNextLegTransport.slice(1);
      const depTime = td.departureTime || '10:30';
      const depStation = td.departureStation || `${modeLabel} Station`;
      const carrier = td.carrier ? ` (${td.carrier})` : '';
      const hotelNameDisplay = flightContext.hotelName || 'Your Hotel';

      const depMins = parseTimeToMinutes(depTime) ?? (10 * 60 + 30);
      const checkoutMins = Math.max(depMins - 90, 7 * 60);
      const calculatedCheckout = `${String(Math.floor(checkoutMins / 60)).padStart(2, '0')}:${String(checkoutMins % 60).padStart(2, '0')}`;
      const leaveForStationMins = Math.max(depMins - 45, checkoutMins + 15);
      const leaveForStation = `${String(Math.floor(leaveForStationMins / 60)).padStart(2, '0')}:${String(leaveForStationMins % 60).padStart(2, '0')}`;
      const breakfastEnd = `${String(Math.floor(Math.max(checkoutMins - 30, 7 * 60) / 60)).padStart(2, '0')}:${String(Math.max(checkoutMins - 30, 7 * 60) % 60).padStart(2, '0')}`;
      const breakfastStart = `${String(Math.floor(Math.max(checkoutMins - 90, 7 * 60) / 60)).padStart(2, '0')}:${String(Math.max(checkoutMins - 90, 7 * 60) % 60).padStart(2, '0')}`;

      console.log(`[compile-day-schema] NON-FLIGHT departure: ${resolvedNextLegTransport}, dep=${depTime}, station=${depStation}, to=${resolvedNextLegCity}`);

      dayConstraints = `
=== DEPARTURE DAY: ${modeLabel.toUpperCase()} TO ${(resolvedNextLegCity || 'NEXT CITY').toUpperCase()} ===

⚠️ THIS IS NOT A FLIGHT DEPARTURE. DO NOT mention airports, flights, boarding gates, or security checkpoints.
The traveler departs by ${modeLabel}${carrier}.

🚆 CONFIRMED ${modeLabel.toUpperCase()} SCHEDULE:
- Departs: ${depTime} from ${depStation}${carrier}
- Destination: ${resolvedNextLegCity}
${td.duration ? `- Duration: ${td.duration}` : ''}

TIMELINE:
- Breakfast: ${breakfastStart} - ${breakfastEnd}
- Hotel Checkout: ${calculatedCheckout}
- Leave for ${depStation}: ${leaveForStation}
- Board ${modeLabel}: ${depTime}

DEPARTURE DAY ACTIVITIES: 1-2 maximum (breakfast + farewell only)

REQUIRED SEQUENCE:
1. "Breakfast at ${flightContext.hotelName || 'hotel'}" — at the hotel's own restaurant, NEVER at a different hotel
   - startTime: "${breakfastStart}", endTime: "${breakfastEnd}"
   - category: "dining"
   - Near hotel

2. "Hotel Checkout"
   - startTime: "${calculatedCheckout}", endTime: "${addMinutesToHHMM(calculatedCheckout, 15)}"
   - category: "accommodation"
   - location: { name: "${hotelNameDisplay}" }

3. "Transfer to ${depStation}"
   - startTime: "${leaveForStation}", endTime: "${addMinutesToHHMM(depTime, -10)}"
   - category: "transport"
   - description: "Travel to ${depStation} for ${modeLabel} departure"

4. "${modeLabel} to ${resolvedNextLegCity}"
   - startTime: "${depTime}"
   - category: "transport"
   - description: "Board ${modeLabel}${carrier} to ${resolvedNextLegCity}"

⚠️ DO NOT schedule sightseeing or major activities. This is a departure day.
⚠️ DO NOT mention airports or flights — the traveler is taking a ${modeLabel}.
⚠️ CHECKOUT MUST happen BEFORE transfer to station. This is auto-enforced.
THE TRAVELER IS LEAVING BY ${modeLabel.toUpperCase()}. Keep it simple.`;

    } else {
      // ===== FLIGHT-BASED DEPARTURE =====
      const hasReturnFlight = !!(flightContext.returnDepartureTime || flightContext.returnDepartureTime24);
      const hasHotelData = !!(flightContext.hotelName || flightContext.hotelAddress);

      console.log(`[compile-day-schema] LastDay: returnFlight=${hasReturnFlight}, hotel=${hasHotelData}, transfer=${airportTransferMinutes}min`);

      if (hasReturnFlight) {
        const departure24 = flightContext.returnDepartureTime24 || normalizeTo24h(flightContext.returnDepartureTime!) || '12:00';
        const departureMins = parseTimeToMinutes(departure24) ?? (12 * 60);

        const checkInBuffer = 180;
        const transferBuffer = airportTransferMinutes + 30;
        const totalBufferMins = checkInBuffer + transferBuffer;

        const leaveHotelBy = addMinutesToHHMM(departure24, -totalBufferMins);
        const hotelCheckout = addMinutesToHHMM(leaveHotelBy, -30);
        const airportArrival = addMinutesToHHMM(departure24, -checkInBuffer);
        let latestSightseeing = addMinutesToHHMM(hotelCheckout, -60);

        const hotelNameDisplay = flightContext.hotelName || 'Your Hotel';

        const isEarlyFlight = departureMins < (12 * 60);
        const isMidDayFlight = departureMins >= (12 * 60) && departureMins < (15 * 60);
        const isAfternoonFlight = departureMins >= (15 * 60) && departureMins < (18 * 60);

        console.log(`[compile-day-schema] Flight at ${departure24}: early=${isEarlyFlight}, midday=${isMidDayFlight}, afternoon=${isAfternoonFlight}`);

        if (isEarlyFlight) {
          dayConstraints = `
=== DEPARTURE DAY: EARLY FLIGHT (${departure24}) ===

Reality: An early flight means NO sightseeing activities possible.

Flight: ${departure24}
Airport transfer: ~${airportTransferMinutes} minutes
Leave hotel by: ${leaveHotelBy}

HARD CONSTRAINTS:
- Wake up, pack, and prepare for departure
- Breakfast at hotel ONLY if time permits
- Checkout: ${hotelCheckout}
- Leave for airport: ${leaveHotelBy}

DEPARTURE DAY ACTIVITIES: NONE or just breakfast

REQUIRED SEQUENCE:
1. "Wake up & Final Pack" (if including)
   - category: "personal"

2. "Hotel Checkout"
   - startTime: "${hotelCheckout}", endTime: "${addMinutesToHHMM(hotelCheckout, 15)}"
   - category: "accommodation"
   - location: { name: "${hotelNameDisplay}" }

3. "Transfer to Airport"
   - startTime: "${leaveHotelBy}", endTime: "${airportArrival}"
   - category: "transport"

4. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"
   - description: "Check-in, security, and boarding"

⚠️ DO NOT schedule sightseeing. This is logistics only.
THE TRAVELER IS LEAVING. Keep it stress-free.`;

        } else if (isMidDayFlight) {
          const breakfastStart = '08:30';
          const breakfastEnd = '09:30';
          const checkoutStart = addMinutesToHHMM(leaveHotelBy, -45);
          const checkoutEnd = addMinutesToHHMM(leaveHotelBy, -30);

          dayConstraints = `
=== DEPARTURE DAY: MIDDAY FLIGHT (${departure24}) ===

Flight: ${departure24}
Airport transfer: ~${airportTransferMinutes} minutes
Leave hotel by: ${leaveHotelBy}
Checkout by: ${checkoutEnd}

HARD CONSTRAINTS:
- Last activity must END by: ${latestSightseeing}
- After checkout, traveler HAS LUGGAGE
- All activities must be NEAR HOTEL (walking distance)

LUGGAGE REALITY:
- Store luggage at hotel after breakfast
- Do ONE nearby activity (10-15 min walk max from hotel)
- Return to collect luggage
- Leave for airport

DEPARTURE DAY ACTIVITIES: 1 maximum (near hotel only)

⚠️ CRITICAL SEQUENCE - CHECKOUT MUST HAPPEN BEFORE AIRPORT TRANSFER:
1. "Breakfast at ${flightContext.hotelName || 'hotel'}" — at the hotel's own restaurant, NEVER at a different hotel
   - startTime: "${breakfastStart}", endTime: "${breakfastEnd}"
   - category: "dining"
   - NEAR HOTEL

2. "Hotel Checkout & Luggage Storage"
   - startTime: "${checkoutStart}", endTime: "${checkoutEnd}"
   - category: "accommodation"
   - description: "Check out, store luggage with hotel"

3. ONE OPTIONAL light activity (if time permits):
   - Must be walking distance from hotel
   - Must END by ${latestSightseeing}
   - Example: "Final stroll through [neighborhood near hotel]"

4. "Collect Luggage & Transfer to Airport"
   - startTime: "${leaveHotelBy}", endTime: "${airportArrival}"
   - category: "transport"
   - description: "Collect bags from hotel and depart for airport"

5. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"
   - description: "Check-in, security, and boarding"

⚠️ DO NOT schedule activities across the city.
⚠️ DO NOT plan activities after ${latestSightseeing}.
⚠️ CHECKOUT (step 2) MUST have an earlier startTime than TRANSFER (step 4). This is auto-enforced by post-processing.
THE TRAVELER IS LEAVING. Make it a gentle goodbye, not a marathon.`;

        } else if (isAfternoonFlight) {
          const checkoutStart = addMinutesToHHMM(leaveHotelBy, -60);
          const checkoutEnd = addMinutesToHHMM(leaveHotelBy, -45);

          dayConstraints = `
=== DEPARTURE DAY: AFTERNOON FLIGHT (${departure24}) ===

Flight: ${departure24}
Airport transfer: ~${airportTransferMinutes} minutes
Leave hotel by: ${leaveHotelBy}
Checkout by: ${checkoutEnd}

HARD CONSTRAINTS:
- Last activity must END by: ${latestSightseeing}
- After checkout, traveler HAS LUGGAGE
- Stay in ONE AREA near hotel

LUGGAGE REALITY:
- Check out, store luggage with hotel
- Activities in hotel neighborhood ONLY
- No cross-city travel with bags

DEPARTURE DAY ACTIVITIES: 1-2 maximum (morning only, near hotel)

⚠️ CRITICAL SEQUENCE - CHECKOUT MUST HAPPEN BEFORE AIRPORT TRANSFER:
1. "Breakfast"
   - startTime: "08:30", endTime: "09:30"
   - Near hotel

2. ONE morning activity
   - Must be NEAR hotel (walking distance)
   - End by ${latestSightseeing}

3. "Light Lunch" (optional)
   - Near hotel or on way back

4. "Hotel Checkout & Collect Luggage"
   - startTime: "${checkoutStart}", endTime: "${checkoutEnd}"
   - category: "accommodation"
   - description: "Check out and collect stored luggage"

5. "Transfer to Airport"
   - startTime: "${leaveHotelBy}", endTime: "${airportArrival}"
   - category: "transport"

6. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"

⚠️ NO activities scheduled after ${latestSightseeing}.
⚠️ Stay near hotel. Do not go across the city.
⚠️ CHECKOUT (step 4) MUST have an earlier startTime than TRANSFER (step 5). This is auto-enforced by post-processing.
THE TRAVELER IS LEAVING. Make it relaxed.`;

        } else {
          // Evening flight
          const checkoutTime = '12:00';
          const checkoutEnd = '12:30';
          const collectLuggageStart = addMinutesToHHMM(leaveHotelBy, -30);
          latestSightseeing = addMinutesToHHMM(collectLuggageStart, -30);

          dayConstraints = `
=== DEPARTURE DAY: EVENING FLIGHT (${departure24}) ===

Flight: ${departure24}
Airport transfer: ~${airportTransferMinutes} minutes
Leave hotel by: ${leaveHotelBy}
Checkout: ${checkoutTime} (noon, standard checkout)

HARD CONSTRAINTS:
- Last activity must END by: ${latestSightseeing}
- After checkout, traveler HAS LUGGAGE
- Recommend luggage storage with hotel

EVENING DEPARTURE = MORE FLEXIBILITY, but still constrained

LUGGAGE REALITY:
- Check out at noon, store luggage with hotel
- All afternoon activities in ONE area (hotel neighborhood preferred)
- Return to hotel with time to spare
- Collect luggage and leave

DEPARTURE DAY ACTIVITIES: 2-3 maximum, but CONDENSED

⚠️ CRITICAL SEQUENCE - ALL ACTIVITIES MUST BE CHRONOLOGICALLY ORDERED:
1. "Breakfast"
   - startTime: "08:30", endTime: "09:30"
   - category: "dining"

2. Morning activity (can be 10-15 min from hotel)

3. "Hotel Checkout & Luggage Storage"
   - startTime: "${checkoutTime}", endTime: "${checkoutEnd}"
   - category: "accommodation"
   - description: "Check out and store luggage with hotel for afternoon activities"

4. "Lunch"
   - Near hotel
   - category: "dining"

5. ONE afternoon activity (optional)
   - Must stay in same area/neighborhood
   - Low-stakes (can be cut short if needed)

6. "Collect Luggage & Transfer to Airport"
   - startTime: "${collectLuggageStart}", endTime: "${airportArrival}"
   - category: "transport"
   - description: "Return to hotel, collect stored luggage, and head to airport"

7. "Departure"
   - startTime: "${airportArrival}", endTime: "${departure24}"
   - category: "transport"
   - description: "Check-in, security, and boarding"

⚠️ All activities after checkout must be in ONE area.
⚠️ Final activity should be LOW-STAKES (can be skipped if running late).
⚠️ No reservations that can't be cancelled.
⚠️ CHECKOUT must happen BEFORE luggage collection/transfer. This is auto-enforced by post-processing.
THE TRAVELER IS LEAVING. A gentle goodbye, not a marathon.`;
        }

      } else if (hasHotelData) {
        // No return flight, hotel provided
        const checkout = '11:00';

        let departureMode = 'airport';
        let departureLabel = 'Transfer to Airport';
        if (resolvedIsMultiCity && resolvedNextLegTransport) {
          const mode = resolvedNextLegTransport;
          if (mode === 'train') { departureMode = 'train station'; departureLabel = 'Transfer to Train Station'; }
          else if (mode === 'bus') { departureMode = 'bus station'; departureLabel = 'Transfer to Bus Station'; }
          else if (mode === 'ferry') { departureMode = 'ferry terminal'; departureLabel = 'Transfer to Ferry Terminal'; }
        }
        const destLower = (destination || '').toLowerCase();
        if (destLower.includes('venice') && departureMode === 'airport') {
          departureMode = 'train station (Santa Lucia) or airport (Marco Polo)';
          departureLabel = 'Departure Transfer';
        }

        dayConstraints = `
=== DEPARTURE DAY: NO FLIGHT DETAILS PROVIDED ===

⚠️ Plan a proper farewell morning — the traveler deserves closure, not an abrupt stop.

TIMELINE:
- Breakfast: 08:30 - 09:30
- Post-breakfast farewell activity: 09:30 - 10:30 (stroll, café, or nearby attraction)
- Hotel checkout: ${checkout}
- Farewell meal or final experience: 11:15 - 12:15
- ${departureLabel}: 12:30 onwards

DEPARTURE DAY ACTIVITIES: 2-3 activities (breakfast + 1-2 farewell experiences)

REALISTIC STRUCTURE:
1. "Breakfast at ${flightContext.hotelName || 'Your Hotel'}" — at the hotel's own restaurant, NEVER at a different hotel
   - 08:30 - 09:30
   - At hotel restaurant

2. "Farewell [stroll/café/experience] in [neighborhood]"
   - 09:30 - 10:30
   - Walking distance from hotel
   - A gentle goodbye to the city — NOT a major attraction

3. "Hotel Checkout"
   - startTime: "${checkout}", endTime: "11:15"
   - category: "accommodation"
   - location: { name: "${flightContext.hotelName || 'Your Hotel'}" }

4. "Farewell [meal type] at [specific restaurant]"
   - 11:15 - 12:15
   - A sit-down farewell meal near the hotel or en route to ${departureMode}
   - Pick a REAL, specific restaurant — not generic "farewell lunch"

5. "${departureLabel}"
   - startTime: "12:30"
   - category: "transport"
   - description: "Transfer to ${departureMode} for departure"

⚠️ All post-checkout activities must be NEAR the hotel or en route to departure.
⚠️ Final activity should be LOW-STAKES (can be skipped if running late).
⚠️ CHECKOUT must happen BEFORE departure transfer. This is auto-enforced by post-processing.

NOTE: Add your flight details to unlock more of the day if departing later.`;

      } else {
        // No flight, no hotel — use placeholder
        const destLowerNoHotel = (destination || '').toLowerCase();
        let genericDepartureHint = 'airport or station';
        if (destLowerNoHotel.includes('venice')) genericDepartureHint = 'Santa Lucia Station or Marco Polo Airport';

        dayConstraints = `
=== DEPARTURE DAY: NO FLIGHT OR HOTEL INFORMATION ===

Use "Your Hotel" as a placeholder name for accommodation activities — these will be updated with the real hotel name once selected.

⚠️ Plan a proper farewell morning — don't just stop mid-morning.

TIMELINE:
- Breakfast: 08:30 - 09:30
- Final farewell activity: 09:30 - 10:30
- Checkout from Your Hotel: 11:00
- Farewell meal or last experience: 11:15 - 12:00
- Departure Transfer: 12:30

DEPARTURE DAY ACTIVITIES: 2-3 activities (breakfast + 1-2 farewell experiences)

STRUCTURE:
1. "Breakfast"
   - 08:30 - 09:30

2. "Farewell [stroll/café] in [neighborhood]"
   - 09:30 - 10:30
   - Nearby, flexible, low-stakes

3. "Checkout from Your Hotel"
   - 11:00 - 11:15
   - category: "accommodation"
   - location: { name: "Your Hotel" }

4. "Farewell [meal] at [specific place]"
   - 11:15 - 12:00
   - A specific restaurant or café for a final meal

5. "Departure Transfer"
   - 12:30
   - category: "transport"
   - description: "Transfer to ${genericDepartureHint}"

⚠️ Last scheduled activity ends by 12:30 PM.
⚠️ Keep the morning light and stress-free but NOT empty.
⚠️ Include a REAL farewell meal — not just "departure preparation."

Add your flight and hotel details for a more complete last day.`;
      }
    } // end else (flight-based departure)
  }

  // ===== MULTI-CITY: Per-City Boundary Constraints =====
  if (resolvedIsMultiCity) {
    const mcHotelName = resolvedHotelOverride?.name || flightContext.hotelName || 'Hotel';

    if (paramIsFirstDayInCity && !isFirstDay && !paramIsTransitionDay) {
      dayConstraints += `\n\n🏨 CITY ARRIVAL — CHECK-IN DAY:
- This is the first day in ${destination}. The traveler needs to check into "${mcHotelName}".
- REQUIRED: Include a "Check-in at ${mcHotelName}" activity (typically 30-60 min).
- Plan afternoon/evening activities after check-in, clustered near the hotel area.
- Use "${mcHotelName}" for ALL hotel references. Do NOT invent a different hotel.`;
    }

    if (resolvedIsLastDayInCity && !isLastDay && !(isLastDay || resolvedIsLastDayInCity)) {
      // NOTE: This block is now unreachable because resolvedIsLastDayInCity days enter the
      // departure-day prompt block above. Kept for safety.
      const nextTransport = resolvedNextLegTransport || 'flight';
      const nextCity = resolvedNextLegCity || 'the next destination';
      const transportLabel = nextTransport.toUpperCase();
      const isNonFlight = nextTransport !== 'flight';

      let departureFacility = 'airport';
      let departureInstructions = '';
      if (nextTransport === 'train') {
        departureFacility = 'train station';
        departureInstructions = `\n- REQUIRED: Include a "Transfer to Train Station" activity.\n- REQUIRED: Include a "${transportLabel} to ${nextCity}" departure activity as LAST.\n- ⚠️ DO NOT mention airports or flights.`;
      } else if (nextTransport === 'bus') {
        departureFacility = 'bus station';
        departureInstructions = `\n- REQUIRED: Include a "Transfer to Bus Station" activity.\n- REQUIRED: Include a "${transportLabel} to ${nextCity}" departure activity as LAST.\n- ⚠️ DO NOT mention airports or flights.`;
      } else if (nextTransport === 'ferry') {
        departureFacility = 'ferry terminal';
        departureInstructions = `\n- REQUIRED: Include a "Transfer to Ferry Terminal" activity.\n- REQUIRED: Include a "${transportLabel} to ${nextCity}" departure activity as LAST.\n- ⚠️ DO NOT mention airports or flights.`;
      } else if (nextTransport === 'car') {
        departureInstructions = `\n- REQUIRED: Include a "Drive to ${nextCity}" departure activity as LAST.\n- ⚠️ DO NOT mention airports or flights.`;
      }

      dayConstraints += `\n\n🏨 CITY DEPARTURE — CHECKOUT DAY:
- This is the LAST DAY in ${destination}. The traveler departs for ${nextCity} by ${transportLabel}.
- REQUIRED: Include "Hotel Checkout" activity in the morning.
- REQUIRED: Include a farewell meal after checkout.
- Use "${mcHotelName}" for the checkout activity.${isNonFlight ? departureInstructions : ''}`;
    }

    if (mcHotelName && mcHotelName !== 'Hotel') {
      dayConstraints += `\n\n🏨 ACCOMMODATION: "${mcHotelName}" — use this name for ALL hotel references. Do NOT substitute a different hotel name.`;
    }
  }

  return { dayConstraints, flightContext };
}
