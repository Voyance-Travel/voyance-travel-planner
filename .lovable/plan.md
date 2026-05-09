# L2 — Fix N+1 in `calculateBudgetSummary`

`src/services/tripBudgetAPI.ts` lines 502-506 currently do:

```ts
const allSplits: ExpenseSplit[] = [];
for (const expense of expenses) {
  const splits = await getExpenseSplits(expense.id);  // 1 round-trip per expense
  allSplits.push(...splits);
}
```

A trip with 30 expenses = 30 sequential `expense_splits` queries before the budget summary renders.

## Change

Replace the loop with one batched `.in('expense_id', expenseIds)` query, then map rows into `ExpenseSplit` shape using the same field mapping `getExpenseSplits` uses (so the rest of the function — which reads `s.expenseId`, `s.memberId`, `s.amount`, `s.isPaid` — keeps working unchanged).

```ts
// Batch fetch all splits for all expenses in one query (was N+1).
const expenseIds = expenses.map(e => e.id).filter(Boolean);
const { data: splitRows } = expenseIds.length > 0
  ? await supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
  : { data: [] as any[] };

const splitsByExpense = new Map<string, ExpenseSplit[]>();
for (const row of (splitRows || [])) {
  const split: ExpenseSplit = {
    id: row.id,
    expenseId: row.expense_id,
    memberId: row.member_id,
    amount: Number(row.amount),
    percentage: row.percentage ? Number(row.percentage) : null,
    isPaid: row.is_paid,
    paidAt: row.paid_at,
  };
  if (!splitsByExpense.has(split.expenseId)) splitsByExpense.set(split.expenseId, []);
  splitsByExpense.get(split.expenseId)!.push(split);
}

const allSplits: ExpenseSplit[] = Array.from(splitsByExpense.values()).flat();
```

`allSplits` is preserved (used at lines 536 and 546 with `.filter`). `splitsByExpense` is also exported into the closure so future code (and the verify check) can use the indexed lookup. No behavior change otherwise.

## Verification

- `grep -c "splitsByExpense" src/services/tripBudgetAPI.ts` ≥ 2 (the `Map` declaration + `.set`/`.get` references give 4+).
- Existing `getExpenseSplits` helper stays as-is (still used by other call sites at line 365).
- Budget summary numbers match what they did before (same input rows, same field mapping).

## Out of scope

- Changing the consumer-side `.filter(s => s.expenseId === ...)` calls to use the new `splitsByExpense` map (would be a nice micro-optimization, but spec says "replace per-expense fetch", not refactor balance computation).
