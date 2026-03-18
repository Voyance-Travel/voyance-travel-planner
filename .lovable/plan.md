

## Fix: Budget Numbers Show Stale/Mismatched Values Before Correcting

### Root Cause

The `useTripFinancialSnapshot` hook has a two-part timing problem:

1. **Async pipeline is long**: When activities change, `syncBudgetFromDays` does: async dynamic import → async DB upsert → dispatch `booking-changed` → async DB re-fetch → setState. That's 4+ async hops before the UI updates.

2. **Multiple separate `useState` calls** (lines 74-77): `setTripTotalCents`, `setPaidCents`, `setBudgetTotalCents`, `setLoading` are four separate state updates. While React 18 batches these in most cases, the hook can still render with partial data during the initial load or when the fetch races with a previous render cycle — leading to moments where budget = 700, expenses = 333, remaining = 333 (because one value updated before the other).

### Fix

Two changes:

| # | File | Change |
|---|------|--------|
| 1 | `useTripFinancialSnapshot.ts` | Consolidate all 4 state variables into a single `useState` object so updates are atomic — no intermediate renders with mismatched numbers |
| 2 | `EditorialItinerary.tsx` (~line 1399-1416) | After `syncActivitiesToCostTable` completes, pass the just-written totals directly to the snapshot via a new custom event payload, so it can update optimistically without a second DB round-trip |

### Change 1: Atomic state in `useTripFinancialSnapshot.ts`

Replace the 4 separate `useState` calls with one:

```typescript
const [data, setData] = useState({
  tripTotalCents: 0,
  paidCents: 0,
  budgetTotalCents: 0,
  loading: true,
});
```

Update `fetchData` to call `setData({ tripTotalCents: totalCents, paidCents: paidTotal, budgetTotalCents: ..., loading: false })` in a single call. This guarantees all three numbers update in the same render frame.

Also accept an optimistic payload from the `booking-changed` event:

```typescript
const handler = (e: Event) => {
  const detail = (e as CustomEvent).detail;
  if (detail?.optimisticTotalCents != null) {
    setData(prev => ({ ...prev, tripTotalCents: detail.optimisticTotalCents }));
  }
  fetchData(); // Still fetch for full accuracy
};
```

### Change 2: Optimistic dispatch from `EditorialItinerary.tsx`

After `syncActivitiesToCostTable` succeeds, compute the total from the data we just wrote and include it in the event:

```typescript
const optimisticTotalCents = activitiesForCostTable.reduce(
  (sum, a) => sum + Math.round(a.costPerPersonUsd * (a.numTravelers || 1) * 100), 0
);
window.dispatchEvent(new CustomEvent('booking-changed', { 
  detail: { tripId, optimisticTotalCents } 
}));
```

This gives the UI an immediate update (same render frame as the sync completing), while the background fetch corrects for hotel/flight rows and toggles.

