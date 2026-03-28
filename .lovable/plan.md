

## Fix: Payments Tab — Math Gap & Missing Flights

Two root causes explain both the $4,328 gap and the $0 flights.

---

### Problem 1: Flights Show $0

**Root cause**: `usePayableItems` checks `flightSelection?.totalPrice` (line 108), but the `FlightSelection` interface doesn't have a `totalPrice` field — it only has `outbound`, `return`, and `legs[]`, each with individual `price` fields. So the check always fails and flights are never added.

**Fix** in `src/hooks/usePayableItems.ts`:
- Compute flight total from legs: sum all `leg.price` values, or fall back to `outbound.price + return.price`
- Also check the `activity_costs` DB rows for a `flight` category (day_number=0) as a secondary fallback when no flight selection exists
- Update the `flightSelection` type in the hook's interface to include `legs?: { price?: number; airline?: string }[]`

```typescript
// Replace the simple totalPrice check with:
const flightTotal = flightSelection?.totalPrice 
  || (flightSelection as any)?.legs?.reduce((s, l) => s + (l?.price || 0), 0)
  || ((flightSelection?.outbound?.price || 0) + (flightSelection?.return?.price || 0));

if (flightTotal > 0) {
  // ... create flight payable item with flightTotal
}

// Also: if no flight from selection, check activity_costs for flight row
if (!flightTotal && activityCosts?.length) {
  const flightRow = activityCosts.find(r => r.category === 'flight' && r.day_number === 0);
  if (flightRow && flightRow.cost_per_person_usd > 0) {
    // Add flight from DB ledger
  }
}
```

---

### Problem 2: Activity Costs Are Per-Person, Not Multiplied by Travelers

**Root cause**: The `usePayableItems` hook reads `activity.cost.amount` which is the per-person cost. It stores this directly as `amountCents` without multiplying by `travelers`. Meanwhile, `useTripFinancialSnapshot` computes the trip total as `cost_per_person_usd × num_travelers` from the DB. This creates the gap:

- Snapshot: $100/pp × 2 travelers = $200 per activity
- Payable items: $100 per activity (per-person only)

For a trip with 2 travelers and ~$4,800 in per-person activity costs, this explains the ~$4,328 gap (activities counted at 1× instead of 2×).

**Fix** in `src/hooks/usePayableItems.ts`:
- Activity amounts should reflect total group cost (per-person × travelers) to match the trip total
- Add the `/pp` label in the UI display, but the `amountCents` value should be the total payable amount

```typescript
// Line 218: multiply by travelers for total payable amount
amountCents: Math.round(cost * travelers * 100),
```

This ensures the Payments tab total = Trip Total shown in the header.

---

### Problem 3: DB Reconciliation Also Uses Per-Person

The reconciliation block (lines 252-288) also doesn't account for the fact that `cost_per_person_usd × num_travelers` should give total, but it already does this correctly on line 266. However, the JSON-parsed activities above don't, causing a mismatch between the two paths.

---

### Summary

| File | Change |
|------|--------|
| `src/hooks/usePayableItems.ts` | (1) Compute flight total from leg prices when `totalPrice` missing. (2) Add DB fallback for flight costs. (3) Multiply activity per-person costs by `travelers` so totals match snapshot. (4) Update `flightSelection` interface to include `legs`. |

