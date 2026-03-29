

# Pipeline Refactor: Phased Rollout Plan

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

## Phase 0: Foundation (No behavior changes)

**Goal**: Add types and stage logging without touching any generation logic. Nothing can break because nothing changes.

**Files created**:
- `pipeline/types.ts` -- DaySchema, DayFacts, SlotType, ValidationError types, failure codes enum
- `pipeline/stage-logger.ts` -- writes stage artifacts (compiled schema, raw AI output, validation report) to `trip.metadata.generation_logs[dayN]`

**Files changed**: None. These are new, unused modules.

**Verification**: Deploy, generate a trip. Everything works exactly as before. New files exist but are not called.

---

## Phase 1: Retire Legacy Path

**Goal**: Make `action-generate-full.ts` a thin redirect to the day-chain pipeline. One authoritative path.

**Files changed**:
- `action-generate-full.ts` -- gut the 2,962-line implementation; replace with a call to `action-generate-trip.ts` logic (compile context, then chain day-by-day)
- `index.ts` -- `generate-full` action routes through the same trip orchestrator

**What stays working**: The day-chain path (`generate-trip` -> `generate-trip-day` -> `generate-day`) is untouched. The legacy path just delegates to it now.

**Risk**: Low. The day-chain path already handles all trip types. If any edge case relied on legacy-only logic, it surfaces immediately.

---

## Phase 2: Extract Deterministic Compilers

**Goal**: Pull rule logic OUT of `action-generate-day.ts` into isolated, testable modules. The main file still calls them -- behavior stays identical.

**Files created**:
- `pipeline/compile-day-facts.ts` -- extracts hotel truth, flight truth, city/day mapping, meal policy, must-dos, budget caps from generation_context. Returns a `DayFacts` object.
- `pipeline/compile-day-schema.ts` -- takes DayFacts and produces a `DaySchema`: slots, time windows, required meals, locked logistics, constraints. Pure deterministic code.

**Files changed**:
- `action-generate-day.ts` -- at the top of the generation function, call `compileDayFacts()` and `compileDaySchema()`. Pass the schema downstream. The existing prompt-building code still runs, but now it reads from the schema object instead of re-deriving rules inline.

**Key principle**: This is a refactor, not a rewrite. The prompt still gets built the same way, but the facts feeding it come from a single compiled source.

**Verification**: Generate trips. Output should be identical. Stage logger (Phase 0) now saves the compiled schema for each day -- you can inspect it.

---

## Phase 3: Validator with Failure Taxonomy

**Goal**: Replace scattered post-processing checks with a single structured validator that classifies issues by error code.

**Files created**:
- `pipeline/validate-day.ts` -- runs all checks against a generated day, returns `ValidationResult[]` with typed error codes:

```text
PHANTOM_HOTEL      -- hotel activity with no booking
MEAL_ORDER         -- lunch after 17:00, breakfast after 14:00
TITLE_LABEL_LEAK   -- "Voyance Pick", "Staff Pick" in title
LOGISTICS_SEQUENCE -- departure items out of order
GENERIC_VENUE      -- placeholder names like "Local Restaurant"
DUPLICATE_CONCEPT  -- same activity as previous day
CHRONOLOGY         -- activities not sorted by time
TIME_OVERLAP       -- overlapping time windows
CHAIN_RESTAURANT   -- blocklisted chain in meal
```

**Files changed**:
- `action-generate-trip-day.ts` -- after calling `handleGenerateDay`, run `validateDay()` and log results via stage logger. Existing sanitization still runs (we're adding classification, not removing fixes yet).
- `sanitization.ts` -- no changes yet. It still runs. The validator runs in parallel to classify what sanitization is catching.

**Verification**: Generate trips. Check `generation_logs` for each day -- you now see exactly which issues were detected and what error codes they got. This is the debugging breakthrough.

---

## Phase 4: Deterministic Repair Layer

**Goal**: Move business-rule fixes out of `sanitization.ts` and into a structured repair module that acts on validator output.

**Files created**:
- `pipeline/repair-day.ts` -- deterministic repairs keyed to error codes:
  - `MEAL_ORDER` -> reassign meal times
  - `PHANTOM_HOTEL` -> strip hotel activities
  - `TITLE_LABEL_LEAK` -> strip labels
  - `CHRONOLOGY` -> sort by startTime
  - `LOGISTICS_SEQUENCE` -> reorder departure sequence
  - `CHAIN_RESTAURANT` -> flag for AI re-pick

**Files changed**:
- `sanitization.ts` -- remove meal time validation, phantom hotel stripping, and chronology sorting. Keep only text-level cleanup (CJK stripping, schema leak removal, word dedup, em-dash replacement).
- `action-generate-trip-day.ts` -- replace post-generation sanitization calls with: `validate -> repair -> text-sanitize` pipeline.

**Verification**: Generate trips. Same output quality, but now every fix is traceable: validator detected it, repair fixed it, logs show both.

---

## Phase 5: Shrink the Prompt

**Goal**: Remove hard rules from the AI prompt that are now enforced by code. The prompt becomes focused on venue selection, descriptions, and personalization.

**Files changed**:
- `action-generate-day.ts` / `prompt-library.ts` -- remove prompt sections for:
  - Meal ordering rules
  - Hotel truth enforcement
  - Departure sequencing
  - Title formatting rules
  - Chronology guarantees
  - Logistics buffer math
- Keep prompt sections for:
  - Venue quality and selection criteria
  - Description writing style
  - Personalization and vibe
  - Budget-appropriate recommendations

**Expected result**: Prompt shrinks significantly. AI has fewer degrees of freedom. Deterministic code owns the rules. AI owns the creativity.

---

## Phase 6: Targeted AI Repair (Optional)

**Goal**: For semantic issues that code can't fix deterministically, use small focused repair prompts.

**Files created**:
- `pipeline/ai-repair.ts` -- small, targeted prompts for:
  - Missing must-do activity (re-generate one slot)
  - Wrong restaurant cuisine type (swap one venue)
  - Weak personalization (rewrite one description)
  - Duplicate concept with no code-swappable alternative

These are micro-prompts, not full-day regenerations. They only fire when the validator flags a specific semantic issue.

---

## Rollout Summary

```text
Phase 0: Types + logger          -- zero risk, additive only
Phase 1: Retire legacy path      -- low risk, one path
Phase 2: Extract compilers       -- refactor, same behavior
Phase 3: Validator taxonomy       -- additive, parallel to existing
Phase 4: Repair layer            -- swap sanitization internals
Phase 5: Shrink prompt           -- remove redundant AI rules
Phase 6: AI micro-repairs        -- optional, semantic fixes
```

Each phase is independently deployable and testable. If any phase introduces a regression, you roll back that phase only. The system works correctly at every intermediate state.

### Technical Details

**New directory structure**:
```text
supabase/functions/generate-itinerary/
  pipeline/
    types.ts              -- DaySchema, DayFacts, ValidationError, FailureCode
    stage-logger.ts       -- saves artifacts to trip metadata
    compile-day-facts.ts  -- hotel/flight/meal/must-do truth
    compile-day-schema.ts -- slots, time windows, constraints
    validate-day.ts       -- structured validator with error codes
    repair-day.ts         -- deterministic fixes keyed to error codes
    ai-repair.ts          -- targeted micro-prompts (Phase 6)
```

**Existing files narrowed**:
- `sanitization.ts` -- text cleanup only (CJK, labels, dedup, dashes)
- `action-generate-full.ts` -- thin redirect to day-chain
- `action-generate-day.ts` -- calls compilers, builds smaller prompt, calls AI
- `generation-core.ts` -- shared infra only, no rule enforcement

