

## Departure Day Sequence Validator

### Problem
On departure days, the AI generates activities in broken sequence — checkout before breakfast, airport security before meals, nonsensical walking transports injected by the bookend validator. The AI prompt alone can't fix this reliably.

### Solution
Add a deterministic `validateDepartureDay()` function that runs AFTER generation/normalization but BEFORE the bookend validator (~line 10800 in `index.ts`).

### Implementation

**File: `supabase/functions/generate-itinerary/index.ts`**

#### 1. Helper: `isDepartureDay()`
Detects departure days by checking:
- `dayNumber === totalDays`, OR
- Activity array contains a flight card (category `flight`, or title matching `departure|heading home|flight home`)

#### 2. Core: `validateDepartureDay(generatedDay, options)`

Takes the generated day and an options object with `departureFlightTime24` (from `flightContext.returnDepartureTime24`), `hotelName` (from `paramHotelName`), and `isInternational` flag.

**Classification step** — categorizes each activity:
- `breakfast`: category dining + tags/title containing breakfast/morning meal
- `checkout`: title contains checkout/check-out
- `airport-transport`: category transport + title/location mentions airport
- `airport-security`: title contains security/departure/check-in at airport
- `flight`: category flight or title contains flight/departure flight
- `other`: everything else

**Rule application (in order):**

| Rule | Logic |
|------|-------|
| R1: Breakfast before checkout | If breakfast exists after checkout in array order, move breakfast before checkout. Set breakfast startTime = checkout.startTime - 60min, shift checkout accordingly. |
| R2: Airport security before flight only | Move "Airport Departure and Security" to immediately before the flight card. |
| R3: No activities after security | Any non-flight, non-transport activity after security → move before airport transport. If it's a meal at non-airport location, move before checkout. |
| R4: Single airport transport | Keep exactly one airport transport card, placed after last non-airport activity and before security. Remove duplicates and nonsensical transports (e.g. "Walk to HND" from a restaurant). |
| R5: Time window enforcement | Derive `arriveAirportBy = departureTime - 150min (intl) or 90min (domestic)`. Derive `latestCheckout = arriveAirportBy - transportDuration - 30min`. Remove excess activities between checkout and airport transport that don't fit. |
| R6: Breakfast location | If breakfast is on departure day and location doesn't match hotel name/neighborhood, override location to "near [hotelName]" or "at [hotelName]". |

**Time derivation** — all times derived from `departureFlightTime24`:
- Airport buffer: 150min (international) / 90min (domestic)
- Transport duration: use existing transport card's duration or default 45min
- Breakfast: 60min before checkout
- Checkout: 30min before airport transport start

#### 3. Integration Point

Insert at ~line 10800, after personalization validation and before the bookend validator:

```text
// After normalizedActivities is finalized (~line 10799)

if (isLastDay && generatedDay.activities?.length > 0) {
  validateDepartureDay(generatedDay, {
    departureFlightTime24: flightContext.returnDepartureTime24,
    hotelName: paramHotelName,
    isInternational: /* derived from flight data or default true */,
  });
  normalizedActivities = generatedDay.activities;
}

// Existing bookend validator (~line 10801)
```

Variables already in scope at this location: `isLastDay`, `dayNumber`, `totalDays`, `flightContext` (with `returnDepartureTime24`), `paramHotelName`, `generatedDay`, `normalizedActivities`.

#### 4. Logging
All fixes logged with `[departure-validator]` prefix for debugging:
```
[departure-validator] 🔄 Moved breakfast before checkout on Day 5
[departure-validator] 🔄 Moved airport security to pre-flight position
[departure-validator] 🗑️ Removed nonsensical transport "Walk to HND"
[departure-validator] ✓ Day 5 departure sequence validated (3 fixes applied)
```

### Expected Result
```
7:00 AM  — Breakfast at hotel or nearby
8:00 AM  — Hotel Checkout
8:15 AM  — Transport to Airport
         — Airport Departure and Security
10:45 AM — Flight
```

### Files Changed
- `supabase/functions/generate-itinerary/index.ts` — add `isDepartureDay()`, `validateDepartureDay()`, and integration call

