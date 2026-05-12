## Fix: Proof-of-charge gate rejects regenerate-trip day loop

### Root cause
`generate-itinerary`'s proof-of-charge gate maps `generate-day` → only `['regenerate_day', 'unlock_day']`. Full-trip regeneration (EditorialItinerary "Regenerate") records a single `regenerate_trip` charge, then loops calling `action: 'generate-day'` per day. Every day call is blocked with `No proof-of-charge … blocking`. Result: 90 credits × 3 reruns burned, zero generation, zero new logs from `[BOOKEND_VERIFY]`/`bookend_trace` because the pipeline never runs.

### Fix (single file, ~6 lines)
`supabase/functions/generate-itinerary/index.ts` — extend the action map:

```ts
const SPEND_ACTIONS_BY_EDGE: Record<string, string[]> = {
  'generate-trip':   ['trip_generation', 'regenerate_trip'],
  'generate-full':   ['trip_generation', 'regenerate_trip'],
  'regenerate-day':  ['regenerate_day', 'unlock_day', 'regenerate_trip', 'trip_generation'],
  'generate-day':    ['regenerate_day', 'unlock_day', 'regenerate_trip', 'trip_generation'],
};
```

Rationale:
- `regenerate_trip` is the umbrella charge that authorizes the full per-day loop — must satisfy `generate-day`.
- `trip_generation` is the umbrella for primary generation — also routes through `generate-day` in some chain paths; safe to accept.
- 10-minute window + same `tripId` + `pending|completed` status keeps the abuse surface unchanged.

### Verify
1. Trigger full-trip Regenerate in EditorialItinerary on the existing test trip.
2. Watch `generate-itinerary` edge logs for `Proof-of-charge OK: charge=… action=regenerate_trip` per day instead of `No proof-of-charge … blocking`.
3. Once a regen completes, query `trips.itinerary_data->'metadata'->'quality'->'bookend_trace'` for that trip — every non-departure day should now have a populated trace object instead of `null`. If `expected:true, persisted:false` appears, the `reason` field exposes which guard rejected injection.
4. If the trace shows the verification ran but the bookend still missing, that's the actual hotel-return bug — telemetry will finally point at the real culprit.

### Out of scope
- Not touching the bookend verification logic itself this pass — gate fix unblocks observability first, then real diagnosis follows.
- No client changes needed; idempotency key + tripId are already passed.
