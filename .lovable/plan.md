## Plan

1. **Fix the read-time hotel-return safety net**
   - Update `ensureHotelReturnBookend` so it identifies the true chronological terminal activity instead of trusting array order.
   - Move the terminal card to the tail before appending the hotel return, matching the backend `runStep8` behavior.
   - Remove the overly broad skip for terminal `source: "user"` / `manual` rows; the rule should preserve locked rows, but still append a return after a user-added dinner or activity.
   - Add explicit coverage for the reported cases:
     - Day ends at dinner around `23:13` → append `Return to {hotel}`.
     - Day has dinner at `21:49` followed by a stale `Travel to Parco Sempione` transport card → append return after the chronological tail so the visible day does not end at the park.

2. **Fix save-time hotel-return persistence parity**
   - Update backend `runStep8` to use the same lock semantics as the universal locking protocol: locked/pinned/manual activities are not modified or reordered, but they should not block appending a hotel return after them.
   - Ensure non-departure days always get a terminal hotel-return card after the latest non-departure activity when the last activity ends in the accepted evening window.
   - Keep departure-day behavior unchanged.

3. **Prevent stale post-dinner travel tails from becoming the final destination**
   - Add a targeted guard for terminal local transport/travel cards after dinner that point to a non-hotel venue.
   - The guard will not delete user-locked items; it will append the hotel return after them so the final visible destination is still the hotel.

4. **Add regression tests**
   - Extend `ensureHotelReturnBookend.test.ts` for:
     - Nabucco-style late dinner ending `23:13`.
     - Al Coniglio Bianco followed by `Travel to Parco Sempione` ending the day.
     - User-source/manual terminal dinner still receiving a hotel return.
     - Locked terminal rows remaining unmodified, with no reordering.
   - Add/extend backend tests around `runStep8` for the same terminal selection and lock-preservation behavior.

5. **Validate**
   - Run the relevant targeted tests only.
   - Confirm grep signals for the new regression cases and lock-safe behavior.