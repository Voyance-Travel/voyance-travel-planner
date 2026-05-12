
# Why itinerary fixes keep recurring — and how to break the cycle

Your diagnostic is correct. I verified the three locks against the current codebase: the save action returns `success: true` even when meal/hotel-return/description invariants are violated, there is no `.github/workflows/` directory, and the meal/hotel-return/description concerns each have multiple independent call sites that can undo one another.

The cheapest, highest-leverage intervention is **LOCK 3 first**. Once the save refuses to persist a broken trip, every duplicated code path is forced to either produce correct output or be visibly removed — which makes LOCK 2 safe to do incrementally rather than as a big-bang refactor. LOCK 1 (CI) lands in parallel as a backstop.

Below is the staged plan. Each stage is independently shippable.

---

## Stage 1 — Close LOCK 3: make `save-itinerary` a real gate (1 day)

Goal: a broken itinerary cannot silently land in `trips.itinerary_data`. The user sees the failure at generation time, not 5 cities later.

### 1a. New file: `supabase/functions/_shared/validate-itinerary-for-persist.ts`

Single pure function that runs the existing invariants we already have helpers for, and returns a structured verdict instead of mutating or warning.

```ts
export interface PersistValidationError {
  code: 'MISSING_REQUIRED_MEAL'
      | 'MISSING_HOTEL_RETURN'
      | 'EMPTY_DINING_DESCRIPTION'
      | 'PHANTOM_PREDAWN_CARD'
      | 'OVERLONG_ACTIVITY'        // > 6h non-logistics
      | 'WRAP_GAP_OVER_3H'         // covers Iron Fairies / 19h gap
      | 'CURRENCY_MISMATCH'        // HKD vs CN¥ class
      | 'EMPTY_DAY';
  dayNumber: number;
  activityId?: string;
  detail: string;
}
export interface PersistVerdict {
  ok: boolean;
  errors: PersistValidationError[];
  warnings: PersistValidationError[];
}
export function validateItineraryForPersist(
  days: any[],
  ctx: { destination: string; policy: MealPolicy; hotelName?: string }
): PersistVerdict;
```

Internally composes the helpers that already exist (`enforceRequiredMealsFinalGuard` in dry-run mode, `runStep8` invariant check, `ensureDayDiningDescriptions` in dry-run mode, `stripPreDawnHotelReturns` in dry-run mode, plus a new duration/gap check and a destination→currency check using `cityCountryMap` + `exchange-rates`). Dry-run = report what they *would* mutate; do not mutate.

### 1b. Wire the gate into `action-save-itinerary.ts`

Just before the final `success: true` return (around L1084), call the gate. Behavior:

