## Problem

Day 2 of a luxury 3-day Venice trip ships with a **3h 40m unplanned window (12:10 → 15:50)** between "Rialto Bridge and Market Area Walk" and "Kinetic Lagoon Private Boat Adventure". The Density Protocol prohibits dead gaps > 90 m. The UI's amber "Fill the gap" nudge confirms it (DeadGapBanner) — but a generated luxury trip should never reach the user with that hole in the first place. The slot also straddles lunch (13:00), so either lunch was deduped away or the gap was created after meal injection ran.

## Root cause — pipeline ordering

`fillAfternoonDeadGaps` (the server-side gap filler) is called inside `action-generate-trip-day.ts` at line 1432, but **three later passes can re-open or widen gaps and never re-check**:

```text
Step A  pipeline repair-day                    (line 1418)
Step B  fillAfternoonDeadGaps   ←— gap was filled here
Step C  cross-day restaurant dedup  (line 1460)   ←— removes non-primary dining → new gap
Step D  universalQualityPass         (line 1517)   ←— shifts timings, removes dupes → new/wider gap
        (NO second gap check after C/D)
```

Compounding factors:

1. **Single-shot AI request, silent null** — `proposeGapFiller` (`supabase/functions/_shared/fill-gap.ts`) returns `null` on any of: AI fetch error, non-OK response, parse failure, generic-name guard, dedup hit, AI returning `{fallback:true}`. Caller leaves the gap and moves on. No retry, no fallback to a curated POI from `verified_venues` / fallback-restaurants table.
2. **Cross-day dedup may remove lunch** — line 1507 `[CROSS-DAY DEDUP] "${act.title}" repeats with no replacement — REMOVING`. If lunch (e.g. "Lunch at All'Arco") gets removed and the title doesn't match the primary-meal regex (because the AI titled it "Cicchetti at All'Arco" instead of "Lunch at …"), the lunch is wiped without injection. That alone produces the 12:10 → 15:50 hole.
3. **No final density assertion** — nothing logs/escalates when, after all passes, the day still has a > 180 m unplanned afternoon window. We rely entirely on the UI to surface it to the user.

## Fix — three layers, mirrors the Michelin defense-in-depth pattern

### Layer 1: Re-run the gap filler as the FINAL pre-save step

In both `action-generate-trip-day.ts` (line ~1517 area) and `action-generate-day.ts` (analogous spot), call `fillAfternoonDeadGaps` a **second time AFTER `universalQualityPass` and after cross-day dedup**, with the same options. This catches gaps newly-opened by Steps C and D. Same lockedIds, same isFirstDay/isLastDay guards apply, so locked Voyance picks and arrival/departure days are still respected.

### Layer 2: Make `proposeGapFiller` resilient

Edit `supabase/functions/_shared/fill-gap.ts`:

- **Retry once** on `null` from the first AI attempt, this time with `temperature: 0.6` and an explicit instruction "Do NOT return fallback — pick the closest landmark/café/shop you know in this neighborhood."
- **Curated fallback** — if both AI attempts fail, fall back to a real entry from `verified_venues` (Supabase) or `fallback-restaurants.ts` filtered by destination + neighborhood proximity (use `beforeAct.location.coordinates` if available). This guarantees a real, named insert instead of leaving a hole.
- **Log the failure mode** when both AI + fallback yield nothing, so we can see the next regression in edge logs.

### Layer 3: Cross-day dedup must not silently delete a meal

In `action-generate-trip-day.ts` lines 1499-1510 (the `else` branch where no replacement is found), expand the "primary meal" preservation to detect meal-time-of-day rather than just the title regex:

- If `act.startTime` is in the canonical lunch (12:00-14:30) or dinner (18:00-22:00) window, **OR** the activity is `category === 'dining'`, treat it as a primary meal and **keep the duplicate** rather than removing it. The duplicate-detection memo already calls this out for the literal "Lunch at"/"Dinner at" prefix; we need to widen the time/category check so untitled meals (e.g. "Cicchetti at All'Arco" at 13:00) are also protected.

### Layer 4 (observability — non-blocking)

After Layer 1's second `fillAfternoonDeadGaps` run, compute a final-day dead-gap report and:

- `console.warn('[QUALITY] Day N still has Xm unplanned 12:00-19:00 after all passes — gap-fill exhausted')` so we can grep edge logs for the next regression.
- Persist a soft tag `metadata.quality.unfilled_dead_gap_minutes = X` on the day (no UI change required) so analytics can track frequency.

### Tests

- `pipeline/__tests__/fill-dead-gaps.second-pass.test.ts` — given a day where step C removes lunch, the second `fillAfternoonDeadGaps` call inserts a real activity into the resulting gap.
- `_shared/__tests__/fill-gap.retry.test.ts` — when AI returns `{fallback:true}` once then a real venue, returns the real venue. When both attempts fail, a curated fallback is returned.
- `action-generate-trip-day.dedup.test.ts` — a non-prefixed meal at 13:15 (`"Cicchetti at All'Arco"`, category `dining`) is preserved by cross-day dedup even with no replacement.

### Memory

Append to existing `mem://features/itinerary/auto-buffer-and-dead-gap`:

> Dead-gap auto-fill must run TWICE: once after repair-day and once again after cross-day dedup + universalQualityPass, because both later passes can re-open gaps. `proposeGapFiller` retries once with lower temperature and falls back to `verified_venues` / fallback-restaurants when AI declines. Cross-day dining dedup never removes a meal-time activity (12:00-14:30 or 18:00-22:00) without a replacement, even if the title lacks the literal "Lunch at" / "Dinner at" prefix.

## Files

- **Edit** `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — second `fillAfternoonDeadGaps` call after universalQualityPass; widen primary-meal guard in cross-day dedup (lines ~1499–1510).
- **Edit** `supabase/functions/generate-itinerary/action-generate-day.ts` — same second gap-fill call.
- **Edit** `supabase/functions/_shared/fill-gap.ts` — retry-with-lower-temperature + curated fallback path.
- **Edit** `supabase/functions/generate-itinerary/pipeline/fill-dead-gaps.ts` — emit final-pass density warning + write `metadata.quality.unfilled_dead_gap_minutes`.
- **New tests** in `pipeline/__tests__/`, `_shared/__tests__/`, plus a dedup test.
- **Memory** — append to `mem://features/itinerary/auto-buffer-and-dead-gap`.

No DB schema changes. No UI changes (the existing DeadGapBanner remains as the user-visible safety net for days that still slip through).
