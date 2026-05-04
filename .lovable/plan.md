## Why the total keeps jumping up

When you open a trip and immediately see "+$900" or "+$500" jumps, you're seeing the same `TripTotalDeltaIndicator` toast/badge fire because the cost ledger genuinely changed between the previous fetch and the new one. The numbers really did move — the question is *why* they're moving without you doing anything.

I traced every place that writes to `activity_costs` (the single source of truth `useTripFinancialSnapshot` reads). Three silent rewriters are the culprits:

### 1. Auto-repair on page load (`TripDetail.tsx:1471`)
On every trip open we run `needsCostRepair` → if zero rows, fire `repairTripCosts`. That edge function (`action-repair-costs.ts`) does much more than fill blanks:
- **Michelin floor** (lines 291–353): any dining row below `MICHELIN_FLOOR.mid` ($120) or `.high` ($180) is *raised* to the floor.
- **Ticketed-attraction floor** (lines 247–263): any matched venue under its min price is *raised*.
- **Reference fallback** (line 279): any $0 dining/activity is *raised* to `cost_mid_usd` from `cost_reference`.
- **JSONB writeback** (line 403+): the patched cost is written back into `trips.itinerary_data` so the cards visibly change.

Result: open a legacy trip → total can jump hundreds of dollars in one fetch. The user gets a toast with no attribution.

### 2. Post-regeneration repair (`EditorialItinerary.tsx:3791`)
After regenerate, we always (not conditionally) call `repairTripCosts`. Same floors fire — even on trips that were fine — so each regen ratchets the total up.

### 3. `syncBudgetFromDays` reading patched JSONB (`EditorialItinerary.tsx:1294–1400`)
Days re-render → `syncBudgetFromDays` reads `act.cost` (already patched up by the repair JSONB writeback) → upserts into `activity_costs` again at the higher price → dispatches `booking-changed` with `optimisticTotalCents`. The snapshot fetches, sees the new total, fires the delta toast.

The 25% jump warning at `useTripFinancialSnapshot.ts:160` then wraps it all in a `toast.warning("Trip total changed by +$X")` — which is the message you keep seeing.

---

## The fix

Three changes, smallest-blast-radius first.

### A. Gate the auto-repair so it doesn't silently raise prices
- `needsCostRepair` should only return true if `activity_costs` is **completely empty** for the trip (already does) **and** the trip has never been repaired (`trips.last_cost_repair_at IS NULL`). Add `last_cost_repair_at` column and stamp it in `action-repair-costs.ts` after a successful run.
- Skip the post-regeneration repair (`EditorialItinerary.tsx:3791`) entirely. The generation pipeline already writes correct costs; the repair function exists for legacy/missing data, not as a routine post-step.

### B. Make floor adjustments explicit, not silent
- In `action-repair-costs.ts`, when Michelin/ticketed/reference floors *increase* an existing non-zero cost, write a row to a new `cost_change_log` table: `{ trip_id, activity_id, previous_cents, new_cents, reason, applied_at }`.
- On a manual "Repair pricing" click (`handleRepairPricing`), surface a summary: "Adjusted 4 items: Sushi Saito +$80 (Michelin 3-star floor), …" — no surprise for the user.
- Locked rows (`source IN ('user_override','user','manual')` — already respected by the trigger) are never touched.

### C. Stop the delta toast from misleading
- In `useTripFinancialSnapshot.ts`, when the delta is caused by a known repair within the last 5 seconds (check `cost_change_log`), suppress the generic warning toast and replace it with the itemized list above.
- Keep the indicator badge (it's useful) but show the per-item breakdown on click.

---

## Files to touch

```text
supabase/migrations/<new>.sql
  - add trips.last_cost_repair_at timestamptz
  - create cost_change_log table + RLS

supabase/functions/generate-itinerary/action-repair-costs.ts
  - log every floor/fallback raise to cost_change_log
  - stamp trips.last_cost_repair_at on success

src/services/activityCostService.ts
  - needsCostRepair: also require last_cost_repair_at IS NULL
  - new getRecentCostChanges(tripId, sinceMs)

src/pages/TripDetail.tsx
  - unchanged behavior (auto-repair only fires once ever)

src/components/itinerary/EditorialItinerary.tsx
  - remove the always-on post-regenerate repairTripCosts call (line 3791)
  - handleRepairPricing: show itemized change summary

src/hooks/useTripFinancialSnapshot.ts
  - if recent cost_change_log rows explain the delta, render attributed toast
  - otherwise keep the existing 25% warning
```

## Out of scope
- The cost-reference data itself (Michelin floors, ticketed minimums) is unchanged. Those values are correct; the problem is they were being applied silently and repeatedly.
- Manual entries you've made are already protected by the `validate_activity_cost` trigger and won't be modified.

Approve and I'll implement.