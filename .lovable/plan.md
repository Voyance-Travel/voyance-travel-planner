# RS.M.B3 — Refund currency mismatch

## Problem

`stripe-webhook` zeroes `activity_costs` on `charge.refunded` but never records the refund's currency. The finance ledger entry stamps `currency: charge.currency.toUpperCase()` (could be EUR/JPY/etc.), while downstream readers (`getBudgetLedger`) hard-code `currency: 'USD'`. EUR/JPY refunds therefore display as USD-denominated zero-outs in the budget UI.

`activity_costs` has no `currency` column today; cost reads assume USD.

## Fix

Add `currency` to `activity_costs`, backfill from `trips.budget_currency`, stamp it on the refund zero-out, and surface it from the ledger reader.

### 1. Migration

```sql
ALTER TABLE public.activity_costs
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

UPDATE public.activity_costs ac
   SET currency = COALESCE(t.budget_currency, 'USD')
  FROM public.trips t
 WHERE ac.trip_id = t.id
   AND (ac.currency IS NULL OR ac.currency = 'USD');
```

The `OR ac.currency = 'USD'` clause makes the backfill safe to re-run and corrects rows that received the column default before the trip's true currency was known.

### 2. `supabase/functions/stripe-webhook/index.ts` (charge.refunded handler, ~line 842)

In the existing `activity_costs` update block, add the currency stamp:

```ts
.update({
  is_paid: false,
  paid_amount_usd: 0,
  paid_amount_local: 0,
  currency: charge.currency.toUpperCase(),  // capture the actual refund currency
  refunded_at: new Date().toISOString(),
  refund_amount_cents: charge.amount_refunded,
  updated_at: new Date().toISOString(),
})
```

### 3. `src/services/tripBudgetService.ts` — ledger reader

Two `currency: 'USD'` literals to replace:

- **Line 540** (inside `getBudgetLedger` row mapper): `currency: (row as any).currency || trip?.budget_currency || 'USD'`
- **Line 727** (`recordExpense` return): `currency: (data as any).currency || 'USD'`

`getBudgetLedger` already loads the trip elsewhere — thread `budget_currency` into the row mapper as a fallback. If the trip lookup isn't already in scope, add a lightweight `trips.budget_currency` select alongside the existing `activity_costs` query.

### 4. Generated types

`src/integrations/supabase/types.ts` is auto-regenerated from the schema after the migration applies, so the new `currency` column will be typed automatically. Reads use `(row as any).currency` as a defensive fallback for the brief window before regen.

## Verification

- `grep -c "ALTER TABLE.*activity_costs.*currency" supabase/migrations/` → ≥ 1
- After a non-USD refund: the `activity_costs` row carries the refund currency (EUR, etc.), and the budget ledger surfaces that same currency instead of 'USD'.
- Pre-refund USD rows continue to display as USD (default + backfill).

## Files

- **New:** `supabase/migrations/<timestamp>_activity_costs_currency.sql`
- **Edit:** `supabase/functions/stripe-webhook/index.ts` — one line addition in the refund zero-out block
- **Edit:** `src/services/tripBudgetService.ts` — replace two hard-coded `'USD'` literals with row/trip-derived currency
