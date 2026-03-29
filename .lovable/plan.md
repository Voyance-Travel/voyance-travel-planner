

# Phase 2: Extract Deterministic Compilers — COMPLETED

## Summary

Phase 2 extracted ~1,200 lines of deterministic fact-gathering and rule-derivation logic from `action-generate-day.ts` into two isolated, testable modules:

1. **`pipeline/compile-day-facts.ts`** — async function that consolidates all DB queries and fact extraction (transition days, locked activities, preferences, flight/hotel context) into a typed `CompiledFacts` return.
2. **`pipeline/compile-day-schema.ts`** — pure function that takes resolved facts and executes the day-mode classification decision tree, producing a `CompiledSchema` with `dayConstraints` string.

### Also completed
- **`pipeline/types.ts`** — Added `LockedActivity`, `CompiledFacts`, `CompiledSchema`, `DaySchemaInput` types.
- **`action-generate-day.ts`** — Replaced inline logic with calls to `compileDayFacts()` and `compileDaySchema()`.
- **`action-generate-trip-day.ts`** — Wired in `StageLogger` to record AI response timing and flush pipeline artifacts to `trip.metadata.pipeline_logs`.

## Next: Phase 3 — Validators & Repair

Extract the post-generation validation and repair logic from `action-generate-day.ts` into `pipeline/validate-day.ts` and `pipeline/repair-day.ts`. These will consume the `DaySchema` and validate AI output against it, then apply deterministic repairs for known failure codes.
