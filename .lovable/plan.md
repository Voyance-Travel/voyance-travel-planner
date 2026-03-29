

# Phase 2: Extract Deterministic Compilers — COMPLETED

## Summary

Phase 2 extracted ~1,200 lines of deterministic fact-gathering and rule-derivation logic from `action-generate-day.ts` into two isolated, testable modules:

1. **`pipeline/compile-day-facts.ts`** — async function that consolidates all DB queries and fact extraction (transition days, locked activities, preferences, flight/hotel context) into a typed `CompiledFacts` return.
2. **`pipeline/compile-day-schema.ts`** — pure function that takes resolved facts and executes the day-mode classification decision tree, producing a `CompiledSchema` with `dayConstraints` string.

### Also completed
- **`pipeline/types.ts`** — Added `LockedActivity`, `CompiledFacts`, `CompiledSchema`, `DaySchemaInput` types.
- **`action-generate-day.ts`** — Replaced inline logic with calls to `compileDayFacts()` and `compileDaySchema()`.
- **`action-generate-trip-day.ts`** — Wired in `StageLogger` to record AI response timing and flush pipeline artifacts to `trip.metadata.pipeline_logs`.

# Phase 3: Validators & Repair — COMPLETED

## Summary

Phase 3 extracted ~580 lines of inline post-processing from `action-generate-day.ts` into two structured pipeline modules:

1. **`pipeline/validate-day.ts`** — Pure inspection function that classifies every issue by `FailureCode`. Checks: PHANTOM_HOTEL, CHAIN_RESTAURANT, GENERIC_VENUE, TITLE_LABEL_LEAK, CHRONOLOGY, TIME_OVERLAP, MEAL_ORDER, MEAL_MISSING, MEAL_DUPLICATE, LOGISTICS_SEQUENCE, DUPLICATE_CONCEPT, WEAK_PERSONALIZATION. Returns `ValidationResult[]` with severity, activity index, and autoRepairable flag.

2. **`pipeline/repair-day.ts`** — Deterministic repairs keyed to failure codes, executed in strict order: phantom hotel strip → chain removal → pre-arrival filter → chronology sort → trip-wide dedup (with pool swap) → personalization violations → departure sequence (6-rule validator) → bookend injection (hotel returns + transit gaps) → label leak strip. Returns `RepairAction[]` for logging.

### Changes to existing files
- **`action-generate-day.ts`** — Replaced inline trip-wide validation, personalization check, departure validator, bookend validator, and chain filter (~580 lines) with `validateDay()` + `repairDay()` pipeline calls. Meal guard stays inline (needs DB-backed fallback venues).

## Next: Phase 4 — TBD

Potential directions:
- Extract prompt construction into `pipeline/compile-prompt.ts`
- Move venue enrichment (Google Maps) into a dedicated pipeline stage
- Add pipeline logging for validation/repair results via StageLogger
