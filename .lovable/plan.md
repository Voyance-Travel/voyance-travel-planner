
# Fix #5: First-Trip Gating Guard Comments

## Changes

**File:** `src/lib/voyanceFlowController.ts`

### Change 1: Guard comment above FIRST_TRIP_FREE_DAYS (lines 36-37)

Replace:
```typescript
/** Days unlocked free on a user's very first trip */
export const FIRST_TRIP_FREE_DAYS = 2;
```

With:
```typescript
// GUARD: First-trip users get exactly 2 days free. Day 3+ is gated.
// This value is used by canAccessDay() and computeUnlockedDayCount().
// Changing this number affects all first-trip users — coordinate with pricing.ts if adjusted.
export const FIRST_TRIP_FREE_DAYS = 2;
```

### Change 2: Inline comment above first-trip check in canAccessDay (line 78)

Add a comment directly above the existing line 78:
```typescript
  // First-trip-free: users get Days 1-2 at no cost. Day 3+ requires unlock or Smart Finish.
  if (isFirstTrip && dayNumber <= FIRST_TRIP_FREE_DAYS) {
```

## What does NOT change
- Value of FIRST_TRIP_FREE_DAYS stays at 2
- No logic changes anywhere
- No other functions or files touched