- `errors.length === 0` → persist + return `success: true` (today's behavior).
- `errors.length > 0` → still persist (so the user sees the partial result and can edit), but return HTTP **422** with `{ success: false, code: 'NEEDS_REGENERATION', errors, warnings, persistedDespiteErrors: true }`. Stamp `metadata.persist_validation = { failed_at, errors }` on the trip row so the UI can surface a per-day banner without re-calling the gate.

We deliberately keep the row written so the user doesn't lose context — the gate's job is to **signal**, not to discard work.

### 1c. Surface 422 in the UI

`src/components/itinerary/EditorialItinerary.tsx` (and the chat action executor) already centralize save responses through `safeUpdateItineraryData`. Add one branch: when the response carries `code === 'NEEDS_REGENERATION'`, render a per-day amber banner: *"Day N didn't save cleanly: missing dinner. Regenerate Day N."* with a button that calls the existing per-day refresh.

This is the conversion from "ship blind" to "ship verified at the moment of save."

### 1d. Tests
- `validate-itinerary-for-persist.test.ts` covering each error code with a fixture that today reaches production (Hong Kong Day 1 no breakfast, Mallorca Day 2 phantom 1:20 AM, Bangkok 9h Iron Fairies, Hong Kong CN¥).
- One integration test against `action-save-itinerary` confirming a known-broken day returns 422 + persists + stamps metadata.

---

## Stage 2 — Close LOCK 1: CI on every change (1 week, parallelizable with Stage 1)

### 2a. `.github/workflows/test.yml`
Runs on every PR + push to main:
- `bun install`
- `bun run test` (vitest — 17 existing suites, including the bookend/meal/dining specs already in the repo)
- `deno test --allow-net --allow-env supabase/functions/**/*.test.ts`
- `bunx playwright test` against the **published** URL `voyance-travel-planner.lovable.app` for the smoke set only (`critical-paths.spec.ts`, `trip-itinerary.spec.ts`) — full suite nightly.

Block merge on red. This alone would have caught every regression in the user's list because the matching specs already exist (`hotel-return-bookend.test.ts`, `meal-detection-false-positives.test.ts`, `dining-description-rescue.test.ts`, `bookend-edge-cases.test.ts`, `late-nightlife-source-survival.test.ts`, etc.).

### 2b. Lovable apply flow
Confirm Lovable commits land on `main` (current behavior). Workflow runs post-commit; if red, the user gets a GitHub notification within ~3 minutes and reverts via Lovable's version history. No change to Lovable apply itself.

### 2c. Edge function deploy gate
Add a tiny `scripts/preflight-edge.ts` invoked in CI that runs `deno check` over every edge function entrypoint — catches the recurring "scope crash" class (`isFastPaced`, `isTransportFinal`) before deploy.

---

## Stage 3 — Close LOCK 2: collapse duplicated paths (2–3 weeks, incremental)

Done in this order so each step is safe under the Stage 1 gate:

1. **Hotel-return**: keep `runStep8` as canonical. Delete the inline injection at `action-generate-trip-day.ts:1892` and `:2165` and replace with a single call to `runStep8`. The save-time net at `action-save-itinerary.ts:504` becomes a `validateItineraryForPersist` *check only* (already covered by the gate).
2. **Dining descriptions**: keep `ensureDayDiningDescriptions` (persist-boundary, already landed) as canonical. Remove the LLM-batched `fillMissingDescriptions` call from `generation-core.ts` Stage 6 and from `action-generate-trip-day.ts` post-repair — both become redundant once persist-boundary is the single guarantee. UI `resolveActivityDisplayDescription` stays as a legacy-data display safety net only.
3. **Meal injection**: keep `enforceRequiredMealsFinalGuard` (in `day-validation.ts`) as canonical. Reduce the 5 sites to 1 generation-time call + 1 persist-boundary check. The persist check uses the same dry-run helper Stage 1 introduces.

Each step ships behind the Stage 1 gate, so any regression surfaces immediately as a 422 on the next save instead of as a QA finding in city N+1.

---

## Sequencing & risk

| Stage | Effort | Risk | When |
|---|---|---|---|
| 1 — Save gate | 1 day | Low. Worst case: false-positive 422s; dial down by moving codes from `errors` to `warnings`. | Now |
| 2 — CI | 1 week | Low. Tests already exist; only wiring is new. | Parallel with Stage 1 |
| 3 — Path consolidation | 2–3 weeks | Medium. Refactor in pre-launch. Mitigated entirely by Stages 1 + 2. | After Stages 1 + 2 are green for 1 week |

---

## What this gets you

- **Day 1**: every new generation that violates a known invariant returns 422; the user sees a per-day "regenerate" CTA instead of a silently broken trip 5 days later in QA.
- **Week 1**: every Lovable apply that breaks an existing invariant fails CI within 3 minutes of commit; the user reverts via version history.
- **Week 4**: the duplication that lets fixes "come back in a different city" is gone; there is one canonical path per concern, gated and tested.

The recurring-bug pattern ends because the user stops being the verification signal.

## Open questions (please confirm before I implement Stage 1)

1. On a 422, do you want the partial result **persisted with a banner** (my recommendation, preserves user work) or **rejected entirely** (purer but loses generation cost)?
2. For currency mismatch (Hong Kong → CN¥), should that be an `error` (blocks) or `warning` (logs only) in the first cut? I'd start as `warning` to avoid blocking on currency-table gaps, then promote.
3. Should the CI Playwright smoke run against the **published** URL (current default) or a **staging** environment? Published is simpler but means CI failures can chase a deploy that already shipped.
