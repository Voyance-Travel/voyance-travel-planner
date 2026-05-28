# Phase 4 — Filler LLM (Slot-Fill Contract)

The skeleton from Phase 1+2 is already built and persisted alongside the legacy prompt. Phase 4 stops asking the LLM to invent a day from scratch and instead asks it to **only fill named slots** in a fixed `SkeletonDay`. The LLM can no longer choose times, add or drop slots, or reorder anything — eliminating "nightcap at 9 AM", missing meals, and ignored must-dos at the source.

## Shape of the change

```text
Legacy (today):
  prompt-text ──▶ LLM ──▶ free-form day JSON ──▶ 20-step repair stack

Phase 4 (behind a flag):
  SkeletonDay (filled + empty slots)
        │
        ▼
  per-slot aiInstruction packets ──▶ LLM (AI SDK Output.object)
        │
        ▼  { slotId, name, description, venueAddress, durationMin }[]
  mergeFilledSlots(skeleton, response)
        │
        ▼
  legacy DayActivity[] shape ──▶ feeds the SAME enrich/cost/persist tail
```

The Planner LLM (Phase 3) already wrote `omitted_must_dos` and a populated `daySkeleton`. Phase 4 consumes that skeleton on the per-day path.

## Scope

### 1. Shared filler module — `supabase/functions/_shared/slot-filler-llm.ts`
- Single entry: `fillDaySkeleton({ skeleton, dayContext, lovableApiKey, timeoutMs }) → FillResult`
- Uses AI SDK (`generateText` + `Output.object`) through the existing `_shared/ai-gateway.ts` provider.
- Model: `google/gemini-3-flash-preview`.
- Zod output schema is strict: `{ fills: { slotId: string, name: string, description: string, venueAddress?: string, durationMin?: number, neighborhood?: string }[] }`. **No time fields, no category, no cost** — the model literally cannot return them.
- Builds a compact per-slot packet: `{slotId, slotType, mealType?, timeWindow, aiInstruction, mustDoTitle?}`. Only empty, non-filled slots are sent.
- Returns `{ skeleton, fills, unfilled: SkeletonSlot[], usage }`.
- Bounded: 12s timeout per day, single retry on parse failure, leaves `unfilled` slots untouched (cleanup layer handles them in Phase 5).

### 2. Skeleton → legacy `DayActivity[]` adapter — `supabase/functions/_shared/skeleton-to-activities.ts`
- Pure mapper, no LLM. Walks the filled `SkeletonDay` and emits the shape the existing enrich/repair/persist tail already accepts.
- Each slot becomes one activity: copies `filledData` for pre-pinned slots; for filler-named slots, composes `{ title=name, description, startTime/endTime from timeWindow, category derived from slotType/mealType, source: 'skeleton_filler' }`.
- Stamps `metadata.skeletonSlotId` and `metadata.mustDoRef` so downstream auditors can verify lock + must-do coverage without re-deriving.

### 3. Flag-gated wiring in the per-day path
- Add a single decision point near the top of `action-generate-trip-day.ts` (server chain) and `action-generate-day.ts` (single-day):
  ```ts
  const useSchemaFiller =
    trip.metadata?.feature_flags?.schema_filler === true;
  ```
- When ON and `daySkeleton` is present:
  1. Call `fillDaySkeleton` instead of the free-form prompt path.
  2. Pipe through `skeleton-to-activities` → existing `validateDay` → `repairDay` → `enrichDay` → `universalQualityPass` → `persist-itinerary` chain unchanged.
  3. Skip the legacy compile-prompt + AI call entirely on this branch.
- When OFF: nothing changes. The legacy path runs.
- No feature-flag UI yet — toggle is set per-trip via `trips.metadata.feature_flags.schema_filler = true` for A/B testing on internal trips.

### 4. Safety nets that stay enabled even on the new path
- `applyValidationGate`, `enforceTimingAndBuffers`, `sanitizeSchedule`, `assertNoCrossDayBleed`, `persistTripItinerary` regression guard, frozen-after-ready, lock preservation — all unchanged. The filler can't violate them by construction, but the gates remain because they also catch user edits and chat actions.
- Lock & must-do guards: `verifyLocksPreserved`, `injectMissingMustDos`, `enforceRequiredMealsFinalGuard` — kept enabled in Phase 4 as belt-and-braces. They become candidates for removal in Phase 5 after one week clean.

### 5. Trace + observability
- New stage names threaded through the existing `withStage` recorder: `slot_filler_call`, `slot_filler_merge`, `slot_filler_unfilled`.
- Sentinels: `[SLOT_FILLER] day=N fills=K unfilled=M usage=…`.
- Stamps `metadata.quality.slot_filler = { calls, fills, unfilled, durationMs }` on the day.
- Existing `auditTimingViolations` runs on both branches and surfaces any drift between schema model and persisted JSON.

### 6. Tests
- Unit: `slot-filler-llm.test.ts` with a stubbed AI SDK provider — verifies packet shape, Zod schema rejection on extra fields, timeout handling, unfilled-slot reporting.
- Unit: `skeleton-to-activities.test.ts` — exhaustive slot-type → category mapping, time-window honoring, `mustDoRef` preservation, lock stamping.
- Integration fixture: replay a Madrid + a Casablanca day through the new path with a recorded LLM response; assert (a) every required meal is present, (b) every must-do produces an activity, (c) `enforceTimingAndBuffers` is a no-op on the output, (d) `applyValidationGate` returns zero critical codes.

## Cutover plan (within Phase 4)

1. Ship the module + adapter + flag wiring with flag default OFF. No production trip behavior changes.
2. Flip the flag on 10 internal staging trips covering: short-haul standard, late-night arrival, departure day with morning flight, gentle pattern, packed pattern. Compare against the legacy path's same-trip generation.
3. If meals-present ≥ 100%, must-do coverage ≥ 95%, and validation-gate critical codes are at or below legacy, flip the flag for a 20-trip beta cohort.
4. Phase 5 ships only after that beta runs clean for one week. Phase 5 is what actually retires the redundant repair steps.

## What we explicitly do NOT do in Phase 4

- We do NOT delete any repair step or guard. That's Phase 5, gated on Phase 4 data.
- We do NOT switch the other two LLM calls (Planner, Refill) to AI SDK yet — that's Phase 6.
- We do NOT touch the frontend. The preview already consumes `daySkeleton`; the persisted activity shape stays identical.
- We do NOT change the existing free-form prompt or its callers. The flag-off path is a byte-for-byte no-op.

## Files touched

- `supabase/functions/_shared/slot-filler-llm.ts` — new
- `supabase/functions/_shared/skeleton-to-activities.ts` — new
- `supabase/functions/_shared/__tests__/slot-filler-llm.test.ts` — new
- `supabase/functions/_shared/__tests__/skeleton-to-activities.test.ts` — new
- `supabase/functions/generate-itinerary/__tests__/schema-filler.integration.test.ts` — new
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — flag-gated branch near AI call site
- `supabase/functions/generate-itinerary/action-generate-day.ts` — same flag-gated branch
- `_shared/trace-recorder.ts` — add the three stage names to the canonical list comment (no code change)
- `.lovable/plan.md` — append Phase 4 status block

## Estimated effort

Medium-large. Most of the surface area is the filler module + the adapter + tests; the two action files each get one well-scoped branch insert.
