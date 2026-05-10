-- One-time backfill: delete expense_splits rows belonging to solo trips
DELETE FROM public.expense_splits es
WHERE EXISTS (
  SELECT 1 FROM public.trip_expenses te
  WHERE te.id = es.expense_id
    AND (
      SELECT count(*) FROM public.trip_members tm
      WHERE tm.trip_id = te.trip_id
    ) <= 1
);