## Root cause

The truncated card title — `Return to Four Seasons Hotel Osaka for Check` — is produced by a single buggy regex inside the read-time hotel-return bookend resolver:

`src/lib/itinerary/ensureHotelReturnBookend.ts` line 106:
```
title.match(/^Return to\s+(.+?)(?:\s*[—-]|$)/i)
```

`(.+?)` is non-greedy and stops at the **first hyphen**. The Osaka trip contains an AI-generated transport card titled `Return to Four Seasons Hotel Osaka for Check-in` (the 17:20 arrival-day transfer the model mis-titled). When `extractHotelName` walks the activities, this regex captures `Four Seasons Hotel Osaka for Check` (everything up to the `-` in `Check-in`) and that becomes the hotel name used to build every subsequent synthetic bookend card.

That truncated hotel name then leaks into:
- The synthetic read-time bookend rendered at the end of normal days
- A bookend card the resolver still injects on the **departure day** at ~1:55 PM, because the chronologically-last activity (an airport transfer card whose title doesn't contain the word "airport"/"station"/"terminal"/"gate") slips past `isDepartureTerminal`, falling into the gray-zone branch (`lastEnd > 02:30 && lastEnd < 14:00`)
- The DB itself — Osaka has 8+ persisted copies of `Return to Four Seasons Hotel Osaka for Check`, meaning the synthetic card is leaking out of the read-time path into a save somewhere (likely via an editor/normalize round-trip that doesn't strip `synthetic:true` rows)

## Fix

### 1. Stop the truncation (`src/lib/itinerary/ensureHotelReturnBookend.ts`)

Rewrite `extractHotelName` so it never truncates on a hyphen and never picks up "for Check-in"/"for Check-out" suffixes the AI sometimes appends to a hotel name:

- Replace the `^Return to\s+(.+?)(?:\s*[—-]|$)` regex with one that stops only at the **end of the title**, an em/en dash with surrounding spaces (` — ` / ` – `), or a comma — and then strips a trailing ` for Check-?in` / ` for Check-?out` / ` for Checkout` / ` for arrival` / ` for departure` clause.
- Apply the same trailing-clause strip to the `^Checkout from …` branch.
- Skip candidates whose category is `transport`/`flight` (the 17:20 row is `transport`, not accommodation) — only trust accommodation/STAY rows or rows whose title genuinely starts with `Return to`/`Checkout from` AND has a clean hotel-shaped tail.
- Prefer `opts.hotelName` (already done) and skip extraction entirely when the trip metadata supplies the hotel.

### 2. Strengthen departure-day suppression (same file)

The Osaka departure day has `Transfer to Kansai International Airport (KIX)` (transport, contains "airport") — that *should* trigger the existing guard. But the 1:55 PM card shows the guard is being bypassed somewhere (likely the `Travel to <hotel>` card at 10:15–10:35 ends up as chronological last when the airport transfer time isn't parsed). Two changes:

- Broaden `isDepartureTerminal` to also recognise titles starting with `Transfer to … Airport`/`Taxi to … Airport`/`Drive to … Airport` regardless of category casing.
- Add a defensive check: if any card on the day is `category === 'flight'` AND its title starts with `Departure`, treat the whole day as a departure day even when `opts.isDepartureDay` is false (mirrors the existing `dayHasDepartureTerminal` helper but driven by category, not just title).
- Log a `[BOOKEND_TRACE] reason=gray_zone_skipped_departure_heuristic` sentinel when the new guard fires so we can see it in production.

### 3. Mirror the regex hardening in the parser (`src/utils/itineraryParser.ts`)

`dayHasDepartureTerminal` lives here too; same strengthening so the parser-level filter agrees with the resolver.

### 4. Backend parity sweep (`supabase/functions/generate-itinerary/universal-quality-pass.ts` + save path)

`runStep8` already takes a clean `hotelName` from trip metadata, so the backend doesn't truncate. But add a defensive scrub at the persist boundary in `supabase/functions/generate-itinerary/action-save-itinerary.ts` (`normalizeDays`): drop any synthetic accommodation row whose title matches `for Check$` (no `-in`/`-out` suffix) — these are unambiguously the truncation bug's output and should never live in the DB. Log `[SCRUB_TRUNCATED_BOOKEND] day=N count=K` per occurrence.

### 5. One-shot DB cleanup migration

A SQL migration that deletes `itinerary_activities` rows where `title LIKE '% for Check'` AND `category = 'accommodation'` (the unambiguous truncated-bookend signature). Restricted to `accommodation` so a real `Transfer to Hotel for Check-in` transport card is not touched.

### 6. Tests

- `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts` — add cases:
  - `Return to Four Seasons Hotel Osaka for Check-in` (transport row) MUST NOT be used as a hotel-name source; resolver must fall back to `opts.hotelName` or `Your Hotel`.
  - Departure day with `Transfer to Kansai International Airport (KIX)` as last card never injects a bookend even when `opts.isDepartureDay` is false.
  - When `opts.hotelName = 'Four Seasons Hotel Osaka'`, the injected bookend title is exactly `Return to Four Seasons Hotel Osaka` — no `for Check` suffix.
- `src/utils/__tests__/itineraryParser.test.ts` (or nearest) — add a `dayHasDepartureTerminal` case for the airport-transfer pattern above.

## Validation

- `bunx vitest run src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts src/utils/__tests__/itineraryParser*.test.ts`
- Inspect the Osaka trip in the preview: departure day should no longer show the 1:55 PM card; non-departure days should show `Return to Four Seasons Hotel Osaka` (no `for Check`).
- DB query after migration: `SELECT count(*) FROM itinerary_activities WHERE title LIKE '% for Check' AND category='accommodation'` returns 0.

## Scope guardrails

- Only changes the bookend resolver, parser helper, save-time scrub, and one cleanup migration. No changes to Health Engine, Payments, generation prompt, or unrelated cards.
- Synthetic cards remain display-only; the new save-time scrub is a one-line defense, not a behavioural change.