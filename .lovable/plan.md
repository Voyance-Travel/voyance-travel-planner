## Plan: make Step 2 flight times authoritative

### Goal
When a user enters flight times in Step 2, the itinerary should use the same destination-arrival and destination-departure times everywhere: fresh generation, post-generation edits, meal policy, transport cascade, and display.

### Root causes found
- Multi-city Step 2 accepts free-text times like `10:30 AM`, but some duration/normalization code only accepts `HH:MM`.
- `arrival.date` is not stored from Step 2, so overnight / +1 flights can be interpreted as same-day.
- Post-generation helpers duplicate leg-picking logic and sometimes fall back to `legs[0]` instead of the destination-arrival leg for 3+ legs.
- The immediate flight patch uses a 30-minute arrival buffer, while the cascade uses a larger airport buffer, making the itinerary appear to “jump” after saving.
- One fresh-generation path still relies on context flight data that appears not to be populated consistently from `trips.flight_selection`.

### Implementation steps

1. **Create one frontend flight timing utility**
   - Add shared helpers around `normalizeFlightSelection` for:
     - canonical 24h time parsing (`HH:MM`, `h:mm AM/PM`, ISO wall-clock strings)
     - destination-arrival leg selection
     - destination-departure leg selection
     - optional cross-day arrival detection
   - Keep user-entered wall-clock time intact conceptually; no timezone conversion.

2. **Preserve arrival dates from Step 2**
   - Add `arrivalDate?: string` to `ManualFlightEntry`.
   - In `Start.tsx`, store `arrival.date` on each `FlightLeg`.
   - For now, default `arrival.date` to `departureDate` when absent so existing form behavior stays stable.
   - In `MultiLegFlightEditor`, add an arrival-date field for ambiguous/overnight legs so users can explicitly set +1 arrivals.

3. **Fix time parsing in `normalizeFlightSelection`**
   - Update `parseDateTimeUTC` to parse both `HH:MM` and `h:mm AM/PM`.
   - Use `arrival.date` when present for outbound duration and return-arrival estimation.
   - Add tests for `10:30 AM`, `22:15`, overnight arrival dates, and estimated return arrival.

4. **Unify post-generation flight patch + cascade**
   - Refactor `flightItineraryPatch.ts`, `cascadeTransportToItinerary.ts`, and `recomputeDayModes.ts` to use the same destination-arrival/departure helpers instead of local `legs[0]` fallbacks.
   - Align the initial patch buffer with the cascade buffer so saving a flight does not apply two conflicting shifts.
   - Make `recomputeDayModes` treat cross-day inbound flights as applying arrival meal policy to the correct calendar day.

5. **Unify backend flight extraction**
   - Update `prompt-library.extractFlightData` and `action-generate-trip-day` hoisted clock extraction to use `_shared/flight-leg-pick.ts` instead of ad-hoc `legs[0]` / `last leg` reads.
   - Ensure saved metadata stamps `savedArrivalTime24` / `savedDepartureTime24` from the canonical picked legs.
   - Keep existing departure buffer rules intact.

6. **Patch in-itinerary flight edits**
   - Update `AddBookingInline.tsx` to write `arrival.date`, select the destination-departure leg for backward-compatible `return`, and reuse the same tagging/normalization rules as Step 2.

7. **Tests / validation**
   - Add focused tests for:
     - 3-leg route: Home → Hub → Destination → Home uses leg 2 arrival.
     - AM/PM Step 2 input survives normalization.
     - overnight arrival date does not shift Day 1 incorrectly.
     - `recomputeDayModes` uses the canonical destination-arrival leg.
     - post-generation flight patch and cascade agree on resulting time windows.

### Files likely touched
- `src/utils/normalizeFlightSelection.ts`
- `src/components/itinerary/AddBookingInline.tsx`
- `src/components/planner/flight/MultiLegFlightEditor.tsx`
- `src/pages/Start.tsx`
- `src/services/flightItineraryPatch.ts`
- `src/services/cascadeTransportToItinerary.ts`
- `src/lib/itinerary/recomputeDayModes.ts`
- `supabase/functions/_shared/flight-leg-pick.ts`
- `supabase/functions/generate-itinerary/prompt-library.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- targeted tests under `src/utils/__tests__` and/or existing itinerary test folders

### Non-goals
- No itinerary content redesign.
- No changes to flight booking/search providers.
- No automatic mutation of old frozen trips beyond normal user-triggered flight save/cascade behavior.