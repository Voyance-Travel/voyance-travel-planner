

# Fix BUG-19: Bulk Unlock Modal Shows Single-Day Cost

## Root Cause

In `src/components/checkout/OutOfCreditsModal.tsx`, line 50:

```typescript
const actionCost = action ? CREDIT_COSTS[action] : creditsNeeded;
```

When `action` is provided (e.g., `'UNLOCK_DAY'`), the modal **always** looks up the per-action cost from the pricing config (`CREDIT_COSTS.UNLOCK_DAY = 60`), completely ignoring the `creditsNeeded` value (120) that was explicitly passed by `useBulkUnlock`. This means the deficit calculation, the display text, and the recommended pack are all wrong.

## Fix

**File:** `src/components/checkout/OutOfCreditsModal.tsx` (line 50)

Change the cost resolution to prefer the explicitly passed `creditsNeeded` over the config lookup:

```typescript
// Before (broken):
const actionCost = action ? CREDIT_COSTS[action] : creditsNeeded;

// After (fixed):
const actionCost = creditsNeeded || (action ? CREDIT_COSTS[action] : 0);
```

This way:
- Bulk unlock passes `creditsNeeded: 120` -- the modal shows 120
- Single-day unlock passes `creditsNeeded: 60` -- the modal shows 60
- Fallback to `CREDIT_COSTS[action]` only when `creditsNeeded` is not provided (backward compatible)

Also update the action label on the same component so bulk unlocks say "Unlock All Days" instead of "Unlock Day":

```typescript
// When creditsNeeded exceeds single-day cost and action is UNLOCK_DAY, show bulk label
const actionLabel = (action === 'UNLOCK_DAY' && creditsNeeded > CREDIT_COSTS.UNLOCK_DAY)
  ? 'Unlock All Remaining Days'
  : action ? ACTION_LABELS[action] || action : 'this action';
```

**Single file change, two lines.**

