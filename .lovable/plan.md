# Fix: Day 1 starts at 12:15 AM with phantom "Return to Hotel"

## Root cause

Two cooperating bugs in `supabase/functions/generate-itinerary/pipeline/repair-day.ts`:

1. **Midnight wrap in `offset()`** (line 3409–3415) uses `% 24`, so when the end-of-day "Return to Hotel" injection is computed against a late activity (e.g. nightcap ending 23:55), `offset(et, 20)` produces `00:15` — silently rolling into the next calendar day.

2. **Morning phantom strip skips Day 1 when no check-in exists.** The `MORNING PHANTOM STRIP` block (line 3468+) on Day 1 only strips hotel-accommodation cards that appear **before** the check-in index. If `day1CheckInIdx < 0`, the condition `(!isFirstDay || (day1CheckInIdx >= 0 && firstRealIdx < day1CheckInIdx))` evaluates false and the phantom 00:15 "Return to Your Hotel" survives. (Same gap also lets phantoms leak when a previous day's wrapped 00:15 return ends up serialized as the first item of the next day.)

Result: Day 1 = `[00:15 Return to Your Hotel] → transit → 09:45 Luggage Drop → ...`

## Changes (one file)

`supabase/functions/generate-itinerary/pipeline/repair-day.ts`

### 1. Cap `offset()` against midnight wrap
Change the helper used by the bookend injectors so a return-to-hotel time can never land in the next calendar day. If `tot >= 24*60`, clamp to `23:45` (and let downstream gap logic skip rather than wrap). Optionally return a sentinel that the two injection sites (line ~3633 freshen-up, line ~3686/3687 end-of-day return) check, and **abort the injection** instead of producing a 00:15 card.

### 2. Strip pre-dawn hotel phantoms unconditionally
In the `MORNING PHANTOM STRIP` block (line 3472+), add a rule that runs **regardless of Day 1 / check-in state**: if the first non-transport activity is hotel-related accommodation **and** its `startTime` is before `05:00`, strip it (and any preceding transport-to-hotel card). This is the same behavior the hotel-change branch already uses at line 3492–3494, generalized.

This catches:
- Day 1 with no check-in (current bug)
- Any day where a previous-session phantom or wrap-around return leaked to the top
- Avoids regressing legitimate early-morning checkouts (those are caught by `isCheckinOrCheckout` exclusion already in the surrounding `if`)

### 3. Add a regression test
Add a fixture-style unit test under `supabase/functions/generate-itinerary/` that feeds a Day 1 starting with a `00:15 Return to Your Hotel` accommodation card and asserts the repair pass removes it. Mirrors existing test files in that folder (e.g. `ledger-check.test.ts`).

## Verification

1. Deploy `generate-itinerary`.
2. Re-run the failing Venice itinerary; confirm Day 1 first item is the morning anchor (Caffè Florian / Luggage Drop), not a 00:15 hotel return.
3. Check edge function logs for new repair codes: `stripped_morning_hotel_phantom` should fire on the regression input; no `injected_hotel_return` should produce a `00:xx` startTime.

## Out of scope

- The 401/502 self-chain auth fix from the previous turn stays as-is.
- No prompt changes — this is purely the deterministic repair pass.
