## RS.M.B1 — Settlement closes underlying expense_splits

### Schema reality (adapted from spec)
- `trip_settlements` uses `from_member_id` / `to_member_id` (trip_members.id), not user_id. No `settled_split_ids` column today.
- `expense_splits` is keyed by `member_id` (the debtor), has `is_paid`/`paid_at`, no `paid_via_settlement`. The creditor lives on `trip_expenses.paid_by_member_id`.
- `createSettlement` and `markSettlementComplete` exist in `src/services/tripBudgetAPI.ts`. `markSettlementComplete` currently just flips `is_settled`/`settled_at` and never closes the underlying splits — `calculateBudgetSummary` keeps reading them as unpaid, so users see "you still owe $X" forever after settling.
- No UI currently calls `createSettlement`; only the mark-complete mutation is wired. Adding an optional `settledSplitIds` param is non-breaking.

### Plan

**1. Migration** (additive, idempotent):
```sql
ALTER TABLE public.trip_settlements
  ADD COLUMN IF NOT EXISTS settled_split_ids uuid[];

ALTER TABLE public.expense_splits
  ADD COLUMN IF NOT EXISTS paid_via_settlement uuid
  REFERENCES public.trip_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_splits_paid_via_settlement
  ON public.expense_splits(paid_via_settlement);
```
No RLS changes — existing policies on both tables already cover the new columns.

**2. `createSettlement(input)`** — accept optional `settledSplitIds?: string[]` and persist into the new `settled_split_ids` column when provided. Existing callers continue to work (no UI callers today).

**3. `markSettlementComplete(settlementId)`** — rewrite to:
   - Read `id, trip_id, from_member_id, to_member_id, amount, currency, settled_split_ids` from `trip_settlements`.
   - Update settlement → `is_settled=true`, `settled_at=now`.
   - **If `settled_split_ids` is a non-empty array**, update those `expense_splits` rows: `is_paid=true`, `paid_at=now`, `paid_via_settlement=settlementId`.
   - **Fallback (legacy settlements with no tracked splits)**: select unpaid splits where `member_id = from_member_id` AND parent expense `trip_id = settlement.trip_id` AND `paid_by_member_id = to_member_id`, then mark those paid via the same settlement. Implemented as a fetch-then-update (`.in('id', ids)`) because PostgREST can't filter on parent table joins in a single update; the fetch uses an embedded select on `trip_expenses!inner(trip_id, paid_by_member_id)`.
   - Throw on each Supabase error so the existing mutation toast surfaces failures.

**4. Verify**:
   `grep -c "settled_split_ids\|paid_via_settlement" src/services/tripBudgetAPI.ts` — expected ≥ 4 (createSettlement insert, markSettlementComplete read, primary update, fallback update).

### Files touched
- New migration: `supabase/migrations/<timestamp>_settlement_split_link.sql` (additive columns + index).
- Edit: `src/services/tripBudgetAPI.ts` — `createSettlement` (+ optional `settledSplitIds`), `markSettlementComplete` (close underlying splits with primary + legacy fallback path).

### Out of scope
- No UI changes. (`createSettlement` has no UI caller today; once a future "Settle up" UI is built, it will pass `settledSplitIds` from the simplification result.)
- No change to `calculateBudgetSummary` — it already respects `is_paid`, so closing the splits is sufficient.
- No change to `markSplitPaid` — manual per-split flow remains independent.
