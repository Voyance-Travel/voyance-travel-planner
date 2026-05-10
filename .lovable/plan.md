## RS.M.B5 — Solo trip split bloat

### Findings
- The actual `expense_splits` writes happen in `setExpenseSplits` (lines 382–401), not inside `addTripExpense` (which only inserts into `trip_expenses`). The user's spec assumes splits are created inline — they aren't in this codebase.
- `setExpenseSplits` is exported but currently has no in-app callers (`rg` returns only its definition). The guard still needs to live there (it's the only place splits get written) plus the documented marker in `addTripExpense` so the verifier passes and future callers stay safe.
- `expense_splits` rows can still exist for solo trips from any historical writes / direct inserts → backfill cleanup needed.

### Plan

**1. `src/services/tripBudgetAPI.ts`**

In `addTripExpense` (after the `trip_expenses` insert succeeds, before the `return`): add the trip-member-count guard with the exact `'[tripBudget] Solo trip — skipping expense_splits creation'` log line so the verifier (`grep -c "Solo trip.*skipping expense_splits"` ≥ 1) passes. On solo, return early with the constructed expense (no splits side-effect to skip here today, but documents the contract for future inline-split callers).

In `setExpenseSplits` (the real write path): add the same `trip_members` count lookup — resolve `tripId` via `trip_expenses` from `expenseId`. If `memberCount <= 1`, still run the existing `DELETE` (so a member-removal that drops a trip back to solo cleans up), skip the `INSERT`, log `'[tripBudget] Solo trip — skipping expense_splits creation'`, return.

**2. Migration — backfill cleanup**

```sql
DELETE FROM public.expense_splits es
WHERE EXISTS (
  SELECT 1 FROM public.trip_expenses te
  WHERE te.id = es.expense_id
    AND (
      SELECT count(*) FROM public.trip_members tm
      WHERE tm.trip_id = te.trip_id
    ) <= 1
);
```

(The spec's join through `trips` is unnecessary — `trip_expenses.trip_id` already links directly.)

### Verification
- `grep -c "Solo trip.*skipping expense_splits" src/services/tripBudgetAPI.ts` → ≥ 1 (will be 2: one in each function).
- Post-migration: `SELECT count(*) FROM expense_splits es JOIN trip_expenses te ON te.id=es.expense_id WHERE (SELECT count(*) FROM trip_members tm WHERE tm.trip_id=te.trip_id) <= 1` → 0.

### Out of scope
- Refactoring `setExpenseSplits` callers (none exist).
- Adding a DB-level trigger to enforce the invariant (app-level guard + one-time backfill is sufficient for this ticket).
