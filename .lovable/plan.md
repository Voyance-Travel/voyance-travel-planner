## Goal

The header has a USD ↔ local-currency toggle. Today it controls only the itinerary header + activity cards. Payments and Budget ignore it (Payments hard-prefers `budget_currency`, Budget always reads `budget_currency` regardless). Result: three surfaces, three currencies.

Make the toggle authoritative across the entire trip view, and default it to **USD** so every trip starts in USD on first load.

## Behavior after this change

- First load of any trip → toggle = USD. Itinerary, Payments, Budget all render USD.
- Click toggle → local currency. Same three surfaces flip together.
- Choice persists per-trip in `localStorage` so refresh keeps the user's selection.
- Underlying numbers do **not** change. We only convert at the display layer using the existing `convertFromUSD` / `formatMoneyFromUsdCents` helpers. Backend, ledger, snapshot cents stay canonical USD; `settings.budget_total_cents` stays in `budget_currency` and is converted to USD for ratios.

## Changes

1. **`src/components/itinerary/EditorialItinerary.tsx`**
   - `showLocalCurrency` initial state: `true` → `false` (default USD).
   - Hydrate/persist from `localStorage` key `voyance.currencyToggle.<tripId>` so the user's pick survives reload.
   - Pass `displayCurrency={tripCurrency}` into `<BudgetTab />` (new prop, see #3).
   - `<PaymentsTab tripCurrency={tripCurrency} />` already wired — no change needed beyond #2.

2. **`src/components/itinerary/PaymentsTab.tsx`**
   - In the `displayCurrency` memo, flip precedence: **`tripCurrency` wins**, `budgetCurrency` is the fallback only when `tripCurrency` is empty. (The user's explicit toggle must beat the trip's budget metadata.)
   - Keep the existing `convertToUSD(budgetLimitCents, budgetCurrency)` step so the "% of budget" ratio stays unit-correct.

3. **`src/components/planner/budget/BudgetTab.tsx`**
   - Accept new optional prop `displayCurrency?: string` (defaults to `settings.budget_currency || 'USD'`).
   - Replace every `settings?.budget_currency || 'USD'` formatting site with `displayCurrency`.
   - `formatCurrency` helper inside the file: route through `formatMoneyFromUsdCents` so non-USD totals are **converted**, not just relabeled. Values stored in `budget_currency` (e.g. `budget_total_cents`, per-category allocations) are first converted to USD via `convertToUSD(amount, budgetCurrency)` and then formatted in `displayCurrency`. Snapshot-derived USD cents flow straight through `formatMoneyFromUsdCents`.
   - `rateDisclosure(displayCurrency)` instead of `rateDisclosure(budget_currency)`.

4. **`src/lib/currency.ts`**
   - Update the docstring on `getCanonicalDisplayCurrency` to reflect new precedence (user/toggle currency wins; budget_currency is fallback). No behavior change to other helpers.

5. **Memory** — update `mem://constraints/finance/currency-units-canonical` to document: header toggle = single source of truth; default USD; precedence is `tripCurrency > budgetCurrency > 'USD'`; never relabel non-USD cents — always convert via `convertToUSD` first.

## Out of scope

- No backend, edge function, ledger, or `activity_costs` writes — purely display.
- No new toggle UI; reuse the existing chip in the itinerary header.
- Per-currency rounding rules / FX rate table — unchanged.
- Sharing / PDF export currency — separate surfaces, not touched here.

## Verification

- Mallorca trip: open → header, Payments "Trip total", Budget "Spent / Budget" all render in USD with matching numbers. Click toggle → all three flip to EUR together. Refresh → stays on last choice.
- New trip (no `budget_currency` set) → still defaults to USD.
- USD-budget trip in a USD destination → toggle is a no-op (both sides equal); nothing reformatted incorrectly.
