## Root cause

For trip `7ea828ac…` Day 1, `activity_costs` contains **two dining rows**:

| activity_id | per-person | × travelers | total | in itinerary JSON? |
|---|---|---|---|---|
| `21050843…` (live "Lunch at Le Comptoir du Relais") | $45 | 2 | **$90** | ✅ |
| `f11e8f19…` (orphan from a prior swap) | $25 | 2 | **$50** | ❌ |

Only the $90 row corresponds to a real activity. The $50 row is leftover from a swap that never ran `cleanupRemovedActivityCosts`. Both `getBudgetLedger` and `usePayableItems` then run "orphan rescue" — when a row's `activity_id` no longer exists in JSON, they pop the next name from the `(day|category)` queue. The queue still contains "Lunch at Le Comptoir du Relais" (the only dining activity on Day 1), so the orphan inherits the *same* name, producing two visually identical rows at different prices. Existing dedupe keys on amount, so $50 ≠ $90 slips through.

## Fix (3 layers)

### 1. Backfill: purge existing orphans for all trips
SQL migration that deletes any non-`logistics-sync` `activity_costs` row whose `activity_id` is not present in `trips.itinerary_data->days[*].activities[*].id`. One-shot cleanup of pre-existing damage like this trip's `f11e8f19…` row.

### 2. Read-time guard in `getBudgetLedger` (`src/services/tripBudgetService.ts`)
Before the rescue loop runs, drop any row whose `activity_id` is non-null and **not** present in `nameById`. These are by definition orphaned rows that no longer correspond to any activity the user can see. Logistics rows (hotel/flight, `day_number=0`, no `activity_id`) are unaffected.

### 3. Same guard in `usePayableItems` (`src/hooks/usePayableItems.ts`)
Mirror the filter in the `for (const row of activityCosts)` loop so the Payments tab and Budget tab agree. Skip rows where `row.activity_id` exists but is missing from `activityNameById`.

### 4. Tighten orphan-rescue to prevent reintroducing duplicate names
Even after the guard, harden rescue so it never assigns a name already used by another costed row on the same day. (Defensive — the guard above should make this unreachable, but cheap to add.)

## Why not just fix sync?
`syncBudgetFromDays` already calls `cleanupRemovedActivityCosts` correctly. The orphan exists because either (a) it predates the cleanup logic, or (b) it was written by a path that bypassed the React component (e.g. an edge-function cost repair). A read-time filter is the durable fix; the migration handles existing damage.

## Files

- **new migration** — delete orphan `activity_costs` rows
- `src/services/tripBudgetService.ts` — filter orphans before mapping/rescue
- `src/hooks/usePayableItems.ts` — same filter in the activity-cost loop

## Verification
After deploy, the Day 1 list will show one "Lunch at Le Comptoir du Relais — $90" row, and the trip total will drop by $50.
