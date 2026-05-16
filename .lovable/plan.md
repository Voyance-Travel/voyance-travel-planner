## Plan: stop duplicate hotel-return cards

1. **Make hotel-return dedupe destination-aware**
   - Update the shared hotel-return detection so generated rows like “Return to Imperial Riding School, Autograph Collection” are recognized even when the title does not literally contain “hotel”.
   - Match by return verbs plus accommodation category/source/tags/venue fields, not just brand keywords.

2. **Dedupe after read-time injection**
   - In the itinerary parser, run the hotel-return dedupe again after `ensureHotelReturnBookend(...)` appends a read-time card.
   - Keep only the chronologically latest generated hotel-return card, while preserving any true user/manual/locked rows.

3. **Persist-time cleanup parity**
   - Mirror the same broader detection in `action-save-itinerary` so duplicated hotel returns are removed before saving, not only hidden in the UI.

4. **Regression coverage**
   - Add/extend tests for the exact screenshot case: two generated “Return to Imperial Riding School, Autograph Collection” rows on the same day should display/persist as one.
   - Include a guard that a user/manual locked hotel return is not deleted.