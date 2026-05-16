Problem found: the itinerary header toggle itself is initialized to USD, but several other money paths can still bypass that default.

Root causes:
- `BudgetTab` receives the USD display currency, but it still uses `useTripBudget.formattedBudget` / `formattedRemaining`, which are formatted from `settings.budget_currency` instead of the global trip display currency.
- `BudgetSetupDialog` formats feasibility/hotel warning amounts directly with `settings.budget_currency`, so it can show local currency even when the page is in USD mode.
- `JourneyBudgetSummary` reads each linked trip’s `budget_currency` and uses that over the parent display currency.
- Some older formatter components use raw `Intl.NumberFormat(currency)` on values that are canonical USD cents, which changes the symbol without consistently using the selected display currency.
- The specific Jeju trip row already has `budget_currency = USD`, so this is not a database value problem for that trip; it is a frontend display-path problem.

Plan:
1. Make `BudgetTab` stop rendering `formattedBudget` / `formattedRemaining` from `useTripBudget`; compute those labels from canonical cents using the `displayCurrency` prop that comes from `EditorialItinerary`.
2. Update `BudgetSetupDialog` to accept a `displayCurrency` prop and format its warning/preview amounts in that currency instead of `settings.budget_currency`.
3. Update `JourneyBudgetSummary` so the parent display currency wins for all leg totals; do not let each trip’s stored `budget_currency` override the active USD/local toggle.
4. Audit the Budget/Payments/Itinerary money render paths touched by the trip page and replace any remaining canonical-USD direct `Intl.NumberFormat` formatting with `formatMoneyFromUsdCents(..., displayCurrency)`.
5. Add/update focused tests where practical for the formatter behavior: when `displayCurrency='USD'` and `settings.budget_currency='KRW'`, Budget tab labels must render `$`, not `₩`.
6. Verify on the trip page that first load shows USD across Trip Total, Budget, Payments, warnings, and summaries; local currency should appear only after clicking the currency toggle.