## Problem

Same session, same trip, two different lists:

- **Payments → "Activities & Experiences: 22 bookable items"** comes from `usePayableItems()` (`src/hooks/usePayableItems.ts`):
  - drops any row with `cents <= 0` (free venues, $0 spa)
  - groups *all* same-day transit rows into one "Local transit — Day N" line
  - filters placeholder departure transfers and unconfirmed intra-city taxi legs
  - excludes flight + hotel from `activityItems` (they go into `essentialItems`)

- **Budget → "All Costs (26)"** comes from `getBudgetLedger()` (`src/services/tripBudgetService.ts`), which is a near-raw map of `activity_costs` rows:
  - keeps $0 rows (renders them as "Free")
  - one row per individual transit leg (no per-day grouping)
  - includes day-0 hotel/flight rows

Both labels say "items," so the user reasonably reads them as the same set. They're not — and the divergence shifts every regen because $0/transit row counts vary.

## Fix

Route Budget's "All Costs" list through the same payable-items pipeline Payments already uses, so the two views are derived from one source. This is consistent with the existing principle that `usePayableItems` is the single source of truth for cost totals (called out in its file header).

### 1. Render "All Costs" from `usePayableItems` in `BudgetTab.tsx`

- Fetch `activity_costs` + `tripInclusion` toggles in `BudgetTab` exactly like `PaymentsTab` does (mirror the two `useQuery` blocks).
- Call `usePayableItems({ days: itineraryDays, flightSelection, hotelSelection, travelers, payments, activityCosts, includeHotel, includeFlight, paymentsLoaded: true })`.
- Build the displayed list as `[...essentialItems, ...activityItems]` (essentials first → flight/hotel/manual logistics on top, then activities + grouped transit). Same order Payments uses.
- Replace `<CostsList ledger={ledger} … />` with a small `PayableCostsList` that renders the unified `PayableItem` shape:
  - `name` → `entry.name`
  - `category` → derive from `item.type` (`flight`/`hotel`/`activity`/`dining`/`transport`/`shopping`/`other`) → existing `categoryColors`/`categoryIcons` keys (`flight`, `hotel`, `food`, `transit`, `activities`, `misc`).
  - `amount_cents` → `item.amountCents`
  - Day badge → `item.dayNumber` when present
  - Transit grouped rows: render the same way Payments does (collapsible sub-items via `item.subItems`).
- Header becomes **"All Costs ({list.length})"** using the unified count, so the number always matches Payments' `essentialItems.length + activityItems.length`.

### 2. Preserve removal behavior

- For activity-typed payable items, `item.id` is `${activity_id}_d${day_number}`. Strip the `_d…` suffix to recover `activity_id` and call the existing `onActivityRemove(activityId)` prop, which removes the activity from `days` and triggers `syncBudgetFromDays` (the existing flow).
- For grouped transit rows (`id` starts with `transit-d`), hide the trash icon — these aren't a single removable activity. Users still remove individual transit legs from the itinerary tab.
- For flight/hotel/manual items, hide the trash icon (those flow through their own management UIs already; removing a row inside a derived view is the wrong affordance).
- Drop the legacy `removeEntry(entry.id)` call — it operated on raw ledger ids that no longer exist in the unified list.

### 3. Keep the legacy ledger path for the "Free venues" disclosure (optional — small)

- The unified list intentionally hides $0 rows. Add a tiny muted footer beneath the All Costs card: *"+ N free venues not shown"* where `N = ledger.length - unifiedList.length`. Computed by reusing `useTripBudget`'s `ledger` (already loaded) for the count only — no rendering of the rows. This keeps transparency without re-introducing the disagreement.

### 4. Smoke-test the agreement

- After the change, on any session: Payments header `essential + activity` total === Budget "All Costs" count. The header in PaymentsTab already shows `activityItems.length` next to the Activities section; we'll cross-check.
- Existing `useTripFinancialSnapshot` total continues to drive Trip Total in both tabs — no change.

## Files touched

- `src/components/planner/budget/BudgetTab.tsx` — fetch payments+activityCosts+inclusion toggles, call `usePayableItems`, replace `<CostsList>` with a payable-items renderer, update header count + free-venues footer.
- (No edge-function or schema changes.)

## Out of scope

- Reworking `getBudgetLedger` to share a function with `usePayableItems`. Different consumers still want raw access (CSV exports, audit). Keep it; just stop using it as the visible "All Costs" source.
- Changing transit grouping or $0 suppression rules.

## Memory

Update `mem://technical/finance/ui-total-cost-fallback-logic` with: "Budget tab All Costs list is derived from `usePayableItems`, NOT `getBudgetLedger`. The two must always show the same count + names + totals as PaymentsTab. `getBudgetLedger` is retained for raw audit only and is referenced in the All Costs free-venues footer count."

**Approve to implement?**