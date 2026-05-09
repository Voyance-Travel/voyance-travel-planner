## M4 — Cost summary currency normalization

`calculateBudgetSummary` sums `plannedAmount` / `actualAmount` across expenses without checking each expense's `currency`. A trip with EUR + JPY + USD expenses produces a meaningless number. Per spec: don't fake an FX conversion in v1 — exclude mismatched currencies from totals and surface a warning so the UI can flag them.

### Schema reality check (the user's snippet needs adapting)

The proposed snippet assumes `expense.amount`, an in-scope `trip` object, and a single `total += …`. Actual code:

- `TripExpense` has `plannedAmount`, `actualAmount` (nullable), and `currency` — no `amount` field. Four reductions exist: `totalPlanned`, `totalActual`, `totalPaid`, and the per-member `owed` aggregate (which sums `ExpenseSplit.amount`, inheriting the parent expense's currency).
- `calculateBudgetSummary(tripId)` only takes `tripId` — no `trip` object in scope. Need to fetch trip currency.
- `BudgetSummary` has no `currency` or warning field today; the UI can't render the warning until we expose one.

### Step 1 — Fetch trip currency at top of the function

```ts
const { data: tripRow } = await supabase
  .from('trips')
  .select('currency, budget_currency')
  .eq('id', tripId)
  .maybeSingle();
const tripCurrency = (tripRow?.currency || tripRow?.budget_currency || 'USD').toUpperCase();
```

(Verify both columns exist on `trips`; if only one does, drop the other from the select.)

### Step 2 — Per-expense normalization helper

```ts
const mixedCurrencyExpenseIds: string[] = [];
const normalize = (expense: TripExpense, raw: number): number => {
  const expenseCurrency = (expense.currency || tripCurrency).toUpperCase();
  if (expenseCurrency === tripCurrency) return raw;
  if (!mixedCurrencyExpenseIds.includes(expense.id)) {
    mixedCurrencyExpenseIds.push(expense.id);
    console.warn('[budget] Mixed-currency expense not converted', {
      expenseId: expense.id, expenseCurrency, tripCurrency, amount: raw,
    });
  }
  return 0; // truthful display > fake total; v1.x will add real FX
};
```

### Step 3 — Apply to all four totals

```ts
const totalPlanned = expenses.reduce((sum, e) => sum + normalize(e, e.plannedAmount), 0);
const totalActual  = expenses.reduce((sum, e) => sum + normalize(e, e.actualAmount ?? e.plannedAmount), 0);
const totalPaid    = expenses
  .filter(e => e.paymentStatus === 'paid')
  .reduce((sum, e) => sum + normalize(e, e.actualAmount ?? e.plannedAmount), 0);
const totalPending = totalActual - totalPaid;
```

For member balances: a split inherits its parent expense's currency. Build an `expenseById` map and run splits through `normalize(parentExpense, split.amount)` in both the `owes` and `owed` reductions. Skips fall to 0 the same way.

### Step 4 — Expose currency + warning on `BudgetSummary`

```ts
export interface BudgetSummary {
  totalPlanned: number;
  totalActual: number;
  totalPaid: number;
  totalPending: number;
  currency: string;                      // NEW — what the totals are denominated in
  mixedCurrencyExpenseIds: string[];     // NEW — expenses dropped from totals
  memberBalances: { … }[];
  settlements: TripSettlement[];
}
```

Return `currency: tripCurrency` and `mixedCurrencyExpenseIds` from the function. UI consumers can render a "X expenses need conversion" badge when the array is non-empty.

### Out of scope (explicit)

- Real FX conversion (exchangerate.host etc.) — v1.x.
- Migrating existing UI consumers to render the warning — they keep working; the new fields are optional readers.

### Verify

- `grep -n "Mixed-currency expense not converted\|mixedCurrencyExpenseIds" src/services/tripBudgetAPI.ts` → 3+ hits
- Trip with one EUR + one USD expense: totals only include the matching-currency rows; `mixedCurrencyExpenseIds.length === 1`; console shows one `[budget]` warn per mismatched expense (deduped by ID).
