# Fix: Walking transits crossing water boundaries (Bosphorus, Bay, Thames, East River)

## Root Cause
`checkWalkOverThreshold` in `supabase/functions/generate-itinerary/pipeline/validate-day.ts:1185` only flags walks whose duration > 30 min (or > 20 min luxury) OR distance > 1500 m. A "15-min walk" from Topkapi (European Istanbul) to Çiya Sofrası (Asian Kadıköy) is short by these thresholds — so no failure code is emitted, repair-day §15b never runs, and an impossible cross-Bosphorus walk ships.

There is no continent / water-body check anywhere in the pipeline (`rg "ferry|water_cross|bosphorus"` returns 0 hits).

## Change 1 — `supabase/functions/_shared/transit-mode.ts`

Add a tiny pure helper alongside `haversineMeters` / `pickTransitTier`:

```ts
export type WaterCrossing = { city: string; reason: string };

/**
 * Hard-coded water/borough boundaries. Detect when a straight-line leg
 * crosses a body of water that pedestrians cannot traverse (or where the
 * required bridge dwarfs the haversine distance).
 *
 * Returns null when no boundary is crossed.
 */
export function detectWaterCrossing(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
): WaterCrossing | null {
  // Istanbul — Bosphorus: lng ≈ 29.02
  if (from.lat > 40.8 && from.lat < 41.3 && to.lat > 40.8 && to.lat < 41.3
      && ((from.lng < 29.00 && to.lng > 29.05) || (from.lng > 29.05 && to.lng < 29.00))) {
    return { city: 'Istanbul', reason: 'Bosphorus (Europe ↔ Asia)' };
  }

  // NYC — East River: Manhattan (lng < -73.97) ↔ Brooklyn/Queens (lng > -73.97)
  if (from.lat > 40.55 && from.lat < 40.92 && to.lat > 40.55 && to.lat < 40.92
      && ((from.lng < -73.972 && to.lng > -73.945) || (from.lng > -73.945 && to.lng < -73.972))) {
    return { city: 'New York', reason: 'East River (Manhattan ↔ Brooklyn/Queens)' };
  }

  // SF Bay — SF (lng < -122.38) ↔ Oakland/Alameda (lng > -122.32)
  if (from.lat > 37.7 && from.lat < 37.9 && to.lat > 37.7 && to.lat < 37.9
      && ((from.lng < -122.38 && to.lng > -122.32) || (from.lng > -122.32 && to.lng < -122.38))) {
    return { city: 'San Francisco', reason: 'SF Bay (SF ↔ Oakland)' };
  }

  // London — Thames: lat ≈ 51.505 (rough east-west river through central London)
  if (from.lng > -0.25 && from.lng < 0.05 && to.lng > -0.25 && to.lng < 0.05
      && ((from.lat < 51.498 && to.lat > 51.512) || (from.lat > 51.512 && to.lat < 51.498))) {
    return { city: 'London', reason: 'Thames (north ↔ south)' };
  }

  return null;
}
```

Pure function, no I/O. Bounding boxes prevent false-positives in unrelated cities that happen to share a longitude.

## Change 2 — `pipeline/validate-day.ts` `checkWalkOverThreshold` (~line 1185)

After the existing `if (dur <= durCap && dist <= distCap) continue;` short-circuit, add a coordinate-pair water-crossing check that **fires regardless of distance/duration**:

```ts
// Cross-water guard — short walks can still cross impassable water bodies.
const fromC = extractCoords((act as any)?.transportation?.from)
  || extractCoords(activities[i - 1] || {});
const toC = extractCoords((act as any)?.transportation?.to)
  || extractCoords(activities[i + 1] || {})
  || extractCoords((act as any)?.location || {});
if (fromC && toC) {
  const crossing = detectWaterCrossing(fromC, toC);
  if (crossing) {
    results.push({
      code: FAILURE_CODES.WALK_OVER_THRESHOLD,
      severity: 'critical',
      message: `Walk "${act.title}" crosses ${crossing.reason} — must be ferry/taxi`,
      activityIndex: i,
      meta: { waterCrossing: crossing },
    });
    continue; // already flagged; don't double-emit on duration/distance
  }
}
```

Reuse `WALK_OVER_THRESHOLD` so the existing repair-day §15b handler picks it up — no new failure code, no validation-gate wiring change needed.

## Change 3 — `pipeline/repair-day.ts` §15b (~line 3577)

After the existing `pickTransitTier` call, override the chosen mode when the validation result tagged the leg as a water crossing:

```ts
// Water-crossing override: pickTransitTier doesn't know about ferries.
const wc = vr?.meta?.waterCrossing as { city?: string; reason?: string } | undefined;
if (wc) {
  tier = {
    method: 'ferry' as any,
    durationMinutes: Math.max(tier.durationMinutes, 25), // ferry crossing floor
    costAmount: tier.costAmount > 0 ? tier.costAmount : 5,
    instructions: `Ferry across ${wc.reason}`,
    distanceMeters: tier.distanceMeters,
  };
  // Rewrite "Walk to X" → "Ferry to X"
  if (typeof act.title === 'string') {
    act.title = act.title.replace(/^(?:Walk|Walking|Stroll)\b/i, 'Ferry');
  }
  console.log(`[transit] Day ${dayNumber} downgraded walk → ferry: ${act.title} crosses water boundary (${wc.reason})`);
}
```

Requires threading `vr` into the loop — current code maps to indices only; adjust to keep the full `ValidationResult` so `meta.waterCrossing` survives.

The existing label rewrite (`Walk → Taxi`) at line 3625 is replaced by `Ferry` only when `wc` is set; otherwise existing behavior is preserved.

## Out of Scope
- Generic "altitude/network unclear" heuristic from the bug report — too noisy without routing data; the bounded city list covers the documented false-positive cases. Add cities incrementally as new reports come in.
- LLM-generation-time prompt rule (separate concern).
- Refresh-day / chat-action paths (they already re-run validate→repair).

## Tests — new `__tests__/water-crossing-walk.test.ts`

1. `detectWaterCrossing` Topkapi (41.0115, 28.9833) → Çiya (40.9893, 29.0254) → returns Istanbul/Bosphorus.
2. `detectWaterCrossing` Sultanahmet → Galata (both European, lng 28.97 / 28.97) → returns null (no false-positive same-side).
3. `detectWaterCrossing` Manhattan (40.758, -74.000) → DUMBO (40.703, -73.989) → returns NYC/East River.
4. `detectWaterCrossing` Paris ↔ Marais (both lng ≈ 2.35) → returns null (outside London bbox).
5. `validate-day.checkWalkOverThreshold` — 15-min walk Topkapi → Çiya → emits `WALK_OVER_THRESHOLD` with `meta.waterCrossing.city === 'Istanbul'`.
6. `repair-day` §15b — given the above failure, mutates `transportation.method = 'ferry'`, `durationMinutes >= 25`, title prefix `Ferry`.

## Sentinels
- `[transit] Day N downgraded walk → ferry: ... crosses water boundary (...)`
- Existing `[WALK_OVER_THRESHOLD]` log still fires.
