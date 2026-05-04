## Root cause of the €59 gap

I traced the missing $59 (~€59) on Day 1 of the Paris trip (`7ea828ac-9db5-42e7-b9a2-daeed10dd71f`). The day total is computed correctly — but several cost rows that count toward it are **not rendered as line items** in the user-visible activity list, and one row carries **stale/incorrect cost data**.

### Day 1 activity_costs (per person):

| Category | $/pp | Visible as a line item? | Notes |
|---|---|---|---|
| activity (Musée d'Orsay) | 17.39 | ✅ yes | matches user's €16 |
| dining (L'Arpège lunch) | 160.00 | ✅ yes | matches user's €230 expectation roughly |
| dining (Bouillon Julien dinner) | 50.00 | ✅ yes | user expected €28 → real value is $50/pp |
| **transport (taxi to Four Seasons)** | **65.22** | ❌ **NO** — filtered out of visible activity list | flagged "[Repair auto-corrected]" |
| **transport ("Walk to Musée d'Orsay")** | **15.22** | ❌ **NO** | flagged "[Free venue - Tier 1]" but cost is non-zero — DATA BUG |
| transport (other) | 3.50 + 2.00 | ❌ NO | small intra-city transit |
| dining (orphan auto-corrected) | 8.00 | ❌ NO | stale row, no matching activity in itinerary_data |
| flight, shopping, free venues | 0.00 | n/a | zero-cost, fine |

Sum: **$321/pp** ≈ the €333 the user sees (with FX/rounding).

So the gap is real and fully accounted for in the database — it's just **invisible** to the user. Two distinct bugs:

1. **UI gap:** Transport rows (Metro, Walk, Taxi) are filtered out of `getVisibleReorderableActivities` (line 4180–4191 in `EditorialItinerary.tsx`) but are summed into `getDayTotalCost` (line 1240). Net effect: the badge says "€333" but the cards on screen sum to €274.
2. **Data corruption:** A "Walk to Musée d'Orsay" row has $15.22 baked into it from a prior auto-correction, even though the row's own notes say "Free venue - Tier 1". A walk should always be $0. Same kind of corruption produced an orphan $8 dining row.

## Fix plan

### Phase 1 — UI: make the gap visible

1. In `EditorialItinerary.tsx`, compute a `transitSubtotal` alongside `totalCost` (sum costs of activities where `category` or `type` is transport/transit). Compute `visibleActivitiesSubtotal = totalCost − transitSubtotal`.
2. Update the day-total badge tooltip (around line 9494) to break the number down:
   ```
   Activities: €274
   Transit & transfers: €59
   Day total: €333
   ```
   The bottom-of-day "Day Total: €333/pp" badge (line 10093) gets the same tooltip. Users instantly see what the gap is.
3. When `transitSubtotal > 0`, also append a small inline label to the badge (e.g. `€333 (incl. €59 transit)`) so the disclosure works even without hovering. Cap at one line so it doesn't reflow on mobile.

### Phase 2 — Data integrity: stop counting bogus costs

4. In `supabase/functions/generate-itinerary/action-repair-costs.ts` (and any cost-write path), enforce: if a row's `notes` contain `Free venue - Tier 1` OR the activity title starts with `Walk ` (case-insensitive) AND `category` is transport, force `cost_per_person_usd = 0`. Walks are always free; "Free venue Tier 1" is by definition free.
5. In `src/services/tripBudgetService.ts` (`getBudgetLedger`), apply the same guard at read time as a belt-and-suspenders measure: any row tagged `Free venue` with non-zero cost is reported with cost 0 and a console.warn for observability.
6. Add a Postgres validation trigger update in `validate_activity_cost`: if `notes ILIKE '%Free venue%'` then force `cost_per_person_usd = 0` regardless of source. This catches future writes from any code path.

### Phase 3 — One-time data repair (this trip + global cleanup)

7. Migration: zero out all activity_costs rows where `notes ILIKE '%Free venue%' AND cost_per_person_usd > 0`. Re-sync the corresponding entries inside `trips.itinerary_data->'days'->'activities'->'cost'->'amount'`.
8. Migration: delete orphan `activity_costs` rows whose `activity_id` no longer exists in any `trips.itinerary_data` for the same trip (this kills the stale $8 dining row).
9. Re-run the snapshot/summary invalidation so the Budget tab and day badges reflect the cleaned data immediately.

### Phase 4 — Optional polish (nice-to-have, not required for the fix)

10. In the Budget tab's "All Costs" list, group entries by `day_number` with collapsible day headers. This way the Budget tab itself becomes a per-day reconciliation view that mirrors the itinerary day badges 1:1.

## Files to change

- `src/components/itinerary/EditorialItinerary.tsx` — add `transitSubtotal`, update both day-total badges to render a breakdown
- `src/services/tripBudgetService.ts` — read-time guard against Free-venue rows with non-zero costs
- `supabase/functions/generate-itinerary/action-repair-costs.ts` — write-time guard
- `supabase/migrations/<new>.sql` — update `validate_activity_cost` trigger + zero out existing bad rows + delete orphan rows
- (optional) `src/components/planner/budget/BudgetTab.tsx` — group ledger by day

## Why this works

After phase 1, the day-total badge stops being a black box: any user can hover and see exactly which transit costs make up the difference. After phase 2 + 3, "Walk" and "Free venue" rows can never silently inflate a day total again — at write time, at read time, and at the database layer. The €333 will still be €333 (the taxi is real), but it will visibly equal Activities + Transit, line by line.

## Out of scope

- Changing the `getDayTotalCost` formula itself. The total is already correct — the problem is presentation, not arithmetic.
- The user's €28-vs-$50 Bouillon Julien expectation. That's a separate "is this the right venue & price" question; the current $50/pp is consistent with what's in `cost_reference` for a Paris bouillon dinner with starter + main + drink for two.