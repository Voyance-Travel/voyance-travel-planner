## Goal

Close the remaining two Payments-tab discrepancies the user flagged:

1. **$8 phantom** — header says $1,088, line items add to $1,080. The missing $8 is transit cost folded into the canonical snapshot but not surfaced as a breakdown item.
2. **"Departure Flight" $50** — listed as a bookable activity in Payments while the Day 3 itinerary card says "Free".

Both are surface-level UI/data attribution bugs, not architecture bugs — the header/snapshot fix landed earlier. We just need the breakdown and the flight placeholder to tell the same story.

## Root cause

### Issue 1 — `$8` transit phantom
`usePayableItems` (`src/hooks/usePayableItems.ts` ~L369–L381) drops transit rows whose title looks like a placeholder departure transfer or an unconfirmed intra-city taxi, **but** `resolveCanonicalCostRows` (the source for the headline + `financialSnapshot.buckets.transit`) does not apply the same skips. Net effect:
- Snapshot total includes those cents.
- Payable list excludes them, so `transitItems.length === 0`.
- The "Local Transit" bucket card is gated on `items.length > 0` (PaymentsTab.tsx ~L1490), so it never renders — even though `buckets.transit > 0`.

Result: bucket sum < headline by the dropped cents (the $8).

### Issue 2 — "Departure Flight" $50
Activity card on Day 3 displays $0/"Free" because it matches the "placeholder departure transfer / unverified transit" content rule (Core memory: *Placeholder Departure Transfer* / *Unconfirmed Transit Leg* → stays $0 in `activity_costs`). But the row in `activity_costs` for this specific trip was written **before** that guard, or its title slipped past the regex (e.g. literal "Departure Flight" instead of a transfer keyword), so it sits at $50. `usePayableItems` then turns every non-transit row into `type:'activity'` and it surfaces as a $50 bookable item.

## Fix

### 1. Single source for transit visibility (`src/hooks/usePayableItems.ts`)

When a transit row is skipped by `isPlaceholderDepartureTransferTitle` or `isUnconfirmedIntraCityTaxi`:
- Continue skipping from the per-row sub-items list **and** from the per-day grouped totalCents, so it doesn't show as a billable line.
- But **emit a single $0 informational "Local transit (estimated)" group row** for that day so:
  - `transitItems.length > 0` → the bucket card renders.
  - The card header total reads `financialSnapshot.buckets.transit` (already authoritative, $8).
  - Inside, render a single muted sub-item: "Estimated walking / short transit — not bookable" with `amountCents: 0` and no Pay button.

This keeps the headline source of truth intact (canonical snapshot) and makes the bucket card visibly reconcile to it. No backend changes; no new RPCs.

### 2. Strip placeholder "Departure Flight" cost (two layers)

**Frontend (`src/hooks/usePayableItems.ts`)**: extend the placeholder check at the per-row branch (~L399) to also detect placeholder departure-flight rows (category `flight` with title matching `/^(departure|return)\s+flight\b/i` AND no booked-cost source AND no flight number). When matched: skip emitting a payable item (the canonical day-0 flight chip is the only legitimate flight row).

**Backend (`supabase/functions/_shared/write-activity-costs.ts`)**: mirror the same rule — when scanning the itinerary for cost rows, if the activity is a placeholder departure flight card (matching the same regex + no booked basis), write `cost_per_person_usd: 0` with `source: 'placeholder_departure_flight'`. This prevents the row from leaking into `buckets.activities` on future writes and is consistent with the existing "Placeholder Departure Transfer" rule already in core memory.

No migration / no one-shot backfill required — next save through `safeUpdateItineraryData` → `writeActivityCostsFromItinerary` will normalize the row.

### 3. Memory

Add one constraint:
- `mem://constraints/finance/transit-bucket-visibility-mirrors-snapshot` — if `buckets.transit > 0` the Local Transit card MUST render, even when all underlying rows are placeholder/unconfirmed (synthetic $0 sub-item is OK). And expand the existing *Placeholder Departure Transfer* note to mention "Departure/Return Flight" placeholder titles fall under the same $0 rule.

## Out of scope

- No changes to the canonical resolver, snapshot hook, or header equation — those already match (user confirmed the green "Matches itinerary" check).
- No new tables, RLS changes, or migrations.
- No changes to the itinerary card UI; "Free" continues to render correctly.

## Verification

1. Re-load the user's Faro trip; confirm:
   - "Local Transit" card now visible with header $8 and an inactive "Estimated walking / short transit" sub-item.
   - "Departure Flight" no longer in Activities bucket; Activities total drops to $150 (3 × $50).
   - Bucket sum: $520 + $360 + $150 + $8 + reserve = $1,088 → matches headline.
2. Add a unit test in `src/hooks/__tests__/usePayableItems.test.ts`:
   - Given a transit row with placeholder title and $8 cents, payable items emit a `groupKind:'transit'` row with `amountCents:0` and bucket card renders.
   - Given an activity row `category:'flight'` titled "Departure Flight" with no flight number, no payable item is emitted.
