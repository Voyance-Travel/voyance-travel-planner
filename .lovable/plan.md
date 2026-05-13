# Fix: Hotel return missing when nightcap is added AFTER an existing bookend

## Root cause (verified against Casablanca trip DB)

Casablanca Day 2 ends:
- `20:15–20:40` `accommodation` — **Return to Casablanca Marriott Hotel** (existing bookend)
- `23:29–23:44` `dining` — **Nightcap at La Sqala** (added later, no following return card)

Two suppression sites prevent the late-nightlife bookend from appearing:

1. **Read-time (`src/lib/itinerary/ensureHotelReturnBookend.ts:166`)** — the early
   `activities.some(isHotelReturnBookendActivity)` short-circuit returns immediately
   on the 20:15 STAY card and never reaches the wrap-aware "is the chronological
   tail terminal?" check. Result: parser never appends a 23:54 → 02:55 late-nightlife
   bookend even though `last` (the 23:29 nightcap) clearly qualifies. This is the
   exact same logic flaw that produced the Mallorca and San Juan misses.

2. **Write-time (`runStep8` in `universal-quality-pass.ts`)** — `runStep8` *itself*
   would handle this correctly (its wrap-unaware max picks 23:44 > 20:40), but it
   only runs during full-day generation and the post-meal-guard retry. Chat-added
   activities (`itineraryActionExecutor`) and ad-hoc edits that extend the day past
   an existing bookend never re-trigger it, so the DB stays sparse and the read-time
   net is the only thing left — and it's currently broken (#1).

## Fix

### 1. `src/lib/itinerary/ensureHotelReturnBookend.ts`
Drop the eager `activities.some(isHotelReturnBookendActivity)` early-return. The
existing post-selection `isTerminalAlready(last)` check (after the wrap-aware
`lastIdx` walk) already handles the legitimate "day truly ends on a hotel return"
case; the early `some()` only fires the false-positive when an earlier bookend is
later trumped by a real activity (nightcap, late dinner, user-added).

Add a new `[BOOKEND_TRACE] reason=stale_earlier_bookend_superseded` log so we can
see in production when a Day-N late activity overrides an earlier bookend.

### 2. Save/normalize-time net (`supabase/functions/generate-itinerary/action-save-itinerary.ts`)
In the per-day `normalizeDays` loop (after timing cascade, before persist), run
`runStep8` once when the chronologically-last non-locked card is **after** an
existing bookend on the same day. This catches:
- Chat-added late nightcaps
- User-added late activities
- Any post-generation mutation that extends the day

Sentinel: `[BOOKEND_VERIFY] day=N reason=late_addition_after_bookend appended=…`.

### 3. Persisted clean-up (one-shot, optional)
Backfill is unnecessary — read-time fix #1 makes existing trips render correctly
on next mount. Save-time fix #2 makes the next save persist the new bookend.

### 4. Tests
- `ensureHotelReturnBookend.test.ts` — new case: existing 20:15 STAY return + 23:29
  nightcap (Casablanca shape). Assert a second `late_nightlife_bookend` card is
  appended at 23:54-ish.
- `late-nightlife-source-survival.test.ts` — extend with the
  "earlier-bookend + later-nightcap" shape so the survival contract covers it.
- New `action-save-itinerary` test for the normalize-time `runStep8` re-trigger.

### 5. Memory
Update `mem://constraints/itinerary/late-nightlife-hotel-return` and
`mem://constraints/itinerary/read-time-hotel-return-bookend` with the
"earlier-bookend-doesn't-suppress" rule, and add the recurring Casablanca/Mallorca/
San Juan reproduction to the index Core line so this regression class stays loud.

## Files to change

- `src/lib/itinerary/ensureHotelReturnBookend.ts` (drop eager early-return)
- `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts` (new case)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (normalize-time runStep8 re-trigger)
- `supabase/functions/generate-itinerary/__tests__/late-nightlife-source-survival.test.ts` (extend)
- `supabase/functions/generate-itinerary/__tests__/hotel-return-bookend.test.ts` (new save-time case)
- `mem://constraints/itinerary/late-nightlife-hotel-return`
- `mem://constraints/itinerary/read-time-hotel-return-bookend`
- `mem://index.md`

## Out of scope

- No prompt changes (the model already correctly omits a second bookend when an
  earlier one exists; we want the deterministic engine to append it post-hoc).
- No removal of the now-stale earlier 20:15 return — that's a UI-visible mutation
  better handled in a follow-up that also re-times it as a "freshen up" if needed.
