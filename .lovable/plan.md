# Post-Arrival Hotel-Return Loop — Plan

## Problem

On arrival day, the AI sometimes emits a generic "Return to Your Hotel" card *after* the check-in block. Today the Executioner's `enforceImpossibleLogistics` only catches airport-transfer loops via `isAirportTransfer(a)`; a hotel-return card (category=accommodation/logistics, title like "Return to your hotel", no airport keywords) slips through. Upstream, the arrival-day prompt in `flight-hotel-context.ts` tells the AI to budget 4h for "transport to hotel, check-in" but never asserts "you are now at the hotel — do not emit a return-to-hotel step."

This is the same class of bug as the airport-loop fix, just for a different card shape.

## Fix (3 layers, no behavior change for legitimate end-of-day bookends)

### 1. Executioner: extend Pass 5(a) to catch hotel-return loops
**File:** `supabase/functions/_shared/schedule-executioner.ts`

- Add a local `isHotelReturnCard(a)` helper that matches the same brand-aware pattern already used by `clamp-bookend.ts::isBookendCard` / `hideGhostActivities.ts` (title regex `^(return|head back|back) to (the |your )?(hotel|HOTEL_BRAND_RE|<ctx.hotelName>)`, category in {accommodation, logistics, transit, return}, NOT a meal/sightseeing).
- Inside the `enforceImpossibleLogistics` loop, after the existing `isAirportTransfer` branch, add:
  - **Day 1 only**, after `firstCheckinIdx >= 0`: any `isHotelReturnCard(a)` at index `i > firstCheckinIdx` AND whose `startTime` is **before 18:00** (i.e. not the legitimate end-of-day bookend) → drop with new code `HOTEL_RETURN_LOOP_DROPPED`.
  - User-owned / locked / `source` starting `bookend-*` or `late_nightlife_bookend` are exempt (mirrors existing guards). Source-tagged bookends are the read-time / save-time injection path — they're never loops.
- Add counter `hotelReturnLoopsDropped` to `ExecutionerCounters` and surface via `toExecutionerAuditCodes` as `EXEC_HOTEL_RETURN_LOOP_DROPPED`.

Net effect: after arrival check-in, a mid-afternoon "Return to hotel" plain card is dropped; the canonical end-of-day hotel-return bookend (≥19:00, `source:'bookend-*'`) is untouched.

### 2. Prompt: assert post-arrival location
**File:** `supabase/functions/generate-itinerary/flight-hotel-context.ts` (the arrival-day flight-info block ~line 368)

Append one explicit line after the existing "Allow 4 hours for: customs/immigration, baggage, transport to hotel, check-in" directive:

> "AFTER check-in the traveler IS AT THE HOTEL. Do NOT emit a 'Return to Hotel' or 'Head back to hotel' activity between check-in and the natural end-of-day bookend — they're already there. The only legitimate hotel-return card is the day's final bookend, which is injected automatically."

Pure prompt addition — no code-flow change.

### 3. Save-time net (defense-in-depth)
**File:** `supabase/functions/generate-itinerary/action-save-itinerary.ts` (existing `normalizeDays` pipeline)

Add a one-pass strip after `enforceDepartureDayLogistics` that, per day, drops any non-locked, non-bookend-source hotel-return card sitting BEFORE the day's last non-bookend activity. Sentinel: `[HOTEL_RETURN_LOOP_STRIP] day=N dropped=K`. This catches legacy persisted trips and any path that bypasses the Executioner (chat-applied edits, manual paste).

## Tests

**New:** `supabase/functions/_shared/__tests__/executioner-hotel-return-loop.test.ts`
- Day 1: `[Arrival transfer 14:00, Check-in 16:00, Return to hotel 17:30, Dinner 19:30, Return to JW Marriott 22:30 source=bookend-readtime]` → mid-day return dropped, bookend preserved.
- Day 1 luxury hotel brand: `Head back to Aman Venice 17:00` after `Check-in 16:30` → dropped.
- Locked `Return to hotel 17:00` (user-pinned) → preserved.
- Day 3 (middle): same card pattern with no check-in → NOT dropped by this rule (out of scope — handled elsewhere if at all).

## Out of scope

- Read-time bookend injection logic (already correct).
- Adding a `HOTEL_RETURN_LOOP` validation-gate code — Executioner drop + save-time net are sufficient; validation gate is for content quality, not logistics loops.
- Backfill of historical trips beyond what the save-time net already heals on next save.

## Files Touched

- `supabase/functions/_shared/schedule-executioner.ts` (helper + Pass 5a extension + counter)
- `supabase/functions/_shared/itinerary-integrity-contract.ts` (audit code mapping)
- `supabase/functions/generate-itinerary/flight-hotel-context.ts` (one prompt line)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (save-time strip)
- `supabase/functions/_shared/__tests__/executioner-hotel-return-loop.test.ts` (new)
- `mem/constraints/itinerary/` — new `post-checkin-hotel-return-loop.md` + `mem/index.md` link
