Root issue: the header is visually reading as EUR because the current toggle UI is ambiguous and the selected-state styling can make the local currency look active even though the code tries to initialize `showLocalCurrency` to false. There is also still too much per-component currency logic in `EditorialItinerary.tsx`, so prior fixes only patched one path instead of making USD the enforced display contract.

Plan:
1. Make USD the hard initial display currency
   - Keep the session-only state, but derive the selected currency through a small explicit helper so `tripCurrency` cannot fall back to local/budget currency on first render.
   - Reset to USD whenever `tripId` changes and keep clearing legacy `voyance.currencyToggle.*` localStorage keys.

2. Fix the toggle visual so the selected side is unmistakable
   - Replace the current `USD ↔ EUR` text treatment with a true two-segment control.
   - The active segment gets the filled/primary styling; inactive segment is muted.
   - This prevents “EUR appears selected by default” even when the numeric value is USD.

3. Propagate the same selected currency everywhere on the trip page
   - Continue passing `tripCurrency` into Payments/Budget/Flights/Hotels, but ensure it is always `'USD'` until the user explicitly clicks local.
   - Keep all totals canonical USD internally; only the display conversion changes after the user toggles.

4. Add a regression test for the Amsterdam/EUR case
   - Mount/validate the currency-selection behavior for a Eurozone destination: first render must show USD selected and no EUR-formatted trip total.
   - Toggle once should switch to EUR, and changing trips should reset back to USD.

5. Update the project memory note if needed
   - Strengthen the existing currency memory with the concrete UI rule: selected display currency must be explicit, not inferred from destination/budget on initial render.