## Goal

End-to-end enforcement that any transit card with `transportation.method = walk/walking` exceeding **30 minutes** OR **1500 m** is force-converted to taxi (or transit-tier-appropriate alternative). Three independent layers — validator → repair → gate fallback — all driven by a single new failure code `WALK_OVER_THRESHOLD`.

This complements the existing `enforceTransitModeByDistance` post-LLM sanitizer (`_shared/transit-mode.ts`, threshold 650 m) by adding a **harder ceiling**: even if a "walk" leg slipped past the 650 m guard (e.g. coords missing at sanitizer time, value reconstructed downstream from a length string), the validate→repair→gate cascade will catch it before persist.

## Reuse, don't fork

The user-supplied spec proposes a new `_shared/transit-mode-helper.ts` with `pickTransitMode(distanceMeters, currentDurationMin)`. **A shared helper already exists** at `_shared/transit-mode.ts` exposing `pickTransitTier(distanceMeters, destinationName)` with constants `MAX_WALK_DISTANCE_METERS = 650` and `MAX_WALK_DURATION_MINUTES = 15`, used by both `optimize-itinerary` and the sanitizer.

Decision: **extend the existing module** rather than create a parallel one. Add:

```ts
// _shared/transit-mode.ts
export const WALK_HARD_DISTANCE_METERS = 1500;
export const WALK_HARD_DURATION_MINUTES = 30;

export function pickTransitFallback(
  distanceMeters: number | null | undefined,
  currentDurationMin?: number,
  destinationName?: string,
): TransitTier {
  if (distanceMeters != null && Number.isFinite(distanceMeters) && distanceMeters > 0) {
    return pickTransitTier(distanceMeters, destinationName || 'destination');
  }
  // Unknown distance → conservative taxi default
  return {
    method: 'uber',
    durationMinutes: Math.max(currentDurationMin ?? 0, 20),
    costAmount: 15,
    instructions: `Taxi to ${destinationName || 'destination'}`,
    distanceMeters: 0,
  };
}
```

The repair handler and gate fallback both call `pickTransitFallback`. No duplicate logic, no thresholds drift.

## Changes

### 1. `pipeline/types.ts`
Add `WALK_OVER_THRESHOLD: 'WALK_OVER_THRESHOLD'` to `FAILURE_CODES`.

### 2. `_shared/transit-mode.ts`
Append `WALK_HARD_DISTANCE_METERS`, `WALK_HARD_DURATION_MINUTES`, and `pickTransitFallback` (above). Do **not** create `transit-mode-helper.ts`.

### 3. `pipeline/validate-day.ts`
New `checkWalkOverThreshold(activities, results)` invoked from `validateDay` immediately after `checkPriceDuplication` (line 169). Iterates activities; for each `category ∈ {transport, transit}` whose `transportation.method` matches `walk|walking`, if `durationMinutes > 30` OR `distanceMeters > 1500` push:

```
{
  code: FAILURE_CODES.WALK_OVER_THRESHOLD,
  severity: 'critical',
  message: `Transit "${title}" is walk for ${dur}min / ${dist}m — exceeds 30min/1500m threshold`,
  activityIndex: i,
  field: 'transportation',
  autoRepairable: true,
}
```

### 4. `pipeline/repair-day.ts`
Append a new handler block in the same idiom as the existing `if (byCode.has(FAILURE_CODES.X))` chains. For each flagged index:
- Read `t.distanceMeters`, `t.durationMinutes`, destination from the next activity's location name (fallback: empty).
- Call `pickTransitFallback(distanceMeters, durationMinutes, destName)` → `{ method, durationMinutes, costAmount, instructions }`.
- Write back: `t.method`, `t.durationMinutes`, `t.duration = '${dur} min'`, `t.estimatedCost = { amount, currency: t.estimatedCost?.currency || 'USD' }`. Mirror to top-level `cost.amount` if present.
- Rewrite title prefix `Walk ` → `Taxi ` / `Metro ` to match new method.
- Push `{ code: FAILURE_CODES.WALK_OVER_THRESHOLD, action: 'walk_to_taxi', activityIndex: i, before: { method:'walk', dur, dist }, after: { method, dur: newDur, cost: newCost } }`.

### 5. `pipeline/validation-gate.ts`
Add explicit `case FAILURE_CODES.WALK_OVER_THRESHOLD:` in the switch (line 81). Performs the same swap with conservative defaults — `pickTransitFallback(t.distanceMeters, t.durationMinutes)` — even if coords/distance are missing it lands on `{ method: 'uber', dur: max(current,20), cost: 15 }`. Increments `forcedDowngrades`. Default branch no longer fires for this code.

### 6. `optimize-itinerary/index.ts`
Refactor `getHaversineTransport` (~line 1457) to delegate to `pickTransitTier` from `_shared/transit-mode.ts` (it likely already does after the prior fix; verify and remove any remaining duplicated thresholds).

## Verification

- Unit-style: extend `__tests__/transit-mode.test.ts` (or sibling `walk-over-threshold.test.ts`) covering:
  - 35-min/1200m walk → flagged + repaired to taxi/metro per distance tier.
  - 20-min/1800m walk → flagged + repaired (distance gate fires even when duration OK).
  - 25-min/900m walk → not flagged.
  - Missing distance, 40-min walk → flagged, gate fallback yields `uber/20min/$15`.
- Live: regenerate a Cape Town trip with the prior Kirstenbosch→Woodstock leg; confirm sentinel logs `[VALIDATION_GATE] day=N … forcedDowngrades>=1` and the persisted card shows method=`uber`/`metro` and cost > 0.

## Notes

- Severity is `critical` so the gate handles it even if repair-day is skipped (e.g. legacy paths that call `validate-day` standalone).
- `enforceTransitModeByDistance` (650 m) keeps firing first; this layer is the safety net at the higher 1500 m ceiling for cases where distance was not known at sanitizer time but became known later (e.g. enriched by Google Distance Matrix during `enrich-day`).
- Memory entry to add after merge: extend `mem://constraints/itinerary/transit-mode-distance-guard` with the new 1500m/30min hard ceiling and `WALK_OVER_THRESHOLD` failure code.
