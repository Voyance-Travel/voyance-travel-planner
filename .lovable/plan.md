## Goal
Let users delete an expense row in PaymentsTab with a confirmation prompt, scoped to manually-added expenses (so itinerary-derived flights/hotels/activities aren't accidentally wiped from one tap).

## Scope
File: `src/components/itinerary/PaymentsTab.tsx`

Manual expenses are tagged `external_provider === 'manual'` on insert (line 468). We use that as the eligibility signal — a delete button only appears on rows whose payment(s) are manual. Auto-derived items keep today's behavior (Mark Paid / Unmark Paid / Assign).

## UX
- In `renderPayableItem`, add a small trash-icon `Button` (ghost, destructive on hover) next to the existing actions, rendered only when the item is manual.
- Click opens an `AlertDialog` (already in `src/components/ui/alert-dialog.tsx`):
  - Title: "Delete this expense?"
  - Description: "{item.name} — {formatCurrency(item.amountCents)}. This can't be undone."
  - Cancel / Delete (destructive) buttons.
- On confirm: delete every row in `item.allPayments` from `trip_payments` by id, toast "Expense deleted", call `fetchPayments(150)`, dispatch `booking-changed` so budget/header refresh.
- On error: toast "Failed to delete expense", keep dialog closed.

## Technical bits
- New state at top of component:
  ```ts
  const [deleteTarget, setDeleteTarget] = useState<PayableItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  ```
- New handler `handleDeleteExpense(item)` mirroring the delete portion of `handleUnmarkPaid` (lines 488–534) but without the `activity_costs` update (manual expenses have no row there) and without the paid-total recompute (we can just rely on `fetchPayments` to refresh `totals`).
- Eligibility helper: `const isManual = item.allPayments.every(p => p.external_provider === 'manual') && item.allPayments.length > 0;`
- Render the AlertDialog once at the bottom of the component (sibling of the existing Add Expense Dialog around line 1681), bound to `deleteTarget`.
- Imports to add: `Trash2` from `lucide-react`, `AlertDialog*` primitives from `@/components/ui/alert-dialog`.

## Out of scope
- Bulk delete.
- Deleting itinerary-derived items (would require touching `activity_costs` / locking rules — different surface).
- Undo toast (kept simple per request: confirmation prompt is the safety net).
