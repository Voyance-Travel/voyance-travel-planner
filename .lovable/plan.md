# Authoritative Day-1 Arrival Anchor

The integrity contract already detects `FLIGHT_ANCHOR_COMMIT_MISMATCH` and the freeze gate already demotes the trip to `partial` when it fires. The actual leak is that the **LLM-emitted arrival time is still the value that gets persisted into the activity card**. `repair-day.ts §3b` tries to reconcile it, but it runs late in the pipeline, depends on a stack of optional inputs (`arrivalTime24 && !isHotelChange`), and any earlier mutating pass that touches the arrival card can re-introduce the wrong time. Result: the validator sees the mismatch, marks the trip `partial`, but the card the user sees still carries the LLM time.

Root cause restated: **no single point in the pipeline owns the arrival time**. We have detection (integrity contract), best-effort repair (repair-day §3b), and runtime re-verification (schedule-executioner), but no deterministic, idempotent stamp the moment the LLM response lands.

## What to build

### 1. Single stamper module — `stampArrivalAnchorTruth`

New file `supabase/functions/_shared/stamp-arrival-anchor-truth.ts`. Pure function, no I/O:

```text
stampArrivalAnchorTruth(day, {
  isFirstDay,
  arrivalTime24,        // ground truth from normalizeFlightSelection
  arrivalAirport,
  airportProcessingMins = AIRPORT_PROCESSING_MINS,
}): { day, mutated, action }
```

Behavior:
- No-op when `!isFirstDay`, `!arrivalTime24`, or `isHotelChange`.
- Locate the arrival-flight card using the same multi-signal detector already in `repair-day §3b` (`anchorSource==='arrival-flight'` OR title regex OR `tags.includes('arrival-flight')`).
- If found: rewrite `startTime = arrivalTime24`, `endTime = arrivalTime24 + processingMins`, stamp `anchorSource='arrival-flight'`, `isLocked=true`, `lockReason='flight-truth'`, `source='stamp-arrival-truth'`. Preserve title/description/location.
- If not found: do nothing here (injection still belongs to `repair-day §3b` — it has all the hotel/transfer context).
- Returns `{ mutated: true, action: 'overwrote_arrival_anchor', wasStart, wasEnd, newStart, newEnd }` for tracing.

### 2. Call the stamper at every post-LLM boundary

Wire it as the **first** mutation on the LLM response in both generation paths, before validate/repair/enrich:

- `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts` — right after the LLM returns `ai.day`, before `validate_day_pre_repair`.
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — right after the per-day LLM call resolves, before `validateDay`/`repairDay`.

The stamper is idempotent, so calling it again later (defense in depth) is safe. Add a second call at the end of `repair-day.ts` (after §3b) and at the start of `schedule-executioner.enforceFlightAnchors` to harden the chain.

### 3. Anchor-guard immutability for `lockReason='flight-truth'`

Update `supabase/functions/generate-itinerary/anchor-guard.ts` and the executioner's `pruneOrphanTransits` / `enforceFlightAnchors` / repair-day's `lockedActivities` filter so any row carrying `lockReason==='flight-truth'` is treated identically to a user-owned lock: its `startTime` / `endTime` cannot be mutated by gap-fill, cascade, or vibe-clash passes. Add the same exemption to the FE `safeUpdateItineraryData` write path (no behavior change needed — locked rows already pass through).

### 4. Promote the integrity check to a deterministic fixer

In `supabase/functions/_shared/commit-itinerary.ts::resolveCommitGate`, when the verdict carries `FLIGHT_ANCHOR_COMMIT_MISMATCH` and `arrivalTime24` is known:
1. Run `stampArrivalAnchorTruth` over each affected day in `days`.
2. Re-run `checkItineraryIntegrity` once.
3. If the mismatch clears, ship `ready` with `metadata.integrity_contract.repaired_codes: ['FLIGHT_ANCHOR_COMMIT_MISMATCH']`. Persist the corrected `days` back (the gate already returns `days` indirectly via the metadata patch — extend the return to include `repairedDays` and have callers swap them in before `persistTripItinerary`).
4. If it still fails (e.g., no arrival card at all), keep current `partial` demotion.

This means the validator becomes self-healing for this one class instead of just flagging.

### 5. Validator severity + repair handler

In `supabase/functions/generate-itinerary/pipeline/validate-day.ts`, keep the existing `FLIGHT_ANCHOR_COMMIT_MISMATCH` check but bump severity from `'warning'` to `'error'` AND register it in `repair-day.ts`'s validation-driven repair map so an in-pipeline mismatch triggers `stampArrivalAnchorTruth` directly (today repair-day §3b runs unconditionally; this just ensures the validator's signal flows into the same fixer instead of being silently swallowed).

### 6. Tests

- `_shared/__tests__/stamp-arrival-anchor-truth.test.ts` — overwrite, no-op when not first day, no-op when no arrival card, lock fields stamped.
- `_shared/__tests__/integrity-contract.amsterdam.test.ts` — extend with a fixer test: contract reports mismatch → `resolveCommitGate` repairs → second integrity pass clears → status returns `ready`.
- `generate-itinerary/anchor-guard.test.ts` — verify `lockReason='flight-truth'` survives gap-fill and cascade passes.

## Out of scope

- FE Payments/header parity (separate task already in flight).
- Departure-flight anchor (mirror work for departure, but no current bug filed).
- `flight_intelligence` reconciliation — the existing `[FLIGHT_TRUTH_DISAGREE]` log path stays as-is.
- Changing how `normalizeFlightSelection` resolves the truth — we trust the value it returns; this plan is about persisting it faithfully.

## Files touched

- new: `supabase/functions/_shared/stamp-arrival-anchor-truth.ts`
- edit: `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts`
- edit: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- edit: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- edit: `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
- edit: `supabase/functions/generate-itinerary/anchor-guard.ts`
- edit: `supabase/functions/_shared/schedule-executioner.ts`
- edit: `supabase/functions/_shared/commit-itinerary.ts`
- edit: `supabase/functions/_shared/itinerary-integrity-contract.ts` (extend return shape — no rule changes)
- new tests + memory update under `mem/constraints/itinerary/flight-anchor-truth-parity.md` to record the stamper as the new authoritative layer.
