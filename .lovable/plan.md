## HC.3 — Walk threshold robust to missing/string durations

Single targeted edit in `supabase/functions/generate-itinerary/pipeline/validate-day.ts`, inside `checkWalkOverThreshold` (around lines 1063–1065 of the post-HC.2 file).

### Change

Replace the brittle numeric parse:

```ts
const dur = Number(t.durationMinutes) || 0;
const dist = Number(t.distanceMeters) || 0;
if (dur <= WALK_HARD_DURATION_MINUTES && dist <= WALK_HARD_DISTANCE_METERS) continue;
```

…with a layered resolver, exactly as specified in the request:

1. Try numeric `t.durationMinutes` / `t.distanceMeters`.
2. If duration not finite/positive, parse string forms `"1h 6m"`, `"66 min"`, `"1:06"` from `t.duration` / `act.duration` / `act.durationLabel`.
3. If still missing, infer from `act.startTime` → `act.endTime`.
4. Normalize negative/NaN distance to 0.
5. If both still unknown, `continue` (conservative — no false positive).
6. Otherwise apply the existing threshold check.

### Out of scope

- No changes to `WALK_HARD_*` thresholds.
- No changes to repair-day's parallel walk-distance guard (`enforceTransitModeByDistance` already does its own coord-based check).
- No changes to `isTransitActivity` gate (HC.2 unified that already).

### Expected result

A walk card emitted with `duration: "1h 6m"` and no `transportation.durationMinutes` → parses to 66 min → exceeds `WALK_HARD_DURATION_MINUTES` (30) → fires `WALK_OVER_THRESHOLD` critical, so the validation gate / repair pipeline can act on it.
