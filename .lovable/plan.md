

## Fix: Day Regeneration Not Updating the UI

### Problem
When you click "Regenerate Day", the edge function runs successfully and returns fresh data, but the UI shows the exact same content. This happens because the backend response uses **different field names** than the frontend expects:

| Backend field | Frontend field |
|---|---|
| `startTime` | `time` |
| `name` | `title` |
| `category` | `type` |
| `estimatedCost.amount` | `cost` |

The current code does `{ ...d, ...data.day, activities: data.day.activities }`, which overlays backend-shaped objects onto frontend-shaped state. Since the field names don't match, the old values (from the previous render) stay in place and nothing visually changes.

### Fix

**File: `src/components/planner/steps/ItineraryPreview.tsx`**

1. Import `convertBackendDay` from `@/types/itinerary`
2. In `handleRegenerateDay`, convert `data.day` through `convertBackendDay` before setting it into `localDays`:

```ts
const converted = convertBackendDay(data.day);
setLocalDays(prev => prev.map(d =>
  d.dayNumber === dayNumber ? converted : d
));
```

This ensures the regenerated day goes through the same normalization pipeline that the initial load uses, mapping backend fields to frontend fields correctly.

### Files Changed
1. `src/components/planner/steps/ItineraryPreview.tsx` — import `convertBackendDay`, apply it to regenerated day response

