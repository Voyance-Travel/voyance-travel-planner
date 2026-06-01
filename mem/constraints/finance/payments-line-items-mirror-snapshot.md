---
name: Payments Line Items Mirror Snapshot
description: Payments Trip Total, header total, and visible PayableItems must derive from the same canonical row set; no costed row may be silently skipped
type: constraint
---

Payments Trip Total, EditorialItinerary header displayed total, Budget totals, and the sum of visible Payments line items MUST derive from the same `resolveCanonicalCostRows` result.

Rules:

- `useTripFinancialSnapshot.tripTotalCents` must read `canonical.effectiveTotalCents + miscReserveCents` from the resolver result, not raw `activity_costs` rows.
- `usePayableItems` may group rows (for example `Local transit - Day N`) and may dedupe day-0 hotel/flight rows against their dedicated selection rows, but it must never silently skip a row with `row.cents > 0` that is counted in the resolver.
- Placeholder/unconfirmed transit with positive cents is grouped into visible Local Transit; only true `$0` placeholder transit may render as an informational `$0` row.
- Placeholder departure/return flight stubs with positive cents must render as a visible line item; only `$0` stubs may be hidden.
- Payments drift checks compare `(sum(visible payable items) + miscReserveCents)` to `financialSnapshot.tripTotalCents` within $1.

Regression class closed: Payments Tab `$1,272` ≠ Header `$964` ≠ visible line items `$722`, caused by raw `activity_costs` rows being counted in snapshot but filtered out of `usePayableItems`.