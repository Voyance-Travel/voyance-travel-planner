## Problem

Three numbers shown side-by-side disagree:

- **Header Trip Total**: €915 (~$985) — `useDisplayedTripTotal.displayedTotalCents` rendered via `formatCurrency(..., tripCurrency)`.
- **PaymentsTab Trip Total**: $1,120 — `displayMoney(estimatedTotal)`.
- **PaymentsTab bucket sum**: $1,066 — `essentials + food + activities + transit + misc(+reserve)`.

Three divergence paths in `src/components/itinerary/PaymentsTab.tsx`:

1. **Silent fallback to a different source.** `baseTotal` (lines 463-467) silently swaps to `payableTotalCents` whenever `displayedTotal.loading` is true OR `displayedTotal.displayedTotalCents <= 0`. `payableTotalCents` does NOT include the misc/spending-money reserve and uses a different code path (`usePayableItems`) than the header (`useTripFinancialSnapshot` + `computeHeaderStripValues`). Any moment the snapshot is mid-fetch or returns 0, Payments shows a *different number* than the header instead of waiting. The "Reconciling…" badge is gated to hide while loading (line 1251), so the user sees the divergent number with no warning.

2. **Misnamed reserve fold.** Line 492: `const essentialItemsWithReserve = essentialItems;` — reserve was never actually folded into essentials despite the name. Reserve is added only to `miscItems` (lines 522-536). When `displayedTotal` is loading and `baseTotal = payableTotalCents` (no reserve), the bucket sum still includes reserve via miscItems → `bucketSumCents > estimatedTotal` by exactly `reserveCents` (~$54 in this case, matching the $1,120 − $1,066 = $54 gap).

3. **Currency assumption.** Header "(~$985)" is the user mentally converting €915→USD; PaymentsTab is rendering $1,120 — meaning either both surfaces are in the same currency (and the gap is real, see #1) or `tripCurrency` differs at the moment of paint. Currency is threaded via the same `tripCurrency` prop, so this collapses into #1: render a skeleton until both surfaces can quote the same canonical number in the same currency.

## Fix

All edits in `src/components/itinerary/PaymentsTab.tsx`. No backend changes — `useTripFinancialSnapshot` already returns the canonical reserve-inclusive total; the bug is PaymentsTab choosing not to wait for it.

1. **Remove the divergent-source fallback.** Delete the `payableTotalCents` branch in `baseTotal`. Replace with:

   ```ts
   const headerTotalReady =
     !displayedTotal.loading && displayedTotal.displayedTotalCents > 0;
   const estimatedTotal = headerTotalReady ? displayedTotal.displayedTotalCents : null;
   ```

   When `estimatedTotal === null`, render a `<Skeleton className="h-7 w-24" />` in place of `displayMoney(estimatedTotal)` (line 1242), and short-circuit the "Remaining to pay" / "Paid" / progress-bar math so it doesn't compute against a phantom number. The header is the single source of truth — if it isn't ready, Payments waits.

2. **Reconcile the bucket sum to the headline.** Two parts:

   a. Drop the misnamed `essentialItemsWithReserve` alias; replace every reference with `essentialItems`. Reserve stays in `miscItems` (matching the Budget tab).

   b. Add an inline reserve caption under the Misc bucket header when `reserveCents > 0`: "Includes <displayMoney(reserveCents)> spending-money reserve" so the equation `essentials + food + activities + transit + misc = Trip Total` reads cleanly to the user.

   c. Tighten the dev assertion (lines 555-578): after #1 lands, `bucketSumCents` must equal `estimatedTotal` to within $1 whenever `headerTotalReady` is true. Bump the existing `[PaymentsTab] divergence` Path B threshold from $2.00 → $1.00 and include `reserveCents`, `payableTotalCents`, and `displayedTotal.displayedTotalCents` in the warn payload (already there for most — just confirm).

3. **Belt-and-braces currency check.** Add a one-shot `useEffect` that warns when the live `tripCurrency` prop changes after first paint and the snapshot value would re-render in a different unit, so any future regression of `showLocalCurrency` toggle desync surfaces in dev:

   ```ts
   useEffect(() => {
     console.debug('[PaymentsTab] tripCurrency=', tripCurrency);
   }, [tripCurrency]);
   ```

   No user-facing behavior change.

## Out of scope

- `useTripFinancialSnapshot`, `useDisplayedTripTotal`, `useTripDayBreakdown`, `usePayableItems`, `resolveCanonicalCostRows` — all stay untouched. The contract is right; PaymentsTab just stopped honoring it.
- Header math / `computeHeaderStripValues`.
- Backend `activity_costs` schema or `archive_orphan_trip_payments` RPC.

## Verification

1. **Loading-state convergence**: Throttle network to Slow 3G, hard-refresh a trip. PaymentsTab "Trip Total" must render a skeleton (not a different number) until the header has a value, then both must show the same number in the same currency.
2. **Reserve reconciliation**: For a trip with `miscReserveCents > 0`, expand the Misc bucket. Sum the 5 buckets — must equal headline Trip Total exactly. The reserve caption must show under Misc.
3. **Currency parity**: Toggle local↔USD on the header. PaymentsTab Trip Total must re-render in the new currency on the next paint, no stale value.
4. **Console**: No `[PaymentsTab] divergence` warns on a healthy trip post-fix.

## Memory

After landing, append a Memory entry under the existing `Displayed Trip Total Single Source` constraint:

> PaymentsTab `estimatedTotal` MUST be `useDisplayedTripTotal.displayedTotalCents` only — never fall back to `usePayableItems.totalCents` (the latter excludes the misc reserve and resolves on a different code path). While the displayed total is loading or zero, render a skeleton — never a divergent number. Closes "Header €915 vs Payments $1,120 vs bucket $1,066" three-way drift.