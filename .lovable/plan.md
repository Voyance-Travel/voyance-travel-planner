## What I found

Your Mexico City trip **was created** — `id=e4217b97-34b6-4de4-a842-2200db6f5f73`, 4 days, status `generating`, frozen at the first heartbeat from `15:33:41Z`.

The `.ldb` console error is a Chrome IndexedDB write failure — unrelated noise. The real problem is server-side and visible in the edge logs:

```
15:33:41  launcher_received
15:33:42  launcher_metadata_init
15:33:42  launcher_background_started   ← last log for this trip
15:33:43  (duplicate retry skipped — correct)
            (nothing after this; no generate-trip-day invocation, no error)
```

DB state:

| field | value |
|---|---|
| `itinerary_status` | `generating` |
| `generation_heartbeat` | `15:33:41Z` (frozen) |
| `generation_completed_days` | 0 / 4 |
| `generation_error` | null |
| `fully_persisted` | false |
| `day_count` in JSON | 0 |

So `EdgeRuntime.waitUntil(...)` fired in `action-generate-trip.ts`, the background promise reached `launcher_background_started`, and then **died silently** before it could invoke `generate-trip-day` for Day 1. Zero log lines, zero error metadata, zero failed-day numbers. Exactly the observability gap you flagged in the previous round.

This is the same `stuck-at-18%`-class symptom but earlier in the pipeline (stuck at 0%). The existing 90s stall detector in `useGenerationPoller` should self-resume, but only fires while the trip page is open — if you bounced away, it never ran.

## Plan

Two parts: (a) unstick your trip now, (b) close the blindspot so this can't silently happen again.

### Part A — Unstick trip `e4217b97`

1. **Reset trip state** with one SQL migration:
   - `itinerary_status` → `not_started`
   - Clear `metadata.generation_started_at`, `generation_heartbeat`, `fully_persisted`
   - Leave `generation_completed_days = 0` and metadata user inputs untouched
   - Refund the 240 credits charged at `15:33:20Z` (the `spend-credits` row for action=`trip_generation`) via `credit_ledger` — or, if cleaner, mark the `pending_credit_charges` row failed so the existing `useStalePendingChargeRefund` self-heal handles it on next page visit (preferred, no manual ledger write).
2. **Re-trigger generation** by reloading `/trip/e4217b97-34b6-4de4-a842-2200db6f5f73` — the existing `notStartedHealAttempted` allow-list site in `TripDetail.tsx` (gated on `!hasItineraryData`) will kick off `generate-trip` with a fresh launcher. No code change needed for the retry path.

### Part B — Close the launcher → first-day blindspot

Root cause hypothesis: an exception is thrown between `launcher_background_started` and the first `supabase.functions.invoke('generate-itinerary', { action: 'generate-trip-day', ... })`, and it's being swallowed because:

- The background task is wrapped in `EdgeRuntime.waitUntil(promise)` with no `.catch()` that writes back to `trips.metadata.generation_error`.
- The phase log markers jump straight from `launcher_background_started` to whatever the first day prints — there are no intermediate `phase=*` markers for "loaded trip facts", "computed total days", "queued day 1 invoke", etc.

Three small instrumentation patches in `supabase/functions/generate-itinerary/action-generate-trip.ts` (the launcher):

1. **Wrap the `EdgeRuntime.waitUntil` body in a `try/catch`** that writes the error message + stack to `trips.metadata.generation_error` and flips `itinerary_status` back to `failed`. Re-emit `[GENTRACE] phase=launcher_background_crashed status=fail msg=…` so it shows up in edge logs. Today the failure is invisible from both the DB and the logs.
2. **Add GENTRACE phase markers** at every step between `launcher_background_started` and the first day invoke:
   - `launcher_facts_loaded` (after trip row + profile fetched)
   - `launcher_total_days_computed` (after date math)
   - `launcher_metadata_seeded` (after `trip_day_intents` seeding)
   - `launcher_day_1_invoke_queued` (immediately before the first day invoke)
   - `launcher_day_1_invoke_returned status=ok|fail` (immediately after)
   Each marker is one log line — same format as the existing GENTRACE lines, so the next stuck trip tells us exactly which step blew up.
3. **Wire the launcher into the existing `Trace` recorder** added last round so these phase markers also land in `trips.metadata.generation_trace`. Use `withStage(trace, 'launcher_facts_loaded', { inputs: {tripId} }, …)` etc. — pure pass-through, zero behavior change. The auditor and `useReadTimeAudit` hook will then expose the failure on TripDetail mount for any future stuck trip without us having to dig through edge logs.

No business logic changes. No prompt changes. No schema changes beyond Part A's one-row reset.

### Tests

- Unit test that simulates a thrown exception inside the `EdgeRuntime.waitUntil` body and asserts (a) `generation_error` is written to metadata, (b) `itinerary_status` flips to `failed`, (c) GENTRACE `launcher_background_crashed` log line is emitted.
- Unit test asserting all 5 new phase markers fire in order on a happy-path generation.

### Out of scope

- Rome `d18b2e8a…` data fix (separate task).
- Mobile server-chain mode (already shipped).
- Any change to the per-day pipeline — this only instruments the launcher.

### Risk / rollback

- Part A is a one-row UPDATE + a `pending_credit_charges` status flip; reversible by re-running the same SQL with the old values.
- Part B is pure instrumentation in one file; reverting the patch restores current behavior.

### Files touched

- `supabase/migrations/<timestamp>_unstick_trip_e4217b97.sql` (Part A)
- `supabase/functions/generate-itinerary/action-generate-trip.ts` (Part B)
- `supabase/functions/_shared/__tests__/launcher-trace.test.ts` (new, Part B tests)
