## Bug 4 — Evening dead-gaps (18:00–22:00) not flagged or filled

**Root cause.** `pipeline/fill-dead-gaps.ts` is hard-coded to the afternoon window `AFTERNOON_START_MIN = 12*60` → `AFTERNOON_END_MIN = 19*60` for both the filler (`fillAfternoonDeadGaps`) and the post-pass reporter (`reportRemainingAfternoonDeadGap`). A 18:42 → 22:48 gap (4h6m) lies entirely past the upper bound, so neither function sees it.

**Approach.** User option (b) — refactor to a single window-parameterized helper, then call it twice (afternoon + evening) at every existing call site. Cleaner than option (a), keeps the body of the algorithm in one place, and avoids drift between the two reporters.

## Changes

### 1. `supabase/functions/generate-itinerary/pipeline/fill-dead-gaps.ts`

- Add `EVENING_START_MIN = 18*60`, `EVENING_END_MIN = 22*60` constants alongside the existing afternoon ones.
- Generalize the existing function bodies to accept a `window: { fromMins: number; toMins: number; label: 'afternoon' | 'evening' }` parameter:
  - Rename the algorithmic core to `fillDeadGapsForWindow(activities, opts, window)` (internal, not exported). All references to `AFTERNOON_START_MIN` / `AFTERNOON_END_MIN` inside the loop and overlap math are replaced by `window.fromMins` / `window.toMins`.
  - Same for the reporter — extract `reportRemainingDeadGapForWindow(activities, latestUsableMins, window)`.
- Keep the existing exports as thin wrappers so the 4 call sites in `action-generate-day.ts` + `action-generate-trip-day.ts` keep working unchanged:
  - `fillAfternoonDeadGaps(...)` → calls `fillDeadGapsForWindow(..., { fromMins: 12*60, toMins: 19*60, label: 'afternoon' })`.
  - `reportRemainingAfternoonDeadGap(...)` → calls `reportRemainingDeadGapForWindow(..., { fromMins: 12*60, toMins: 19*60, label: 'afternoon' })`.
- Add new exports:
  - `fillEveningDeadGaps(...)` → calls the same core with the evening window.
  - `reportRemainingEveningDeadGap(...)` → same for the reporter.
- Logging: the existing `[fill-dead-gaps] Detected …` log already prints the gap. Update both functions to include `window.label` in their log lines (e.g. `[fill-dead-gaps][evening] Detected 4h6m gap …`). For the reporter, add `console.warn(\`[QUALITY] Day ${dayNumber ?? '?'} has ${largest}m unplanned ${window.fromMins/60}:00-${window.toMins/60}:00\`)` when `largest >= MIN_GAP_MIN`. Reporter signature gains an optional `dayNumber?: number` so the log includes context — backward-compatible with the existing `(activities, latestUsableMins)` callers.
- The existing `LAST_DAY_MIN_GAP_MIN = 75` thin-finish threshold is afternoon-specific (departure-day "graceful finish"). Keep it tied to `window.label === 'afternoon'`; evening uses the standard `MIN_GAP_MIN = 180`. Last-day evening fill is implicitly excluded already because last-day flights almost always close the window before 22:00 via `latestUsableMins`.
- Departure-day skip: still applies to evening — if `opts.isLastDay && (latestUsableMins === undefined || latestUsableMins <= window.fromMins)`, skip.

### 2. `supabase/functions/_shared/fill-gap.ts`

- Add optional `preferCategory?: 'dining' | 'culture' | 'activity'` to `FillGapInput`.
- When set, append one line to the system prompt: `PREFERRED CATEGORY: ${preferCategory} — pick a real ${preferCategory} venue if a believable option exists; otherwise return another category that fits the WINDOW.`
- This is a soft preference (not a hard rule) — Bug 1's meal-guard remains the primary mechanism for missing dinners. We're only nudging the filler when the meal-guard already ran and an evening gap still survives.

### 3. Call sites — add evening pass after each afternoon pass

`action-generate-trip-day.ts` (3 sites: ~1515, ~1671 retry, ~1700 reporter):

- After each `fillAfternoonDeadGaps(...)` call, add a sibling `fillEveningDeadGaps(dayResult.activities, { ...same opts..., preferCategory: 'dining' })`. Pass `preferCategory: 'dining'` through the opts → `proposeGapFiller` so it surfaces in the prompt.
- After the existing `reportRemainingAfternoonDeadGap(...)`, add `reportRemainingEveningDeadGap(dayResult.activities, _gapLatestMins2, dayNumber)`.

`action-generate-day.ts` (2 sites: ~1349, ~1368): same — add evening fill + reporter after the existing afternoon ones.

`FillDeadGapsOptions` gets an optional `preferCategory?: 'dining' | 'culture' | 'activity'` that is threaded into the `proposeGapFiller` call inside the core helper. Afternoon callers pass nothing (preserve current behavior); evening callers pass `'dining'`.

### 4. Test — `supabase/functions/generate-itinerary/__tests__/evening-dead-gap.test.ts`

4 cases against `reportRemainingDeadGapForWindow` / `reportRemainingEveningDeadGap`:

1. 18:42 dinner-end → 22:48 hotel-return → reports `~246m` for evening window (≥180m threshold met).
2. Activity 19:00 → 22:00 (full evening covered) → reports `0`.
3. Late-nightlife trailing card 21:30 → 23:30 → reports `0` (no evening gap, even though afternoon may still flag).
4. 17:00 → 22:30 with no card in between → only the portion from 18:00 onward counts toward evening (4h30m → reports `≥240m`).

Plus 1 wrapper smoke test confirming the legacy `reportRemainingAfternoonDeadGap(activities)` 2-arg signature still returns the same numbers as before (no regression).

## Out of scope

- Refactoring `proposeGapFiller`'s curated-fallback path — its `dining` branch already exists for `mealSlot`-y windows; the soft-preference nudge in the AI prompt is enough.
- Changing the meal-guard injection logic itself — that's Bug 1's territory; this fix is the safety net when the meal-guard already ran and a >180m evening hole still exists.
- Hard upper bound past 22:00 — late-nightlife windows (22:00–02:00) are governed by separate `late_nightlife_bookend` logic; we deliberately stop at 22:00 to avoid double-flagging that path.

## Verification

- `deno test --allow-all supabase/functions/generate-itinerary/__tests__/evening-dead-gap.test.ts` (5 pass).
- Re-generate a Day 1 with a 18:42 → 22:48 hole → expect `[fill-dead-gaps][evening] Detected …` log + either an inserted dining card or a `[QUALITY] Day 1 has 246m unplanned 18:00-22:00` warning.
- Existing afternoon-gap tests (if any) and 4 existing call sites continue to compile & behave identically (legacy wrappers preserve the old signatures and constants).
