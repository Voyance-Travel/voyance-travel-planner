## Answer

We did add some logs, but not the right kind for this failure. The current logs are mostly console logs and per-day `pipeline_logs`; they show that AI calls happened, but they do not give a durable, end-to-end chain trace of why a paid trip moved from “building” to “partial.” For the Dubai trip, the only useful durable clue is `PERSIST_GATE` saying `MISSING_REQUIRED_MEAL` and `EMPTY_DAY`, while the database tables actually contain all 4 days.

## Plan

### 1. Add durable trip-level chain logging

Create a small shared helper for generation trace events that writes to `trips.metadata.generation_trace` as a ring buffer.

Each event will include:

- `at`
- `tripId`
- `action`
- `dayNumber` when applicable
- `phase`
- `status`
- `durationMs`
- `expectedTotalDays`
- `jsonDayCount`
- `tableDayCount`
- `activityCount`
- `errorCode` / `errorMessage` when applicable

This is the key change: even if edge logs vanish or `waitUntil` output is dropped, the trip row itself will explain what happened.

### 2. Instrument every generation boundary

Add trace writes in:

- `action-generate-trip.ts`
  - launcher received
  - metadata initialized
  - background job started
  - day chain dispatched
  - background failed
- `action-generate-trip-day.ts`
  - day started
  - AI response received
  - day validation outcome
  - day persisted to normalized tables
  - JSON persist attempted
  - chain-to-next-day attempted/succeeded/failed
  - finalization started/completed
- `action-save-itinerary.ts`
  - persist gate checked
  - every blocking error persisted with `{dayNumber, code, message}`
  - status chosen: `ready`, `partial`, or `failed`
- `persist-itinerary.ts`
  - regression blocked
  - frozen-write blocked
  - successful JSON write with counts

### 3. Add a generation health snapshot on every completion/partial/failure

When generation ends or marks partial/failed, persist a compact snapshot:

```text
generation_health: {
  expectedTotalDays,
  jsonDays,
  jsonRealDays,
  tableDays,
  tableRealDays,
  activityRows,
  failedDayNumbers,
  persistGateCodes,
  lastGoodPhase,
  finalStatus
}
```

This gives us a single DB field that says whether the issue is:

- AI did not generate the day
- table write failed
- JSON write failed
- validation gate blocked
- finalization/ready promotion failed
- client/poller failed to recognize complete tables

### 4. Fix the known recovery gap exposed by these logs

For `partial` or `failed` trips, if normalized tables contain all expected days with real activities, run the existing `recoverGenerationFromTables({ persist: true, promoteReady: true })` path automatically from TripDetail/poller.

This is not auto-regeneration. It only rebuilds JSON from already-written database rows, so it respects the “no silent regen on page load” rule.

### 5. Add a one-shot backfill for currently broken trips

Run a safe recovery migration/function for trips where:

- status is `partial` or `failed`
- expected day count is known
- `itinerary_days` has all expected days
- `itinerary_activities` has real rows for those days

This should repair the Dubai trip and the other recent “generated but showing partial/empty” trips without charging or regenerating.

### 6. Add tests that prove logging and recovery work

Add regression coverage for:

- `PERSIST_GATE` writes detailed trace entries, not only console output
- table-complete + JSON-missing + `partial` promotes to `ready`
- background launcher records failure in metadata if `waitUntil` continuation throws
- final status snapshot differentiates JSON failure from AI-generation failure

## Expected outcome

If this happens again, the trip row will tell us exactly which phase failed and why. More importantly, if all paid days were already written to normalized tables, the app will recover the full itinerary instead of presenting one day out of four.