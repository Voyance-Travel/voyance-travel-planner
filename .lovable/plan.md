

# Add Sync Comments to get-entitlements Edge Function

## Scope
Comments only. No values changed. No logic changed. No other files touched.

## Change 1: CREDIT_COSTS header + inline comments (lines 15-34)

Replace lines 15-34 with:

```typescript
// ============================================================
// CREDIT_COSTS — Mirror of src/config/pricing.ts CREDIT_COSTS
// ============================================================
// WARNING: These values MUST match src/config/pricing.ts exactly.
// When updating pricing.ts, update this block AND the
// TIER_CAPS block below at the same time.
// Last synced: 2026-02-14
// ============================================================
const CREDIT_COSTS = {
  unlock_day: 60,            // src/config/pricing.ts:13
  smart_finish: 50,          // src/config/pricing.ts:14
  swap_activity: 5,          // src/config/pricing.ts:16
  regenerate_day: 10,        // src/config/pricing.ts:15
  ai_message: 5,             // src/config/pricing.ts:18
  restaurant_rec: 5,         // src/config/pricing.ts:17
  hotel_search: 40,          // src/config/pricing.ts:10
  hotel_optimization: 100,   // src/config/pricing.ts:19
  transport_mode_change: 5,  // src/config/pricing.ts:22
  mystery_getaway: 15,       // src/config/pricing.ts:20
  mystery_logistics: 5,      // src/config/pricing.ts:21
  base_rate_per_day: 60,     // src/lib/tripCostCalculator.ts:BASE_RATE_PER_DAY
  group_small: 150,          // src/config/pricing.ts:GROUP_UNLOCK_CREDITS.small
  group_medium: 300,         // src/config/pricing.ts:GROUP_UNLOCK_CREDITS.medium
  group_large: 500,          // src/config/pricing.ts:GROUP_UNLOCK_CREDITS.large
};
```

## Change 2: TIER_CAPS header comment (lines 36-38)

Replace lines 36-38 with:

```typescript
// ============================================================
// TIER_CAPS — Mirror of src/config/pricing.ts TIER_FREE_CAPS
// ============================================================
// Must match src/config/pricing.ts TIER_FREE_CAPS exactly.
// Last synced: 2026-02-14
// ============================================================
```

## What does NOT change
- All values remain identical
- All logic remains identical
- No other files are modified
- The TIER_CAPS object itself, FLEX_CAPS_BY_DAYS, and all functions are untouched

