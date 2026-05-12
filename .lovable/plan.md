## Plan

1. **Unify hotel-return detection**
   - Add one shared frontend helper in `ensureHotelReturnBookend.ts` that recognizes all hotel-return shapes already used elsewhere:
     - `Return to Your Hotel`
     - `Return to <real hotel name>`
     - `Back/head back/wind down/retire/end of day at <hotel>`
     - accommodation/stay cards tagged as generated bookends
   - Use this before read-time injection so the UI never appends a second synthetic return when a persisted return already exists earlier in the day order.

2. **Deduplicate at display parse time**
   - In `src/utils/itineraryParser.ts`, after ghost filtering and before read-time injection, remove duplicate non-locked hotel-return bookends per day.
   - Keep the chronologically latest return card, preserve any locked/manual/user card, and never drop real checkout or departure logistics.
   - This protects hard refresh even if old duplicate rows are already persisted in `trips.itinerary_data`.

3. **Harden backend save-time dedupe**
   - In `action-save-itinerary.normalizeDays`, add the same non-destructive duplicate hotel-return sweep after sorting/clamping.
   - This prevents duplicates from being written back on the next save and fixes legacy trips over time.

4. **Add regression coverage**
   - Add/extend tests for:
     - persisted `Return to <Hotel Name>` plus read-time injection should result in one card.
     - departure-day airport/flight card should suppress all synthetic hotel-return injection.
     - locked/manual hotel returns are preserved and not silently removed.

5. **Validate with focused checks**
   - Run the relevant parser/unit tests only.
   - Use browser console/preview logs to confirm no `[BOOKEND_TRACE] readtime action=injected` appears for a day that already has a return card.