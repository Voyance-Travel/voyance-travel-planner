

## Fix: Trip Page Starts in Preview Mode Instead of Edit

### Root cause

In `TripDetail.tsx` line 160:
```typescript
const isOwner = !!(user?.id && trip?.user_id && user.id === trip.user_id);
```

On first render, `trip` is still loading so `trip?.user_id` is `undefined`, making `isOwner = false`. The `useTripViewMode` hook uses this in its `useState` initializer, which only runs once:
```typescript
const [internalMode, setInternalMode] = useState(hasEditAccess ? 'edit' : 'preview');
```

Result: mode initializes to `'preview'` and never updates when the trip data arrives.

### Fix

**File: `src/hooks/useTripViewMode.ts`**

Add a `useEffect` that updates `internalMode` to `'edit'` when `hasEditAccess` becomes `true` after the initial render:

```typescript
useEffect(() => {
  if (hasEditAccess) {
    setInternalMode('edit');
  }
}, [hasEditAccess]);
```

This ensures that once `isOwner` resolves to `true` (after trip data loads), the mode flips to edit. One line addition, single file.

