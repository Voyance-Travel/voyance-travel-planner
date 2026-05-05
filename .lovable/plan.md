## Problem

In `PaymentsTab.tsx` (line 324), `unpaidAmount` clamps at zero:

```ts
const unpaidAmount = Math.max(0, estimatedTotal - paidAmount);
```

When recorded payments exceed the itinerary total (e.g. $2,900 paid against a $2,400 hotel-only trip), the UI silently shows "Remaining to pay: $0" with no acknowledgement of the $500 overpayment. The orphaned payment still appears under Recent Payments but the summary never flags the mismatch — confusing for real users.

## Changes

### 1. Compute and surface an `overpaidAmount` — `src/components/itinerary/PaymentsTab.tsx`

Around line 324:

```ts
const unpaidAmount = Math.max(0, estimatedTotal - paidAmount);
const overpaidAmount = Math.max(0, paidAmount - estimatedTotal);
const isOverpaid = overpaidAmount > 0 && estimatedTotal > 0;
```

(The `estimatedTotal > 0` guard prevents flagging an empty itinerary as "overpaid" — that's a different empty-state, not an anomaly.)

### 2. Replace the right-hand summary tile when overpaid (lines 1017–1025)

When `isOverpaid`:

- Swap icon to `AlertTriangle` in amber.
- Primary line: `Overpaid by {formatCurrency(overpaidAmount)}` (amber-700).
- Secondary line (smaller, muted): `Recorded payments exceed itinerary total` with a tooltip: "Some payments may not be linked to current itinerary items. Review Recent Payments to reconcile."

When not overpaid, render the existing "Remaining to pay" tile unchanged.

### 3. Cap the progress bar visually

`progressPercent` already exceeds 100 when overpaid. Keep the calc as-is for accuracy but:
- Clamp the `<Progress value=...>` (line 1004) to `Math.min(progressPercent, 100)`.
- When `isOverpaid`, tint the progress bar amber: `[&>div]:bg-amber-500`.

### 4. Out of scope

- Auto-reconciling orphaned payments (would require linking historical `trip_payments` to deleted/changed activities — separate, larger fix).
- Editing the Recent Payments list itself.
- Backend changes to `v_payments_summary` — the data already shows the overpayment correctly; this is a UI surfacing fix.

## Files touched

- `src/components/itinerary/PaymentsTab.tsx` — ~25 lines changed across the totals computation, summary tile, and progress bar.