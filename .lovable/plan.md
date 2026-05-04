## Problem

The L'Arpège lunch payment ($500, item_id `59643e43-2e68-4b8e-9196-6e9bf2d2bcb9_d1`) exists in `trip_payments` but the underlying activity is no longer in `itinerary_data` and has no row in `activity_costs`. So:

- It correctly counts toward "Paid so far" (sums `trip_payments`).
- It never appears as a row in `usePayableItems` (which only emits rows for items present in the itinerary JSON or `activity_costs`).
- Counter shows `0/24` instead of `1/N` and the user can't see what they paid for.

## Fix

Add an **orphan payment recovery** pass at the end of `usePayableItems` (in `src/hooks/usePayableItems.ts`), right before the final dedupe:

1. After all itinerary-derived and manual rows are pushed, build a `Set` of present item IDs.
2. Iterate `payments` and, for any non-manual `activity` payment whose `item_id` is not in the set, group payments by `item_id`.
3. Emit one `PayableItem` per orphan group, using `payment.item_name` as the row label, `amount_cents * quantity` as the amount, and recovering `dayNumber` from the trailing `_dN` suffix.

This keeps all existing behavior (transit grouping, manual overrides, JSON-walk fallback) intact, while guaranteeing every payment appears as a row in the list.

## Files

- `src/hooks/usePayableItems.ts` — add the orphan recovery block before the final dedupe.

## Result

- L'Arpège row reappears as a paid activity item, label "Lunch at L'Arpège", $500.
- Counter switches to `1/N` (and N reflects the additional row).
- Paid total is unchanged.
- No DB or edge-function changes.