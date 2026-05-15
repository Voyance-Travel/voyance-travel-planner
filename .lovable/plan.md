## Goal
Stop the recurring Budget/Payments/header reconciliation drift by making every visible finance surface read from one canonical cost decomposition instead of mixing itinerary JSON costs, payable-item sums, and `activity_costs` rows.

## What I found on Monaco
- The backend ledger for Monaco is internally consistent: **$944 total = $700 hotel + $244 itinerary costs**.
- The visible itinerary JSON still contains older/higher per-card costs such as `$30`, `$75`, `$53`, while the canonical ledger has `$10`, `$30`, `$20` per person for those same activities.
- That stale JSON-vs-ledger split is why this “keeps happening”: any surface that uses card JSON or payable item grouping can disagree with the canonical Budget/Payments snapshot.

## Implementation plan
1. **Create one shared finance decomposition hook/service**
   - Promote `decomposeTripCost` as the single frontend read path for headline total, bucket totals, day totals, hotel/flight, reserve, and manual-payment folds.
   - Ensure Payments, Budget, header strip, and per-day badges consume the same decomposition values.

2. **Stop Payments bucket totals from summing `usePayableItems` as truth**
   - Keep `usePayableItems` for row display and payment actions only.
   - Read bucket header totals from the canonical decomposition, with row sums treated as diagnostics only.

3. **Make itinerary card prices prefer the ledger for any matching activity**
   - Current card override only wins for protected floors or missing JSON.
   - Change it so if an `activity_costs` row exists for the card, the card displays the ledger amount by default, not stale JSON.
   - Preserve explicit user/manual overrides.

4. **Normalize JSON costs at save/persist boundaries**
   - When activity costs are written or repaired, mirror the canonical per-person USD amount back into `cost`, `estimatedCost`, and legacy price fields.
   - This prevents stale values like Monaco’s `$75` card cost from surviving after the ledger has settled to `$30`.

5. **Backfill affected existing trips**
   - Add a safe one-time repair path that detects `activity_costs.cost_per_person_usd` materially differing from `itinerary_data.days[].activities[].cost.amount` for the same `activity_id`.
   - Rewrite only the JSON price fields to match the ledger; do not change titles, timing, descriptions, locked activities, or user-entered manual costs.

6. **Add regression tests**
   - Monaco-style fixture: JSON card costs differ from ledger rows, and all computed totals must still equal the ledger total.
   - Manual hotel/flight override fixture: manual rows replace Day-0 canonical rows only when a manual row exists.
   - Reserve fixture: reserve appears in Misc and headline exactly once.

## Technical notes
- No schema change is required.
- The universal fix is mainly frontend finance-source unification plus a backend/front-end persist mirror for JSON price fields.
- The invariant will be: `Trip Total === sum(canonical buckets) === header displayed total`, while row itemization is never allowed to redefine the total.