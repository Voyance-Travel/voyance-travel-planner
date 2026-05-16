# Budget vs Payments mismatch — root cause + fix

## What the user actually saw

- **BudgetTab**: "$2,500 budget · $0 expenses"
- **PaymentsTab**: "€1,608 · 92% of budget"

Same trip, same underlying ledger — three different-looking numbers.

## Root cause (one bug with two symptoms)

The codebase has **two different "cents" fields that look identical but mean different things**, and the two tabs handle them inconsistently:

| Field | Real unit | Used by |
|---|---|---|
| `snapshot.tripTotalCents` | **canonical USD cents** (always USD, regardless of trip) | both tabs |
| `settings.budget_total_cents` | raw cents in `settings.budget_currency` (USD, EUR, …) — **no conversion** | both tabs |

What each tab does today:

- **PaymentsTab** formats `snapshot.tripTotalCents` via `formatMoneyFromUsdCents(cents, tripCurrency)` where `tripCurrency` defaults to the **destination's local currency** (EUR for Mallorca). FX-converts USD→EUR correctly → shows **€1,608**.
- **PaymentsTab** then computes `% of budget = snapshot.tripTotalCents / settings.budget_total_cents`. This divides **USD cents by budget-currency cents** — only correct when `budget_currency === 'USD'`. For a USD budget + EUR display, the % is mathematically right (USD÷USD) but the user is staring at "€1,608 / $2,500 = 92%" which looks impossible.
- **BudgetTab**'s `formatCurrency(cents)` does `new Intl.NumberFormat({ currency: budget_currency }).format(cents/100)` — it **never converts**, it just relabels. So a `snapshot.tripTotalCents` of 232000 (=$2,320) prints as "$2,320" when `budget_currency='USD'` (correct), or "€2,320" when `budget_currency='EUR'` (silently wrong by ~30%).
- The "$0 expenses" the user saw is most likely BudgetTab caught mid-snapshot-load (the `isGenerating && snapshot.tripTotalCents === 0` branch renders a spinner-ish $0), not a real ledger divergence. Once snapshot resolves, both tabs read the same number — they just *render* it differently.

This is the same family of "two tabs disagree" bugs already locked down in memory (`displayed-trip-total-single-source`, `header-strip-mirrors-snapshot`), but those fixes were USD-only and never closed the cross-currency leak.

## Fix (frontend-only, ~4 small edits)

### 1. Single canonical display currency

Add `getCanonicalDisplayCurrency({ budgetCurrency, tripCurrency, showLocalCurrency })` in `src/lib/currency.ts`:

- If a `budget_currency` is set, **it wins** — because the only meaningful comparison on either tab is "spent vs budget", and that has to be in the same currency.
- Otherwise fall back to today's `tripCurrency` (local / USD toggle).

### 2. PaymentsTab: align with budget currency

`src/components/itinerary/PaymentsTab.tsx`:

- Accept new optional `budgetCurrency` prop alongside existing `budgetLimitCents`.
- Replace local `displayMoney = formatMoneyFromUsdCents(c, tripCurrency)` with `formatMoneyFromUsdCents(c, getCanonicalDisplayCurrency(...))`.
- For the `% of budget` ratio, convert `budgetLimitCents` (which is in `budget_currency`) into USD cents first via `convertToUSD`, then divide by `snapshot.tripTotalCents` (already USD cents). Same fix for the "Over budget by X" line and progress bar value.

`src/components/itinerary/EditorialItinerary.tsx` line 7552: pass `budgetCurrency={budgetSettings?.budget_currency}` next to the existing `budgetLimitCents`.

### 3. BudgetTab: stop silently mislabeling USD cents

`src/components/planner/budget/BudgetTab.tsx` line 462-472: rewrite `formatCurrency` to delegate to `formatMoneyFromUsdCents(cents, budget_currency)` so non-USD budgets get **converted**, not relabeled. (`snapshot.tripTotalCents` is canonical USD cents — today's `Intl.NumberFormat` call assumes they're already in `budget_currency`, which is the silent bug.)

Audit the few places BudgetTab feeds non-snapshot cents into `formatCurrency` (e.g. `settings.budget_total_cents` itself, manual allocations) — those rows are **already** in `budget_currency`, so they need a separate small formatter (`formatBudgetCurrencyCents`) that does *not* convert. Two formatters, each with one clear meaning.

### 4. Memory entry

Add `mem://constraints/finance/currency-units-canonical`:

> Two cents fields exist with different units: `snapshot.tripTotalCents` is canonical USD cents; `settings.budget_total_cents` is raw cents in `settings.budget_currency`. Never format the first as if it were the second (and vice versa). Always go through `formatMoneyFromUsdCents` for snapshot-derived totals; use `formatBudgetCurrencyCents` for `budget_total_cents`/allocation rows. Any % or delta that compares the two MUST convert one side into the other's units first.

## Out of scope

- No backend / SQL / ledger changes — the ledger is correct; only display layer is wrong.
- No change to the show-local-currency toggle behavior when no budget is set.
- No re-touching of hero-image or AI Concierge work from prior turns.

## Verification

1. Open Mallorca trip → Budget tab and Payments tab should now show **the same headline amount** in the same currency.
2. Toggle `budget_currency` between USD and EUR on a test trip; both tabs continue to agree, and the % of budget stays sane (no 92% on what should be 70%).
3. `rg "Intl.NumberFormat.*currency:" src/components/planner/budget` should return only the new `formatBudgetCurrencyCents` helper site.
