## Problem

Payments tab is inflating trip totals by including line items the itinerary view never surfaces. After tracing the data:

1. **"Transfer to Airport" $130 / "Travel to Four Seasons" $130 / "$50 taxi rides"** — these come from `activity_costs` rows with `category='transport'` (e.g. row `3a85d23b…` = $65.22/pp × 2 = **$130**, row `89e70593…` = $21.74/pp × 2 = $43, etc.). They were synced into the DB by `itinerary-sync` and are walked in `usePayableItems` via the JSON activities loop OR added by the DB reconciliation block as separate "Local Transit" sums.
2. **The itinerary card UI suppresses these transport segments from the visible per-day cost** (they're rendered as transit chips, not costed activities), so the user never sees them in the day total — but they reappear with full price in Payments. That's the "mystery entry" complaint.
3. **Restaurant items math IS correct** (€230/pp × 2 ≈ $500 at 1.08, since the DB stores in USD). The user's table actually confirms these line up. The remaining trust issue is purely the unsurfaced transport.
4. **`estimateCostSync` fallback** in `usePayableItems` (lines 239–254) can also re-price an activity that the itinerary showed as €0 / hidden, producing a price the user never agreed to.

The root cause: Payments uses **two sources** (JSON walk + DB reconciliation) and re-estimates missing prices, while the itinerary visible totals use a **third** source. Anything the itinerary chooses to hide (transport segments, micro-legs) becomes a "mystery charge".

## Plan

### Pass A — Single source of truth: `activity_costs` only

Rewrite `src/hooks/usePayableItems.ts` so its activity items come **only** from the `activity_costs` table (the same table that already powers BudgetTab and the per-day badges after the previous reconciliation pass). No more JSON walk, no more `estimateCostSync` fallback inside Payments. Concretely:

- Drop the `days.forEach` activity loop.
- Drop `NEVER_FREE_*` re-estimation logic (it was the inflation source).
- Drop the secondary "Local Transit" reconciliation block — replaced by the new aggregation below.
- Build payable items by joining each `activity_costs` row to a display name pulled from the JSON activity by `activity_id` (when available), falling back to the row's category label.
- Cost = `cost_per_person_usd × num_travelers` exactly as stored. No conversion, no multiplier — DB is canonical USD post-Pass-2.

### Pass B — Group transport into one collapsible "Local Transit" line per day

Per the previously-approved "Other / fees" UX, but specialized:

- All `activity_costs` rows with `category IN (transport, transit, transfer, taxi)` are summed per `day_number` into one row: **"Local transit — Day N"** with the per-day USD subtotal.
- The grouped row is expandable, listing each underlying segment (e.g. "Airport → Four Seasons · $130", "Hotel → Septime · $43") so the user can audit it without clutter.
- This stops the parade of $50 taxi line items and matches the itinerary's chip-style transit rendering.

### Pass C — Mirror the itinerary's "hidden" filter

Add a `is_hidden_from_itinerary` check: if the JSON activity for an `activity_id` is suppressed (transport segment, downtime, walking), the Payments row should be visually grouped under "Local transit" (Pass B) rather than rendered as its own header item. This guarantees: **every line item in Payments either appears as a costed item in the itinerary OR sits inside the Local Transit collapsible.**

### Pass D — Display reconciliation badge

In `PaymentsTab.tsx` totals header, add a small reconciliation indicator: "✓ Matches itinerary total" when `payableTotalCents === financialSnapshot.tripTotalCents`. If they ever diverge, show a "Re-sync" button that triggers `syncBudgetFromDays` (already idempotent after Pass 3 of the prior plan) instead of silently displaying two different numbers.

### Pass E — Kill the JSON-cost path entirely for the activity loop

Remove the in-component `estimateCostSync` import in `usePayableItems.ts`. This enforces at the type level that Payments cannot invent a cost — if `activity_costs` doesn't have a row, the item simply doesn't appear, which is correct (it would also be $0 in BudgetTab and the day badge).

## Files

- `src/hooks/usePayableItems.ts` — rewrite per Passes A, B, C, E
- `src/components/itinerary/PaymentsTab.tsx` — render grouped transit row + reconciliation badge (Pass B, D)
- `src/services/activityCostService.ts` — add a small helper `getDisplayNameForActivityCost(row, jsonActivities)` for Pass A name-joining
- No DB migration needed; no edge function changes

## Out of scope

- The currency-audit `writeActivityCost` invariant (Pass 2 of the prior plan) is still pending; once landed, it guarantees the USD figures used here are always correctly converted. This plan assumes that's either already in place or follows immediately.
- Editing how the itinerary view renders transit (chips vs. cards) — only Payments is changing.

## Expected outcome

- Restaurant totals: unchanged (already correct).
- "Transfer to Airport $130" / "Travel to Four Seasons $130" / $50 taxis → collapse into one **"Local transit — Day 1: $130"** row, expandable to show the underlying segment. Same for other days.
- Payments grand total === Budget header total === sum of per-day badges. The reconciliation badge confirms it visually.
- No payable item without a corresponding `activity_costs` row, so nothing can appear in Payments that wasn't accounted for in the budget.