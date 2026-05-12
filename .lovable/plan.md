## Problem

Late-nightlife and overnight hotel-return bookends have startTimes like `00:55` / `00:39` (correct — they close a day whose terminal nightcap ended at 00:30). They're correctly **appended** to the parent day's activity array by `runStep8` and `ensureHotelReturnBookend`, but every downstream sort then compares raw `"HH:MM"` strings or raw minutes-from-midnight. Result: `00:55` sorts before `09:00`, the bookend is re-ordered to the **top** of its own day, and on render the day "opens" with a "Return to Milan Marriott Hotel @ 12:55 AM" card.

The intent (close the prior day with a hotel return) is right; the chronology is broken by non-wrap-aware sorting.

## Root Cause

`ensureHotelReturnBookend` already implements wrap-aware ranking (treat `[00:00, 06:00)` as `+24h`) when picking the chronologically-last activity. None of the sort sites that consume the resulting array do the same.

Sort sites that re-shuffle the bookend to the top:

Backend (writes back to DB → bug becomes persistent):
- `supabase/functions/_shared/timing-cascade.ts:238` — `enforceTimingAndBuffers` sorts by `parseTime(startTime) ?? 99999`. Runs in repair-day §16, save-itinerary STEP 2.9, and the editor's `cascade` net.
- `supabase/functions/generate-itinerary/universal-quality-pass.ts:454` — meal sort (lower-impact, but same pattern).

Frontend (display + transient state):
- `src/utils/itineraryParser.ts:672` — salvageDining merge sort.
- `src/components/itinerary/EditorialItinerary.tsx` — six sort sites: 2680, 3580, 5237, 5315, 5549, 5553, 5740.

## Plan

### 1. Add a shared wrap-aware comparator

**Backend** — extend `supabase/functions/_shared/time-parse.ts` with:

```ts
// Sort-key for chronological order within a single day. Times in the early
// AM (00:00–05:59) belong to the *end* of the day when any activity ends
// after the wrap boundary (e.g. a 23:30 nightcap followed by a 00:55
// hotel return). Mirrors ensureHotelReturnBookend's `norm()`.
export function dayChronoKey(startTime: unknown, opts?: { wrapBoundaryMin?: number }): number;
```

Behavior: parse `HH:MM` (am/pm-aware via existing `parseTimeAmPm`); return `mins + 1440` when `mins < wrapBoundary` (default 360 = 06:00); return `Number.MAX_SAFE_INTEGER` for unparseable / empty so untimed rows still go to the bottom.

**Frontend** — new `src/lib/itinerary/dayChronoKey.ts` with the same semantics; used by every sort that orders activities within a single day.

Both implementations get a tiny test pinning: `[09:00, 23:30, 00:55, untimed]` → `[09:00, 23:30, 00:55, untimed]`.

### 2. Wire the comparator at every sort site

Backend:
- `timing-cascade.ts:238` — replace raw parseTime with `dayChronoKey`.
- `universal-quality-pass.ts:454` — same. (Meals never wrap, so this is defensive.)

Frontend (6 sites):
- `itineraryParser.ts:672` (salvageDining merge)
- `EditorialItinerary.tsx:2680` (apply-time-patches)
- `EditorialItinerary.tsx:3580` (departure swap re-sort)
- `EditorialItinerary.tsx:5237` and `5315` (regen accommodation re-insert)
- `EditorialItinerary.tsx:5549` and `5553` (import merge/append)
- `EditorialItinerary.tsx:5740` (edit-activity time auto-sort)

Day-level sort (`itineraryParser.ts:724`, by `Date`/`dayNumber`) is unchanged — that's cross-day, not within-day.

### 3. One-shot self-heal for already-persisted trips

The bug has already been written to disk on existing trips (`enforceTimingAndBuffers` re-ordered the bookend during prior saves). Fix-forward without a migration:

- In `action-save-itinerary` `normalizeDays`, after the wrap-aware cascade runs, detect bookends (`source` ∈ `{bookend-readtime, bookend-overnight, late_nightlife_bookend}` OR `tags` includes any of those) sitting at index 0 with `startTime < 06:00`, and move them to the chronological tail. Sentinel: `[BOOKEND_REORDER] day=N moved tail src=…`.
- The `enforceTimingAndBuffers` switch alone repairs the order on the very next save without touching unrelated rows.

### 4. Tests

- `_shared/__tests__/time-parse.test.ts`: `dayChronoKey` ordering with wrap and untimed.
- `_shared/__tests__/timing-cascade.test.ts`: 4-activity day `[09:00 brunch, 18:00 wine bar, 23:30 nightcap, 00:55 hotel return (source: late_nightlife_bookend)]` — assert post-cascade order is exactly that, and the bookend is **last**, not first.
- `src/lib/itinerary/__tests__/dayChronoKey.test.ts`: same semantics on the FE helper.
- Extend `ensureHotelReturnBookend.test.ts` with an end-to-end pass: parse → cascade simulation → expect bookend at `acts[acts.length - 1]` with start `00:55`.

## Out of Scope

- No changes to the late-nightlife windowing in `runStep8` / `ensureHotelReturnBookend` (`02:55` cap stays).
- No changes to ghost-activity filtering or the `late_nightlife_bookend` exemption — those are already correct.
- No DB migration; one-shot reorder in `normalizeDays` self-heals legacy trips on first save.

## Files Touched

- `supabase/functions/_shared/time-parse.ts` (+ `dayChronoKey`)
- `supabase/functions/_shared/timing-cascade.ts` (sort swap)
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` (sort swap)
- `supabase/functions/action-save-itinerary/index.ts` (one-shot reorder in `normalizeDays`)
- `src/lib/itinerary/dayChronoKey.ts` (new)
- `src/utils/itineraryParser.ts` (sort swap at line 672)
- `src/components/itinerary/EditorialItinerary.tsx` (6 sort swaps)
- 4 test files (new + extended)
