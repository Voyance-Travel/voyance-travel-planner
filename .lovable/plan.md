

# Fix #3: Add Guard Comment to hasPaidAccess

## Current State

The logic is already correct at line 250:
```typescript
const hasPaidAccess = tripHasSmartFinish || unlockedDays > 0;
```

The existing comment (lines 248-249) is a shorter version. This plan replaces it with the full guard comment.

## Change

**File:** `supabase/functions/get-entitlements/index.ts` (lines 248-250)

Replace:
```typescript
    // Bug 12 fix: per-trip only. hasCompletedPurchase is a global flag and must NOT grant per-trip access.
    // See src/lib/voyanceFlowController.ts hasPaidAccessForTrip() for the canonical logic.
    const hasPaidAccess = tripHasSmartFinish || unlockedDays > 0;
```

With:
```typescript
    // GUARD: hasPaidAccess is PER-TRIP only.
    // tripHasSmartFinish = user bought Smart Finish for THIS trip.
    // unlockedDays > 0 = user unlocked days on THIS trip.
    // NEVER include hasCompletedPurchase here — that is account-wide, not trip-scoped.
    // See: src/lib/voyanceFlowController.ts → hasPaidAccessForTrip()
    const hasPaidAccess = tripHasSmartFinish || unlockedDays > 0;
```

## What does NOT change
- The value/logic of `hasPaidAccess` (already correct)
- No other variables, functions, or response fields
- No other files

