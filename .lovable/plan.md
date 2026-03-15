

# Fix: Hotel & Flight Not Showing in Budget/Payments/Trip Total

## Root Cause

The `activity_costs` table defines `total_cost_usd` as a **generated column**:

```sql
total_cost_usd NUMERIC(10,2) GENERATED ALWAYS AS (cost_per_person_usd * num_travelers) STORED
```

PostgreSQL silently rejects any INSERT or UPDATE that explicitly sets a generated column. In `src/services/budgetLedgerSync.ts`, **both** the insert (line 73) and update (line 57) attempt to write `total_cost_usd: totalUsd`, causing the entire operation to fail silently. This means hotel and flight costs never land in `activity_costs`, so the views (`v_trip_total`, `v_payments_summary`) never include them.

## Fix

**File: `src/services/budgetLedgerSync.ts`**

Remove `total_cost_usd` from both the `.insert()` and `.update()` calls in `upsertLogisticsCost()`. The column auto-computes from `cost_per_person_usd * num_travelers`. The existing values for `cost_per_person_usd` and `num_travelers` are already correctly set, so the generated column will produce the right total automatically.

Additionally, add `.then()/.catch()` error logging to both insert and update calls so future failures surface in the console instead of being swallowed.

That's it — one file, two lines removed, and hotel + flight costs will flow into all budget/payment/trip total views.

