

# Flight Intelligence Pipeline — Continuation

## Summary
Three remaining tasks: (1) fix the build error and thread `flightIntelligence` through `FlightHotelStep`, (2) persist it to the database on trip insert, and (3) wire it into the itinerary generation pipeline.

---

## Task 1: Fix Build Error and Thread Props (Start.tsx)

**Problem:** `FlightHotelStep` references `setFlightIntelligence` at line 1673 but it's defined in the parent `Start()` component (line 1950), not inside `FlightHotelStep`.

**Fix:**
- Add `onIntelligenceCapture` callback prop to `FlightHotelStep`'s props interface (around line 952)
- Pass `setFlightIntelligence` from `Start()` into `FlightHotelStep` at the call site (around line 2528)
- Inside `FlightHotelStep`, change the `FlightImportModal`'s `onIntelligence` callback to use the new prop instead of directly calling `setFlightIntelligence`

**File:** `src/pages/Start.tsx`

---

## Task 2: Persist `flight_intelligence` on Trip Insert (Start.tsx)

**Problem:** The `handleSubmit` function (line 2144) inserts into `trips` but never includes `flight_intelligence`.

**Fix:**
- In the `.insert({...})` call around line 2146-2172, add:
  ```
  flight_intelligence: flightIntelligence || null,
  ```
- The column already exists from the migration created in the previous session

**File:** `src/pages/Start.tsx`

---

## Task 3: Build `buildFlightIntelligencePrompt()` in prompt-library.ts

**Problem:** The itinerary generator has no awareness of flight intelligence data (layovers, availability windows, missing legs).

**Fix:** Add a new exported function `buildFlightIntelligencePrompt(intelligence)` that takes the intelligence JSON and returns a prompt string with:

- **FLIGHT-AWARE SCHEDULING** section: For each destination in `destinationSchedule`, emit `availableFrom` / `availableUntil` constraints, first/last destination notes
- **LAYOVER EXCLUSIONS** section: For each layover, emit "Do NOT schedule activities in {city} during layover"
- **MISSING LEG HANDLING** section: For each missing leg, emit "Leave travel day flexible" instruction
- **TRAVEL INTEL COVERAGE** section: List all destination cities that need Travel Intel

Returns empty string if intelligence is null/undefined (backward compatible).

**File:** `supabase/functions/generate-itinerary/prompt-library.ts`

---

## Task 4: Read and Inject Intelligence in generate-itinerary/index.ts

**Fix in `getFlightHotelContext()` (line 2762):**
- Expand the `.select()` to also fetch `flight_intelligence`
- Return `rawFlightIntelligence` alongside existing return values

**Fix in Stage 1.4 area (around line 7077):**
- Import `buildFlightIntelligencePrompt` from prompt-library
- After building `promptFlightData`, call `buildFlightIntelligencePrompt(flightHotelResult.rawFlightIntelligence)`
- Inject the resulting prompt string into the context so it flows into day generation prompts

**File:** `supabase/functions/generate-itinerary/index.ts`

---

## Task 5: Pass Intelligence from itineraryAPI.ts

**Problem:** The `generateItinerary` function in `itineraryAPI.ts` calls the edge function per-day but doesn't include flight intelligence.

**Fix:**
- After fetching trip details (line 264), read `flight_intelligence` from the trip record
- Include `flightIntelligence: trip.flight_intelligence` in the body of each `supabase.functions.invoke('generate-itinerary', { body: {...} })` call (line 304)

**File:** `src/services/itineraryAPI.ts`

---

## Task 6: Deploy and Verify

- Deploy `parse-booking-confirmation` and `generate-itinerary` edge functions
- Verify backward compatibility (trips without intelligence still generate normally)

---

## Sequencing

1. Fix build error: thread `onIntelligenceCapture` prop through `FlightHotelStep` (Task 1)
2. Persist `flight_intelligence` in trip insert (Task 2)
3. Add `buildFlightIntelligencePrompt()` to prompt-library (Task 3)
4. Update `generate-itinerary/index.ts` to read and inject intelligence (Task 4)
5. Update `itineraryAPI.ts` to pass intelligence in request body (Task 5)
6. Deploy edge functions (Task 6)

