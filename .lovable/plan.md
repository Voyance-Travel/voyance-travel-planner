## Root cause

The underlying `activity_costs` rows for the reported trips already include Day-0 hotel costs correctly:

```text
Casablanca: Days $812 + Hotel $525 = $1,337
Kyoto:      Days $524 + Hotel $1,100 = $1,624
Osaka:      Days $652 + Hotel $1,360 = $2,012
Amsterdam:  Days $804 + Hotel $290 = $1,094
Sapporo:    Days $876 + Hotel $500 = $1,376
```

The remaining bug is in the frontend header: the detailed equation row has a defensive balancing helper, but the big top-line `Trip Total` number still renders from `financialSnapshot.tripTotalCents` directly. So in the stale/undercounted state the small equation can imply `Days + Hotel`, while the main header still shows the days-only snapshot.

## Fix plan

1. **Make the header use one computed value**
   - Compute the header strip values once in `EditorialItinerary` near the existing financial snapshot/day subtotal logic.
   - Use `displayedTripTotalUsd` from that helper for both:
     - the large top-line `Trip Total`
     - the right-hand `Trip Total` in the equation row
   - Keep the financial snapshot as the source of truth underneath; this is a display reconciliation for visible math only.

2. **Remove duplicate inline equation math**
   - Stop recomputing `computeHeaderStripValues` inside the JSX block.
   - Reuse the single computed object so the headline and equation cannot diverge again.

3. **Tighten the helper contract**
   - Add/adjust unit coverage for the exact failure mode: `financialSnapshot.tripTotal = days`, `hotelChip > 0`, and both header displays must equal `days + hotel`.
   - Preserve the existing behavior for reserve/adjustments and no-hotel trips.

4. **Add a regression guard in the component path**
   - Add a focused test or lightweight extraction so the UI-level derivation proves the large header and equation RHS use the same value.
   - This prevents future edits from “fixing” the equation strip while leaving the top-line total wrong.

## Expected result

For every city, when the header shows:

```text
Days + Hotel = Trip Total
```

the large `Trip Total` number and the equation `Trip Total` number will both include the hotel and show the same total.