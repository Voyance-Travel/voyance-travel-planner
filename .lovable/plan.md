## Plan: P0b — Cap per-activity cumulative cascade shift at 120 min

### Scope
Single-block change in `supabase/functions/_shared/timing-cascade.ts`, lines 346-356 (the `cascadeShift` helper inside `enforceTimingAndBuffers`).

### Why
A single bad upstream duration (e.g. Hong Kong Iron Fairies 9-hour cocktail card) currently shifts every later activity by the same delta. Even with P0a's clamp, this collapses dinner + 3 other cards onto 23:29. Cap each activity's cumulative shift at 120 min so one bad row can't destroy the day.

### Change
Replace the unbounded `cascadeShift` with a per-activity cumulative-shift tracker:
- `MAX_CUMULATIVE_SHIFT = 120`
- `cumulativeShiftById: Map<string, number>` accumulates how far each card has been moved
- Per call, `applyDelta = min(delta, 120 − currentShift)`. If `0`, leave card in place and emit one `overlap_fix` repair note ("…reached the 120-min cumulative shift cap…").

### Acceptance greps (after apply)
1. `grep -n "MAX_CUMULATIVE_SHIFT" supabase/functions/_shared/timing-cascade.ts` → ≥3 hits
2. `grep -n "cumulativeShiftById" supabase/functions/_shared/timing-cascade.ts` → ≥3 hits
3. `grep -n "cumulative shift cap" supabase/functions/_shared/timing-cascade.ts` → 1 hit
4. `grep -c "minutesToTime(s + delta)" supabase/functions/_shared/timing-cascade.ts` → 0
5. `grep -c "minutesToTime(s + applyDelta)" supabase/functions/_shared/timing-cascade.ts` → 1

### Out of scope
Other functions, other files, other blocks. P0a remains untouched.