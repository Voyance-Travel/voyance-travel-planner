## Decision

No new changes needed for the Draft-status symptom.

## Why

The chain is correctly diagnosed:

```
Missing Day 2 dinner
  → MEAL_COVERAGE_MISSING integrity code
  → resolveCommitGate returns persistVerdict.ok = false
  → itinerary_status = 'partial'
  → status stays 'draft'
  → UI shows "Draft" badge
```

The root cause is upstream (Day 2 dinner). The status field is behaving exactly as designed — it is a faithful signal that the commit gate did not pass.

## What happens once the dinner fix lands

The dinner-coverage repair already drafted in an earlier turn (freshen-up-without-dinner test + repair-day step) will make `persistVerdict.ok = true` on the next generation. The cascade:

1. `MEAL_COVERAGE_MISSING` no longer fires
2. `resolveCommitGate` returns ok
3. `nextStatus` evaluates to `'ready'` at the existing line ~1680
4. `status` flips off `'draft'` via the existing finalizer

No additional code changes, no migration, no soft-gate relaxation, no historical backfill. Existing trips stuck in `'partial'/'draft'` will heal the next time they are regenerated.

## Out of scope (explicitly rejected)

- Relaxing `resolveCommitGate` to treat `MEAL_COVERAGE_MISSING` as a warning — would let trips with genuinely missing dinners ship as `'ready'`.
- One-shot backfill flipping historical `'draft'` → `'ready'` — same risk, and only safe after we trust the dinner fix in production.

## Verification after dinner fix ships

- Generate a fresh Lisbon-style trip; confirm Day 2 has a dinner card after repair-day.
- Confirm `itinerary_status = 'ready'` and `status` is no longer `'draft'` on the resulting `trips` row.
- Spot-check the trip page: no yellow "draft" banner, no red "missing activities" banner.
