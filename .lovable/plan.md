## Problem

Freshen-up cards meant to bridge afternoon → dinner are landing **after** dinner in the day sequence. Confirmed in production (Lisbon trip Day 2):

```text
16:48–17:03  Taxi to Four Seasons          (hotel arrival)
19:00–20:15  Dinner: Belcanto
20:03–20:33  Freshen Up at Four Seasons    ← inverted
20:33–20:47  Travel to wine bar
22:03–23:03  Wine tasting
23:18–00:47  Return to Four Seasons
```

Bruges Day 2 shows the related overlap variant (freshen-up 17:10–19:10 overlapping a 19:00 dinner). Both reads as incoherent — a freshen-up that follows dinner has no narrative purpose.

## Root cause

`repair-day.ts` has three independent freshen-up insertion paths (case 1 at line ~4341, case 1b at line ~4377, and check-in dedup at line ~1850). After they run, later passes (meal-guard, dinner-tier swaps, cost repair, transit cascade, save-time normalize) can:

1. Inject a dinner card whose start time is **earlier** than an already-placed freshen-up's end time (overlap).
2. Inject a freshen-up at the wrong array index when the prior hotel-related transport sits before dinner — the cap-to-90 / clamp passes don't re-evaluate position relative to the day's last meal.
3. Leave a freshen-up after dinner when a late-evening anchor (wine bar, ceremony) is added by ledger-check post-dinner — the freshen-up gets retimed to bridge into the wine-bar instead of being dropped.

There is no single pass that asserts the **invariant**: every freshen-up card must (a) sit before the day's dinner in array order and (b) end at or before `dinnerStart − transit`.

## Fix

### 1. New `enforceFreshenUpPosition` pass (shared)

Add `supabase/functions/_shared/freshen-up-position.ts` exporting `enforceFreshenUpPosition(activities, { dayNumber, hotelName, hotelCoordinates, isFastPaced, lockedIds })` that:

- Identifies freshen-up cards by `MIDDAY_ACCOM_RE` (already defined in `universal-quality-pass.ts`; promote to shared).
- Identifies the day's terminal dinner by `(category==='dining') && /\b(dinner|evening meal)\b/i`.
- For each non-locked freshen-up:
  - **Drop** if it appears after the dinner card in array order **and** there is already a hotel-related transport (taxi/walk to hotel) within ~120 min before dinner. The taxi already covers the "got back to hotel" moment.
  - Otherwise **reposition + retime**: move it to immediately before the dinner card; clamp `endTime ≤ dinnerStart − hotelToDinner`; clamp `startTime = endTime − min(30, freshenCapMin)`; if the resulting window collides with the previous activity, drop instead of squeeze.
  - If freshen-up overlaps dinner (endTime > dinnerStart) and is already array-before dinner: clamp endTime to `dinnerStart − hotelToDinner`; if remaining duration < 15 min, drop.
- Returns `{ activities, repairs }` with structured `[FRESHEN_UP_POSITION]` log lines and a `MEAL_TIMING` failure code for telemetry.

### 2. Wire the pass at every persistence boundary

Call `enforceFreshenUpPasition` after the existing freshen-up cap pass, in this order:

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — append after the freshen-cap loop (~line 2668) and again after step §15z departure-day enforcement so late ledger-check additions are caught.
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — inside `runStep8` finalize (so the bookend/return-to-hotel pass sees a coherent sequence) and at the trip-wide finalization loop.
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — inside `normalizeDays` per-day loop (catches client edits, undo/redo, refresh-day saves, optimistic patches).

All four call sites use the same shared helper — single source of truth.

### 3. Backfill legacy trips

Add a one-shot scrub to `action-save-itinerary.ts` that runs on every save (no separate migration). The pass is idempotent — already-correct days are no-ops. Lisbon and Bruges trips will self-heal on the next save/refresh.

### 4. Regression tests

`supabase/functions/_shared/__tests__/freshen-up-position.test.ts`:

- **Lisbon-pattern**: dinner at 19:00, taxi-to-hotel at 16:48, late wine bar at 22:03 — freshen-up injected at 20:03. Expect: dropped (taxi already covered hotel arrival).
- **Bruges-pattern**: freshen-up 17:10–19:10 overlapping dinner 19:00. Expect: endTime clamped to 18:45, duration shrinks from 120 → 95 min.
- **Happy path**: freshen-up 18:15–18:45 before dinner 19:00. Expect: untouched.
- **Locked exemption**: locked freshen-up after dinner is preserved.
- **Fast-paced day**: existing 30-min cap behavior preserved.

### 5. Memory update

Add `mem://constraints/itinerary/freshen-up-must-precede-dinner` and reference it in the index Core block alongside the existing "Believable Human Day" rule.

## Files to edit

- **NEW** `supabase/functions/_shared/freshen-up-position.ts`
- **NEW** `supabase/functions/_shared/__tests__/freshen-up-position.test.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/universal-quality-pass.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `mem://constraints/itinerary/freshen-up-must-precede-dinner` (new)
- `mem://index.md` (add Core line + Memories entry)

## Out of scope

- Not changing the LLM prompt — the prompt-side rule already exists; this is a deterministic post-pass safety net.
- Not touching the case 1 / 1b injection logic itself (it's correct in isolation; the bug is composability with later passes).
- Not refactoring the four existing freshen-cap call sites — only adding the new position-enforcer after them.
