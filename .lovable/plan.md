

# Fix #9: Surface Credit Expiration Policy in Config

## Summary

Add a guard comment above `MONTHLY_CREDIT_GRANT` and a new `CREDIT_EXPIRATION_COPY` constant after it in `src/config/pricing.ts`. Purely additive -- no existing code changes.

## Changes

**File:** `src/config/pricing.ts`

### Change 1: Add guard comment above `MONTHLY_CREDIT_GRANT` (before line 341)

```typescript
// GUARD: Free credit expiration policy.
// Free credits (signup bonus + monthly grants) expire after freeExpirationMonths months.
// Purchased credits NEVER expire.
// The UI should surface this distinction wherever credit balances are shown.
```

### Change 2: Add `CREDIT_EXPIRATION_COPY` constant after the `MONTHLY_CREDIT_GRANT` block (after line 348)

```typescript
/**
 * Human-readable credit expiration messages for UI display.
 * Use these in balance displays, tooltips, and purchase confirmations.
 */
export const CREDIT_EXPIRATION_COPY = {
  freeCreditsNotice: 'Free credits expire after 2 months if unused.',
  purchasedCreditsNotice: 'Purchased credits never expire.',
  balanceTooltip: 'Your balance includes both free and purchased credits. Free credits are used first and expire after 2 months.',
} as const;
```

## What does NOT change
- `MONTHLY_CREDIT_GRANT` values unchanged
- `CREDIT_COSTS`, `TIER_FREE_CAPS`, all other constants unchanged
- No logic changes anywhere
- No other files touched
- Nothing references `CREDIT_EXPIRATION_COPY` yet -- future UI work will wire it up

