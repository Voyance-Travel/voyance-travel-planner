## Why the prior fixes didn't actually solve it

Verified persisted state for trip `d18b2e8a…`:

- `metadata.must_do_coverage = { missing: [], scheduled: [all 4] }` — **false positive**.
- `metadata.must_do_repair_attempted = true` — repair ran but injected nothing.
- `trip_day_intents`: 4 rows, all `status='active'` (not one marked `fulfilled`).
- Persisted days: Day 1 `Arrival Flight @ 02:30`, `Colosseum @ 21:30–23:45` (after dark); Days 2–3 dining-only; Pantheon / Trevi / Vatican absent from every title, venue, and description.

Three real defects remain:

1. **Coverage matcher is too loose** — `activityMatches` searches `description` too, so any day-prompt sentence mentioning "Vatican" / "Pantheon" / "Trevi" marks the venue scheduled. That's how all 4 came back green while Days 2–3 are food-only.
2. **Repair pass is fire-and-forget** — `must_do_repair_attempted` is stamped before the injected cards are validated to actually appear in `itinerary_data`, and stamped even when injection silently no-ops.
3. **Reconciliation never marks intents fulfilled** — all 4 rows stay `active`, so backlog injection on Day 2/3 prompts should have fired and didn't, because (a) the backlog reader filters on the wrong status field or (b) the day prompt is rebuilt from `dayItems` before backlog merge.

## Plan

### 1. Tighten coverage matcher (`assert-must-do-coverage.ts`)

- Restrict `activityMatches` haystack to **title + name + venue + location.name** only — drop `description` and `location.address`.
- Require a **whole-word** boundary match (`\b<matcher>\b`), not bare `includes` — kills "Trevi" matching "Travel to …".
- Add `'st peter\'s basilica'` and `'vatican museums'` as separate canonical entries so the Vatican mega-string can match either half independently.
- Return per-venue `matchedActivityId` for traceability.

### 2. Make coverage feed the health gate (`action-generate-trip-day.ts` + `assert-must-do-coverage.ts`)

- Run `assertMustDoCoverage` immediately before `writeGenerationHealth` (not after Phase 5 only).
- When `missing.length > 0`, push `MUST_DO_UNCOVERED` into `generation_health.persistGateCodes` with `{ missing, scheduled }` payload.
- Append a `generation_trace` entry: `{ at, kind: 'must_do_coverage', missing, scheduled }`.
- Stamp `metadata.must_do_coverage` on **every** terminal generation (including 0-missing success) so stale snapshots are overwritten.

### 3. Reconcile intent fulfillment on every persist

- In the existing `reconcileFulfillment` path (`action-save-itinerary` + `action-generate-trip-day`), re-canonicalize using the same matcher map and mark `trip_day_intents.status='fulfilled'` + stamp `fulfilled_activity_id` + `fulfilled_at`.
- Cover the case where a trip-wide intent (day_number=NULL) is satisfied by ANY day.
- Sentinel: `[INTENT_FULFILLED] intent=<title> day=<n> activity=<id>`.

### 4. Promote unfulfilled must-do intents into every relevant day prompt (`compile-prompt.ts`)

- Read `trip_day_intents WHERE trip_id=? AND status='active' AND priority='must'`.
- Inject as an **URGENT BACKLOG** block on every non-departure day until fulfilled, in addition to the existing per-day `dayItems`.
- Each backlog row carries the daylight-hours hint (`09:00–18:00 preferred, never after 20:00`) so the LLM doesn't repeat the 21:30 Colosseum mistake.
- Suppress only when the day's usable active window (after arrival buffer / before departure buffer) is < 90 min.

### 5. Real `LANDMARK_AFTER_DARK` repair (`repair-day.ts`)

- For each activity flagged `LANDMARK_AFTER_DARK` (already detected in `validate-day.ts`):
  - Find the latest **non-meal, non-locked, non-user** afternoon slot (12:00–18:00) and **swap** start/end pairs.
  - If no swap candidate exists, shift the landmark to the earliest free 90-min daylight window.
  - Skip if landmark is locked/user/manual/extracted/pinned.
  - Re-run `enforceTimingAndBuffers` after each swap.
