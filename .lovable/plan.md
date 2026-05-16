## Plan

Fix the itinerary currency display so every trip opens in USD by default, including the header, Budget, and Payments tabs.

## What I found

- `EditorialItinerary` already initializes `showLocalCurrency` to `false`, so the intended default is USD.
- The visible screenshot still shows `CNY`, which means something is reusing local display currency after load or a child surface is prioritizing `budgetCurrency`/local currency over the header toggle.
- The main likely weak spot is `PaymentsTab`/shared display currency behavior: `getCanonicalDisplayCurrency` falls back to `budgetCurrency` when `tripCurrency` is missing, which can reintroduce local currency if a component is rendered before the parent passes the USD toggle value.

## Changes to make

1. **Harden the canonical currency helper**
   - Update `getCanonicalDisplayCurrency` so it defaults to `USD` unless an explicit user toggle value is provided.
   - Keep budget currency only as a server/non-toggle fallback where there truly is no UI currency state.

2. **Make `EditorialItinerary` more defensive**
   - Ensure the header’s display currency is explicitly initialized as `USD` and cannot be inferred from destination/budget on first render.
   - Keep the local-currency toggle working as session-only: USD on reload, local only after the user clicks the toggle.

3. **Align child tabs**
   - Confirm Budget and Payments receive the parent `tripCurrency` and render canonical USD cents through the shared formatter.
   - Remove/adjust any fallback that lets `budgetCurrency` override the parent’s USD default.

4. **Add a small diagnostic log if needed**
   - Add a temporary/dev-only log showing `showLocalCurrency`, `localCurrency`, and `tripCurrency` on render so the next screenshot/log can prove whether the parent or a child is responsible.

## Validation

- Load a non-USD trip such as Shanghai.
- Confirm the header initially shows `$…` and the toggle highlights `USD`.
- Click the currency toggle and confirm it changes to `CNY` only for that session.
- Refresh the page and confirm it returns to USD.