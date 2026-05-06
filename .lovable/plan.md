# One Price Per Activity — End the Card vs Budget Divergence

## Why the previous fix isn't enough

Last turn I added two safety nets:
1. `preserveLedgerCosts` (server + client) so autosaves can't downgrade JSONB after a repair.
2. `getLedgerOverride` so the card *displays* the ledger price when JSONB is materially lower.

Both are defensive patches around a structural problem: **`trips.itinerary_data.activities[].cost` and `activity_costs.cost_per_person_usd` are two independent stores of the same fact.** Every code path that writes one without the other is a chance to drift. The user is right — this will keep happening until there is exactly one writer of price.

## The structural fix

Make `activity_costs` the **only** writer, and have the database itself project the value back into JSONB. After this, the card cannot show a different price from the budget — they are reading the same byte path.

### 1. Database trigger: `activity_costs` → `trips.itinerary_data` (single source of truth)

New `AFTER INSERT OR UPDATE OR DELETE` trigger on `public.activity_costs`:

- On INSERT/UPDATE: `jsonb_set` the matching activity inside `trips.itinerary_data.days[*].activities[*]` where `id = NEW.activity_id`, writing:
  ```json
  "cost": { "amount": <total_cost_usd>, "currency": "USD",
            "perPerson": <cost_per_person_usd>, "basis": "ledger",
            "source": <NEW.source>, "synced_at": <now> }
  ```
- On DELETE: clear `cost` back to `{ amount: 0, currency: "USD", basis: "ledger" }`.

The trigger function uses a single statement with a `jsonb_path_query` + `jsonb_set` to update the right activity in place. Because the trigger runs in the same transaction as the cost write, **there is no window in which the ledger and JSONB disagree**.

This replaces the JSONB-writeback block in `action-repair-costs.ts` (lines 540–581) — it becomes dead code and is removed.

### 2. Make `activity_costs` reject anonymous JSONB-only writes

Add a NOT NULL `source` enforcement plus a small allowlist check:

- Existing sources keep working.
- A new `'manual_edit'` source is required when a user changes the price from the UI. The client cost-edit handler must call the existing cost-update RPC (or `syncActivitiesToCostTable` with `source: 'manual_edit'`) — never write `trips.itinerary_data.cost` directly.

### 3. Remove all client-side writes to `cost.amount` in `itinerary_data`

Audit and delete every place in the UI that mutates `activity.cost` and persists it through `itinerary_data`:

- `EditorialItinerary.tsx`: the cost-edit modal, swap handler, transport-mode change, and the `syncBudgetFromDays` JSONB shape pass — all stop writing `cost`. They write to `activity_costs` only.
- `TripDetail.tsx` autosave funnels: strip `cost` from the activities they round-trip (the trigger will repopulate from ledger after save).
- `TripPlannerContext.tsx#saveTrip`: same — never persist `cost.amount` from React state.

After this, `trips.itinerary_data.cost` is **derived state**, owned by the database. The client treats it as read-only.

### 4. Card display becomes trivially correct

`getActivityCostInfo` keeps reading `activity.cost?.amount`, but the value it sees is now stamped by the DB trigger, so it always matches the budget. The temporary `getLedgerOverride` defense-in-depth from the previous turn is **kept** as a belt-and-braces guard for one release, then removed in a follow-up once we have telemetry showing zero overrides firing.

### 5. Backfill

One-shot migration: for every existing trip, re-run the same `jsonb_set` projection to align JSONB to the current `activity_costs` rows. Logged per-trip count. No data loss — only writing the price the budget already considers truth.

## Out of scope

- Currency display (€ vs $). The trip's `local_currency` already controls the symbol; the underlying amount is what diverged. This plan fixes the amount; the symbol logic is unchanged.
- The Luxury Luminary 30% dining allocation question — separate calibration discussion.
- The `'repair_floor'` basis tag added last turn stays, but its purpose is now informational; the trigger guarantees JSONB equality regardless.

## Files

**New**
- `supabase/migrations/<ts>_sync_activity_costs_to_jsonb.sql` — trigger, function, backfill.

**Modified**
- `supabase/functions/generate-itinerary/action-repair-costs.ts` — drop the JSONB writeback block (now redundant).
- `src/components/itinerary/EditorialItinerary.tsx` — strip `cost` from save funnels; cost edits go through the ledger.
- `src/contexts/TripPlannerContext.tsx` — same.
- `src/pages/TripDetail.tsx` — same; `safeUpdateItineraryData` no longer needs the preserve helper (kept for one release as a transitional safety).
- `src/services/activityCostService.ts` — expose `updateActivityCost(tripId, activityId, perPersonUsd, source='manual_edit')` for the cost-edit modal.

## Verification

1. Unit test on the trigger: insert/update/delete on `activity_costs` mutates the matching JSONB activity.
2. Integration test: run repair on a Rome trip, query `trips.itinerary_data` immediately, assert `cost.amount === total_cost_usd`.
3. Backfill log: zero residual rows where ledger > 0 and JSONB.cost.amount < ledger × 0.9.
4. Browser smoke: open the Rome trip, La Pergola card shows $500 with no `[LedgerOverride]` console warning.

## Why this is the last time

After this lands, **the only way for the card and budget to disagree is for a developer to bypass `activity_costs` entirely and stamp `cost` directly into JSONB.** That path is removed from the UI and edge functions; a lint rule (already proposed for Google API centralization — same pattern) can guard against future regressions.
