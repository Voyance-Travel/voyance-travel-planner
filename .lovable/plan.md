# Continue Schedule Executioner: cleanup/refill + audit-code wiring

The Executioner currently detects and stamps `metadata.quality.executioner` counters but only acts in "flag-only" mode for geo (1D) and doesn't refill cards it removes/shifts. This plan closes the loop so defects either get repaired in place or trigger a deterministic refill, and so every Executioner action is visible in the unified generation trace + read-time audit.

## Scope

1. **Cleanup pass** — after detection, mutate the day in place:
   - 1A flight-anchor: re-stamp anchor `startTime`/`endTime` to truth, push downstream cards by delta via shared `enforceTimingAndBuffers`.
   - 1B midnight-spill: legal spill stays (already stamped); illegal spill (non-bookend, non-late-nightlife) gets trimmed back to 23:30 end + flagged for refill.
   - 1C buffer-cascade: call `enforceTimingAndBuffers` on the response path so what gets persisted matches what got audited.
   - 1D geo: drop outliers (lock-respecting) when `geoFlagOnly=false`; gated behind a `EXECUTIONER_GEO_DROP_ENABLED` env flag, default off until telemetry shows false-positive rate <2%.

2. **Refill pass** — when cleanup removes a non-locked card and leaves a >90 min gap inside the active window, invoke the existing `fillDeadGaps` helper scoped to the affected window. No new LLM call; reuses verified-venue pool + fallback DB. Locked/user/manual/extracted/pinned never refilled over.

3. **Audit-code wiring** — every Executioner action emits:
   - A `withStage(trace, 'schedule_executioner', …)` span containing per-day counters.
   - `auditTimingViolations` codes: `EXEC_FLIGHT_ANCHOR_FIXED`, `EXEC_MIDNIGHT_SPILL_TRIMMED`, `EXEC_BUFFER_CASCADE_APPLIED`, `EXEC_GEO_OUTLIER_DROPPED`, `EXEC_GAP_REFILLED`.
   - Read-time auditor (`useReadTimeAudit`) surfaces these in TripHealthPanel so legacy trips can be self-healed lazily.

4. **Persist contract** — Executioner runs as the LAST stage before `persistTripItinerary`. Its output is the authoritative day snapshot; any later stage that re-runs cascade must be a no-op (`driftProbeRef` style).

5. **Tests**:
   - Extend `schedule-executioner.test.ts` with cleanup + refill fixtures (flight delta, illegal spill trim, geo drop with refill, gap-refill respecting locked rows).
   - New `executioner-trace.test.ts` verifies trace span + audit codes are emitted and idempotent on second run.

## Technical notes

- Files touched (single boundary): `supabase/functions/_shared/schedule-executioner.ts`, `supabase/functions/_shared/audit-timing.ts`, `supabase/functions/generate-itinerary/action-generate-day.ts`, `supabase/functions/generate-itinerary/action-generate-trip-day.ts`, plus tests under `_shared/__tests__/`.
- No DB schema changes. No new edge functions. No frontend changes beyond TripHealthPanel inheriting the new audit codes automatically via `useReadTimeAudit`.
- Geo-drop stays env-gated; default `geoFlagOnly:true` until we have ≥7 days of `EXEC_GEO_OUTLIER` telemetry showing <2% false positives.
- Refill is bounded: max 1 refill card per cleanup event per day (avoid runaway pool drain).
- Idempotency: `metadata.quality.executioner.run_id` short-circuits a second invocation with the same input hash.

## Out of scope

- Skeleton/dayAssignments planner (separate subagent's domain — picked up in a follow-up once that trace returns).
- Cross-day geo coherence (Executioner stays single-day).
- Any prompt-side changes.
