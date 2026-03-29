

# Phase 1: Retire Legacy `generate-full` Path

## What exists today

- **`action-generate-full.ts`** (2,962 lines) — a monolithic pipeline that does its own context prep, preference blending, prompt building, AI generation, enrichment, and saving. It's a complete parallel universe to the day-chain pipeline.
- **`index.ts`** — routes `action === 'generate-full'` to `handleGenerateFull()`.
- **One external caller**: `enrich-manual-trip/index.ts` calls `generate-itinerary` with `action: "generate-full"` and `smartFinishMode: true`. This is the "Smart Finish" flow for manual trips.
- **No frontend callers**: The frontend uses `generate-trip` (day-chain). Only the test file and `enrich-manual-trip` reference `generate-full`.

## What changes

### 1. Gut `action-generate-full.ts` → thin redirect

Replace the 2,962-line implementation with ~30 lines that:
- Extract `tripId`, `smartFinishMode` from params
- Write `smartFinishMode` into `trip.metadata` if truthy (so the day-chain pipeline picks it up)
- Call `handleGenerateTrip()` with the same `tripId` + standard params from the trip record
- Return whatever `handleGenerateTrip` returns

This means `generate-full` becomes an alias for `generate-trip` — same day-chain pipeline, same post-processing, one path.

### 2. Update `index.ts` routing

The `generate-full` action block currently passes `authHeader` to `handleGenerateFull`. The new thin redirect won't need it (self-chaining is handled by `handleGenerateTrip` internally). Simplify the dispatch to match the `generate-trip` pattern.

### 3. Update `enrich-manual-trip/index.ts`

Change the call from `action: "generate-full"` to `action: "generate-trip"` with the correct params shape. This eliminates the need for the redirect entirely, but we keep the redirect in `action-generate-full.ts` as a safety net for any other callers.

### 4. Update test file

`index.test.ts` references `generate-full` — update to use `generate-trip` or adjust expectations.

## What does NOT change

- `action-generate-trip.ts` — untouched, it's the target
- `action-generate-trip-day.ts` — untouched
- `action-generate-day.ts` — untouched
- `sanitization.ts` — untouched
- Frontend code — no frontend uses `generate-full`

## Risk assessment

**Low risk.** The day-chain pipeline already handles all trip types including Smart Finish (it reads `smartFinishMode` from metadata). The only real caller (`enrich-manual-trip`) just needs its action name updated. The old 2,962-line file becomes dead code replaced by a redirect.

## Files touched

| File | Change |
|------|--------|
| `action-generate-full.ts` | Gut → ~30-line redirect to `handleGenerateTrip` |
| `index.ts` | Simplify `generate-full` dispatch (drop `authHeader` pass) |
| `enrich-manual-trip/index.ts` | Change action from `generate-full` to `generate-trip` |
| `index.test.ts` | Update test to match new routing |

