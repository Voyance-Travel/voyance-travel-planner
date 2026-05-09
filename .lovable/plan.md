## Goal

Stop transit cards from showing "Walk · 2h26m" when the segment is actually a 12–15 km cross-district hop. Mirror the existing `enforceBarNightcapPriceCap` pattern with a post-LLM guard that overrides `transportation.method` (and recomputes duration + cost) whenever the haversine distance between origin and destination exceeds the walking threshold.

## What's already in place

- `optimize-itinerary/index.ts` already has the canonical thresholds:
  - `MAX_WALK_DISTANCE_METERS = 650`
  - `MAX_WALK_DURATION_MINUTES = 15`
  - And the canonical `getHaversineTransport(origin, destination, name)` that returns `{ method, durationMinutes, costAmount, instructions }` for walk / metro / uber tiers.
- `geographic-coherence.ts` exports `haversineDistance(lat1, lng1, lat2, lng2)`.
- `sanitization.ts` line 1469 only zeroes the cost when `method === 'walk'` — it never overrides the method or duration.
- `universal-quality-pass.ts` already iterates every activity and calls `enforceBarNightcapPriceCap` — the right place to also call the new guard.

## What's wrong

1. **Generative gap:** the LLM emits `transportation.method: 'walking'` for any connector it doesn't have distance context for. No prompt rule rejects walking on inter-district hops.
2. **Sanitizer gap:** nothing post-LLM converts `walk → uber/metro` based on actual distance, so a 12 km segment is rendered as "Walk · 144 min".
3. **Optimization gap:** `getOptimalTransport` only runs in the optimize pass and silently no-ops when Google Routes fails or named-place coords aren't resolvable, so the LLM's walking value survives.

## Change — Option B (sanitizer guard) + Option A (prompt one-liner)

### 1. New shared helper: `supabase/functions/_shared/transit-mode.ts`

Extract the tier logic from `optimize-itinerary/index.ts::getHaversineTransport` into a pure function so both the optimize path and the new sanitizer guard call the same code:

```ts
export const MAX_WALK_DISTANCE_METERS = 650;
export const MAX_WALK_DURATION_MINUTES = 15;

export interface TransitTier {
  method: 'walk' | 'metro' | 'uber';
  durationMinutes: number;
  costAmount: number;          // EUR
  instructions: string;
}

export function pickTransitTier(distanceMeters: number, destinationName: string): TransitTier;
```

`optimize-itinerary/index.ts` is refactored to import from this helper (no behavior change there).

### 2. New sanitizer: `enforceTransitModeByDistance` in `sanitization.ts`

Signature mirrors `enforceBarNightcapPriceCap`:

```ts
export function enforceTransitModeByDistance(
  activity: Record<string, any>,
  prevActivity: Record<string, any> | null,
  nextActivity: Record<string, any> | null,
  logPrefix = 'SANITIZE',
): boolean
```

Behavior:
- Only acts on transit cards (category `transit`/`travel` or title matching `TRANSIT_TITLE_RE`).
- Resolves origin coords from `activity.from` / `activity.transportation.from` / `prevActivity.location.coordinates` and destination coords from `activity.to` / `activity.transportation.to` / `nextActivity.location.coordinates` / `activity.location.coordinates`.
- If both coords resolve and `method ∈ {walk, walking, on foot}`:
  - Compute `distanceMeters` via `haversineDistance`.
  - If `distanceMeters > MAX_WALK_DISTANCE_METERS` OR walk-minutes > 15 → call `pickTransitTier` and overwrite:
    - `transportation.method`
    - `transportation.duration` (formatted) + `durationMinutes`
    - `transportation.estimatedCost = { amount, currency: 'USD' }`
    - `transportation.instructions`
    - `activity.title` if it starts with `Walk to ` → `Taxi to ` / `Metro to `
  - Log `[TRANSIT_MODE_OVERRIDE]` with old/new method, distance, duration.
- If coords don't resolve, leave the card alone (no false positives).

### 3. Wire into both fan-outs

- `sanitization.ts::sanitizeGeneratedDay` map callback (~line 1466 block): walk activities array as `(act, i, arr) => enforceTransitModeByDistance(act, arr[i-1], arr[i+1], …)` after the existing instructions/cost block. Keep the existing `method === 'walk' → cost = 0` branch as the fallback for legitimate sub-650m walks.
- `universal-quality-pass.ts` (~line 274, next to `enforceBarNightcapPriceCap`): add `enforceTransitModeByDistance(act, prev, next, label)` so the pass catches anything that slipped through earlier stages.

### 4. Prompt one-liner — `prompt-library.ts` transit/connector schema block

Add (anywhere the connector card schema is described):

> `"transportation.method": use "walking" ONLY for segments under ~650 m on foot (<15 min walk). For any inter-district hop (e.g. garden → neighborhood, two venues in different parts of the city), use "uber" or "metro". Never output "walking" for a 1+ km segment.`

This reduces how often the sanitizer guard has to fire.

### 5. Test

New `__tests__/transit-mode.test.ts` covering:
- `Walk to Woodstock` connector with 12 km between coords → overridden to `uber`, duration ≈ 27 min, cost > 0.
- 400 m walk between two adjacent venues → untouched.
- Transit card with no coords → untouched (no false positive).
- Title rewrite: `Walk to Kirstenbosch` → `Taxi to Kirstenbosch` when overridden.

## Files

- New: `supabase/functions/_shared/transit-mode.ts`
- New: `supabase/functions/generate-itinerary/__tests__/transit-mode.test.ts`
- Edit: `supabase/functions/generate-itinerary/sanitization.ts` (export + call site)
- Edit: `supabase/functions/generate-itinerary/universal-quality-pass.ts` (call site)
- Edit: `supabase/functions/optimize-itinerary/index.ts` (refactor `getHaversineTransport` to delegate to shared helper — pure refactor, no behavior change)
- Edit: `supabase/functions/generate-itinerary/prompt-library.ts` (one-line constraint)

## Verification

- `bunx vitest run supabase/functions/generate-itinerary/__tests__/transit-mode.test.ts`
- Deploy `generate-itinerary` + `optimize-itinerary`.
- Watch edge logs for `[TRANSIT_MODE_OVERRIDE]` on the next Cape Town generation — Kirstenbosch → Woodstock should emit one and render as "Taxi · ~27 min".

## Memory

New entry `mem://constraints/itinerary/transit-mode-distance-guard` capturing the shared `pickTransitTier` helper, the 650 m / 15 min thresholds, and the four call sites (sanitizeGeneratedDay, universalQualityPass, optimize-itinerary refactor, prompt rule).
