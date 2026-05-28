# Connect the assembly line we already built

## What's already on disk (correction to my previous reply)

You were right — we did build the skeletons. They exist and are tested:

| Layer | File | Status |
|---|---|---|
| Pattern configs (packed/social/balanced/indulgent/gentle) | `_shared/pattern-group-configs.ts` | ✅ live |
| Archetype → pattern map | `_shared/archetype-group-mapping.ts` | ✅ live |
| `buildEmptyDaySkeleton` (per-day slot layout w/ time windows + meal slots + must-do refs) | `_shared/build-day-skeleton.ts` (435 lines) | ✅ live |
| **Planner LLM** — your "intelligence layer #1": takes hotel + must-dos + days + arrival/departure, returns slot↔must-do assignments and `omitted_must_dos` | `_shared/trip-planner-llm.ts` (296 lines) | ✅ live, wired in `action-generate-trip.ts` |
| Filler LLM (slot-fill contract, strict Zod) | `_shared/slot-filler-llm.ts` | ✅ shipped today (Phase 4), **dry-run only** |
| Skeleton → activity adapter | `_shared/skeleton-to-activities.ts` | ✅ shipped today |

Your architecture and what we have on disk are the **same shape**. The reason days still come back messy is that the pieces aren't connected end-to-end on the per-day path. The legacy free-form prompt is still doing the work; the new pieces shadow it.

## The architecture you described — mapped to what exists

```text
Form ──▶ [Planner LLM]  ──▶ trip_plan
              (✅ trip-planner-llm.ts, lives in action-generate-trip)
              outputs: dayAssignments[], omitted_must_dos[], per-day skeleton seed

         ┌──────────── per day ────────────┐
         │                                  │
         ▼                                  ▼
  [buildEmptyDaySkeleton]            (legacy free-form prompt path)
         │                                  │   ← still the live path
         ▼                                  ▼
  [Filler LLM]  slot-fill              free-form day JSON
         │       Zod-strict                 │
         ▼                                  ▼
  [skeleton-to-activities]            20-step repair stack
         │                                  │
         └──────────┬───────────────────────┘
                    ▼
             [Cleanup layer]   ← your "intelligence layer #2"
             (transit fix, meal-order fix, cross-day dedup,
              drop rows that can't be made coherent)
                    │
                    ▼
             [Refill LLM]      ← "pull back anything we tossed"
                    │
                    ▼
             persist + activity_costs
```

What's actually missing is **three wires**, not three modules.

## The gap

1. **Planner output isn't consumed by the per-day path.** Planner runs once at trip-level and writes `trip_plan.dayAssignments` into `metadata`. But `action-generate-trip-day.ts` (the per-day chain, used by >95% of generations) reads it for the dry-run trace and then ignores it — it still calls the legacy free-form prompt.

2. **Filler runs in dry-run.** Today the orchestrator runs the Filler alongside the legacy LLM and just records `metadata.quality.slot_filler`. It never replaces the legacy output. That's why "nightcap at 9 AM" still slips through.

3. **There is no named Cleanup or Refill stage.** What exists today is the 20-step repair stack (`enforceTimingAndBuffers`, `sanitizeSchedule`, `applyValidationGate`, `nuclearDiningStrip`, `pruneOrphanTransits`, `ledgerCheck`, `injectMissingMustDos`, ...). Each one fixes one symptom in isolation; nothing decides "this row is unsalvageable, drop it, and ask the LLM for a replacement." That's the missing intelligence layer #2 you're describing.

## Proposed plan (no rip-out, three connect-up steps)

### Step A — Make the Filler the real per-day path (Phase 4 cutover)

In `action-generate-trip-day.ts`, change the schema-filler block from "shadow + trace" to "primary path with legacy fallback":

```text
if (daySkeleton && fillerResult.ok && fillerResult.unfilled.length === 0):
    use filler activities  → continue to cleanup
else:
    fall back to legacy free-form prompt for THIS day only
    (stamp metadata.quality.filler_fallback_reason)
```

Same flag (`metadata.feature_flags.schema_filler`), no UI change. Off by default. Flip on for 10 internal trips, watch parity for a few days, then default-on. This is the smallest move that makes the slot-fill contract real.

### Step B — Introduce a named Cleanup stage (the "intelligence layer #2" you described)

New module `_shared/itinerary-cleanup.ts`. Pure functions, no LLM. Takes the post-Filler day and runs an explicit ordered pass:

1. Reorder by chronology (already exists, just consolidate the call site)
2. Collapse adjacent same-category rows (breakfast + breakfast → keep one)
3. Drop rows that violate transit distance from prev/next anchor (>20 min walk on luxury, >30 min standard) and mark `needsRefill: { reason, slotId, neighborhood, slotType, timeWindow }`
4. Drop rows whose category contradicts the slot (nightcap in a breakfast slot → drop + mark)
5. Drop rows whose venue is in the wrong city (already detected by `crossCityFilter`, just plug it in here)
6. Return `{ activities, needsRefill[] }`

This replaces the worst of the 20-step repair stack with one boundary that decides "salvage vs drop." The legacy guards stay as safety nets but stop being the primary line of defense.

### Step C — Add the Refill LLM (your "pull back anything we tossed")

