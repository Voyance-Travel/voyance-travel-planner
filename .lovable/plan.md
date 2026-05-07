## The bug

Payments tab and Budget by Category disagree because they group activity costs differently:

- **`activity_costs` DB (truth):** dining = $216 (6 rows; one is the now-zeroed "Highly-rated neighborhood restaurant" stub → 5 paid rows × 2 travelers = **$180**), activity = $0, transport = $0.
- **Budget by Category (`getCategoryAllocations`)** maps `dining → food` and `activity → activities`. So Food shows $216, Activities shows **$0/$360**. Correct mapping, but users don't see it that way.
- **Payments tab (`usePayableItems`)** lumps every non-flight/non-hotel row into a single bucket called "**Activities & Experiences**" because every row is emitted with `type: 'activity'` (lines 451–462 in `src/hooks/usePayableItems.ts`). So 5 dining rows totalling $180 surface under "Activities" in Payments, while the Activities allocation in Budget reads $0.

Result: the user sees "5 items, $180" labeled Activities in one place and "$0/$360" labeled Activities in the other. Two systems, one label, two truths.

## Root cause

`usePayableItems` collapses dining/activity/shopping/etc. into the single `type: 'activity'` enum because Payments tab originally only had Flight / Hotel / Activities groups. The Budget engine has the correct category granularity (food/activities/transit/misc); Payments doesn't, and the **"Activities & Experiences"** card in Payments is the mislabel.

## Plan

Single fix: make Payments tab categorize the same way Budget does, so the two surfaces use the same buckets and a dining row is never displayed under "Activities".

### 1. Carry the source category through `usePayableItems`

In `src/hooks/usePayableItems.ts`:

- Add an optional `budgetCategory: 'food' | 'activities' | 'transit' | 'misc'` field on `PayableItem`.
- When emitting a row from an `activity_costs` DB row, set `budgetCategory` from `toBudgetCategory(row.category)` (extract the same mapping `tripBudgetService.ts` uses, share it via a small helper in `src/services/budgetCategoryMap.ts`).
- Keep `type: 'activity'` for back-compat (other call sites depend on it).

### 2. Group Payments tab by `budgetCategory`, not by `type`

In `src/components/itinerary/PaymentsTab.tsx`:

- Replace the single `activityItems` bucket with three derived lists: `foodItems`, `activitiesItems`, `transitItems` (filter `payableItems` by `budgetCategory`).
- Render three category cards mirroring Budget by Category labels and icons:
  - "Food & Dining" (Utensils icon, fork/knife)
  - "Activities & Experiences" (Camera icon — existing)
  - "Local Transit" (existing transit grouping already exists; surface as its own card instead of nested under activities)
- Keep "Essentials" (flight + hotel) card unchanged.

### 3. Remove the misleading subtotal label

The current "Activities & Experiences" subtitle reads `{N} bookable items` using all non-essentials. After step 2 it will count only true activity rows, so the visible total there will match Budget's Activities row exactly ($0 / "0 bookable items" hidden if empty).

### 4. Hide empty category cards

If a category has zero items, don't render its card (consistent with how the existing Activities card already hides when `activityItems.length === 0`).

### 5. Tests

- Update `src/hooks/__tests__/usePayableItems.test.ts` to assert `budgetCategory` is set from the DB row category (`dining → food`, `activity → activities`, `transport|transit|transfer|taxi → transit`, etc.).
- Add a snapshot of the Venice trip fixture asserting that 5 dining rows land in `foodItems` and `activityItems` is empty.

### Out of scope

- No changes to `getCategoryAllocations`, `getBudgetSummary`, or the activity_costs schema — Budget engine is already correct.
- No changes to manual expense entry flows; manual `dining`/`transport`/etc. payments already carry their own `item_type` and will map cleanly through the same helper.
- No fix needed for the "Highly-rated neighborhood restaurant" row — that's already $0 from the prior fix and will simply not appear.

## Files touched

- `src/services/budgetCategoryMap.ts` (new — shared `toBudgetCategory` helper)
- `src/services/tripBudgetService.ts` (import shared helper, drop local copy)
- `src/hooks/usePayableItems.ts` (add `budgetCategory` field + populate)
- `src/components/itinerary/PaymentsTab.tsx` (split into three category cards)
- `src/hooks/__tests__/usePayableItems.test.ts` (assertions for new field)
