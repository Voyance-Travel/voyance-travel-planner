Plan for M2 departure-day logistics fix:

1. Add a deterministic departure-day enforcement pass in `supabase/functions/generate-itinerary/pipeline/repair-day.ts`.
   - Run it after existing repair/injection passes and before final validation/gate output.
   - Treat checkout and airport/station transfer as hard structural anchors.
   - Preserve locked/manual/extracted/pinned activities.

2. Replace the late-checkout behavior.
   - Current logic can anchor checkout from `departureTime - 210`, which produces afternoon/evening checkouts for late flights.
   - New rule: checkout must be no later than 11:00, and also early enough for transfer + airport/station buffer.
   - Existing checkout cards get retimed; missing checkout cards get inserted.
   - Normalize checkout duration to 30 minutes.

3. Fix departure transfer scheduling.
   - If a real departure time exists, schedule the transfer backwards from the airport/station arrival deadline using `airportTransferMinutes` when available, otherwise a safe default.
   - Existing untimed/generic transfer placeholders are retimed instead of left unscheduled.
   - Missing transfer cards are inserted only when there is a real flight/intercity departure time.
   - If there is no flight/transport time on the final day, use a simple default checkout at 11:00 and do not create a generic `Departure Transfer` / `Transfer to Airport` placeholder.

4. Enforce the departure barrier.
   - After the transfer card, remove any non-logistics generated activity.
   - After checkout, only allow logistics/departure cards unless the activity is locked/manual/user-owned.
   - This blocks Madrid-like departure-day late dinners or evening freshen-up cards from surviving.

5. Strengthen prompt instructions where departure-day copy is assembled.
   - Update the last-day rule from the vague `Checkout → Transfer → Departure` instruction to explicit timing: checkout by 11:00, transfer backwards from departure, no leisure/dinner after airport/station transfer, and no transfer placeholder when no departure time is known.

6. Add regression tests.
   - Flight at 13:30: checkout around 10:00–10:30, airport transfer scheduled before the airport-arrival deadline, and no post-transfer activity.
   - No flight info: checkout at 11:00 and no airport transfer placeholder.
   - Late-night dinner/freshen-up on departure day: removed when after airport transfer.

Technical notes:
- I’ll keep the implementation inside the existing repair pipeline rather than creating a separate generation path.
- I’ll reuse `parseTimeToMinutes`, `minutesToHHMM`, `addMinutesToHHMM`, `airportTransferMinutes`, and the existing lock-preservation conventions.
- I’ll add a sentinel repair action/log such as `enforced_departure_day_logistics` so future regressions are easy to trace.