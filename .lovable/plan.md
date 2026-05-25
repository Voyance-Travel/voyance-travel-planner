
# End-to-End Itinerary Generation Logging

## Goal

One structured trace, written from the moment a user starts a trip until the itinerary is read back from disk, with **no gap** between stages. Every stage logs the same shape (`stage`, `status`, `inputs`, `outputs`, `durationMs`, `mutations`, `violations`). Bad state becomes attributable to exactly one stage, on both new generations and legacy trips.

## What exists today (and what's missing)

| Surface | Status |
|---|---|
| `trip_generation_traces` table + `trace-recorder.ts` (`stage/llm/mutation/finalize`) | Built, barely wired — only `action-generate-trip-day` calls `StageLogger`, not the unified recorder |
| `generation-trace.ts` ring buffer (`metadata.generation_trace`) | Wired at launcher + day boundaries only |
| `StageLogger` (`metadata.pipeline_logs[dayN]`) | Only `action-generate-trip-day` flushes — no setup, no save, no sync, no read |
| `[SCHEDULE_SANITY]`, `[BOOKEND_TRACE]`, `metadata.quality.*` | Write-time only; silent on legacy bad trips and on JSON↔table drift |
| Setup / profile-load / pre-flight | Mostly bare `console.log` strings, no structured stage record |
| Persist + save + sync + read | No unified record — only ad-hoc sentinels |

The result is exactly the three blind spots in the user's diagnosis: legacy trips show `null`, narrow rule sets log "0 ops" on broken JSON, and JSON↔table drift goes unrecorded.

## Plan

### Stage 1 — Single tracer wired top-to-bottom

Promote `TraceRecorder` to **the** trace API and start one trace at the earliest boundary, threading `traceId` through every action.

Coverage targets (each becomes one `trace.stage(...)` call with structured `inputs` / `outputs` / `notes`):

```text
setup
 ├── user_input_received       (start form / chat-planner payload snapshot)
 ├── profile_resolved          (DNA, archetypes, constraints, fine-tune overrides)
 ├── trip_metadata_init        (must-dos, intents, anchors, celebration, pacing)
 └── preflight_checks          (credits, frozen guard, regression guard)

generation (per day)
 ├── compile_facts             (day-facts payload)
 ├── compile_schema            (day-schema payload)
 ├── compile_prompt            (truncated prompt + token estimate)
 ├── ai_call                   (already covered by trace.llm)
 ├── validate_day              (validator codes + counts)
 ├── repair_day                (every repair step: id, before/after counts)
 ├── enrich_day                (Google/verified-venues hits, fallback ratio)
 ├── fill_dead_gaps
 ├── universal_quality_pass    (step-by-step substages)
 ├── ledger_check
 ├── anchor_guard
 ├── must_do_coverage          (scheduleMustDos + injectMissingMustDos result)
 └── chronology + sanity       (every rule fired)

persist / save / sync
 ├── persist_gate              (regression / frozen / chronology verdict)
 ├── persist_written           (JSON day counts, activity counts)
 ├── sync_tables               (rows written + JSON↔table diff)
 └── activity_costs_written

read
 └── read_time_audit           (Stage 3 — runs on load, see below)
```

Every stage call must record `mutations` for anything it changes in-place (field-level before/after on cards), via the existing `trace.mutation(...)` channel.

### Stage 2 — Widen the rule set behind a single auditor

Extract one pure function `auditTimingViolations(days, tripCtx)` that returns a typed list of codes. It is called from **both** write-time (inside `persist-itinerary`) and read-time (Stage 3). Rules added beyond today's four:

- `ARRIVAL_SEQUENCE` — first non-bookend on arrival day starts before arrival flight + buffer.
- `MEAL_WINDOW` — breakfast >11:00, lunch <11:00 or >15:30, dinner <17:30 or >23:30.
- `LANDMARK_AFTER_DARK` — outdoor sightseeing scheduled after sunset that needs daylight (Colosseum, Trevi, etc., from the existing must-do priority data).
- `MULTIPLE_BOOKEND_RETURNS` — more than one `Return to Hotel` row per day.
- `JSON_TABLE_PARITY` — per-day activity count mismatch between `itinerary_data` and `itinerary_activities`.
- `CROSS_DAY_BLEED` — same rule the existing guard uses, re-exposed as an audit code.

