## Plan

Fix the post-airport hotel-return regression by adding a focused departure-day scrub instead of relying only on prevention.

1. **Add a shared frontend detector**
   - Identify generated hotel-return/bookend cards by `source`, `tags`, read-time id prefix, accommodation category + return/wind-down title, and the exact “wind down (overnight)” description shape.
   - Identify departure terminals using the existing flight / airport / terminal / station / checkout signals.

2. **Strip impossible departure-day hotel returns at parse time**
   - In `parseItineraryDays`, after departure-day detection and before returning parsed days, remove non-locked hotel-return/bookend cards from the detected departure day.
   - This directly covers the observed Osaka / Amsterdam / Sapporo shape: a `bookend-overnight` “Return to hotel” at ~13:55 after an airport transfer.
   - Keep locked/user/manual/extracted/pinned hotel rows untouched.

3. **Harden editor-side synthetic departure filters**
   - In `EditorialItinerary`, replace the current narrow read-time-bookend checks with the same detector so generic accommodation “Return to hotel / wind down at hotel” rows are removed when a final departure card is inserted.
   - This handles cases where the card did not carry the expected `bookend-*` source/tag metadata.

4. **Add regression coverage**
   - Add/extend frontend tests for `parseItineraryDays` or `ensureHotelReturnBookend` showing a final day with checkout + airport transfer + ~13:55 “Return to Hotel … wind down (overnight)” returns without that card.
   - Include a non-departure control so legitimate end-of-day hotel returns still appear on normal days.

5. **Validate only the targeted path**
   - Run the focused test file(s) for the parser/bookend logic.
   - No database migration is needed; this is a frontend display/scrub fix.