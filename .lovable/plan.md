## R4 RLS Verification — Result

Inspected the live `public.profiles` SELECT policy `Users can view profiles of trip co-members`:

```sql
id IN (
  SELECT tm.user_id FROM trip_members tm
  WHERE tm.user_id IS NOT NULL
    AND tm.accepted_at IS NOT NULL          -- target side gated
    AND tm.trip_id IN (
      SELECT tm2.trip_id FROM trip_members tm2
      WHERE tm2.user_id = auth.uid()
        AND tm2.accepted_at IS NOT NULL     -- caller side gated
    )
)
```

Both sides of the JOIN require `accepted_at IS NOT NULL`. Matrix proof by construction:

| Caller | Target | Branch result | Expected | Pass |
|---|---|---|---|---|
| accepted | accepted | both EXISTS pass → row visible | 1 row | ✅ |
| pending  | accepted | caller `tm2` fails → empty | 0 rows | ✅ |
| accepted | pending  | target `tm` fails → empty | 0 rows | ✅ |
| pending  | pending  | both fail → empty | 0 rows | ✅ |

The pre-acceptance leak (both directions) is closed. No adjustment needed before merge — this is the final state.

## Audit Cycle: Closed

No further code or migration work proposed. Remaining items are pure launch-ops:

1. Final Supabase linter run (verification)
2. Fresh-city Madrid-style QA
3. Stripe E2E (Sections 1-6)
4. Beta-2 invite + feedback window
5. Launch

Standing by for the next signal — linter output, QA city pick, Stripe test trigger, or beta-2 copy draft.
