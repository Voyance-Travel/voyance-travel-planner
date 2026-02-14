

# Fix #6: Add Smart Finish Comparison Helper

## Summary

Add a new exported utility function `getSmartFinishComparison` to the end of `src/lib/voyanceFlowController.ts`. This is purely additive -- no existing code changes.

## Change

**File:** `src/lib/voyanceFlowController.ts`

Append the following function after the existing `formatActionToast` function (after line ~175):

```typescript
/**
 * Compare the cost of unlocking remaining gated days individually vs Smart Finish.
 * Returns the comparison so the UI can nudge users toward the better deal.
 */
export function getSmartFinishComparison(params: {
  totalDays: number;
  unlockedDayCount: number;
  hasSmartFinish: boolean;
}): {
  remainingDays: number;
  individualCost: number;
  smartFinishCost: number;
  savings: number;
  smartFinishIsCheaper: boolean;
} {
  if (params.hasSmartFinish) {
    return {
      remainingDays: 0,
      individualCost: 0,
      smartFinishCost: 0,
      savings: 0,
      smartFinishIsCheaper: false,
    };
  }

  const remainingDays = Math.max(0, params.totalDays - params.unlockedDayCount);
  const individualCost = remainingDays * CREDIT_COSTS.UNLOCK_DAY;
  const smartFinishCost = CREDIT_COSTS.SMART_FINISH;
  const savings = individualCost - smartFinishCost;

  return {
    remainingDays,
    individualCost,
    smartFinishCost,
    savings,
    smartFinishIsCheaper: savings > 0,
  };
}
```

## What does NOT change
- All existing functions untouched
- No new imports needed (CREDIT_COSTS already in scope)
- No other files touched
- Nothing calls this yet -- a future UI prompt will wire it up

