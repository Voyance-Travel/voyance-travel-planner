

## Performance Logging & Admin Diagnostics

This plan adds timing instrumentation to itinerary generation, persists it in a new `generation_logs` table, enhances the live progress UI, and creates an admin diagnostics page.

---

### Architecture Overview

The generation system uses a self-chaining architecture:
1. `action-generate-trip` (500 lines) — sets up context, then fires day 1
2. `action-generate-trip-day` (979 lines) — generates one day, saves it, chains to next day
3. Each day calls `action: generate-day` in `index.ts` (13,434 lines) — the actual AI + enrichment

The `GenerationTimer` class will live in a shared file imported by all three action handlers. Progress is already tracked via `trips.metadata.generation_completed_days` — we'll supplement this with phase-level detail in the new table.

---

### Part 1: Database — `generation_logs` table

**Migration SQL** creates the table with:
- `trip_id` (FK to trips), `status` (started/in_progress/completed/failed)
- `phase_timings` JSONB — `{ "fetch_trip_data": 800, "ai_call_day_1": 45000, ... }`
- `day_timings` JSONB array — `[{ day: 1, total_ms, ai_ms, enrich_ms, activities }]`
- `errors` JSONB array — `[{ phase, error, timestamp }]`
- Context fields: `num_days`, `num_guests`, `destination`, `model_used`, token counts
- Progress fields: `current_phase`, `progress_pct` (for real-time polling)
- Indexes on `trip_id` and `created_at DESC`
- RLS: users can SELECT logs for their own trips; service role has full access via `auth.uid() IS NULL` policy (edge functions use service role key)

---

### Part 2: Edge Function Instrumentation

**New file: `supabase/functions/generate-itinerary/generation-timer.ts`**

A `GenerationTimer` class with:
- `init()` — creates the log row with status='started'
- `startPhase(name)` / `endPhase()` — tracks phase durations
- `addDayTiming(day, totalMs, aiMs, enrichMs, activityCount)` — per-day breakdown
- `addError(phase, error)` — accumulates errors
- `updateProgress(phase, pct)` — writes current_phase/progress_pct to DB for real-time polling
- `finalize(status)` — saves all collected timing data
- All operations wrapped in try/catch so logging never breaks generation

**Wiring into `action-generate-trip.ts`** (the orchestrator):
- Create timer at start, call `init()` with destination/days/guests
- Wrap pre-chain enrichment phases (profile load, jet lag, weather, etc.) with `startPhase`/`endPhase`
- Pass `logId` into the chain payload so `action-generate-trip-day` can continue logging

**Wiring into `action-generate-trip-day.ts`** (per-day handler):
- Receive `logId` from chain payload
- Before the generate-day fetch call: `startPhase('day_N_total')`
- After: record timing, call `addDayTiming()`, `updateProgress()`
- On final day: call `finalize('completed')` or `finalize('failed')`

**Wiring into `index.ts` generate-day action** (the heavy work):
- Wrap the AI call, response parsing, venue enrichment, cost estimation, and post-processing stages
- This is where the most granular timing data comes from (AI call duration, enrichment duration per day)
- The timer instance will be reconstructed from the logId passed in params

---

### Part 3: Real-Time Progress Enhancement

**File: `src/components/planner/shared/GenerationPhases.tsx`**

Currently shows rotating generic messages ("Finding hidden gems...") and per-day completion. Enhancement:
- Add a `useEffect` that polls `generation_logs` every 3 seconds when generation is active
- Display the actual `current_phase` instead of generic messages (e.g., "Enriching venues for Day 3...")
- Show a real progress percentage from `progress_pct`
- Stop polling when status is 'completed' or 'failed'
- Falls back gracefully to existing behavior if no log row exists (backward compatible)

---

### Part 4: Admin Diagnostics Page

**New file: `src/pages/admin/GenerationLogs.tsx`**

Layout (admin-gated via `user_roles` check):

```text
┌─────────────────────────────────────────────────────────┐
│  Generation Performance Logs              [Refresh]     │
│                                                         │
│  Summary Cards (last 7 days)                           │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ Total    │ Avg Time │ Failures │ Slowest  │         │
│  │ 23       │ 8m 34s   │ 3 (13%)  │ 14m 22s  │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│                                                         │
│  Recent Generations (table, click to expand)            │
│  ┌───────┬────────┬──────┬────────┬──────────┐         │
│  │ Time  │ Dest   │ Days │ Total  │ Status   │         │
│  │ 2m    │ Tokyo  │ 5    │ 9m 12s │ ✓ Done   │         │
│  └───────┴────────┴──────┴────────┴──────────┘         │
│                                                         │
│  ▼ Expanded: Phase Waterfall (CSS bars)                │
│  fetch_trip_data  ██ 0.8s                              │
│  ai_call_day_1    ████████████████████████ 45.0s       │
│  enrich_day_1     ████ 8.0s                            │
│  ...                                                    │
│  Bottleneck: AI calls = 82% of total                   │
│                                                         │
│  Per-Day Table + Error List                            │
└─────────────────────────────────────────────────────────┘
```

Components:
- `LogSummaryCards` — aggregates from last N days
- `LogTable` — sortable list with expandable rows
- `WaterfallChart` — horizontal bars proportional to duration
- `DayTimingsTable` — per-day breakdown
- Date range filter (today / 7d / 30d)

**Route**: Add `/admin/logs` in `App.tsx` alongside existing admin routes. Add nav link in Settings admin section.

---

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create `generation_logs` table + indexes + RLS |
| `supabase/functions/generate-itinerary/generation-timer.ts` | New: GenerationTimer class |
| `supabase/functions/generate-itinerary/action-generate-trip.ts` | Import timer, wrap enrichment phases, pass logId to chain |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Receive logId, wrap day generation, call updateProgress/finalize |
| `supabase/functions/generate-itinerary/index.ts` | Wrap generate-day AI call and enrichment with timer phases |
| `src/components/planner/shared/GenerationPhases.tsx` | Poll generation_logs for real-time phase display |
| `src/pages/admin/GenerationLogs.tsx` | New: admin diagnostics page |
| `src/App.tsx` | Add /admin/logs route |
| `src/pages/Settings.tsx` | Add admin nav link to Generation Logs |

### Deployment Order
1. Migration (table)
2. Edge function changes (timer class + wiring)
3. Frontend progress enhancement
4. Admin page