New module `_shared/refill-slots-llm.ts`. Same Zod contract as Filler, but the input is only `needsRefill[]` plus the neighbouring activities for context. Bounded: max one refill call per day, 8s timeout, leaves slots empty if it fails (cleanup ran first, so an empty slot is now safe to display as "free time" instead of a hallucination).

### What we keep, what we retire

| Component | Phase 4 cutover | After 1 week clean |
|---|---|---|
| `enforceTimingAndBuffers` | keep (also runs on user edits) | keep |
| `applyValidationGate` | keep (catches user/chat edits) | keep |
| `sanitizeSchedule` | keep | keep |
| `injectMissingMustDos` | keep (belt-and-braces) | retire — Planner owns this now |
| `enforceRequiredMealsFinalGuard` | keep | retire — skeleton guarantees meal slots |
| `nuclearDiningStrip`, `nuclearWellnessSweep` | keep | retire — Cleanup owns this |
| Fragment/title/body scrubs | keep | keep (also fires on chat) |

Nothing gets deleted in this plan. Retirements happen in a follow-up after telemetry proves Cleanup is doing the same job with fewer steps.

## Files this plan touches

- **Edit** `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — flip Filler from dry-run to primary path with named fallback
- **Edit** `supabase/functions/_shared/schema-filler-orchestrator.ts` — return the activities array up the stack so the caller can route past the legacy AI call
- **New** `supabase/functions/_shared/itinerary-cleanup.ts` + tests — the named cleanup boundary
- **New** `supabase/functions/_shared/refill-slots-llm.ts` + tests — second LLM call, fills only flagged slots
- **Edit** `supabase/functions/_shared/trace-recorder.ts` — three new stage names: `filler_primary`, `cleanup`, `refill`

## Risk + rollback

- Per-day filler block is flag-gated (`metadata.feature_flags.schema_filler`). Default OFF means zero production change.
- Cleanup is a pure function and can be unit-tested against recorded Madrid/Casablanca/Rome fixtures before it goes live.
- Refill is bounded (single call, 8s, empty-on-fail). Worst case is a "free time" slot, not a hallucination.
- Persist-time guards (`persistTripItinerary` regression block, frozen-after-ready, lock preservation) all stay on — they're what stopped the recent overwrite bugs and they catch any cleanup/refill regression for free.

## Estimated effort

Step A: small (one well-scoped branch insert + return-value plumbing).
Step B: medium (new module, fixtures, decision rules).
Step C: small (Filler clone with a different packet shape).

Total: roughly one focused day for the wiring, plus the cutover beta soak you already approved for Phase 4.

---

## Steps B + C + A-scaffold — Status (shipped 2026-05-28)

**Step B — Cleanup module:** `_shared/itinerary-cleanup.ts` (pure, no LLM). 5 ops: `inverted_time_window`, `duplicate_meal_slot`, `category_slot_mismatch`, `cross_city_venue`, `transit_too_far`. Wrap-aware chrono sort (pre-dawn = tail). Locked / user / manual / extracted / pinned / booked / imported rows always exempt. Tier-aware walk threshold (1000m luxury, 1500m else). Returns `{ activities, needsRefill, ops }`.

**Step C — Refill LLM:** `_shared/refill-slots-llm.ts`. Same strict slot-fill Zod contract as Filler (no time/category/cost), single attempt, 8s timeout, drops fills with unknown slotIds, dedupes on slotId. Empty `needsRefill` → ok with zero attempts (no token spend).

**Step A — Cutover scaffold only:** `action-generate-trip-day.ts` now logs `[SLOT_FILLER_PRIMARY] day=N eligible=true|false` when a NEW second flag `metadata.feature_flags.schema_filler_primary === true` is set. The original `schema_filler` dry-run flag is untouched and behaves identically. The actual route-around of the legacy AI call (filler.activities → cleanup → refill → legacy enrich/persist tail) is the next focused commit — kept out of this drop because the downstream chain in that 4495-line file needs careful threading of the adapter activities through compileFacts/validateDay/repairDay/enrichDay/universalQualityPass without breaking the legacy fallback path.

Tests: 14 green (`deno test supabase/functions/_shared/__tests__/itinerary-cleanup.test.ts supabase/functions/_shared/__tests__/refill-slots-llm.test.ts`).

Files:
- new `supabase/functions/_shared/itinerary-cleanup.ts`
- new `supabase/functions/_shared/refill-slots-llm.ts`
- new `supabase/functions/_shared/__tests__/itinerary-cleanup.test.ts`
- new `supabase/functions/_shared/__tests__/refill-slots-llm.test.ts`
- edit `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (cutover scaffold log only)

**Next step — Step A cutover (separate, focused commit):**
1. Refactor the legacy AI-call block into a named function `runLegacyAiDayCall(...) → DayActivity[]`.
2. When `schema_filler_primary === true` AND `fillerResult.ok` AND zero unfilled → use `fillerResult.activities`; else fall back to `runLegacyAiDayCall`.
3. Pipe whichever path we chose through `cleanupDay` → `refillDroppedSlots` → existing `validateDay`/`repairDay`/`enrichDay`/`universalQualityPass`/`persist`.
4. Stamp `metadata.quality.day_pipeline = { path: 'filler' | 'legacy', cleanup_ops, refill_attempted }`.
5. Beta on the 5 internal trips (short-haul, late-arrival, morning-departure, gentle, packed) before flipping default-on.
