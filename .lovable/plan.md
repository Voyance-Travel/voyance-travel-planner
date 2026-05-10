## Problem

Day 1 (and any non-departure day) sometimes terminates without a "Return to Hotel" anchor, while other days end with one. UX inconsistency.

## Trace — two leak paths

**Where the bookend lives:** `universal-quality-pass.ts::runStep8` is the canonical injector. Called from Step 8 in `universalQualityPass` for every non-departure day (`dayIndex < totalDays - 1`).

### Leak 1 — `runStep8` 17:00 floor too strict
`runStep8` (lines 79–129) only injects when last activity ends **17:00–23:59**:

```ts
if (h >= 17 && h <= 23) startTime24 = ...
if (!startTime24) {
  console.warn(`[QUALITY] Skipped hotel return injection on Day ${...}: last activity ends at "${candidate}" (need 17:00–23:59)`);
  return;
}
```

Day 1 arrival pattern: late-afternoon arrival → hotel check-in → one cultural anchor 14:30–16:30 → no dinner (arrival too late or meal-guard hasn't run yet) → last activity ends 16:30 → **silent skip**, day ships with no hotel-return.

### Leak 2 — dinner-required deferral never re-attempts
`universalQualityPass` Step 8 (lines 333–366) defers when `dinner` is required but absent, with this comment:

```
A subsequent terminal cleanup / save-time pass will append the
hotel-return card AFTER dinner.
```

But there is **no such pass**. Search confirms: after the final per-day meal-guard injects dinner (`action-generate-trip-day.ts:1786`), nothing re-invokes `runStep8`. `action-save-itinerary.ts::normalizeDays` runs scrub + bookend-clamp + post-checkout prune — none of those add a hotel-return. `repair-day.ts` §5b only handles the case where the day already ends on a transport-to-hotel.

So: dinner-required day → Step 8 deferred → meal-guard injects 19:30 dinner → day persists with dinner as the terminal card, no hotel-return.

### Confirmed un-affected paths
- Departure days are intentionally exempt (gate `dayIndex < totalDays - 1`).
- Single-day trips are exempt (acceptable — only day = departure day).
- Days where the last activity is a hotel-bound transport are handled by `repair-day.ts` §5b.

## Fix — three layers, narrowly scoped

### 1. Loosen the `runStep8` time gate
- File: `supabase/functions/generate-itinerary/universal-quality-pass.ts`, function `runStep8` (line 83).
- Change the accepted window from `17:00–23:59` to **`14:00–23:59`**. 14:00 is the earliest plausible end of a "real day" — anything ending before that is degenerate (the day has nothing of substance after lunch) and the bookend would read as a midday surrender. We keep that skip.
- The warning log stays but with the new threshold. If the existing memory `dinner-required-defer-hotel-return` cared about a 17:00 boundary, no — it only describes the deferral mechanic, not the time floor.
- Export `runStep8` so step 2 can reuse it.

### 2. Re-run Step 8 after the final meal-guard
- File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` around line 1788 (inside the `if (!_fmgResult.alreadyCompliant)` branch where `dayResult.activities` is replaced).
- After updating `dayResult.activities`, call `runStep8(dayResult.activities, dayNumber - 1, hotelName)`.
- Idempotent because `runStep8` already short-circuits when the last activity is `STAY|ACCOMMODATION` or matches `/return.*hotel|back.*hotel|return\s+to/i`.
- One log line `[QUALITY] Day N: re-ran Step 8 after meal-guard injected dinner — hotel-return appended` (or "no-op" path covered by the existing log inside `runStep8`).
- Sentinel `dayResult.metadata.quality.hotel_return_post_meal_guard = true` when a card was appended.

### 3. Save-time safety net (covers manual edits, undo/redo, escaped generations, single-day refresh)
- File: `supabase/functions/generate-itinerary/action-save-itinerary.ts`, function `normalizeDays` (line 121).
- After the existing `pruneNonLogisticsAfterCheckout(activities)` and **before** the day is returned, for every day except the last (departure) day:
  - Detect `isAlreadyTerminatedAtHotel` using the same predicate as `runStep8` (cat ∈ STAY/ACCOMMODATION OR title matches `/return.*hotel|back.*hotel|return\s+to/i`).
  - If not, call `runStep8(activities, dayNumber - 1, hotelName)` (resolve `hotelName` from the trip context already passed into `normalizeDays` — needs a small signature extension).
  - Skip on departure day (last day) — same gate as Step 8.
  - Skip when the day has < 1 non-logistics activity (degenerate / hotel-only days handled elsewhere).
- Log `[QUALITY] day=N save-time hotel-return appended` so we can measure how often the earlier passes missed it.

### Out of scope
- Day-1 arrival-day specific logic (`Day 1 missing Arrival Cultural Anchor` already exists at line 326 — separate concern).
- Departure-day terminal card (handled by `Departure Day Graceful Finish`).
- Walking-card "Walk to <hotel>" injection — `repair-day.ts` §5b already covers the trailing-transport path; we are not changing that.
- Single-day trips (intentionally end on departure logistics).

### Tests

- Extend `supabase/functions/generate-itinerary/scenario.test.ts` (or add a new `hotel-return-bookend.test.ts` if scope demands):
  - **Day 1 ends at 16:30 with no dinner required** → after `universalQualityPass`, last activity is "Return to <hotel>" starting 16:30.
  - **Day 1 dinner-required, no dinner, ends 16:00** → Step 8 deferred; after simulated meal-guard inject of 19:00 dinner + re-run, hotel-return present at the end.
  - **Departure day with last activity ending 16:00** → no hotel-return appended.
  - **Day already ends on STAY/ACCOMMODATION card** → Step 8 idempotent no-op.
  - **Day ends on transport-to-hotel** → `repair-day.ts` §5b path still wins (no double-append).
  - **Save-time path:** day enters `normalizeDays` without a hotel-return → exits with one. Day enters with one → no duplicate.
- Update fixtures only if the missing-bookend assertion fires on existing snapshots; prefer not.

### Files
- edit `supabase/functions/generate-itinerary/universal-quality-pass.ts` (loosen time gate, export `runStep8`)
- edit `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (post-meal-guard retry)
- edit `supabase/functions/generate-itinerary/action-save-itinerary.ts` (save-time safety net + thread `hotelName` into `normalizeDays`)
- new  test cases in `scenario.test.ts` or a dedicated `hotel-return-bookend.test.ts`
- edit `.lovable/plan.md`

Memory candidate post-implement: `mem://constraints/itinerary/day-end-hotel-return-bookend` — "Every non-departure day ends on a hotel-return card. `runStep8` accepts last-activity end ≥ 14:00; called from universalQualityPass, post-meal-guard retry, and `normalizeDays` save-time net. Idempotent."