## Problem

Two failure modes producing the user-visible "Day 2 missing return + phantom 12:10 AM at top":

1. **Late-nightlife predicate too narrow.** Both `runStep8` (`universal-quality-pass.ts`) and `ensureHotelReturnBookend` (`src/lib/itinerary/ensureHotelReturnBookend.ts`) gate the post-midnight bookend on:

   ```
   LATE_NIGHTLIFE_TITLE_RE = /\b(speakeasy|nightclub|cocktail|nightcap|club|lounge|bar|aperitif|aperitivo)\b/i
   LATE_NIGHTLIFE_CATS = { NIGHTLIFE, BAR, ENTERTAINMENT, COCKTAILS, LOUNGE }
   ```

   "La Rosa **Vermutería**" matches neither — `vermutería`, `vermut`, `taberna`, `bodega`, `wine bar`, `tavern`, `pub`, `cava`, `digestif` are all missed, and the day's primary `category` is often `dining` / `drinks`, neither in the set. Result: nightcap ends 00:15 → bookend skipped → Day 2 ends mid-air.

2. **Stale orphan bookend persisted from a prior generation pass** sits on Day 2 as a `late_nightlife_bookend` with `startTime` `00:10` even though Day 2's true tail isn't a late-night card. Because the source is `late_nightlife_bookend`, every defensive layer (`stripPreDawnHotelReturns`, `isGhostActivity`, `clampAllBookends`) intentionally **exempts** it, so it survives forever. Once it's the only `late_nightlife_bookend` on a day whose chronological tail is now a normal-evening or wrap-window non-nightlife card, it ends up looking like a phantom "12:10 AM" header item.

## Plan

### 1. Broaden the late-nightlife predicate (single shared definition)

Create `supabase/functions/_shared/late-nightlife-predicate.ts` with:

```ts
export const LATE_NIGHTLIFE_TITLE_RE =
  /\b(speakeasy|nightclub|cocktail|nightcap|club|lounge|bar|aperitif|aperitivo|
       vermut|vermuteria|vermutería|taberna|bodega|tavern|pub|wine\s*bar|
       cava|digestif|late\s*drinks|after[-\s]?dinner\s*drinks|drinks?)\b/i;
export const LATE_NIGHTLIFE_CATS = new Set([
  'NIGHTLIFE','BAR','ENTERTAINMENT','COCKTAILS','LOUNGE','DRINKS',
]);

// Time-anchored fallback: a long evening activity (start ≥ 21:00) that
// runs into the wrap window (end 00:00–02:30) is *empirically* nightlife
// even when the title doesn't carry the keyword. This is the Mallorca
// "La Rosa Vermutería 21:30 → 00:15" miss.
export function isLateNightlikeTail(startMins: number | null, endMins: number | null): boolean {
  if (startMins == null || endMins == null) return false;
  if (startMins < 21 * 60) return false;
  return endMins >= 0 && endMins <= 2 * 60 + 30;
}

export function qualifiesAsLateNightlife(act: any, startMins: number | null, endMins: number | null): boolean {
  const t = String(act?.title || act?.name || '');
  const c = String(act?.category || '').toUpperCase();
  return LATE_NIGHTLIFE_TITLE_RE.test(t)
    || LATE_NIGHTLIFE_CATS.has(c)
    || isLateNightlikeTail(startMins, endMins);
}
```

Mirror as `src/lib/itinerary/lateNightlifePredicate.ts` (FE, identical semantics).

Wire:
- `universal-quality-pass.ts` `runStep8` — replace inline regex/set + the `titleNightlife || catNightlife` check with `qualifiesAsLateNightlife(lastActivity, startMinsParsed, endMinsParsed)`.
- `ensureHotelReturnBookend.ts` — same.
- `predawn-hotel-strip.ts` — leaves the source/tag-based exemption alone (still needed for the persisted card).

This single change fixes Day 2 (vermutería bookend now generates).

### 2. Self-heal stale orphan late-nightlife bookends

The persisted `00:10` card on Day 2 needs to be removed at the next save so a fresh, correctly-timed bookend takes its place.

Add `pruneOrphanLateNightlifeBookend(activities, dayNumber)` in `_shared/timing-cascade.ts`:

- Scan for cards with `source === 'late_nightlife_bookend'` (or tag).
- For each, find the chronologically-prior **non-bookend** activity (by `dayChronoKey`).
- If that prior activity is **not** late-nightlife (per `qualifiesAsLateNightlife` using its real start/end), or if the bookend's start is **before** the prior's end (impossible chronology), remove the bookend. Sentinel: `[ORPHAN_BOOKEND_PRUNED] day=N reason=…`.

Wire:
- `action-save-itinerary.ts` `normalizeDays` — call AFTER the wrap-aware sort + the existing `[BOOKEND_REORDER]` self-heal, BEFORE `stripPreDawnHotelReturns`. After this prune, the day either has no bookend (covered by §3) or a clean one.
- `pipeline/repair-day.ts` — call once before §15z final logistics enforcement.

### 3. Re-run bookend after orphan prune

In both `normalizeDays` (save) and `parseItineraryDays` Step 4b (read), once an orphan was pruned, re-evaluate whether the day now needs a bookend:

- **Save side**: after `pruneOrphanLateNightlifeBookend`, re-run `runStep8(activities, dayNumber - 1, hotelName)` if `removed > 0`. Hotel name is already extracted from prior runs (memo on the day's STAY card or top-level metadata).
- **Read side**: `ensureHotelReturnBookend` is already called per-day after Step 4 — no change needed once §1 broadens the predicate.

### 4. Tests

- `supabase/functions/_shared/__tests__/late-nightlife-predicate.test.ts` — new. Pins:
  - `"La Rosa Vermutería"` cat=`drinks` → qualifies.
  - `"Wine Bar Bodega Z"` cat=`dining` → qualifies (title regex).
  - Untitled card start=21:30 end=00:15 → qualifies via `isLateNightlikeTail`.
  - Plain dinner ending 22:30 → does NOT qualify (out of wrap window).
- `supabase/functions/_shared/__tests__/timing-cascade-orphan.test.ts` — new. 3-activity day `[breakfast 09:00, museum 14:00, dinner 21:00→22:30, late_nightlife_bookend 00:10]` → bookend pruned; sentinel emitted.
- Extend `late-nightlife-source-survival.test.ts` with a Mallorca-shaped vermutería day → bookend appears at tail.
- Extend `src/lib/itinerary/__tests__/ensureHotelReturnBookend.test.ts` with vermutería + cat=`drinks` case.

## Out of Scope

- No changes to `dayChronoKey`, `clampAllBookends`, `isGhostActivity`, or the `[BOOKEND_REORDER]` self-heal added in the prior pass — all still correct.
- No DB migration; the orphan-prune at save-time self-heals legacy trips on next save.
- Day 1 (working) is untouched.

## Files Touched

- `supabase/functions/_shared/late-nightlife-predicate.ts` (new)
- `supabase/functions/_shared/timing-cascade.ts` (+ `pruneOrphanLateNightlifeBookend`)
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` (use shared predicate)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (wire prune + re-run runStep8)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (wire prune)
- `src/lib/itinerary/lateNightlifePredicate.ts` (new, FE mirror)
- `src/lib/itinerary/ensureHotelReturnBookend.ts` (use shared predicate)
- 4 test files (3 new + 1 extended)
