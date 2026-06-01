# Plan: Second backfill for mis-stamped 'failed' trips

## Decisions confirmed

- **Keep classifier threshold as-is**: `meaningfulCount < Math.max(2, dayCount)` in both `day-validation.ts:1397` and `itineraryCompleteness.ts:95`. Scaling floor correctly catches under-populated long trips that a flat `< 3` would miss. No code change.
- **Run one more backfill** targeting trips re-stamped between the first backfill and the new classifier deploy.

## The migration

One-shot SQL, idempotent, narrowly scoped:

```sql
UPDATE public.trips
SET
  itinerary_status = 'ready',
  metadata = metadata
    || jsonb_build_object(
      'generation_failure_reason', null,
      'empty_itinerary_detected_at', null,
      'incomplete_backfill_v2_at', now()
    )
WHERE itinerary_status = 'failed'
  AND metadata->>'generation_failure_reason' = 'incomplete_itinerary'
  AND metadata->>'itinerary_frozen_at' IS NOT NULL;
```

### Why these three predicates

- `itinerary_status = 'failed'` — only trips currently surfacing the red banner.
- `generation_failure_reason = 'incomplete_itinerary'` — exact stamp the broken classifier wrote; leaves any other failure reason (legitimate empties, AI errors, etc.) untouched.
- `itinerary_frozen_at IS NOT NULL` — proves the trip was actually finished and persisted; if it was never frozen, it really is incomplete and we should not heal it.

Stamping `incomplete_backfill_v2_at` makes the heal traceable and prevents accidental double-runs from showing up as a mystery later.

## Files touched

- One new SQL migration. No code changes.

## Out of scope

- Anne Frank House drop and "walk to airport" departure — still separate root causes, still need their own trace before patching.