- Sentinel: `[LANDMARK_DAYLIGHT_REPAIR] day=N venue=<title> from=<old> to=<new>`.

### 6. Real missing-must-do injection (single attempt, validated)

- After repair, if `assertMustDoCoverage().missing.length > 0` and `metadata.must_do_repair_attempted !== true`:
  - Pick the lightest non-departure day (fewest paid activities, no required-meal conflict).
  - For each missing venue, resolve via existing `verified_venues` / fallback DB; if resolved, insert a card with daylight time and run the full validator/cascade.
  - **Only** stamp `must_do_repair_attempted=true` AFTER re-running `assertMustDoCoverage` and confirming `missing.length` decreased. Otherwise leave unstamped so the next save retries.
  - If venue resolution fails, keep `MUST_DO_UNCOVERED` on the health gate so the trip surfaces the gap in UI rather than silently passing.

### 7. Tighten arrival/departure clock gating (`must-do-priorities.ts`)

- `scheduleMustDos` / `findBestDay` take `{ arrivalClock, departureClock, dayMode }` per day.
- Day 1 only eligible when `arrivalLocal + 90min < 17:00`; Day N only when `departureLocal - bufferMins - 90min > 12:00`.
- Keep the 600-min relax cap, log the rationale: `[MUSTDO_SCHEDULE] day=N relax=true reason=usable_window=Xmin`.

### 8. Heal Rome trip `d18b2e8a…` in place (data, not migration)

- Repair `itinerary_data.days[0]`:
  - `Arrival Flight` → land time recorded on the trip (use `metadata.arrivalTime24` or first flight row); rebuild Day 1 logistics from that anchor.
  - `Colosseum Exploration` → 14:30–17:00; drop the late-evening transit pair around it.
- Inject:
  - Day 2 morning: `Vatican Museums & St. Peter's Basilica` block (09:00–12:30) before lunch.
  - Day 3 morning: `Pantheon` (09:30–10:30) + `Trevi Fountain` (10:45–11:30) before lunch.
- Resolve venues via `verified_venues` (Rome); fall back to known coords.
- Route the write through `safeUpdateItineraryData('self-heal-must-do-backfill')` so all downstream syncs (activity_costs, trip_day_intents.status='fulfilled') fire.
- Re-run `assertMustDoCoverage` + stamp fresh `metadata.must_do_coverage`, `generation_health`, and a trace entry.
- Clear `itinerary_frozen_at` only briefly during write; restamp after.

### 9. Tests

- `assert-must-do-coverage.test.ts`: whole-word matcher rejects "Travel to Trevi-themed café"; description text doesn't count; Vatican Museums alone satisfies "Vatican City (St Peter's & Vatican Museums)".
- `compile-prompt.test.ts`: active `priority='must'` intents render in URGENT BACKLOG on every non-tight day.
- `repair-day.landmark-after-dark.test.ts`: 21:30 Colosseum swaps with a 15:00 cultural block.
- `must-do-injection.test.ts`: missing Pantheon resolves and lands on lightest day; `must_do_repair_attempted` only set after coverage improves.
- `reconcile-fulfillment.test.ts`: trip-wide intent flips to `fulfilled` when matching activity exists on any day.

## Files to touch

- `supabase/functions/_shared/assert-must-do-coverage.ts`
- `supabase/functions/_shared/day-intents-store.ts` (reconcile + backlog reader)
- `supabase/functions/generate-itinerary/must-do-priorities.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` (re-export gate code)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (reconcile call site)
- One Rome trip data heal (in-place `UPDATE trips SET itinerary_data=…`, no schema migration)
- Matching `.test.ts` files

## Out of scope

- Rebuilding the must-do scorer.
- Multi-retry regeneration loops.
- Charging credits for the self-heal.
- New memory entry (will add after the contract is proven on the Rome trip).
