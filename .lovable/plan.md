## Problem

The "Matches itinerary / Reconciling…" indicator in the Payments header never resolves when a manual hotel, flight, or other manual entry exists.

`PaymentsTab` computes the reconciliation client total as:

```
clientTotal = payableTotalCents + rawManualCents
```

But `payableTotalCents` (from `usePayableItems`) **already** includes every `manual-*` row via `addManualGroups('hotel' | 'flight' | 'dining' | …)`. Adding `rawManualCents` on top double-counts manual entries, so `clientTotal` exceeds `estimatedTotal` by exactly the sum of manual payments and the badge stays stuck on "Reconciling…".

Verified against the live Paris trip (`7ea828ac…`):
- snapshot trip total: $1,728 (no canonical hotel/flight in `activity_costs`)
- manual hotel: $2,400
- `estimatedTotal` = $4,128
- `payableTotalCents` ≈ $4,128 (already includes manual hotel)
- buggy `clientTotal` = $4,128 + $2,400 = $6,528 → mismatch persists

## Fix

`src/components/itinerary/PaymentsTab.tsx` (the reconciliation block around lines 897–915):

1. Remove the redundant `rawManualCents` addition. The correct comparison is `payableTotalCents` vs `estimatedTotal` (both already manual-aware via the override delta on the snapshot side and via `addManualGroups` on the items side).
2. Slightly widen the equality tolerance from $1 to $2 to absorb cents-level rounding from per-row `Math.round` (24 rows × ½¢ ≈ 12¢, well within $2).
3. Add a one-line comment explaining that `payableTotalCents` is already manual-inclusive so future edits don't reintroduce the double-count.

No changes needed in `usePayableItems`, `useTripFinancialSnapshot`, or the budget service — those are already consistent with each other.

## Verification

After the fix, for the Paris trip:
- `estimatedTotal` = $4,128
- `payableTotalCents` = $4,128
- diff ≤ $2 → badge shows "Matches itinerary" with the green check.

Spot-check a second trip with no manual entries to confirm the existing matching case still works (it relies on the same numbers, just with `rawManualCents = 0`, so behavior is unchanged there).
