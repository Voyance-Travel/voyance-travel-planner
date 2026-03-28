

## Fix: Budget Custom Input Clearing When Value Matches a Preset

### Problem
Typing values like `500`, `1000`, `2500`, or `5000` in the custom budget input clears the field because the display logic matches them to preset values and shows an empty string.

### Fix — `src/pages/Start.tsx`

1. **Add a `customBudgetActive` ref** near other refs:
   ```typescript
   const customBudgetActive = useRef(false);
   ```

2. **Update the custom input's `value` prop** (~line 846):
   ```typescript
   value={customBudgetActive.current ? (budgetAmount ?? '') : (budgetAmount && !budgetPresets.some(p => p.value === budgetAmount) ? budgetAmount : '')}
   ```

3. **Add `onFocus`** to set `customBudgetActive.current = true`

4. **Add `onBlur`** to set `customBudgetActive.current = false`

5. **On preset button click**, set `customBudgetActive.current = false`

6. **Remove any existing `onFocus` handler** that clears the budget when it matches a preset — the ref now handles the distinction.

### Result
Custom input accepts any number including preset-matching values. Preset buttons still work independently.

