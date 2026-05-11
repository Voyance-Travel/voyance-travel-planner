# Hotel-Return Bookend — Edge-Case Hardening

## Problem

`runStep8` (universal-quality-pass.ts:94) only injects the "Return to hotel" bookend when the last activity's `end_time` parses to 14:00–23:59 (or post-midnight nightlife). When the last card has missing/malformed `end_time` or ends before 14:00, it silently bails — last card on the day is left as e.g. an early lunch with no hotel return. Save-time net at action-save-itinerary.ts:435 calls the same `runStep8` and inherits the gap.

## Changes

### 1. `supabase/functions/generate-itinerary/universal-quality-pass.ts` — `runStep8`

Add an `endTime` derivation fallback before the parse at line 110:

- If `lastActivity.end_time` / `endTime` is missing or unparseable, derive from `startTime` + duration:
  - parse `activity.duration` ("90 min", "1h30", "1:30", bare minutes number) or `activity.durationMinutes`
  - if still nothing, default to `startTime + 60min`
- If `startTime` is also missing/unparseable, treat the synthesized end as the day's empirical floor: `max(last_known_time across day, 19:00)`.

Widen acceptance:

- Standard 14:00–23:59 zone unchanged.
- Late-nightlife 00:00–02:55 bleed unchanged.
- NEW: if end_time was synthesized (not from real LLM data) AND this is the terminal card of the day AND not airport/STAY/return, still inject — clamp synthesized start ≥ 19:00, end via existing `clampBookendEndTime`.
- Log: `[QUALITY] Day X: hotel return injected with synthesized end_time (was unparseable)`.

Keep existing skip guards: airport/station/terminal/gate logistics tail, STAY/accommodation, existing return-to-hotel title.

### 2. `supabase/functions/generate-itinerary/action-save-itinerary.ts` — save-time net (line ~423)

After the existing `runStep8` call:

- If `acts.length` unchanged AND last activity is not STAY/accommodation/airport/return, log:
  `[SAVE_QUALITY] day=N WARNING: bookend injection skipped despite non-terminal last activity "<title>" end="<endTime>"`
- This is a monitoring signal only — no behavioral change.

### 3. New test `supabase/functions/generate-itinerary/__tests__/bookend-edge-cases.test.ts`

Covers:
- Last activity with no `end_time` → bookend injected (synthesized)
- Last activity ending 13:45 → bookend injected (early-close case)
- Last activity = airport transit on departure day → NO bookend
- Last activity already STAY/accommodation → NO duplicate bookend

Mirrors style of existing `hotel-return-bookend.test.ts` and `late-nightlife-source-survival.test.ts`.

## Out of Scope

- No changes to `clampBookendEndTime`, predawn-strip, ghost filter, or save-time `terminalCleanup`.
- No prompt changes — pure post-gen safety net.
- No memory rule rewrite (existing Day-End Hotel-Return Bookend memory still accurate; this widens the "no end_time / pre-14:00" leak path it implicitly covered via `runStep8`).

## Verification

- `grep -n "synthesized end_time\|bookend injection skipped" supabase/functions/generate-itinerary/` → ≥2 hits.
- New deno test passes (4 cases).
- Re-run any prior failing trip → terminal card on every non-departure day = "Return to <hotel>".
