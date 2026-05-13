## Issue 3 Investigation — Day 2 stale-overlap warning

### What the data says

Casablanca trip `fce9c4ba-…0eda783`, Day 2:

| Source | Lunch (Bleu/Brasserie) | Museum of Moroccan Judaism |
|---|---|---|
| Page render (normalized table) | 12:30–13:30 | **13:45–15:00** |
| `itinerary_data` JSON (sparse, 4 of 17 cards) | not present | `startTime:"13:45"`, `endTime:"15:00"`, **`time:"12:31"` (stale)** |

`parseEditorialDays` → `getDisplayStartTime` correctly prefers `startTime` over `time`, so the engine *should* report 13:45–15:00 for the Museum. The health panel only reads `editorDays = parseEditorialDays(trip.itinerary_data, …)` — never the normalized table. So if the warning still says `12:31–13:46`, exactly one of these is true:

1. A code path along `editorDays → analyzeHealth` strips/loses `startTime` for some rows (then `time` becomes the fallback).
2. The cascade-preview clone fails for this activity (no id, throws, or locked) and the synthesized `endTime = startTime + duration` lands at 13:46 by reading `time` instead of `startTime`.
3. Two activity records collide on id, the merge drops the fresh one.

### Two related symptoms

**A. Stale-time leak via `time` fallback** — the underlying JSON carries `startTime:"13:45"` *and* `time:"12:31"` together, and any reader that uses `time` first (or treats `startTime` as falsy) surfaces the wrong number. Today's `displayTime` chain is correct, but nothing else stops a future reader from regressing.

**B. JSON ↔ normalized-table drift** — Day 2 has 17 cards in `itinerary_activities` but only 4 in `trips.itinerary_data`. The page renders the 17, the health panel sees the 4. This violates the **DB Is Source of Truth** memory and is the real reason the panel shows times the user can't see on screen.

### Plan

**1. Lock the time-field invariant at the parser boundary** — `src/utils/itineraryParser.ts`
- In `parseActivity`, after extracting `startTime` and `time`, if both are present and disagree, **drop `time` entirely** so no downstream code can fall through to the stale value. Add a `console.warn('[TIME_FIELD_DRIFT]', { id, startTime, time })` breadcrumb so we see how often this happens in production.
- Same treatment for `endTime` vs any legacy `end`-style fallback if present.

**2. Defense in depth in `displayTime` + cascade preview**
- `getDisplayStartTime` / `getDisplayEndTime`: keep `startTime` precedence but **stop reading `a?.time`** as a fallback when `a?.startTime` is a non-empty string of any value (today's chain already does this; add a clarifying comment + test).
- `buildCascadePreview` clone: `const startTime = a?.startTime || a?.start_time;` (drop `?? a?.time`) — relying on parser normalization above. A record reaching this point without `startTime` is genuinely untimed, not a victim of legacy `time` shadowing.

**3. Stop reading sparse JSON when normalized data is richer** — `src/pages/TripDetail.tsx`
- After `parseEditorialDays(trip.itinerary_data, …)`, compare per-day activity counts against the `itinerary_activities` rows already loaded for the same trip. If JSON day has materially fewer real cards than the table (>40% gap, mirroring the persist-regression guard ratio), call the existing `resyncItineraryFromDb(tripId)` once and re-parse. Health analysis runs against the rebuilt `editorDays`.
- Telemetry: `console.warn('[HEALTH_JSON_SPARSE_RESYNC]', { tripId, day, jsonCount, tableCount })`.

**4. Tests**
- `src/utils/__tests__/itineraryParser.timeFieldDrift.test.ts` — JSON activity with `{startTime:"13:45", time:"12:31"}` parses with `time` dropped and `startTime` preserved.
- Extend `src/components/trip/__tests__/TripHealthPanel.cascadePreview.test.ts` with a Casablanca-shaped fixture (Lunch 12:30–13:30 + Museum carrying both `startTime:"13:45"` and stale `time:"12:31"`); assert no overlap warning fires.

**5. Memory**
- New constraint `mem://constraints/itinerary/time-field-canonicalization`: parser is the single boundary that reconciles `startTime` vs legacy `time`; downstream readers never fall back to `time` when `startTime` exists.
- Append a note to `mem://constraints/itinerary/health-cascade-preview` covering the sparse-JSON re-sync trigger.

### Out of scope

- Why the JSON drifted from the normalized table on this trip (separate write-path audit; will surface once the `[HEALTH_JSON_SPARSE_RESYNC]` telemetry runs in production).
- Any change to the cascade engine itself — Issue 2's fixes already hold.
