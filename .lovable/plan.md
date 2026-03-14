

## Fix: Payments Tab "Trip Total" diverges from Budget/Itinerary

### Root Cause

Three tabs, three calculation methods:

| Tab | Source | Total shown |
|-----|--------|-------------|
| **Itinerary header** | `useTripFinancialSnapshot` (ledger) | $475 |
| **Budget** | `useTripFinancialSnapshot` (ledger) | $475 |
| **Payments** | Local `payableItems.reduce()` over itinerary activities + cost estimation | $610.25 |

The Payments tab builds its own `payableItems` array by iterating over `days[].activities`, applying `estimateCostSync` fallbacks for zero-cost items (e.g., dining, transport), and summing everything at line 433. This produces a different number because:

1. **Cost estimation fallbacks** — Payments runs `estimateCostSync` for activities with $0 cost that match "never free" categories (dining, transport, etc.). The budget ledger may store different amounts or not have these items at all.
2. **Per-person vs group ambiguity** — `activity.cost?.amount` may be per-person in some cases but treated as group total in Payments.
3. **Different item sets** — Payments may include/exclude items differently than the ledger sync.

### Fix

**Make Payments tab use `useTripFinancialSnapshot` for its displayed "Trip Total"**, exactly as Itinerary and Budget already do. The `payableItems` list still drives the individual line items and "paid" tracking, but the summary header total comes from the canonical snapshot.

**File: `src/components/itinerary/PaymentsTab.tsx`**

1. Import and call `useTripFinancialSnapshot(tripId)`
2. Replace `estimatedTotal` (line 434) with `financialSnapshot.tripTotalCents` for the header display
3. Keep `payableItems` for the itemized list and payment tracking — those serve a different purpose (tracking what's paid vs unpaid)
4. Calculate "Remaining to pay" as `snapshot.tripTotalCents - paidAmount` instead of `fallbackTotal - paidAmount`

This is a focused change — approximately 10 lines modified. The individual payable items list stays as-is (it's correct for tracking payments per item), but the summary total will now match the other two tabs exactly.

### Files to modify

| File | Change |
|------|--------|
| `src/components/itinerary/PaymentsTab.tsx` | Import `useTripFinancialSnapshot`, use its `tripTotalCents` for the header "Trip Total" display |

