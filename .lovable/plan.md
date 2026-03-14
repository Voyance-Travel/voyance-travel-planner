

## Bug: Walk Connectors Charged $15 in Payments Tab

### Root Cause

The Payments tab (`PaymentsTab.tsx` lines 300-375) does **not** read from the database `activity_costs` table. Instead, it re-derives costs from raw itinerary day data using its own JavaScript logic. When an activity has $0 cost, it checks if the category is in a "never free" list — and `transport` is on that list (line 313). Walk items categorized as `transport` or `walk` trigger the `estimateCostSync()` fallback, which assigns them ~$15 each.

Meanwhile, the database is **correct**: the sync at line 1211 of `EditorialItinerary.tsx` skips items where `costVal <= 0`, so walks never enter `activity_costs`. The Budget tab reads from the DB views and shows the right number. But the Payments tab uses its own parallel calculation.

### Evidence

- Database query: **zero** rows with `category = 'walk'` — walks are correctly excluded from `activity_costs`
- 7 walk items × $15 = $105 phantom charges only in the Payments tab
- The `NEVER_FREE_CATEGORIES` list at line 309 includes `transport`, `transfer`, etc.
- Walk activities with `cost = 0` match this filter and get an estimated cost via `estimateCostSync()`

### Fix

**File: `src/components/itinerary/PaymentsTab.tsx`**

Two changes in the payable items builder (lines 300-375):

1. **Add walk/stroll to the non-payable filter** — Add walk-related keywords to `NON_PAYABLE_KEYWORDS` (line 301):
   ```
   'walk to', 'walk through', 'stroll', 'walking',
   'evening walk', 'neighborhood walk'
   ```

2. **Add `walk` to `NON_PAYABLE_CATEGORIES`** (line 306):
   ```
   const NON_PAYABLE_CATEGORIES = ['downtime', 'free_time', 'walk', 'walking', 'stroll'];
   ```

This ensures walk connector items are filtered out before the "never free" estimation kicks in, matching how the database sync already handles them. No database changes needed — the DB is correct.

### Impact

- Removes 7 × $15 = $105 in phantom charges from the Payments tab
- Payments tab total will align with the Budget tab and DB views
- No effect on paid transit items (rideshare, streetcar, taxi) which have real costs

