## Problem

The Add Expense modal in `PaymentsTab.tsx` only offers `flight`, `hotel`, `activity`. The DB CHECK constraint `trip_payments_item_type_check` enforces the same three values, so simply adding new options client-side would fail at insert.

## Plan

### 1. DB migration

Loosen `trip_payments_item_type_check` to accept additional categories used for manual logging:

```
flight, hotel, activity, dining, transport, shopping, other
```

`flight | hotel | activity` remain canonical for AI-generated rows (the payable items hook keys off these). The new values are only used by manually-added expenses (`item_id` starts with `manual-`).

### 2. Client changes (`src/components/itinerary/PaymentsTab.tsx`)

- Widen the `newExpenseType` state union to include the 4 new values.
- Update the `<Select>` options with friendly labels: Flight ✈️, Hotel/Accommodation 🏨, Activity/Tour 🎟️, **Dining 🍽️**, **Transport 🚗**, **Shopping 🛍️**, **Other 💳**.
- Update name-field placeholders for each new type (e.g. dining → "e.g., Dinner at Le Comptoir").
- Update `getItemIcon` to return appropriate lucide icons for `dining` (Utensils), `transport` (Car), `shopping` (ShoppingBag), `other` (Receipt). Add the imports.
- Update the inline icon used in the manual-grouping flow inside `usePayableItems` consumer paths (no schema change needed there — rendering already uses `getItemIcon(type)`).

### 3. `usePayableItems`

Extend the manual-group sweep so it also picks up `dining`, `transport`, `shopping`, `other` item types (currently only sweeps `flight` and `hotel`; `activity` is handled separately by the activity branch). Without this, new manual expenses would be inserted but never rendered as payable items.

## Files

- DB migration: relax CHECK constraint on `trip_payments.item_type`
- `src/components/itinerary/PaymentsTab.tsx` — widen union, new Select options, placeholders, icons
- `src/hooks/usePayableItems.ts` — sweep new manual types into payable items

## Expected outcome

User can log a manual "Dinner at Le Comptoir – $180" under **Dining**, a "Taxi to CDG – $90" under **Transport**, or a "Hermès scarf – $450" under **Shopping**, and each shows up in the payments list with an appropriate icon and folds into the Trip Total exactly like manual flights/hotels do today.