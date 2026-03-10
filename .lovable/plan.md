

## Fix: Group Unlock Modal Opens Behind Share Modal

### Problem
The `GroupBudgetDisplay` component's `onTopUp` callback on line 6074 opens the group unlock modal without closing the share modal first. This is the only remaining occurrence — line 3740 already has the fix, and line 1901 fires from a URL param (share modal not open).

### Change

**File:** `src/components/itinerary/EditorialItinerary.tsx` — Line 6074

Replace:
```ts
onTopUp={() => setShowGroupUnlockModal(true)}
```

With:
```ts
onTopUp={() => {
  setShowShareModal(false);
  setTimeout(() => setShowGroupUnlockModal(true), 600);
}}
```

Single line change. Matches the existing pattern at line 3738-3740.

