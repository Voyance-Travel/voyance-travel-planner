## Problem
Day 1 total reads "€171/pp (incl. €62 transit)" but the €55 fixed-rate airport taxi is buried inside the €62 figure, leaving the user to wonder why intra-city transit is so high.

## Fix
Surface the airport transfer separately in the existing day-total tooltip and the "(incl. … transit)" inline pill on the Day card.

### Edit: `src/components/itinerary/EditorialItinerary.tsx`

1. **Compute `airportTransferSubtotal`** alongside the existing `transitSubtotal` (~line 9482). Sum costs of any transit-category activity whose `title` / `name` / `description` matches `\bairport\b`. Derive `otherTransitSubtotal = transitSubtotal - airportTransferSubtotal`.

2. **Inline pill** (~line 10221) — when `airportTransferSubtotal > 0`, change the suffix to:
   `(incl. €X airport taxi + €Y transit)` (or just `€X airport taxi` if no other transit).
   Falls back to the current `(incl. €Z transit)` when no airport leg exists.

3. **Tooltips** (top-card badge ~line 9602 and bottom day-total ~line 10227) — split the "Transit & transfers" row into two when the airport subtotal exists:
   - "Airport transfer  €X"
   - "Local transit  €Y" (omit when zero)
   Existing row stays for non-arrival days.

No change to totals, schema, or generator. Pure presentational breakout that leverages existing cost lookups.

## Files
- `src/components/itinerary/EditorialItinerary.tsx`