---
name: Post-checkin hotel-return loop
description: Day-1 mid-day "Return to Hotel" cards after check-in are dropped — they're already at the hotel
type: constraint
---

**Closes:** AI emits "Return to your hotel" / "Head back to [hotel/brand]" mid-afternoon on arrival day after the check-in card — the traveler is already there.

**3-layer defense:**

1. **Executioner Pass 5(a-bis)** (`_shared/schedule-executioner.ts::enforceImpossibleLogistics`): new `isHotelReturnCard(a, hotelName)` + drop branch on Day 1 when `i > firstCheckinIdx`, `startMin < 18:00`, and row is NOT source-tagged `bookend-*` / `late_nightlife_bookend`. New counter `hotelReturnLoopsDropped` + audit code `EXEC_HOTEL_RETURN_LOOP_DROPPED`. Issue code `HOTEL_RETURN_LOOP_DROPPED`. Sentinel `[EXECUTIONER] HOTEL_RETURN_LOOP_DROPPED day=N title="…" start=HH:MM`.

2. **Arrival-day prompt** (`generate-itinerary/flight-hotel-context.ts` ~L420): explicit "POST-CHECKIN LOCATION" directive telling the model the traveler IS AT THE HOTEL after check-in and must not emit a return-to-hotel card between check-in and the natural wind-down.

3. **Save-time net** (`_shared/strip-hotel-return-loop.ts` wired in `action-save-itinerary.ts::normalizeDays`): mirrors Executioner logic for paths that bypass it (legacy persisted trips, chat-applied edits, manual paste). Sentinel `[HOTEL_RETURN_LOOP_STRIP] day=N dropped=K`.

**Exemptions (all 3 layers):** locked / user-added / manual / extracted / pinned / booked / `source` starting `bookend-` / `late_nightlife_bookend`. Bookend source tag wins regardless of clock — those rows are the read-time / save-time injection path, never a loop.

**Tests:** `supabase/functions/_shared/__tests__/executioner-hotel-return-loop.test.ts` (mid-day drop + evening bookend preserved, branded-hotel via `hotelName` ctx, user-pinned preserved, middle-day no-op, bookend-source exemption).
