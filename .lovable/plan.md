

# Fix: Out-of-Credits Modal Recommends Pack That Doesn't Cover Full Need

## Problem
The "Quick Boost (100 credits)" shows as the primary CTA when the user needs 120 credits for a bulk unlock. Even though the boost might technically cover the *deficit* (if the user has some balance), the UX is confusing -- users see "you need 120" but the recommended pack only has 100.

## Root Cause
The modal's `showBoost` logic on line 53 decides which pack to feature:

```
const showBoost = deficit <= BOOST_PACK.credits && deficit > 0;
```

This checks whether the boost covers the *deficit* (actionCost minus balance). But it creates a confusing experience: the header says "requires 120 credits" while the primary button offers only 100. Users can't easily tell that 100 + their existing balance = enough.

## Fix

**File:** `src/components/checkout/OutOfCreditsModal.tsx`

1. Change `showBoost` logic to compare against the **full action cost**, not just the deficit. This ensures the primary CTA always shows a pack that visually "covers" the displayed need:

```typescript
// Before: compares deficit (may be less than actionCost)
const showBoost = deficit <= BOOST_PACK.credits && deficit > 0;

// After: only show boost as primary if it covers the FULL action cost
const showBoost = actionCost <= BOOST_PACK.credits && deficit > 0;
```

2. Pass `actionCost` (not `deficit`) to `getRecommendedPack` so the recommended pack always covers the full displayed need:

```typescript
// Before
const recommended = getRecommendedPack(deficit);

// After
const recommended = getRecommendedPack(actionCost);
```

## Result
- User needs 120 credits for bulk unlock
- BOOST_PACK has 100 credits, 100 < 120, so `showBoost = false`
- `getRecommendedPack(120)` returns Top-Up 300 ($25) as primary CTA
- Quick Boost (100 credits, $9) still appears as secondary option
- If user only needs a single 60-credit action, boost (100) still shows as primary since 100 >= 60
