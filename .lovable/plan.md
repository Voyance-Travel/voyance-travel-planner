## Problem

The header **Trip Total** in `PaymentsTab` is sourced from `useTripFinancialSnapshot(tripId)`, which reads exclusively from the `activity_costs` ledger. Manual expenses added via the "Add Expense" dialog are written **only** to `trip_payments` (with `item_id` prefixed `manual-`), never into `activity_costs`. Result: the manual $2,400 hotel inflates the per-item list and "Paid so far", but the canonical Trip Total stays at the original $2,921 estimate, making the math look broken.

`usePayableItems` already includes manual entries (lines 201–228), so `payableTotalCents` already reflects them — the bug is that `estimatedTotal` prefers the snapshot when available and ignores `payableTotalCents` once the snapshot is non-zero.

## Plan

In `src/components/itinerary/PaymentsTab.tsx`, update the `estimatedTotal` derivation (lines 242–252):

1. Compute `manualExtraCents` from `payments` where `item_id` starts with `manual-` (sum of `amount_cents * quantity`). These are the entries the snapshot does not know about.
2. Set `estimatedTotal = max(snapshotTotal + manualExtraCents, payableTotalCents)`. This:
   - Adds manual costs on top of the canonical ledger total, so adding a $2,400 hotel raises Trip Total by $2,400.
   - Keeps `payableTotalCents` as a floor in case the snapshot is briefly stale or zero.
3. No changes to "Paid so far" (already correct from `trip_payments`) or to per-item rendering.

## Why not write manual entries into `activity_costs`?

`activity_costs` is the AI-generated cost ledger keyed by `activity_id` and tied to itinerary days. Manual one-off expenses don't belong there — they're free-form line items the user logged. Sourcing the Trip Total from `payments + ledger` keeps each table's role clean and avoids polluting ledger-driven analytics.

## Files

- `src/components/itinerary/PaymentsTab.tsx` — replace the 11-line `estimatedTotal` block with the additive computation above.

## Expected outcome

After adding a $2,400 manual hotel and a $500 paid L'Arpège on a $2,921 base trip:
- Trip Total: **$5,321** (2,921 + 2,400)
- Paid so far: **$2,900** (unchanged)
- Remaining: **$2,421**

Reconciliation badge ("✓ Matches itinerary") continues to compare `payableTotalCents` (which already includes manual entries) against the snapshot — that comparison is unaffected.