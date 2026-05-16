## Problem

The header USD ↔ local toggle (default USD, persisted per trip) already drives `tripCurrency` and is correctly piped into the Itinerary header, PaymentsTab, and BudgetTab. PaymentsTab is clean — every render site calls `displayMoney(usdCents)` which converts USD cents → display currency.

**BudgetTab is wrong.** Its `formatCurrency(cents)` only **relabels** the currency symbol — it never converts. So:

- Snapshot USD cents (e.g. `snapshot.tripTotalCents`) render with a `€` prefix at the same numeric value when toggle = EUR (and vice-versa).
- `settings.budget_total_cents` / `alloc.allocatedCents` / `alloc.usedCents` / `summary.committedHotelCents` / `fit.overageCents` etc. are stored in `budget_currency` units. They render at face value with a `$` prefix when toggle = USD (the Mallorca "$2,500" symptom).

Two unit systems hit one relabeling formatter → Budget always disagrees with Itinerary/Payments.

## Fix (frontend only, in `src/components/planner/budget/BudgetTab.tsx`)

Split the single formatter into two unit-aware helpers, then route every existing call site to the correct one. No new UI, no new toggle, no backend.

### 1. Replace the single `formatCurrency` with two helpers

```ts
import { formatMoneyFromUsdCents, convertToUSD } from '@/lib/currency';

const budgetCurrency = (settings?.budget_currency || 'USD').toUpperCase();

// Snapshot / ledger values — already in canonical USD cents.
const formatUsd = useCallback(
  (usdCents: number) => formatMoneyFromUsdCents(usdCents, displayCurrency),
  [displayCurrency],
);

// Values stored in `budget_currency` units (budget_total_cents, allocations,
// committed*, fit.* derived from those). Convert to USD first, then format.
const formatBudget = useCallback((budgetCents: number) => {
  if (!isFinite(budgetCents)) return formatMoneyFromUsdCents(0, displayCurrency);
  if (budgetCurrency === 'USD') return formatMoneyFromUsdCents(budgetCents, displayCurrency);
  const usd = convertToUSD(budgetCents / 100, budgetCurrency);
  return formatMoneyFromUsdCents(Math.round(usd * 100), displayCurrency);
}, [budgetCurrency, displayCurrency]);
```

### 2. Route every existing call site to the right helper

Audit-derived mapping (full pass over all ~30 `formatCurrency(` sites):

- **`formatUsd` (USD cents)** — anything reading from `snapshot.*`, `fit.drivers[*].cents` (already USD), `hotelCents`/`flightCents`/`discretionaryCents` (derived from `snapshot.tripTotalCents` + `summary.committed*` — see note below), per-bucket `amountCents` on lines 225/259, per-day `/day` divisions of `snapshot.budgetRemainingCents`, `breakdownParts` `r.usedCents`.
- **`formatBudget` (budget_currency cents)** — `settings.budget_total_cents`, `originalCents` (from `alloc.original_total_cents`), `suggested` (`fit.suggestedBudgetCents`), `alloc.allocatedCents`/`alloc.usedCents`, `city.allocatedBudgetCents`/`city.remainingCents`, `prev` revert value.

Note for hotel/flight: `summary.committedHotelCents` / `committedFlightCents` from `useBudgetSummary` are USD cents (mirrored from `activity_costs`). Keep them on `formatUsd`. The lines 663–707 paragraph mixes them with `budgetCents` — that comparison must also normalize: compute `budgetUsdCents = formatBudget`'s underlying USD conversion once and use it for `overagePct`, `hotelMultiplier`, and the "your budget is X" line so the ratio is unit-correct (same pattern PaymentsTab already uses for `budgetLimitUsdCents`).

### 3. Drop dead code

- Remove the now-unused `formatCurrency` after migration.
- Keep `rateDisclosure(displayCurrency)` banner — already correct.

## Out of scope

- No backend, edge function, ledger, or `activity_costs` writes.
- No new toggle UI; header toggle is unchanged.
- PaymentsTab and EditorialItinerary already render through `displayMoney`/USD-cents helpers — not touched.
- Per-currency rounding rules unchanged.

## Verification

Mallorca trip (budget = €2,500 stored as `budget_total_cents=250000`, `budget_currency='EUR'`, snapshot `tripTotalCents ≈ 175000`):

| Toggle | Budget total chip | Trip total chip | Payments Trip Total |
|---|---|---|---|
| USD (default first load) | `$2,693` (250000 EUR cents → USD) | `$1,750` | `$1,750` |
| Local (EUR) | `€2,500` | `€1,608` | `€1,608` |

Flip toggle → all three surfaces update together. Refresh → stays on last pick. New trip with no `budget_currency` → defaults to USD, both helpers become identity.

## Memory update

Update `mem://constraints/finance/currency-units-canonical` to document: BudgetTab uses two helpers — `formatUsd` for snapshot/ledger USD cents, `formatBudget` for `budget_currency`-stored cents (converted first). Single relabeling formatter is a known bug pattern; do not reintroduce.
