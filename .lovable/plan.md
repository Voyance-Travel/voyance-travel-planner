

## Budget Coach Not Being Applied — Root Cause Analysis & Fix

### Problem

After clicking "Apply" on a Budget Coach suggestion, the swap either doesn't take effect or the budget numbers don't update. The edge function itself is working (logs confirm 7 valid suggestions returned recently).

### Root Causes Found

**1. Budget ledger is never re-synced after a swap**

When `onApplyBudgetSwap` fires in `EditorialItinerary.tsx` (line 5217), it:
- Updates local `days` state with the new activity name/cost (via `setDays`)
- Calls `syncBudgetFromDays(updated)` — but this function (line 1184) **only syncs to `activity_costs` table**, NOT to `trip_budget_ledger`
- The `BudgetCoach` gets `currentTotalCents` from `summary.totalCommittedCents + summary.plannedTotalCents`, which reads from `trip_budget_ledger`
- Since the ledger isn't updated, the summary never changes, and the coach still shows "over budget" with stale numbers

The budget ledger sync (`syncItineraryToBudget`) only runs once on `BudgetTab` mount (line 271-307). After a swap, the ledger retains the old costs.

**2. React Query caches are not invalidated after swap**

After applying a swap, the `useTripBudget` hook's `tripBudgetSummary` and `tripBudgetLedger` queries are never invalidated. The summary stays stale until the user navigates away and back.

**3. GlobalErrorHandler suppresses all errors on itinerary routes**

The `isSuppressedRoute` check (line 10-13 in `GlobalErrorHandler.tsx`) silently swallows ALL unhandled rejections when the URL contains `/itinerary` or `?generate=true`. This masks any errors from the budget swap flow, making it appear as if nothing happened.

### Fix Plan

**File: `src/components/itinerary/EditorialItinerary.tsx`**

In the `onApplyBudgetSwap` handler (line 5217-5292):
1. After the swap is applied and `upsertActivityCost` succeeds, re-sync the budget ledger by calling `syncItineraryToBudget` with the updated days
2. Invalidate the `tripBudgetSummary` and `tripBudgetLedger` React Query caches so the BudgetCoach and BudgetTab re-render with correct totals
3. Move `syncBudgetFromDays` call out of the `setDays` updater (React anti-pattern — side effects should not run inside state updaters)
4. Add console logging to trace whether the activity ID match succeeds

```typescript
onApplyBudgetSwap={async (suggestion) => {
  const newCostWhole = Math.round(suggestion.new_cost / 100);
  let applied = false;
  let updatedDays: EditorialDay[] = [];

  setDays(prev => {
    const updated = prev.map(day => {
      // ... existing matching/swap logic unchanged ...
    });
    updatedDays = updated;
    return updated;
  });

  // Move side effects OUT of setDays updater
  if (applied) {
    syncBudgetFromDays(updatedDays);
    setHasChanges(true);

    // Write to activity_costs (existing)
    try { ... } catch { ... }

    // NEW: Re-sync budget ledger so summary reflects the swap
    try {
      const { syncItineraryToBudget } = await import('@/services/tripBudgetService');
      await syncItineraryToBudget(tripId, updatedDays.map(...), travelers);
      queryClient.invalidateQueries({ queryKey: ['tripBudgetSummary', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripBudgetLedger', tripId] });
    } catch (e) {
      console.warn('Budget ledger re-sync after swap failed:', e);
    }
  } else {
    toast.error('Swap skipped because suggested cost was not lower.');
  }
}}
```

**File: `src/components/common/GlobalErrorHandler.tsx`**

Narrow the `isSuppressedRoute` guard to only suppress during active generation (not all itinerary views):

```typescript
const isSuppressedRoute = () => {
  const query = window.location.search.toLowerCase();
  return query.includes('generate=true');
};
```

This ensures budget coach errors on the itinerary page are properly surfaced instead of silently swallowed.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Re-sync budget ledger + invalidate queries after swap; move side effects out of setDays updater |
| `src/components/common/GlobalErrorHandler.tsx` | Narrow route suppression to `?generate=true` only |

