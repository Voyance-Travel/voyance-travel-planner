

## Budget Allocations Not Working

**Root cause**: The `budget_allocations` column stores an empty JSON object `{}` in the database. In JavaScript, `{}` is truthy, so the fallback to default allocations never triggers:

```typescript
// This never falls through because {} is truthy
settings?.budget_allocations || getDefaultAllocations(spendStyle)
```

Result: all slider values are `undefined`, rendered as 0%, and the total shows 0%.

**Two bugs to fix:**

### 1. Fix allocation initialization (BudgetSetupDialog.tsx)
Check if the allocations object actually has valid keys before trusting it. Replace the simple `||` fallback with a validation that checks for at least one `_percent` key with a numeric value:

```typescript
const isValidAllocations = (a: any): a is BudgetAllocations =>
  a && typeof a.food_percent === 'number' && typeof a.activities_percent === 'number';

const [allocations, setAllocations] = useState<BudgetAllocations>(
  isValidAllocations(settings?.budget_allocations) 
    ? settings.budget_allocations 
    : getDefaultAllocations(spendStyle)
);
```

### 2. Fix settings fetch fallback (tripBudgetService.ts)
Apply the same validation in `getTripBudgetSettings` so the service layer never returns an empty `{}` as valid allocations:

```typescript
// Line 237: validate before using DB value
budget_allocations: isValidAllocations(data.budget_allocations) 
  ? data.budget_allocations 
  : DEFAULT_ALLOCATIONS.balanced,
```

### 3. Fix save to persist allocations properly
Verify the `handleSave` in `BudgetSetupDialog` actually sends non-empty allocations. Current code looks correct — the bug is purely on the read/init side. But also ensure that when saving, allocations are always populated (not `{}`).

### Files to change
- `src/services/tripBudgetService.ts` — add allocation validation helper, use in `getTripBudgetSettings`
- `src/components/planner/budget/BudgetSetupDialog.tsx` — use validated fallback in state init

This is a two-file fix. The sliders will immediately show correct default percentages (e.g., 30% food, 30% activities for "balanced") instead of all zeros.

