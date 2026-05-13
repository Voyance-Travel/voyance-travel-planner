
## What's happening

The "Calculating…" pill next to Trip Total can spin forever on both the Itinerary and Budget tabs even though the underlying numbers are correct. Verified the affected trips (Mexico City, Montreal, San Juan, Casablanca, Kyoto, Osaka, Amsterdam) are all in `status='ready'` or `'partial'` AND have `metadata.itinerary_frozen_at` set — so the AI generation gate is genuinely off. The visible spinner is purely a UI state-management bug:

- **Itinerary tab** spinner = `isBudgetGenerating || financialSnapshot.loading`. The wedge is `financialSnapshot.loading` getting stuck `true` (any silent network blip in `useTripFinancialSnapshot.fetchData` before `setData` runs leaves the initial `loading: true` in place — the catch-only safety net is too narrow and the initial `if (!tripId) return` early-exit doesn't clear it either).
- **Budget tab** spinner = `summary.isGenerating`. Should already be `false` for these trips, but the OR with re-fetch interval (4s) means a single stale `isGenerating:true` round-trip keeps the pill on. We'll harden the same way.

## Fix (UI / hooks only — no business-logic changes)

1. **`src/hooks/useTripFinancialSnapshot.ts`**
   - Treat a non-zero `tripTotalCents` as "we have a real number, stop spinning" — once we've ever set a successful snapshot, never flip `loading` back to `true` on subsequent re-fetches (booking-changed events, backfill events).
   - Clear `loading` at the early `if (!tripId) return` exit so a transient null tripId can't strand the pill.
   - Add an absolute safety timeout (8 s) that flips `loading: false` if no `setData` has fired — covers the unlikely "promise never resolves" case (network hang, RLS recovery loop).
   - Log a one-time `[useTripFinancialSnapshot] spinner safety timeout fired` warn so we can detect any future regression.

2. **`src/components/itinerary/EditorialItinerary.tsx`**
   - Tighten the `isBudgetCalculating` derivation: only show the pill while we have **no** total to render (`financialSnapshot.tripTotalCents === 0 && financialSnapshot.loading`) OR the AI is actively generating (`isBudgetGenerating`). This kills the "spinner re-appears during background refetches" pattern without touching number rendering.

3. **`src/components/planner/budget/BudgetTab.tsx`**
   - Same tightening for the BudgetTab pill — show "Calculating…" only when `isGenerating && (!snapshot || snapshot.tripTotalCents === 0)`. If we already have a number on screen, never re-spin.

4. **Tests**
   - Extend `src/services/__tests__/getBudgetSummaryStaleGen.test.ts` (or add a sibling) to cover `partial + frozenAt` (Casablanca/Osaka), `ready + frozenAt` (the rest) and a `loading: true → snapshot fills → booking-changed → loading: true` round-trip never re-spinning.

5. **Memory**
   - Update `mem://constraints/itinerary/calculating-spinner-resolves` with the new "snapshot-presence supersedes loading flag" rule so future refactors don't re-introduce the wedge.

## Out of scope

- No changes to `getBudgetSummary` business rules, generation status, or the underlying `activity_costs` math — those are correct. Numbers stay identical; only the spinner condition changes.
