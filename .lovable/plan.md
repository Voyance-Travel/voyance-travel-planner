# Fix: Payments $1,272 ≠ Header $964 ≠ Line Items $722

## Root cause (confirmed)

Three surfaces sum from three different sets:

| Surface | Reads | Filters applied |
|---|---|---|
| Payments tab `Trip Total` | `useTripFinancialSnapshot.tripTotalCents` → `decomposeTripCost` over raw `activity_costs` | none — every row counted |
| EditorialItinerary header | `useDisplayedTripTotal` → `composeDisplayedTripTotal` (snapshot + day breakdown, then `max(snapshot, chipSum)`) | clamps to chip sum |
| Payments line items (`usePayableItems`) | `resolveCanonicalCostRows` over `activity_costs` | drops day-0 logistics dupes, placeholder transit, placeholder departure/return flight stubs, rows that fail row-key match against live activities |

Result: a row can be **counted in `tripTotalCents` but not surfaced as a line item**, and the header can clamp to chip sum that excludes a third bucket. The transit-grouping path in `usePayableItems` already iterates `canonical.rows`, so anything `resolveCanonicalCostRows` drops disappears from the visible list — but the snapshot still adds the raw `activity_costs` row.

The existing memory `displayed-trip-total-single-source` enforces parity between snapshot and the header composer, but it does not enforce parity with `usePayableItems`. That's the gap.

## Fix — single canonical row set for all three surfaces

Make `resolveCanonicalCostRows` the **only** definition of "what counts as a trip cost row", and have both `tripTotalCents` and `usePayableItems` consume it. No row is allowed to be in one and not the other.

### 1. Snapshot reads from the resolver, not from raw `costs`

In `src/hooks/useTripFinancialSnapshot.ts`:

- Replace the `decomposeTripCost({ costs, ... })` input with the rows already produced by `resolveCanonicalCostRows({ costs, liveActivities, includeHotel, includeFlight })`.
- `tripTotalCents` becomes `canonical.effectiveTotalCents` (which already folds manual hotel/flight) plus `miscReserveContributionCents`. Hotel/flight toggles continue to work because the resolver respects them.
- Buckets (`buckets.transit`, `buckets.dining`, etc.) get recomputed from the same `canonical.rows` array.
- The invariant log at line 547 (`snapshot vs decomposition`) becomes `snapshot vs canonical.effectiveTotalCents` and is upgraded from `console.error` to a hard `console.error` + telemetry event when they diverge by >$1.

### 2. Line items surface every counted row

In `src/hooks/usePayableItems.ts`:

- Continue iterating `canonical.rows`, but **never silently drop a costed row**. The three current drop branches (`row.isLogisticsRow`, `PLACEHOLDER_FLIGHT_TITLE_RE`, placeholder/unconfirmed transit) become "route to a different bucket" rather than "skip":
  - Day-0 hotel/flight rows already render as the dedicated hotel-selection / flight-selection rows — keep that, but assert their cents equal the resolver's hotel/flight totals (parity check, not a second source).
  - Placeholder departure/return flight stubs with cents > 0 emit a real line item (currently they're skipped entirely; if they have a cost it must show up).
  - Placeholder/unconfirmed transit rows with cents > 0 get folded into the per-day "Local transit — Day N" group instead of producing the synthetic $0 informational row only. The "$0 informational" branch stays for days with zero transit cost.

### 3. Reconciliation guard becomes blocking

`PaymentsTab.tsx` already has a `payableDrift` warn around line 590. Replace with a hard guard:

- If `|sum(payableItems) + manualNonItemized − snapshot.tripTotalCents| > $1`, render an amber "Reconciling…" badge **and** log a structured `[PaymentsTab] drift` warning that names which row id(s) are in one set but not the other.
- A regression test in `src/hooks/__tests__/useDisplayedTripTotal.parity.test.ts` (extended) and a new `usePayableItems.parity.test.ts` assert: for any fixture with N priced `activity_costs` rows, `sum(payableItems by amountCents) === snapshot.tripTotalCents` (modulo the misc reserve which is named explicitly).

### 4. Memory + lint

- New memory: `mem://constraints/finance/payments-line-items-mirror-snapshot.md` — "Payments Trip Total, header displayed total, and sum of visible PayableItems MUST derive from the same `resolveCanonicalCostRows` call; no silent skip of a costed row is permitted."
- Add to Core in `mem/index.md`.
- ESLint rule (or test file scan) that fails CI if a new `continue` or filter branch is added inside the `usePayableItems` `for (const row of canonical.rows)` loop without a matching bucket emission.

## What this does NOT change

- Hotel/flight inclusion toggles, misc reserve math, manual hotel/flight folding — all already live in the resolver.
- The "max(snapshot, chipSum)" clamp in `composeDisplayedTripTotal` stays; once snapshot and line items agree, the chip sum will too, and the clamp becomes a no-op rather than a divergence hider.
- Backend `activity_costs` writes, generation pipeline, or any edge function. This is purely the FE single-resolver wiring.

## Verification

1. Open the affected trip; confirm Payments Trip Total, header, and sum of line items all match to the dollar.
2. Toggle Hotel / Flight inclusion — all three move together.
3. Mark one transit group as paid — the paid figure on Payments and the Budget tab move by the same amount.
4. Hard refresh — numbers do not change.
5. `vitest run useDisplayedTripTotal.parity usePayableItems.parity` passes.

## Files touched

- `src/hooks/useTripFinancialSnapshot.ts`
- `src/hooks/usePayableItems.ts`
- `src/components/itinerary/PaymentsTab.tsx` (drift guard + badge)
- `src/hooks/__tests__/useDisplayedTripTotal.parity.test.ts` (extend)
- `src/hooks/__tests__/usePayableItems.parity.test.ts` (new)
- `mem/constraints/finance/payments-line-items-mirror-snapshot.md` (new)
- `mem/index.md` (add Core entry + reference)
