

# Fix #8: Harden useEntitlements Error Fallback

## Problem

The `getDefaultEntitlements` fallback (used when the edge function fails) currently sets premium content flags to `true`:

```
can_view_photos: true,    // First trip = true
can_view_addresses: true,
can_view_booking_links: true,
can_view_tips: true,
can_view_reviews: true,
```

This creates a loophole: if a non-first-trip user hits a network error, they get premium content for free because the fallback assumes "first trip." The fallback should be **restrictive** -- lock everything, and let the UI offer a retry.

## Changes

**File:** `src/hooks/useEntitlements.ts`

### Change 1: Add `entitlements_error` to `EntitlementsResponse` type (after line ~98)

Add an optional field:
```typescript
  // Error state flag
  entitlements_error?: boolean;
```

### Change 2: Add guard comment above `getDefaultEntitlements` (line ~271)

```typescript
// GUARD: Error fallback must be RESTRICTIVE.
// If get-entitlements fails, lock all premium content to prevent unpaid access.
// Do NOT default premium flags to true here -- that creates a free-access loophole on errors.
// The UI should detect the error state and offer a retry.
// See: src/lib/voyanceFlowController.ts -- single source of truth for gating logic.
```

### Change 3: Fix the fallback values (lines 286-289)

**Before:**
```typescript
can_view_photos: true, // First trip = true
can_view_addresses: true,
can_view_booking_links: true,
can_view_tips: true,
can_view_reviews: true,
```

**After:**
```typescript
can_view_photos: false,
can_view_addresses: false,
can_view_booking_links: false,
can_view_tips: false,
can_view_reviews: false,
```

### Change 4: Add `entitlements_error: true` to the fallback return (after the `entitlements: {}` line, ~310)

```typescript
entitlements_error: true,
```

### Change 5: Also add `entitlements_error: false` to the QA_MODE mock (around line 186)

So the QA mock doesn't trigger error UI.

## What does NOT change

- The normal success return path
- The edge function call itself
- No changes to voyanceFlowController.ts or edge functions
- No other files touched
- The `canViewPremiumContentForDay` function (it already handles `undefined` entitlements separately)

## Why restrictive is correct

A temporary lockout during an outage is far less damaging than accidentally granting free premium access. The `entitlements_error` flag lets the UI distinguish "locked because error" from "locked because unpaid" and show a retry prompt.

