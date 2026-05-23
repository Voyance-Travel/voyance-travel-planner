# What's Still Broken After Anchor-Cleanup Fix

I swept the two newest "ready" trips (Milan `44a68e13`, Sao Paulo `db13fe14`). The anchor-duplication bug is gone, but the on-disk data exposes **four new classes of breakage** the pipeline is silently letting through. The chronology view says `0 issues` because it only checks strict reverse-order timestamps — overlaps and misplaced cards slip past.

## 1. Activity overlaps are not being detected at save time (Sao Paulo — severe)

```text
Day 1  Cathedral 11:55–13:10  ⟂  Lunch 12:30–13:30  ⟂  Taxi 13:15–13:50
Day 2  Bike Tour 10:10–12:40  ⟂  Lunch 12:30–13:30  ⟂  Travel 12:45–13:13
Day 3  MAM     09:46–11:46    ⟂  Checkout 11:00–11:30
```

Meal-guard is inserting Lunch at a fixed 12:30 slot **on top of** the existing activity, then the cascade walk doesn't push subsequent rows because the inserted meal carries a stale `startTime` that pre-dates the previous row's end. The save-time `enforceTimingAndBuffers` only adjusts forward-ordered pairs; an inserted overlap is invisible to it.

**Fix:** In `assignFloatingMealTimes` (and the meal-guard insertion path), after stamping a time, run a single-pass collision check against the day; if `start < prevEnd`, push to `prevEnd + 5min`. Then re-sort + re-cascade. Add an `OVERLAP` code to `applyValidationGate` that drops or shifts.

## 2. Departure-day logistics §15z is not firing for Milan + Sao Paulo

Milan (flight 11:30):
```text
Day 3  Breakfast 08:30  →  Checkout 11:00  →  (nothing)
```
Checkout cap should be `min(11:00, 11:30 − 180 buffer − 30 transfer − 60 − 30)` = way before 08:00. Should also have an airport-transfer card ending at 08:30. Neither happened.

Sao Paulo (flight 23:05):
```text
Day 3  MAM 09:46–11:46  →  Checkout 11:00  →  Travel to Airport 13:02–13:47  →  Flight 23:05
```
Transfer ends 9+ hours before flight; §15z should have either removed it (wrong time) or pushed it to ~19:05.

**Fix:** Confirm §15z reads `savedDepartureTime24` (Milan has it set, Sao Paulo too), and that it's invoked unconditionally on the last day. Likely regression after the recent anchor-guard rewrite — add a sentinel log `[DEPARTURE_15Z_RAN] flight=… cap=…` so we can see misses on the next trip.

## 3. Title-time mismatch validator not enforced

Milan Day 1: `"Nightcaps at Ugo Cocktail Bar"` scheduled `14:53–15:53`. `validateActivityTitleTime` in `_shared/output-consistency.ts` already detects this exact pattern but its emit isn't wired into `applyValidationGate` as a forced rename or reschedule. Either:
- Rename strip: drop "Nightcap"/"Sunset" prefix when slot is afternoon, or
- Reschedule into the matching window via repair-day.

## 4. Day-1 missing breakfast + dead-gap on Day 2 (Milan)

- Day 1 arrival empty → defaulted to <09:30 → breakfast required, but Day 1 has **no breakfast card** (starts with check-in at 08:15 then bike at 09:18).
- Day 2: Lunch 12:30–13:30 → Freshen-up 16:45 = **3h 15min unfilled active window**. `fill-dead-gaps` should have caught >90min.

**Fix:** `fill-dead-gaps` on Day-N≥2 mid-afternoon window is silently skipping. Likely the "exempt if next card is freshen-up" branch is too greedy. Tighten so freshen-up at 16:45 doesn't excuse a 13:30 leak.

## 5. Day-1 missing hotel-return bookend (both trips)

Milan Day 1 dinner ends 20:15, no return card. Sao Paulo Day 1 nightcap ends 00:52 (wraps past midnight) — should have emitted `late_nightlife_bookend`. `runStep8` and the read-time bookend injector are both missing this. Likely the chained generator's per-day finalization is not running Step 8 on Day 1 when arrival time is unknown.

## Proposed implementation order

1. **Overlap detection at meal-guard insertion + save-time** — biggest user-visible bug.
2. **§15z sentinel + regression repro** — adds observability before patching.
3. **`fill-dead-gaps` afternoon-window tightening.**
4. **Day-1 bookend on arrival-unknown branch.**
5. **Wire title-time validator into validation gate.**

## Touch list (preview)

- `supabase/functions/_shared/meal-time-assignment.ts` (collision push)
- `supabase/functions/_shared/timing-cascade.ts` (overlap pass)
- `supabase/functions/_shared/validation-gate.ts` (OVERLAP + TITLE_TIME codes)
- `supabase/functions/generate-itinerary/repair-day.ts` (§15z sentinel + Day-1 bookend branch)
- `supabase/functions/_shared/fill-dead-gaps.ts` (freshen-up exemption tightening)
- One-shot SQL backfill to re-run §15z + dead-gap fill on the 2 affected trips.

## What I'd want from you before building

Two scoping questions:

1. **Overlap resolution policy** — when an inserted meal collides with an existing activity, should I (a) shift the meal later and cascade everything else, or (b) keep the meal at its canonical slot and shift the sightseeing card earlier? (a) is safer, (b) keeps meals at "believable human" hours.
2. **Day-1 breakfast** — when arrival time is unknown, current default assumes pre-09:30 (breakfast required). Want me to keep that, or flip to "no breakfast required when arrival unknown"?

Once you answer those I'll build. Or say "go" and I'll pick (a) + keep current breakfast default.
