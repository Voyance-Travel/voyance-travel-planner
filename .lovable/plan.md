# Selected Attractions Ignored — Diagnosis & Fix Plan

## Symptom

Rome trip `d18b2e8a…` — user chose **Colosseum, Pantheon, Trevi Fountain, Vatican City**. Only Colosseum surfaced (Day 1 at 21:30 — way too late). Pantheon, Trevi, and Vatican are absent from all 3 full days. Days 2–3 are all-food.

## What the DB shows

- `metadata.mustDoActivities` is correctly stored as a 4-item array.
- `trip_day_intents` rows for this trip: **0** — `seedDayIntentsFromMetadata` either never ran in this server-chain leg, or `intentsFromChatPlannerExtraction` returned 0 entries (mustDoActivities is forwarded as an Array but the joiner expects a string in some branches).
- `metadata.generation_trace` / `generation_health` are NULL despite the visibility work shipped earlier — those columns were written by code paths that didn't reach this trip's pipeline.

## Root causes (compounding)

1. **`findBestDay` excludes arrival/departure days for >180 min activities.** Trip is 4 days; Day 1 is arrival, Day 4 is departure. That leaves **only Days 2–3** as candidates for big-ticket must-dos (Vatican ≈ 240 min, Colosseum ≈ 180). After a couple of must-dos get assigned to one day, the `lowestLoad + duration ≤ 480` cap rejects the rest as `unschedulable` (silent — only `priority:'must'` go into `unschedulable`; others are dropped without trace).
2. **Day-prompt only mentions the must-dos assigned to that day** (`dayItems`). Other-day items are listed as "for awareness — do NOT schedule today." So if scheduling already kicked Vatican/Trevi to `unschedulable` or to a day where the AI ignored them, no day's prompt re-asks for them.
3. **No post-generation coverage validator.** Nothing checks "every must-do venue listed in metadata appears in at least one day's activities." The `validate-day` checks dedup and concept duplication, never coverage.
4. **`trip_day_intents` was never seeded for this trip.** Without intent rows, the soft "USER WISHES" fallback that subsequent days rely on never fires either. The seeding call at `action-generate-trip-day.ts:397` is wrapped in a try/catch that warns and continues silently — combined with the array-vs-string handling in `intentsFromChatPlannerExtraction` (which only fires when `!perDayActivities`), this can produce 0 written rows with no surfaced error.
5. **Colosseum at 21:30** is itself a downstream symptom — the AI emitted Colosseum in Day 1's response but cascaded transit + meals pushed it to the only remaining slot. No assertion that landmark sightseeing should be daylight.

## Fix Plan

### 1. Schedule across all days for short-trip arrival/departure exceptions
- In `must-do-priorities.ts::findBestDay`, when `unschedulable.length > 0` after the first pass, run a **second relax pass** that allows Day 1 (post-arrival, given a positive afternoon window) and Day N (pre-departure, given a non-tight flight) — gated on the trip's actual arrival/departure clock, not duration alone.
- Treat `lowestLoad + duration ≤ 600` (10h) for the relax pass instead of 480.

### 2. Inject ALL unscheduled must-dos into EVERY remaining day's prompt as "URGENT BACKLOG"
- In `compile-prompt.ts` (around line 597), when `mustDoEventItems.length` is 0 for `dayNumber` but `scheduled.unschedulable.length > 0` (or any must-do is not yet fulfilled per `trip_day_intents`), append a `## ⚠️ UNCOVERED MUST-DOS — schedule today if at all possible` block listing the venues with resolved address/description. Suppress on departure-day prompt (Day N == totalDays).

### 3. Post-generation must-do coverage assertion
- Add `assertMustDoCoverage(allDaysSoFar, mustDos)` invoked from `action-generate-trip-day.ts` after the final day persists (Phase 5+ before freeze). For every must-do venue with **0 matching activities** across the trip:
  - Stamp `metadata.must_do_coverage = { missing: [...], scheduled: [...] }`.
  - Surface in `generation_health.persistGateCodes` as `MUST_DO_UNCOVERED`.
  - Optional follow-up: enqueue a single repair leg that re-runs the lightest day with a forced injection (mirror existing `repairDay` pattern, gated by `metadata.must_do_repair_attempted` to avoid loops).

### 4. Fix silent seeding gap so `trip_day_intents` always carries must-dos
- In `_shared/intent-normalizers.ts::intentsFromChatPlannerExtraction`, **always** process `mustDoActivities` (drop the `!perDayActivities.length` gate). Per-day rows still win via the unique index; this guarantees trip-wide must-dos are written even when chat-planner extracted `perDayActivities`.
- In `_shared/day-intents-store.ts::seedDayIntentsFromMetadata`, return a structured result `{ written, skipped, errors }` and log it; have the caller stamp `metadata.intent_seed_audit` so future stuck trips show what happened.

### 5. Landmark daylight constraint
- In the per-day prompt (`compile-prompt.ts`), when a sightseeing must-do is injected, add a one-liner: *"Schedule sightseeing landmarks between 08:00 and 17:30 — never after 20:00."* Add a validator entry `LANDMARK_AFTER_DARK` in `validate-day.ts` that downgrades any matching sightseeing activity to a warning and triggers a repair swap.

### 6. Backfill this Rome trip
- One-shot edge call to repair Days 2 and 3:
  - Day 2: inject Vatican Museums (morning, 09:00–12:30) + St. Peter's Basilica (13:30–15:00).
  - Day 3: inject Pantheon (10:00–11:00) + Trevi Fountain quick-stop (11:30–12:00) + Roman Forum/Palatine if room.
- Move Day 1 Colosseum from 21:30 to ~15:00 (replace the food-only Trastevere wander overlap).
- Run `enforceTimingAndBuffers` + persist via `safeUpdateItineraryData('self-heal-mustdo-coverage')`.

### 7. Tests
- `must-do-priorities.test.ts` — 4-day trip, 4 long must-dos → all scheduled (3 across full days, 1 relaxed onto Day 1 afternoon).
- `compile-prompt.test.ts` — uncovered must-do appears in subsequent day prompts.
- `validate-day.test.ts` — landmark scheduled at 21:30 flagged `LANDMARK_AFTER_DARK`.
- `day-intents-store.test.ts` — `seedDayIntentsFromMetadata` returns audit object; mustDoActivities seeded even when perDayActivities present.

## Files to touch

```
supabase/functions/generate-itinerary/must-do-priorities.ts
supabase/functions/generate-itinerary/pipeline/compile-prompt.ts
supabase/functions/generate-itinerary/pipeline/validate-day.ts
supabase/functions/generate-itinerary/action-generate-trip-day.ts
supabase/functions/_shared/intent-normalizers.ts
supabase/functions/_shared/day-intents-store.ts
+ matching .test.ts files
+ one-shot SQL migration backfilling trip d18b2e8a…
```

## Out of scope

- Re-architecting must-do scoring (preferredTime inference, cross-day clustering).
- Rebuilding the day-prompt around a fresh "uncovered set" rather than per-day `dayItems` — appended as a follow-up if coverage gaps persist after the relax pass + backlog injection.
