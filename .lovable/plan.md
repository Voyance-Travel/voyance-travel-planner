## Goal

The currency toggle on the itinerary should **always start in USD on every page load**, regardless of what the user last picked. Switching to local during a session is still allowed, but a refresh / re-open resets to USD.

## Change

In `src/components/itinerary/EditorialItinerary.tsx` (around lines 2781–2796):

1. Remove the `localStorage` read in the `useState` initializer — initialize `showLocalCurrency` to `false` unconditionally.
2. Remove the `useEffect` that writes `voyance.currencyToggle.<tripId>` to `localStorage`.
3. Remove the now-unused `currencyToggleStorageKey` constant.
4. Best-effort cleanup: on mount, delete any pre-existing `voyance.currencyToggle.*` keys from `localStorage` so stale values don't linger.

No other files change. The toggle UI, `tripCurrency` derivation, BudgetTab/PaymentsTab plumbing, and FX helpers stay exactly as they are.

## Verification

- Fresh load of any trip → header shows USD, USD chip highlighted.
- Toggle to local during the session → itinerary, Payments, Budget all switch to local (existing behavior).
- Refresh the page → back to USD on all three surfaces.

## Memory

Update `mem://constraints/finance/currency-units-canonical`: drop the "per-trip choice persisted in localStorage" line; document that USD is the hard default on every load and local is session-only.
