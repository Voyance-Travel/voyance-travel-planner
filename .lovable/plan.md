# Day 2 ghost return — bookend bleeds past midnight (23:45 → 12:44 AM)

## What the user sees

Day 2 ends with:

```
…last activity ends 23:45
23:45 → 12:44 AM   Return to JW Marriott Venice Resort & Spa   (59 min)
```

The card starts in-bounds (23:45) but its `endTime` is past midnight, so the UI renders "12:44 AM" — a Day-3-territory bleed and the same shape of bug as the prior pre-dawn ghosts.

## Root cause (single hole, three exits)

There are three independent "drop past 23:30" passes, and **all three explicitly exempt hotel-return / freshen-up / check-in cards from the cutoff**:

1. `supabase/functions/_shared/timing-cascade.ts:286-302` — `isEndOfDayBookend` exempts hotel-return from the past-midnight drop.
2. `supabase/functions/generate-itinerary/pipeline/repair-day.ts:2786-2808` — same exemption (`'return to' / 'freshen up' / 'check-in'`).
3. `supabase/functions/generate-itinerary/pipeline/repair-day.ts:2885-2904` — same exemption after duration enforcement.

The exemption is correct in principle (we want a bookend even at 23:30+), but **none of these passes ever clamps the bookend's `endTime` to ≤ 23:59**. Combined with:

- `runStep8` in `universal-quality-pass.ts` only caps end at 23:59 for cards *it* injects — not for cards already in the array.
- `makeAccomCard` (`repair-day.ts:3424`) builds a return card with raw `offset(st, dur)` — no upper clamp on the result.
- The minimum-duration cascade (`repair-day.ts:2811-2864`) skips `accommodation`, but the **buffer / overlap cascade** can still shift a bookend's `startTime` later, leaving the original `durationMinutes` intact and computing `endTime = start + dur` past midnight.

So a card that the AI emitted with `start=23:45, dur=59` (or one that got pushed from 23:00 → 23:45 by an earlier overlap cascade while keeping its 59-min duration) survives every cutoff and prints "12:44 AM".

The pre-dawn UI scrubber (`src/lib/itinerary/hideGhostActivities.ts`) doesn't catch this either — it only hides 00:00-04:59 *start times*, not late-night cards whose **end** crosses midnight.

## Fix — clamp the bookend window everywhere it's exempted

Single shared helper + three call sites, plus a UI safety net that mirrors the existing pre-dawn scrubber.

### Layer 1 — Shared `clampBookendEndTime` helper (new)

New file `supabase/functions/_shared/clamp-bookend.ts`:

- `clampBookendEndTime(act, { latestEnd = '23:59' })`:
  - Identifies hotel-return / freshen-up / check-in cards by the same regex/category set already used in the three exemption blocks.
  - If `endTime > latestEnd`, sets `endTime = latestEnd`, recomputes `durationMinutes` from `(end - start)`, and if the new duration drops below 5 min, also pulls `startTime` back to `latestEnd - 15` (preserves a visible 15-min bookend).
  - Returns a structured result so callers can log a single `[BOOKEND_CLAMP]` line for observability.
- `clampAllBookends(activities, ctx)` — array helper that runs the above over an activity list and returns the count of clamps (for `metadata.quality.bookend_clamped_count`).

### Layer 2 — Wire into the three exemption sites

- `supabase/functions/_shared/timing-cascade.ts` — inside `isEndOfDayBookend`-exempt branch, call `clampBookendEndTime` before `return true`. Push a new repair `type: 'bookend_clamped'`.
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts:2786-2808` — same: clamp before the `return true` exemptions; push `repairs` entry `action: 'bookend_clamped_post_overlap'`.
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts:2885-2904` — same: clamp before exemption; push `action: 'bookend_clamped_post_duration'`.

### Layer 3 — Clamp at the bookend builders

- `repair-day.ts:3424 makeAccomCard` — wrap the computed `endTime` with the shared clamp so any newly-built return/freshen-up card is born in-bounds.
- `universal-quality-pass.ts:runStep8` — already caps at 23:59, but route through the shared helper so the regex stays in one place.

### Layer 4 — Final pre-persist sweep

- `supabase/functions/generate-itinerary/pipeline/persist-day.ts` — right next to the existing `stripPreDawnHotelReturns` call, run `clampAllBookends(normalizedActivities, { dayNumber, label: 'PERSIST' })` and `clampAllBookends(generatedDay.activities, { … })`. Persist `metadata.quality.bookend_clamped_count` on the day row when > 0.
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — same sweep at JSON snapshot time so legacy data flowing through save also gets fixed.

### Layer 5 — UI safety net (mirrors pre-dawn scrubber)

- `src/lib/itinerary/hideGhostActivities.ts` — extend `isGhostActivity` with a "post-midnight bleed" check:
  - If the card matches `HOTEL_RETURN_RE` AND its `endTime` parses past midnight (i.e. `endMins < startMins`, OR `endMins > 23*60+59`), treat as a ghost and hide.
  - Same source/lock exemption rules as today (never hide `is_locked`, `user`, `manual`, `extracted`, `pinned`).
- This mirrors the existing pre-dawn rule and means already-persisted trips heal on next render without a regen.

## Files to edit

- New: `supabase/functions/_shared/clamp-bookend.ts`
- Edit: `supabase/functions/_shared/timing-cascade.ts` (exemption branch)
- Edit: `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (two cutoff exemptions + `makeAccomCard`)
- Edit: `supabase/functions/generate-itinerary/universal-quality-pass.ts` (`runStep8` routes through helper)
- Edit: `supabase/functions/generate-itinerary/pipeline/persist-day.ts` (final sweep + metadata)
- Edit: `supabase/functions/generate-itinerary/action-save-itinerary.ts` (snapshot-time sweep)
- Edit: `src/lib/itinerary/hideGhostActivities.ts` (post-midnight bleed branch)
- New tests:
  - `supabase/functions/_shared/__tests__/clamp-bookend.test.ts` — start 23:45 + 59 min → end 23:59, dur 14 min; start 23:55 + 30 min → start pulled back to 23:44 to preserve a 15-min window; locked cards untouched.
  - `supabase/functions/generate-itinerary/__tests__/bookend-clamp-cascade.test.ts` — overlap-cascade pushes return from 23:00 to 23:45 → final endTime ≤ 23:59, count appears in repairs.

## Memory

- Update `mem://constraints/itinerary/dinner-required-defer-hotel-return` (or add sibling `mem://constraints/itinerary/bookend-clamp-end-of-day`):
  - Hotel-return / freshen-up / check-in cards are exempted from the 23:30 drop in three places — each exemption MUST run `clampBookendEndTime` so the card can never end past 23:59.
  - `metadata.quality.bookend_clamped_count` and `repair.action='bookend_clamped_*'` are the regression sentinels.
- Update `mem://index.md` Ghost Activity Filter line to mention the post-midnight-bleed branch alongside the existing pre-dawn rule.
