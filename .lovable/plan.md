

## Fix: Edit Activity Modal Defaults to $0 for Estimated Costs

### Problem

When opening the Edit Activity modal, the cost field defaults to `$0` for activities that display a `~$35` estimated cost in the itinerary. This happens because:

- **Line 57 of `EditActivityModal.tsx`**: `setCost(String(activity.cost?.amount ?? 0))` — only reads `activity.cost`
- Many AI-generated activities store their price in `activity.estimatedCost`, not `activity.cost`
- The itinerary card correctly resolves cost via a multi-step fallback (`cost` → `estimatedCost` → estimation engine), but the edit modal skips all fallbacks

This means users cannot adjust estimated costs — they open the modal, see `$0`, and any save overwrites the `~$35` estimate with `$0`.

### Fix

**File: `src/components/itinerary/EditActivityModal.tsx`** — Update the `useEffect` cost initialization (line 57) to fall back to `estimatedCost` when `cost` is missing:

```typescript
// Before:
setCost(String(activity.cost?.amount ?? 0));

// After:
setCost(String(activity.cost?.amount ?? activity.estimatedCost?.amount ?? 0));
```

This single-line change ensures the modal pre-fills with the estimated cost when no explicit cost exists, matching what the user sees on the card.

### Files to modify

| File | Change |
|------|--------|
| `src/components/itinerary/EditActivityModal.tsx` | Line 57: add `estimatedCost` fallback in cost initialization |

