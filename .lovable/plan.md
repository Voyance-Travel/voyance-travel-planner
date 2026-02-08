

# Fix Stale Credit Costs in get-entitlements

## What's Wrong

The `get-entitlements` edge function has outdated credit costs that don't match the finalized pricing model. This causes incorrect feature flags -- users may be told they can't afford actions that actually cost less now.

## Changes

One file: `supabase/functions/get-entitlements/index.ts`

Update the `CREDIT_COSTS` object (around line 28):

| Key | Current (Wrong) | Correct |
|-----|-----------------|---------|
| `swap_activity` | 15 | 5 |
| `regenerate_day` | 90 | 10 |
| `base_rate_per_day` | 90 | 60 |

The `hotel_search_per_city` (40) stays as-is -- confirmed correct.

These values are used in the feature flag checks at the bottom of the function (`can_swap_activity`, `can_regenerate_day`, `can_build_itinerary`). With the wrong costs, free users with credits are being incorrectly blocked.

## No Other Changes

- Hotel credits (40/city, 100 optimization): Keep as-is
- Multi-city fees (+60/+120/+180): Keep as-is
- Everything else in the function is correct

