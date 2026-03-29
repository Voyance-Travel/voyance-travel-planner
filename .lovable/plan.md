# Pipeline Refactor: Phased Rollout Plan

## Architecture Principle
> "Stop asking the model to invent the rules and then asking code to clean up the mess.
> Give code ownership of the rules, and let the model operate inside a constrained box."

## Pipeline Flow
```
Trip Facts → Day Schema → AI Fill → Validator → Targeted Repair → Save
```

## Current State Summary

| File | Lines | Role | Problem |
|------|-------|------|---------|
| `action-generate-day.ts` | 4,583 | Prompt + logistics + validation + repair | Monolith doing everything |
| `action-generate-full.ts` | 2,962 | Legacy full-trip generation | Parallel path, duplicates rules |
| `generation-core.ts` | 3,172 | Shared generation infra | Overlapping cleanup with sanitization |
| `sanitization.ts` | 318 | Text cleanup + business rules | Mixed concerns |
| `day-validation.ts` | 876 | Meal guards, chain blocklist | Good but disconnected from pipeline |
| `action-generate-trip.ts` | ~500 | Trip orchestrator | Good pattern, keep |
| `action-generate-trip-day.ts` | 1,118 | Day chain loop | Good pattern, keep |

---

## ✅ Phase 0: Foundation (COMPLETE)

**Files created**:
- `pipeline/types.ts` — DayFacts, DaySchema, DaySlot, ValidationResult, FailureCode enum, StageArtifacts, RepairAction, StageTiming
- `pipeline/stage-logger.ts` — StageLogger class that persists artifacts to `trip.metadata.pipeline_logs[day_N]`

**Status**: Deployed. Zero behavior changes. New files exist but are not called by any generation code.

---

## Phase 1: Retire Legacy Path

**Goal**: Make `action-generate-full.ts` a thin redirect to the day-chain pipeline.

**Files changed**:
- `action-generate-full.ts` — gut implementation; delegate to `action-generate-trip.ts` logic
- `index.ts` — `generate-full` routes through same trip orchestrator

**Risk**: Low. Day-chain path already handles all trip types.

---

## Phase 2: Extract Deterministic Compilers

**Goal**: Pull rule logic OUT of `action-generate-day.ts` into isolated, testable modules.

**Files created**:
- `pipeline/compile-day-facts.ts` — extracts hotel/flight/meal/must-do truth from GenerationContext → DayFacts
- `pipeline/compile-day-schema.ts` — takes DayFacts → DaySchema (slots, time windows, constraints)

**Files changed**:
- `action-generate-day.ts` — call compilers at top, feed schema downstream. Same behavior, single source.

---

## Phase 3: Validator with Failure Taxonomy

**Goal**: Structured validator that classifies issues by error code (additive, runs alongside existing sanitization).

**Files created**:
- `pipeline/validate-day.ts` — returns `ValidationResult[]` with typed codes: PHANTOM_HOTEL, MEAL_ORDER, TITLE_LABEL_LEAK, LOGISTICS_SEQUENCE, GENERIC_VENUE, DUPLICATE_CONCEPT, CHRONOLOGY, TIME_OVERLAP, CHAIN_RESTAURANT

**Files changed**:
- `action-generate-trip-day.ts` — run `validateDay()` after generation, log via StageLogger

---

## Phase 4: Deterministic Repair Layer

**Goal**: Move business-rule fixes out of `sanitization.ts` into structured repair keyed to error codes.

**Files created**:
- `pipeline/repair-day.ts` — deterministic repairs: MEAL_ORDER→reassign times, PHANTOM_HOTEL→strip, CHRONOLOGY→sort, etc.

**Files changed**:
- `sanitization.ts` — narrow to text-only cleanup (CJK, labels, dedup, dashes)
- `action-generate-trip-day.ts` — pipeline becomes: validate → repair → text-sanitize

---

## Phase 5: Shrink the Prompt

**Goal**: Remove hard rules from AI prompt that code now enforces.

**Files changed**:
- `action-generate-day.ts` / `prompt-library.ts` — remove meal ordering, hotel truth, departure sequencing, title formatting, chronology, logistics buffer rules from prompt. Keep venue quality, descriptions, personalization, vibe.

---

## Phase 6: Targeted AI Repair (Optional)

**Files created**:
- `pipeline/ai-repair.ts` — micro-prompts for semantic issues only (missing must-do, wrong cuisine, weak personalization)

---

## New Directory Structure
```
supabase/functions/generate-itinerary/pipeline/
  types.ts              ✅ DONE — DaySchema, DayFacts, ValidationResult, FailureCode
  stage-logger.ts       ✅ DONE — StageLogger class
  compile-day-facts.ts  — Phase 2
  compile-day-schema.ts — Phase 2
  validate-day.ts       — Phase 3
  repair-day.ts         — Phase 4
  ai-repair.ts          — Phase 6
```
