## Why some days don't end with "Return to Hotel"

Pulled the last 4 trips from the database. The newest (Bali) has bookends on every non-departure day. The older 3 (Seoul + 2 Bruges trips) don't — they were generated **before** the recent `runStep8` hardening shipped (14:00 floor + save-time safety net + late-nightlife branch). On disk those days simply don't have a hotel-return card.

There's also one edge case the current generator still misses: a day whose last activity ends **after 02:30** (e.g. Seoul Day 1 ended at 02:50 — outside both the standard 14:00–23:59 window and the late-nightlife 00:00–02:30 cap). `runStep8` correctly refuses to fabricate a bookend in that gray zone, so the day ships without one.

The generator pipeline is right. We just need a **read-time** safety net so existing trips and gray-zone days still display a hotel-return card to the user.

## What to build

### 1. Read-time hotel-return injector (frontend, non-destructive)

New helper `ensureHotelReturnBookend(activities, opts)` in `src/lib/itinerary/`, called from `parseItineraryDays` right after `filterGhostActivities`. Pure display-layer — never writes to DB.

Behavior (mirrors `runStep8` exactly so we don't conflict with existing rules):

- **Skip** if departure day (last activity is a flight/airport transfer, or `isLastDay` flag set)
- **Skip** if the day is empty
- **Skip** if the last card is already a true hotel return (`TRUE_RETURN_RE` / `CHECKOUT_RE` / `STAY` / `ACCOMMODATION` minus midday `freshen-up|luggage drop|check-in`) — same predicate as `runStep8`
- **Skip** locked / user / manual / extracted / pinned terminal cards (universal locking)
- Otherwise inject a synthetic card:
  - `title: "Return to {hotelName}"` (resolved from trip metadata `selected_hotel.name` / `hotel.name` / `accommodation.name`, fallback `"Return to Your Hotel"`)
  - `startTime` = clamp(lastEnd + 15min, 19:00, 23:30) for the 14:00–23:59 window; for 00:00–02:30 late-nightlife tail, place 25 min after lastEnd capped at 02:55
  - For the **gray-zone edge case** (lastEnd between 02:31 and 13:59): use the **next morning** assumption — render as "Return to {hotel} (overnight)" anchored at lastEnd + 25 min, no time clamping. This handles Seoul Day 1's 02:50 finish.
  - `category: 'accommodation'`, `cost: 0`, `source: 'bookend-readtime'`, `synthetic: true`
  - Description: brief turn-by-turn-friendly copy ("Head back to {hotel} for the night.") so the directions are useful, per the user's request.

### 2. UI marker for synthetic cards (subtle)

In `EditorialItinerary.tsx` activity card render, when `source === 'bookend-readtime'`, render with the same hotel-return styling as today but suppress edit/lock/cost actions (it's display-only). No new visual treatment beyond the existing hotel-return card style — keeps the UI calm.

### 3. Make `runStep8` cover the 02:31–13:59 gray zone going forward

In `supabase/functions/generate-itinerary/universal-quality-pass.ts` `runStep8`, extend the synthesis fallback so when `endMinsParsed` falls in 02:31–13:59 (currently silently rejected), we still emit a bookend at `lastEnd + 25min` with `source: 'bookend-overnight'`. Same brand-aware ghost-filter exemption as `late_nightlife_bookend`.

### 4. Optional one-shot backfill (deferred, ask before running)

A migration/script that re-applies `runStep8` to every existing trip's `itinerary_data.days` and writes back via `safeUpdateItineraryData` (so it goes through `persistTripItinerary` and respects the no-regression guard). I'd rather **not** ship this in the same pass — the read-time injector solves the user-visible symptom immediately without touching persisted data. We can run the backfill after we've verified the read-time net behaves on your live trips.

## Files touched

- `src/lib/itinerary/ensureHotelReturnBookend.ts` — new helper
- `src/utils/itineraryParser.ts` (or wherever `parseItineraryDays` lives) — call new helper after `filterGhostActivities`
- `src/components/itinerary/EditorialItinerary.tsx` — minimal render guard for `source === 'bookend-readtime'`
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — extend `runStep8` synthesis to cover 02:31–13:59 gray zone, emit `source: 'bookend-overnight'`
- `src/lib/itinerary/hideGhostActivities.ts` — add `'bookend-overnight'` and `'bookend-readtime'` to the source allowlist (alongside `late_nightlife_bookend`)
- Tests:
  - `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts` — covers all 4 reproduced cases (Bruges Day 1 nightcap 22:36, Bruges Day 1 nightcap 00:16, Bruges Day 2 dinner 20:15, Seoul Day 1 02:50), departure-day skip, locked-skip, idempotency
  - Extend `bookend-edge-cases.test.ts` for the new 02:31–13:59 branch

## Memory updates

- New: `mem://constraints/itinerary/read-time-hotel-return-bookend` — describes the read-time injector, source tags `bookend-readtime` / `bookend-overnight`, and that it's display-only
- Update Core "Believable Human Day" to note the read-time net exists for legacy trips and gray-zone end times

## Out of scope (per user)

- No changes to the regression-overwrite guard, departure-day enforcement, freshen-up positioning, validation gates, or any other existing itinerary rule
- No backfill migration in this pass (proposed as a follow-up)
