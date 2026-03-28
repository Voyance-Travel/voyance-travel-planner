


## Fix: Budget Custom Input Clearing When Value Matches a Preset

### Problem
Typing values like `500`, `1000`, `2500`, or `5000` in the custom budget input clears the field because the display logic matches them to preset values and shows an empty string.

### Fix — `src/pages/Start.tsx`

1. **Add a `customBudgetActive` state** near other state:
   ```typescript
   const [customBudgetActive, setCustomBudgetActive] = useState(false);
   ```

2. **Update the custom input's `value` prop** (~line 846):
   ```typescript
   value={customBudgetActive ? (budgetAmount ?? '') : (budgetAmount && !budgetPresets.some(p => p.value === budgetAmount) ? budgetAmount : '')}
   ```

3. **Add `onFocus`** to set `setCustomBudgetActive(true)`

4. **Add `onBlur`** to set `setCustomBudgetActive(false)`

5. **On preset button click**, set `setCustomBudgetActive(false)`

### Result
Custom input accepts any number including preset-matching values. Preset buttons still work independently.

---

## ✅ Departure Day Sequence Validator (Implemented)

### Problem
On departure days, the AI generates activities in broken sequence — checkout before breakfast, airport security before meals, nonsensical walking transports injected by the bookend validator.

### Solution
Added deterministic `validateDepartureDay` logic inline in `supabase/functions/generate-itinerary/index.ts` (~line 10801), running AFTER personalization validation but BEFORE the bookend validator.

### Rules Implemented
| Rule | Description |
|------|-------------|
| R1 | Breakfast moved before checkout; times re-anchored |
| R2 | Airport security positioned immediately before flight |
| R3 | Non-flight activities after security moved earlier |
| R4 | Duplicate airport transports removed; nonsensical walks stripped |
| R5 | Time window enforced from flight departure time (2.5h international buffer) |
| R6 | Breakfast location overridden to "near [Hotel]" if not near hotel |

### Files Changed
- `supabase/functions/generate-itinerary/index.ts` — inline departure validator at ~line 10801
