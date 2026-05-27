# Suppress redundant hotel-return after late check-in

## Problem

Day 1 ends like this:

```
22:25–22:55  Check in at Hotel Arts Barcelona     (accommodation)
22:55–23:20  Return to Your Hotel                 (synthetic bookend)
```

The bookend is meant to gracefully close the day at the hotel. When the day's last activity is already a hotel check-in (or any other "we are at the hotel for the night" event) happening in the evening, adding a second hotel card immediately after is nonsensical.

## Root cause

`runStep8` in `supabase/functions/generate-itinerary/universal-quality-pass.ts` and `ensureHotelReturnBookend` in `src/lib/itinerary/ensureHotelReturnBookend.ts` both classify `check-in / settle-in / luggage-drop / freshen-up` strictly as **midday accommodation rituals** (`MIDDAY_ACCOM_RE`) and never let them satisfy the bookend. That rule was added to fix Bruges "Freshen Up at The Notary 17:45" — but it overshoots when the check-in is genuinely the terminal evening event (late arrival flights).

## Fix

Treat a late-evening hotel **check-in** as a valid terminal accommodation card — same as "Return to Hotel" — so the synthetic bookend is skipped.

### 1. `supabase/functions/generate-itinerary/universal-quality-pass.ts` — `runStep8`

In the `alreadyReturn` computation, add a third branch:

- Detect "check-in / checkin / settle in / drop bags / luggage drop / bag drop" at the trip's hotel.
- If that card's `startTime` ≥ 20:00 (configurable threshold; matches the late-arrival window) **and** its category is `STAY`/`ACCOMMODATION` (or its title contains the hotel name), set `alreadyReturn = true` with `reason=late_evening_checkin`.
- Log via the existing `[BOOKEND_TRACE]` sentinel.

### 2. `src/lib/itinerary/ensureHotelReturnBookend.ts` — read-time mirror

Apply the same exception in `isTerminalHotelCard` (and the helper that gates the synthetic injection): a `MIDDAY_ACCOM_RE`-matching card whose start ≥ 20:00 AND category is `STAY`/`ACCOMMODATION` counts as terminal. This keeps FE display consistent with BE persistence and prevents post-load reinjection.

### 3. Tests

- Extend `supabase/functions/generate-itinerary/__tests__/hotel-return-bookend.test.ts`:
  - Day with terminal "Check in at Hotel Arts Barcelona 22:25–22:55" → no bookend injected (`reason=late_evening_checkin`).
  - Day with midday "Freshen Up at The Notary 17:45–19:30" still injects bookend (regression guard).
  - Day with afternoon "Check-in at Hotel X 15:00" followed by dinner → bookend still fires after dinner (check-in isn't terminal).

### 4. No DB migration

The §3b arrival-flight reconcile from prior turns will heal new trips on save. For already-persisted trips, the next save (any edit) re-runs `runStep8` via `enforceTimingAndBuffers` and the read-time guard hides the ghost immediately on next load. No one-shot SQL needed.

## Out of scope

- The underlying "check-in at 22:25" is itself a symptom of the prior walk-to-hotel cascade (already addressed). This plan is specifically about removing the duplicate bookend regardless of why check-in lands late.
