## Root cause

The generator pipeline's overlap repair (`repair-day.ts` section 13, `TIME_OVERLAP CASCADE`) only fires when `currStart < prevEnd` — a true overlap. Every Rome/Paris day still ships with **two classes of conflict the generator never resolves**, both of which `refresh-day` then flags as errors:

1. **Same-start conflicts** (`refresh-day` lines 551-559, `isSameStart`). When two consecutive cards have `startTime === startTime` (typically a 0-duration transit stub jammed in front of its target), the cascade's `currStart < prevEnd` test misses it (equality fails strict less-than).
2. **Transit-gap / insufficient-buffer** (`refresh-day` lines 599-645). For two distinct-coordinate cards back-to-back, refresh-day requires `gap >= estimateTransit + getEffectiveMinBuffer`. The generator never runs this haversine-based check; it just schedules e.g. `10:00–11:00 Vatican` followed by `11:00–12:30 Trastevere lunch` and emits the day. refresh-day flags the missing 15-25 min walk/taxi as `insufficient_buffer` (severity error if `gap < transit alone`).

That's exactly why a Rome day ships with 2 issues, Paris with 3 — it's deterministic per the venue spread, not random.

## Fix — bring the validator's algorithm forward into the generator

We already have the canonical algorithm in `supabase/functions/refresh-day/index.ts`. Lift the conflict-detection + safe-cascade core into a shared helper and run it as a final pass on every generated day, before persistence.

### 1. Extract shared helper

Create `supabase/functions/_shared/timing-cascade.ts` exporting:
- `enforceTimingAndBuffers(activities, opts)` — sorts chronologically, then for each consecutive pair:
  - **Same-start fix**: if `currStart === nextStart`, push `next` to `currEnd + 5`.
  - **Overlap fix**: if `currEnd > nextStart`, push `next` (and cascade subsequent) to `currEnd + 5`.
  - **Transit-buffer fix**: if both have coordinates, compute `estimateTransit + getEffectiveMinBuffer`; if gap < required, push `next` (and cascade) forward.
  - Skip locked / structural cards as the targets of pushes (`accommodation`, departures, `lockedIds`) — same exemption set repair-day already uses.
  - Drop activities pushed past `23:30` (mirror existing `cutoff` rule), exempting end-of-day hotel-return cards.
- Returns `{ activities, repairs[], droppedIds[] }`.

The pure helpers (`parseTime`, `minutesToTime`, `haversineMeters`, `estimateTransit`, `isSamePlace`, `getEffectiveMinBuffer`) move into the same file. `refresh-day/index.ts` is rewritten to import them so we don't fork the algorithm.

### 2. Wire the pass into the generator

Two integration points (both needed; first is per-day, second is the catch-all):

- **`pipeline/repair-day.ts`** — after the existing section 13 (TIME_OVERLAP CASCADE) and 13b (MIN DURATION), call `enforceTimingAndBuffers(activities, { lockedIds, dayNumber })`. Append its `repairs` to the local `repairs` array. This keeps repair-stage logging identical and avoids re-doing work in two places.
- **`action-save-itinerary.ts`** — just before the final write, run the same helper across each day's activities once more. This is the safety net for the manual-paste / non-generator save paths and for any future action that bypasses the per-day repair (e.g. assistant tool edits).

### 3. Verification

Add `supabase/functions/_shared/timing-cascade.test.ts` with three fixtures:
- Two same-start activities → next pushed to `prev.end + 5`.
- Vatican (lat 41.902, lng 12.453) at `10:00–11:00` + Trastevere lunch (41.890, 12.467) at `11:00–12:30` with no buffer → next pushed by ~estimated walk + 15 min buffer.
- Locked card + AI card overlap → AI is the one that moves, not the locked card.

After deploy, regenerate the existing Rome trip and confirm `refresh-day` returns `issues: []` for every day on first call (no Fix Timing required). Health Score should land at 100 absent operating-hours / venue closure issues.

## Out of scope

- Operating-hours conflicts (`type: 'operating_hours'`) — these depend on live venue hours and the existing repair already handles them where data is present. They'll continue to surface as warnings on `refresh-day` when the generator places a card outside posted hours; that's a venue-data problem, not a scheduling-bug.
- Minimum-duration enforcement (already covered by 13b).
- The Fix Timing button itself stays — it's still useful when the user manually drags cards.

## Files

- create `supabase/functions/_shared/timing-cascade.ts`
- create `supabase/functions/_shared/timing-cascade.test.ts`
- edit `supabase/functions/refresh-day/index.ts` (delete duplicated helpers + cascade body, import from shared)
- edit `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (append final pass at end of section 13b)
- edit `supabase/functions/generate-itinerary/action-save-itinerary.ts` (run pass once per day before persistence)