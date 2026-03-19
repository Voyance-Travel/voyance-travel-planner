

## Fix: "Split All Evenly" destroys existing "Paid" payments

### Root cause

The "Split All Evenly" handler iterates over all items in the `unassigned` bucket. A paid item can land in "unassigned" if its `assigned_member_id` doesn't resolve to a known synthetic member ID. The handler then:

1. **Deletes all existing `trip_payments`** for that item (line 1127-1129) — including the `status: 'paid'` row
2. Inserts new rows with `status: 'pending'` — effectively resetting the $800 hotel payment to $0 paid

Additionally, the unique constraint `(trip_id, item_type, item_id)` means only one payment row can exist per item, so splitting among N members via upsert silently overwrites rather than creating N rows.

### Two-part fix

**File: `src/components/itinerary/PaymentsTab.tsx`**

#### 1. Skip paid items in "Split All Evenly"

In the split handler (line 1125), filter out any item that already has a `paid` payment. Paid items should never be reassigned or deleted by a bulk split action.

```ts
// Before splitting, filter to only truly unassigned/unpaid items
const splittableItems = unassigned.items.filter(({ item }) =>
  !item.allPayments.some(p => p.status === 'paid')
);
```

Then iterate over `splittableItems` instead of `unassigned.items`.

#### 2. Preserve paid status when splitting already-paid items individually

Add a guard at the top of the delete block: if any payment in `item.allPayments` has `status === 'paid'`, skip the item entirely and show a toast warning ("Hotel is already paid — skipping").

### Result

- Paid items are never touched by "Split All Evenly"
- The $800 hotel payment is preserved
- Only genuinely unassigned/pending items get split

