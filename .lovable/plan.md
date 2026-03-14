

## Root Cause Found: Activity IDs Are Not UUIDs

The `activity_costs` table requires `activity_id` to be a UUID column. But the itinerary for the New Orleans trip uses **slug-style IDs** like `nola-d1-t1`, `nola_b01`, `day1-checkin-regen-1773459870019`. Every sync attempt silently skips all activities because of this UUID validation guard:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const validActivities = activities.filter((a) => UUID_RE.test(a.id));
// → 0 valid activities → nothing written → views return $0
```

The `activity_costs` table is **completely empty** for this trip. That's why `v_trip_total` returns $0, which propagates to Budget "Expected Spend" and Payments "Trip Total" as $0.00.

This isn't a rendering/reactivity bug — there's literally no data in the table to read.

---

## Fix: Change `activity_id` from UUID to TEXT

The cleanest fix is to change the column type so it accepts any activity ID format.

### Step 1: Database migration
- `ALTER TABLE activity_costs ALTER COLUMN activity_id TYPE text;`
- Update the unique constraint on `(trip_id, activity_id)` if needed (it should work with text)

### Step 2: Remove UUID guards in code
- **`src/services/activityCostService.ts`** — Remove the `UUID_RE` filter from `syncActivitiesToCostTable` (line 350-351) and `upsertActivityCost` (line 215-219)
- **`src/components/itinerary/EditorialItinerary.tsx`** — Remove the UUID check at ~line 5263 for budget swap cost writes

### Step 3: Fix the cost calculation in `syncActivitiesToCostTable`
Currently (line 1216):
```typescript
costPerPersonUsd: costVal / (travelers || 1)
```
This divides by travelers, but `costVal` from the itinerary is already **per-person** (`$15` means $15/person). So dividing again halves the cost. Fix: pass `costVal` directly as `costPerPersonUsd` and let the DB compute `total_cost_usd = cost_per_person_usd * num_travelers`.

### Step 4: Ensure `total_cost_usd` is computed
Check if the table has a generated column or trigger for `total_cost_usd`. If not, the sync function must write it as `cost_per_person_usd * num_travelers`.

### Step 5: Trigger a re-sync on load
The existing `budgetSyncedRef` pattern in `EditorialItinerary.tsx` already calls `syncBudgetFromDays` on initial load. Once the UUID guard is removed, this will populate `activity_costs` correctly, and all three tabs will show matching totals.

### Files to modify

| File | Change |
|------|--------|
| **Database migration** | `ALTER TABLE activity_costs ALTER COLUMN activity_id TYPE text` |
| `src/services/activityCostService.ts` | Remove UUID guards from `upsertActivityCost` and `syncActivitiesToCostTable`; ensure `total_cost_usd` is written |
| `src/components/itinerary/EditorialItinerary.tsx` | Remove UUID check (~line 5263); fix cost division bug (~line 1216) |

### Expected result
- All itinerary activities (UUID or slug) get written to `activity_costs`
- `v_trip_total` returns the correct sum
- All three tabs show identical totals
- The $0.00 display bug disappears because there's actual data in the table

