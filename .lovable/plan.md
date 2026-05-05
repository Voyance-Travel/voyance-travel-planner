## Problem

The transit allocation ($180 / 10% of trip budget) was exceeded by 131% ($417 generated) because:

1. **Generator awareness only — no enforcement.** `compile-prompt.ts` writes `Local transit: ~$X` into the prompt, but the model frequently ignores it and routes everything via taxi.
2. **No post-generation transit cap.** `action-repair-costs.ts` only repairs *unconfirmed* transit legs to $0; it never trims confirmed taxi cards even when the day's transit total is wildly over the per-day allocation.
3. **Budget Coach is category-blind.** The coach prompt lists generic "swap types" (taxi → metro is one of many bullets) and ranks suggestions purely by absolute savings. With expensive food/activity items present, transit swaps never make the top 8.

## Fix

### 1. Server-side transit cap during generation (`action-repair-costs.ts`)

After per-day costs are normalized, compute the day's confirmed transit total. If it exceeds the allocated per-day transit target by >25%:
- Demote the most expensive `taxi` legs to `metro` / `walk` (preserve the activity, swap mode + cost from `cost_reference`).
- Stop demoting once the day's transit total is within the cap.
- Skip legs flagged `isLocked`, `bookingRequired`, or anchored to flights/airport transfers (those genuinely need a taxi).
- Log each demotion to `cost_change_log` with source `transit_cap_repair` so the snapshot toast can attribute the delta.

The per-day transit target is recomputed from `trips.budget_allocations.transit_percent` × per-day budget (same math as `compile-prompt.ts`).

### 2. Pass transit overrun to Budget Coach (`BudgetTab.tsx` + `BudgetCoach.tsx`)

- Compute `transitOverrunCents = plannedTransitCents - allocatedTransitCents` from `getCategoryAllocations`.
- Forward `category_overruns: { transit: cents, food: cents, ... }` into the `budget-coach` request body.

### 3. Coach prompt prioritizes overrun categories (`supabase/functions/budget-coach/index.ts`)

- Accept `category_overruns` in the request schema.
- Inject a `PRIORITY OVERRUNS` clause into the system prompt:
  > "The following categories are over their allocated budget: Transit by $237. At least the top N suggestions MUST target items in these overrun categories before suggesting swaps elsewhere."
- Where N = number of overrun categories (capped at 3).
- Validate server-side: if `category_overruns.transit > 0` and zero returned suggestions match Transit, append a synthesized fallback ("Switch Day X taxi to metro — $Y → $Z") drawn from `cost_reference`.

### 4. Coach UI surfaces overrun chips (`BudgetCoach.tsx`)

Add a small chip row above the suggestion list when overruns exist:
> ⚠ Transit is $237 over (allocated $180, planned $417)

Clicking the chip filters the suggestion list to that category. Purely cosmetic; requires no schema change.

### 5. One-time reconciliation for the affected Paris trip

After deploy, run the transit cap repair against the affected trip via the same code path (`action-repair-costs` invoked from the existing self-heal trigger).

## Files to change

- `supabase/functions/generate-itinerary/action-repair-costs.ts` — new transit-cap pass
- `supabase/functions/budget-coach/index.ts` — accept `category_overruns`, prompt + validation
- `src/components/planner/budget/BudgetTab.tsx` — compute and pass overruns
- `src/components/planner/budget/BudgetCoach.tsx` — overrun chips + pass-through
- `src/services/tripBudgetService.ts` — expose `allocatedTransitCents` (and others) on the summary for reuse

## Validation

- Generate a Paris trip with 10% transit allocation; confirm post-generation transit total ≤ allocated × 1.25.
- Confirm Budget Coach surfaces ≥1 transit suggestion when transit is over.
- Confirm a synthesized fallback appears when the AI returns zero transit suggestions despite an overrun.
- Confirm `cost_change_log` rows are attributed to `transit_cap_repair`.