Each violation row carries `{ code, dayNumber, activityIds[], detail }`. Persist-time also writes a `metadata.quality.audit_summary` snapshot so the dashboard can group by code without re-running.

### Stage 3 — Read-time auditor (no regen, no credits)

New edge function `audit-trip-timing` (read-only):
- input: `tripId`
- reads `itinerary_data` + `itinerary_activities` + `trips.metadata`
- runs `auditTimingViolations` against on-disk JSON
- writes `metadata.quality.read_time_audit = { at, violations, jsonDayCount, tableDayCount, parityDelta }`
- returns the same payload to the caller

Wired from `TripDetail` once per mount when `metadata.quality.read_time_audit?.at` is older than the last `updated_at` (or absent). Result is purely informational — surfaces to the dashboard but does not auto-mutate the trip.

This is the piece that lights up Rome (and every other legacy broken trip) without a regeneration.

### Stage 4 — Dashboard view + SQL

- View `trips_with_audit_violations` (already half-built as `trips_with_chronology_issues`): one row per `(trip_id, code)` with most-recent audit timestamp.
- Internal `/admin/itinerary-audit` page lists violations grouped by code, with a link to the trip's pipeline_logs panel.

### Stage 5 — Backfill + Rome

- One-shot script invokes `audit-trip-timing` for every trip with `itinerary_status IN ('ready','generated')` so the dashboard is populated.
- Rome `d18b2e8a…` Day 1 stays a separate data fix once the auditor confirms the exact violation codes.

## Out of scope

- Rebuilding the full itinerary scorer.
- Charging credits for the read-time auditor or any self-heal.
- Auto-mutating legacy trips based on audit output — Stage 3 is observability only.
- Multi-retry regeneration loops.

## Technical notes

- `TraceRecorder` already supports the shape this needs; the work is wiring + one shared `withStage(trace, name, args, fn)` helper to enforce uniform capture and prevent silent gaps.
- `auditTimingViolations` lives in `_shared/audit-timing.ts` so write-time (`persist-itinerary.ts`) and read-time (`audit-trip-timing/index.ts`) share one implementation — closes the "logs say clean because rules are narrow" gap.
- `pipeline_logs[dayN]` keeps its current shape; the unified trace just adds the missing stages and the cross-day audit row.
- Every new log site is best-effort and wrapped — instrumentation must never break generation.
- Tests: per-rule unit tests for `auditTimingViolations`, one integration test that a full happy-path generation produces a trace with all expected stages and no `gap=true` flags, and a Rome fixture test that read-time audit emits the expected codes without mutating data.

## Files touched

- `supabase/functions/_shared/trace-recorder.ts` — add `withStage` helper, broaden phases.
- `supabase/functions/_shared/audit-timing.ts` — **new** shared auditor.
- `supabase/functions/_shared/persist-itinerary.ts` — call auditor at write time, record codes into trace + `metadata.quality.audit_summary`.
- `supabase/functions/generate-itinerary/action-generate-trip.ts`, `action-generate-trip-day.ts`, `action-save-itinerary.ts`, `action-sync-tables.ts`, `pipeline/{compile-prompt,validate-day,repair-day,enrich-day,fill-dead-gaps}.ts` — wrap every stage in `withStage`.
- `supabase/functions/audit-trip-timing/index.ts` — **new** read-time auditor edge function.
- `supabase/migrations/<ts>_trips_audit_view.sql` — `trips_with_audit_violations` view + one-shot backfill helper.
- `src/components/trip/TripDetail.tsx` — mount-time invocation of the auditor (gated, idempotent).
- Tests under `supabase/functions/_shared/__tests__/` and `generate-itinerary/__tests__/`.
