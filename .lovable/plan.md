## Wire `withStage` through the generation pipeline + ship tests

Stage 1 of the unified tracer landed (TraceRecorder + withStage helper, audit-timing auditor, audit-trip-timing edge fn, persist-itinerary auditor stamp, view + hook). This plan finishes the wiring so every stage of itinerary generation emits a structured trace row, then locks behavior with tests and a one-shot legacy backfill.

### Scope

**1. Thread `traceId` end-to-end**
- `action-generate-trip.ts` (launcher): create one `Trace` per trip-generation, stash `traceId` on `metadata.generation_trace_id`, pass to every per-day invoke.
- `action-generate-trip-day.ts`: accept `traceId` from caller (fallback: create child); replace ad-hoc `StageLogger` calls with `withStage`.
- `action-save-itinerary.ts` + `action-sync-tables.ts`: accept optional `traceId`, open child stages so user edits and table syncs land on the same timeline.

**2. Wrap each pipeline stage with `withStage`** (one call site per stage, no behavior change)
- `pipeline/compile-facts.ts` → stage `compile_facts`
- `pipeline/compile-schema.ts` → `compile_schema`
- `pipeline/compile-prompt.ts` → `compile_prompt` (inputs: token count, must-do list, anchor list)
- LLM call inside generate-trip-day → `ai_call` (inputs: model, promptTokens; outputs: completionTokens, latencyMs)
- `pipeline/validate-day.ts` → `validate_day` (outputs: violation codes)
- `pipeline/repair-day.ts` → `repair_day` (outputs: repair actions taken)
- `pipeline/enrich-day.ts` → `enrich_day`
- `pipeline/fill-dead-gaps.ts` → `fill_dead_gaps`
- `_shared/universal-quality-pass.ts` → `universal_quality_pass`
- `_shared/ledger-check.ts` → `ledger_check`
- `_shared/anchor-guard.ts` → `anchor_guard`
- `_shared/must-do-coverage.ts` (new wrapper around scheduleMustDos + injectMissingMustDos) → `must_do_coverage`
- `_shared/sanitize-schedule-timing.ts` → `schedule_sanity`
- `_shared/persist-itinerary.ts` → `persist_gate` + `persist_written` + `audit_summary` (auditor already wired; just stage-wrap)
- `action-sync-tables.ts` → `sync_tables` + `activity_costs_written`

Each `withStage` records `{ inputs, outputs, notes, status, durationMs }` and any thrown error is captured with `status: 'error'` without swallowing.

**3. Tests** (`supabase/functions/_shared/__tests__/`)
- `audit-timing.test.ts`: one case per violation code (10 cases) + clean-trip negative case.
- `trace-recorder.withStage.test.ts`: nested stages, error propagation, output capture via getter, durationMs recorded.
- `pipeline-trace-coverage.test.ts`: stub a full happy-path day generation; assert the expected stage names appear in order in `trip_generation_traces`.
- `rome-fixture.test.ts`: load the Rome `d18b2e8a…` JSON fixture, run auditor, assert `INVALID_PREDAWN_MEAL` + `MULTIPLE_BOOKEND_RETURNS` + `LANDMARK_AFTER_DARK` fire.

**4. One-shot legacy audit backfill**
- Migration that selects all `trips` with `itinerary_status IN ('ready','generated')` and invokes `audit-trip-timing` in batches (server-side via `pg_net` or a Deno script). Writes `metadata.quality.read_time_audit` so the `trips_with_audit_violations` view immediately lights up across the fleet.
- No mutation of itinerary data — informational only.

**5. Memory**
- Append `mem://constraints/observability/unified-generation-trace` describing the stage list, `withStage` contract, and the "every stage must be wrapped" rule.
- Add a one-line Core entry pointing at it.

### Explicitly out of scope
- No admin dashboard UI (the view + hook are enough to query for now).
- No auto-mutation of legacy trips based on audit findings.
- No changes to the must-do scheduler, sanitizer, or any business logic — purely instrumentation + tests + backfill.
- Rome Day 1 data fix stays a separate follow-up.

### Risk / rollback
- All `withStage` calls are pass-through wrappers; failure to record a trace never blocks generation (TraceRecorder already swallows its own write errors).
- Backfill is read-only; can be re-run idempotently.
