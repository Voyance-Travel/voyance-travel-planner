ALTER TABLE public.trip_settlements
  ADD COLUMN IF NOT EXISTS settled_split_ids uuid[];

ALTER TABLE public.expense_splits
  ADD COLUMN IF NOT EXISTS paid_via_settlement uuid
  REFERENCES public.trip_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_splits_paid_via_settlement
  ON public.expense_splits(paid_via_settlement);