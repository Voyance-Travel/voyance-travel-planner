## Problem

Activity raw data carries duration strings like `"45:00:00"` instead of `"45m"`. Two bugs combine:

1. **Coerce heuristic is wrong for HH:MM:SS**. Current logic in `src/utils/plannerUtils.ts` and the Deno mirror `supabase/functions/generate-itinerary/_shared/duration-format.ts`:
   ```ts
   if (hasSeconds) totalMin = a * 60 + b;
   ```
   This unconditionally treats `a` as hours, so `"45:00:00"` → `45 × 60 = 2700` min → `"45h"`. The model is actually emitting MM:SS:CS or treating the colons as a generic clock pattern; either way, a leading number ≥ 24 in an HH:MM:SS slot is implausible as hours and must be read as minutes (mirroring the existing `45:00` → `"45m"` rule).

2. **Normalization only runs once, during generation.** `normalizeActivityDuration` is called from `universal-quality-pass.ts` and nowhere else server-side. Refresh-day, repair-day, save-itinerary, and every client save path skip it, so any malformed duration introduced after the quality pass (model-emitted on a regen, user paste, transport repair, etc.) lands in `trips.itinerary_data` unchanged. Today the JSON happens to be clean, but the guard isn't load-bearing — it's accidental.

## Plan

### 1. Fix the heuristic (single source of truth)

Update `src/utils/plannerUtils.ts#coerceDurationString` and the Deno mirror to apply the same "implausible-as-hours" rule already used for `MM:SS`:

```ts
if (hasSeconds) {
  // HH:MM:SS form. If the leading number is implausibly large for hours
  // (>= 24) OR the seconds field is zero AND the leading number is ≥ 5
  // with no minutes either, treat the leading number as minutes — mirrors
  // the MM:SS rule. This catches the AI emitting "45:00:00" for "45 min".
  if (a >= 24 || (b === 0 && parseInt(colon[3], 10) === 0 && a >= 5)) {
    totalMin = a;
  } else {
    totalMin = a * 60 + b;
  }
}
```

After this:
- `"45:00:00"` → `"45m"` ✅
- `"15:00:00"` → currently the test expects `"15h"`; under the new rule it becomes `"15m"` because 15h-long activities don't exist in this product. Update the test to match. (Confirm with: 15-hour activity is nonsense; the only valid interpretation is minutes.)
- `"1:05:00"` → `"1h 5m"` ✅ (a < 24, b ≠ 0)
- `"2:20:00"` → `"2h 20m"` ✅
- `"10:00:00"` → currently `"10h"`; under the new rule becomes `"10m"`. Edge case — a 10-hour activity is also nonsense in normal use; bias toward minutes.

If we want to preserve the rare "10 hours of train" reading we can keep `a < 24 && b === 0 && a < 5` as `a*60` and treat `a >= 5` as minutes. The cutoff `a >= 5` matches the existing MM:SS rule already in the code, so we'll use the same boundary across both branches.

### 2. Run the normalization sweep at every save boundary

Add `normalizeDurationsInDays(updatedDays)` calls at every server- and client-side persistence boundary:

**Server (Deno):**
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — call once, immediately before the DB write (alongside the existing meal/timing sweeps).
- `supabase/functions/refresh-day/index.ts` — sweep the day before returning patches.
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — sweep `result` at the end of the function (it already mutates `transportation.duration: "N min"` strings, but co-locating the sweep guards against future changes).

**Client (TS):**
- `src/services/itineraryActionExecutor.ts#updateTripItinerary` — call before the DB write, after the meal sweep we just added.
- `src/services/itineraryAPI.ts#regenerateDay` — same.
- `src/utils/itineraryParser.ts` — already coerces; leave as-is.

The function exists (`normalizeDurationsInDays`) and is a no-op for already-clean data, so the perf cost is negligible.

### 3. Defensive client display

`src/components/itinerary/EditorialItinerary.tsx` and `FullItinerary.tsx` already wrap `activity.duration` in `coerceDurationString(...)` at render. With the heuristic fixed (#1), legacy bad data already in the JSON also renders correctly without a backfill.

### 4. Tests

- Update `src/utils/__tests__/coerceDurationString.test.ts`:
  - Change `coerceDurationString('15:00:00')` expectation from `'15h'` to `'15m'`.
  - Add `expect(coerceDurationString('45:00:00')).toBe('45m')`.
  - Add `expect(coerceDurationString('30:00:00')).toBe('30m')`.
  - Keep `'1:05:00' → '1h 5m'` and `'2:20:00' → '2h 20m'` (these branches unchanged because `a < 24` and `b !== 0`).
- Add a Deno test for `normalizeDurationsInDays` proving `"45:00:00"` survives → `"45m"` and that `durationMinutes` back-fill is `45`.

### 5. Optional: backfill (skip)

Database scan returned 0 trips with `"duration": "HH:MM:SS"` patterns, so no migration is needed. The render-time coerce + the new save-time sweep cover anything that lands later.

## Files touched

- `src/utils/plannerUtils.ts` — heuristic fix.
- `supabase/functions/generate-itinerary/_shared/duration-format.ts` — same heuristic fix.
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — add sweep.
- `supabase/functions/refresh-day/index.ts` — add sweep on output.
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add sweep at end.
- `src/services/itineraryActionExecutor.ts` — add sweep call.
- `src/services/itineraryAPI.ts` — add sweep call.
- `src/utils/__tests__/coerceDurationString.test.ts` — update + add cases.
- New: `supabase/functions/generate-itinerary/_shared/duration-format.test.ts` — Deno test for the sweep.

## Out of scope

- Reworking `transportation.duration: "N min"` strings (those go through the same coerce when displayed).
- Migrating historical rows (none exist).
- Touching the `duration_text` column on `route_legs` etc. (that's a Google-formatted display field, not what the user is reporting).
