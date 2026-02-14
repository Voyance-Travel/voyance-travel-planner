

# Fix #4: Preview Mode Returns 1 Unlocked Day Instead of 0

## Change

**File:** `src/lib/voyanceFlowController.ts`, line 96

Replace:
```typescript
if (params.isPreview) return 0;
```

With:
```typescript
// Preview users get Day 1 free so they can evaluate the trip before committing credits.
if (params.isPreview) return 1;
```

## What does NOT change
- `canAccessDay`, `hasPaidAccessForTrip`, `getActionCost` — untouched
- First-trip logic (`if (params.isFirstTrip)`) — untouched
- Paid-trip fallback (`return params.generatedDayCount`) — untouched
- No new imports, no new parameters, no other files

## Expected behavior after change
- Preview trips: Day 1 fully visible, Day 2+ gated
- First-trip-free: Days 1-2 visible, Day 3+ gated (unchanged)
- Paid trips: All days visible (unchanged)

