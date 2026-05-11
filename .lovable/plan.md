## Problem

Madrid Day 1 (luxury luminary) routed a 1h 27m / ~3.5km walk Palacio Real → DiverXO. The current hard-walk ceiling (`WALK_HARD_DURATION_MINUTES=30`, `WALK_HARD_DISTANCE_METERS=1500` in `supabase/functions/_shared/transit-mode.ts`) is single-tier — a 25-min / 1200m walk is "fine" for everyone, including a luxury luminary who shouldn't be hoofing it across Centro→Salamanca.

The validate→repair→gate cascade is already in place (validate-day.ts §`checkWalkOverThreshold`, repair-day.ts §15b, validation-gate.ts) and `budgetTier` is already plumbed at every `validateDay(...)` call site (`action-generate-day.ts`, `action-generate-trip-day.ts`). What's missing is a tier-aware threshold.

The original 1h 27m / 3.5km case is already caught by the universal hard ceiling (>30m AND >1500m) — that fix shipped in mem://constraints/itinerary/transit-mode-distance-guard. This plan tightens the ceiling for luxury so cases like 25 min / 1.2 km — currently passing — are also flagged for the luxury cohort.

## Plan

### 1. Add tier-aware constants — `_shared/transit-mode.ts`

```ts
export const WALK_HARD_DISTANCE_METERS = 1500;     // existing
export const WALK_HARD_DURATION_MINUTES = 30;       // existing
export const WALK_LUXURY_DISTANCE_METERS = 1000;   // new
export const WALK_LUXURY_DURATION_MINUTES = 20;     // new
```

Add a tiny helper so the tier→threshold mapping has one source of truth:

```ts
export function isLuxuryTier(budgetTier?: string | null): boolean {
  const t = String(budgetTier || '').toLowerCase().trim();
  return t === 'luxury' || t === 'luminary' || t === 'splurge' || t === 'premium';
}
export function walkThresholdsFor(budgetTier?: string | null) {
  return isLuxuryTier(budgetTier)
    ? { duration: WALK_LUXURY_DURATION_MINUTES, distance: WALK_LUXURY_DISTANCE_METERS }
    : { duration: WALK_HARD_DURATION_MINUTES, distance: WALK_HARD_DISTANCE_METERS };
}
```

Note: per `mem://technical/observability/google-api-centralization` we deliberately do NOT add an async `checkMetroRoute` Google-Directions call inside repair. The existing `pickTransitTier` (haversine-based: walk ≤650m, metro <5km, uber ≥5km) is the canonical metro-vs-taxi decision and runs synchronously after enrichment.

### 2. Plumb `budgetTier` into validator — `pipeline/validate-day.ts`

- Add `budgetTier?: string` to `ValidateDayInput` (line ~99).
- Destructure in `validateDay(...)` (line ~115) and pass into `checkWalkOverThreshold(activities, results, budgetTier)`.
- Inside `checkWalkOverThreshold`:
  - Import `walkThresholdsFor` and `isLuxuryTier` from `_shared/transit-mode.ts`.
  - Resolve `const { duration: durCap, distance: distCap } = walkThresholdsFor(budgetTier);` once.
  - Replace lines 1226 / 1230 to use `durCap` / `distCap` and stamp `tier: isLuxuryTier(budgetTier) ? 'luxury' : 'standard'` into the result message and (optionally) a new `meta.tier` field on `ValidationResult` (re-uses existing `meta?: any` field if present; otherwise embed in message string).

### 3. Pass `budgetTier` at every call site

Four files, each already has `budgetTier` in scope:

- `action-generate-day.ts` lines 1216–1238 and the post-repair re-validation at line 1296 — add `budgetTier` to both `ValidateDayInput` literals.
- `action-generate-trip-day.ts` lines 1351 and 1449 — same addition (uses `tripMeta?.budget_tier` already destructured nearby).

### 4. Repair handler — `pipeline/repair-day.ts` §15b (lines 3577–3634)

No structural changes needed: `pickTransitTier` already maps any distance >650m to metro (<5km) or uber (≥5km), which satisfies the user's "metro if available, else taxi" intent without an extra Google call. The luxury 1000m / 20-min ceiling is enforced earlier (validator); once flagged, the existing repair handles the swap and rewrites `Walk to X` → `Metro to X` / `Taxi to X`.

Two small touches:

- Read `budgetTier` from `input` (already accessed elsewhere as `(input as any).budgetTier`) and stamp `repairs.push({ ..., tier: 'luxury' | 'standard' })` plus include the tier in the `[WALK_OVER_THRESHOLD]` console line so post-mortem grep tells us which cohort triggered the repair.
- No new constants in repair — single source of truth lives in `_shared/transit-mode.ts`.

### 5. Tests — `__tests__/walk-over-threshold.test.ts`

Add three cases to the existing file:

1. `luxury tier flags 25-min / 1200m walk` — same day, `budgetTier: 'luxury'`, expects WALK_OVER_THRESHOLD.
2. `standard tier does NOT flag 25-min / 1200m walk` — control case, expects no violation.
3. `in-neighborhood 8-min / 600m walk passes for luxury` — Plaza Mayor → Mercado San Miguel sized hop stays a walk.
4. `repair on luxury 25-min walk produces metro (1.2km < 5km)` — assert `t.method === 'metro'` and title rewritten to `Metro to ...`.

### 6. Memory

Extend `mem://constraints/itinerary/transit-mode-distance-guard` with the tier-aware addendum (luxury 20m/1000m, standard 30m/1500m) and a one-liner pointer in `mem://index.md` Core under the existing Transit Estimation entry. Do NOT create a new memory file — this is the same constraint family.

## Out of Scope

- Archetype-id-based gating (`luxury_luminary` / `status_seeker`). `budgetTier` is the cleaner, already-plumbed signal and covers the 4-tier set (`value` / `moderate` / `luxury` / `luminary`). If the user wants archetype-OR semantics later, `isLuxuryTier` is the one-line extension point.
- Async metro-route lookups via Google Directions — explicit constraint per `mem://technical/observability/google-api-centralization` and existing `pickTransitTier` already covers the decision.
- No changes to the 650m sanitizer (`MAX_WALK_DISTANCE_METERS`) — that's the global ceiling for newly-emitted walk cards and tightening it would over-correct for non-luxury tiers.

## Verification

- `bunx vitest run supabase/functions/generate-itinerary/__tests__/walk-over-threshold.test.ts` — all existing + 4 new cases pass.
- Manual repro: regenerate a luxury Madrid trip with cross-district anchors; confirm no Walk leg >20 min / >1000m, in-neighborhood walks (≤15 min) preserved. Standard-tier control trip still allows up to 30 min / 1500m.
- Grep `[WALK_OVER_THRESHOLD] day=… tier=luxury` in edge logs after a luxury regeneration.

## Files Touched

- `supabase/functions/_shared/transit-mode.ts` (new constants + helpers)
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` (input field + tier-aware `checkWalkOverThreshold`)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (tier stamping in repair record + log line)
- `supabase/functions/generate-itinerary/action-generate-day.ts` (pass `budgetTier` into `ValidateDayInput` ×2)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (pass `budgetTier` into `ValidateDayInput` ×2)
- `supabase/functions/generate-itinerary/__tests__/walk-over-threshold.test.ts` (4 new cases)
- `mem://constraints/itinerary/transit-mode-distance-guard` (tier-aware addendum)
- `mem://index.md` (one-liner update on Transit Estimation Core entry)
